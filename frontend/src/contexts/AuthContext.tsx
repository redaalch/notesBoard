import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "../lib/axios";
import { extractApiError } from "../lib/extractApiError";

import AuthContext, {
  type AuthUser,
  type AuthContextValue,
} from "./authContext";

// Token is kept in React state + Axios headers only (not localStorage) so that
// XSS scripts cannot read it via localStorage.getItem().
// Session is restored on every page load via the HttpOnly refresh-token cookie.

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  const applyAccessToken = useCallback((token: string | null) => {
    if (token) {
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
      setAccessToken(token);
    } else {
      delete api.defaults.headers.common.Authorization;
      setAccessToken(null);
    }
  }, []);

  const clearSession = useCallback(() => {
    applyAccessToken(null);
    setUser(null);
  }, [applyAccessToken]);

  const handleRefresh = useCallback(() => {
    if (!refreshPromiseRef.current) {
      refreshPromiseRef.current = (async (): Promise<string | null> => {
        try {
          const response = await api.post("/auth/refresh", undefined, {
            validateStatus: (status: number) =>
              status === 200 || status === 204 || status === 401,
          });

          if (response.status !== 200) {
            clearSession();
            return null;
          }

          const { accessToken: token, user: profile } =
            (response.data as { accessToken?: string; user?: AuthUser }) ?? {};

          if (!token) {
            throw new Error("Missing access token in refresh response");
          }

          applyAccessToken(token);
          if (profile) {
            setUser(profile);
          }

          return token;
        } catch (error) {
          clearSession();
          throw error;
        } finally {
          refreshPromiseRef.current = null;
        }
      })();
    }

    return refreshPromiseRef.current;
  }, [applyAccessToken, clearSession]);

  useEffect(() => {
    const boot = async () => {
      try {
        const token = await handleRefresh();
        if (!token) {
          clearSession();
        }
      } catch {
        clearSession();
      } finally {
        setInitializing(false);
      }
    };

    boot();
  }, [applyAccessToken, clearSession, handleRefresh]);

  useEffect(() => {
    const interceptorId = api.interceptors.response.use(
      (response) => response,
      async (error: unknown) => {
        const axiosError = error as {
          config?: {
            url?: string;
            _retry?: boolean;
            headers: Record<string, string>;
          };
          response?: { status?: number };
        };
        const originalRequest = axiosError.config;
        const status = axiosError.response?.status;
        const requestUrl = originalRequest?.url ?? "";
        const isAuthEndpoint =
          typeof requestUrl === "string" &&
          ([
            "/auth/login",
            "/auth/register",
            "/auth/refresh",
            "/auth/logout",
          ].some((path) => requestUrl.startsWith(path)) ||
            requestUrl.startsWith("/auth/password/"));

        if (status === 401 && !isAuthEndpoint && !originalRequest?._retry) {
          try {
            const newToken = await handleRefresh();
            if (!newToken) {
              clearSession();
              return Promise.reject(error);
            }

            originalRequest!._retry = true;
            originalRequest!.headers.Authorization = `Bearer ${newToken}`;
            return api(originalRequest!);
          } catch (refreshError) {
            clearSession();
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      },
    );

    return () => {
      api.interceptors.response.eject(interceptorId);
    };
  }, [clearSession, handleRefresh]);

  const login: AuthContextValue["login"] = useCallback(
    async ({ email, password }) => {
      try {
        const response = await api.post("/auth/login", { email, password });
        const { accessToken: token, user: profile } =
          (response.data as { accessToken?: string; user?: AuthUser }) ?? {};
        if (!token || !profile) {
          throw new Error("Malformed login response");
        }
        // Wipe the previous user's cached data so the new user never sees stale
        // queries from a different account.
        queryClient.clear();
        applyAccessToken(token);
        setUser(profile);
        toast.success(`Welcome back, ${profile.name}`);
        return profile;
      } catch (error: unknown) {
        const status = (error as { response?: { status?: number } })?.response
          ?.status;
        const message = extractApiError(
          error,
          "Failed to log in. Check credentials.",
        );
        if (status === 403) {
          toast.error(message || "Please verify your email before signing in.");
        } else {
          toast.error(message);
        }
        throw error;
      }
    },
    [applyAccessToken, queryClient],
  );

  const register: AuthContextValue["register"] = useCallback(
    async ({ name, email, password }) => {
      try {
        const response = await api.post("/auth/register", {
          name,
          email,
          password,
        });
        const message =
          (response.data as { message?: string })?.message ??
          "Please confirm your email address to finish signing up.";
        toast.success(message);
        return { message };
      } catch (error: unknown) {
        const data = (
          error as {
            response?: {
              data?: { errors?: { message?: string }[] };
            };
          } | null
        )?.response?.data;
        // Prefer the first field-specific validation message over the generic one
        const fieldMsg = data?.errors?.[0]?.message;
        const message =
          typeof fieldMsg === "string" && fieldMsg.length <= 200
            ? fieldMsg
            : extractApiError(error, "Registration failed. Try again.");
        toast.error(message);
        throw error;
      }
    },
    [],
  );

  const updateProfile: AuthContextValue["updateProfile"] = useCallback(
    async ({ name, email, currentPassword, verificationRedirectUrl }) => {
      try {
        const payload: Record<string, string> = {};
        if (name !== undefined) payload.name = name;
        if (email !== undefined) payload.email = email;
        if (currentPassword !== undefined) {
          payload.currentPassword = currentPassword;
        }
        if (verificationRedirectUrl !== undefined) {
          payload.verificationRedirectUrl = verificationRedirectUrl;
        }

        const response = await api.put("/auth/profile", payload);
        const {
          user: profile,
          accessToken: token,
          message,
        } = (response.data as {
          user?: AuthUser;
          accessToken?: string;
          message?: string;
        }) ?? {};

        if (token) {
          applyAccessToken(token);
        }

        if (profile) {
          setUser(profile);
        }

        toast.success(message ?? "Profile updated successfully");
        return (response.data as Record<string, unknown>) ?? {};
      } catch (error: unknown) {
        toast.error(extractApiError(error, "Failed to update your profile."));
        throw error;
      }
    },
    [applyAccessToken],
  );

  const changePassword: AuthContextValue["changePassword"] = useCallback(
    async ({ currentPassword, newPassword }) => {
      try {
        const response = await api.post("/auth/password/change", {
          currentPassword,
          newPassword,
        });

        const {
          user: profile,
          accessToken: token,
          message,
        } = (response.data as {
          user?: AuthUser;
          accessToken?: string;
          message?: string;
        }) ?? {};

        if (token) {
          applyAccessToken(token);
        }

        if (profile) {
          setUser(profile);
        }

        toast.success(message ?? "Password updated successfully");
        return (response.data as Record<string, unknown>) ?? {};
      } catch (error: unknown) {
        toast.error(extractApiError(error, "Failed to update password."));
        throw error;
      }
    },
    [applyAccessToken],
  );

  const resendVerificationEmail: AuthContextValue["resendVerificationEmail"] =
    useCallback(async ({ email, verificationRedirectUrl }) => {
      try {
        const response = await api.post("/auth/verify-email/resend", {
          email,
          verificationRedirectUrl,
        });
        const message =
          (response.data as { message?: string })?.message ??
          "If your account exists and isn't verified, we've sent a confirmation email.";
        toast.success(message);
        return { message };
      } catch (error: unknown) {
        toast.error(
          extractApiError(
            error,
            "Couldn't resend the verification email. Try again later.",
          ),
        );
        throw error;
      }
    }, []);

  const verifyEmail: AuthContextValue["verifyEmail"] = useCallback(
    async (token) => {
      try {
        const response = await api.post("/auth/verify-email", { token });
        const { accessToken: tokenValue, user: profile } =
          (response.data as { accessToken?: string; user?: AuthUser }) ?? {};
        if (!tokenValue || !profile) {
          throw new Error("Malformed verify email response");
        }
        applyAccessToken(tokenValue);
        setUser(profile);
        toast.success("Email confirmed! You're all set.");
        return profile;
      } catch (error: unknown) {
        toast.error(
          extractApiError(
            error,
            "Email verification failed. The link may have expired.",
          ),
        );
        throw error;
      }
    },
    [applyAccessToken],
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Ignore network errors on logout
    } finally {
      // Clear all cached queries so the next user session starts fresh.
      queryClient.clear();
      clearSession();
    }
  }, [clearSession, queryClient]);

  const value: AuthContextValue = useMemo(
    () => ({
      user,
      accessToken,
      initializing,
      login,
      register,
      updateProfile,
      changePassword,
      resendVerificationEmail,
      verifyEmail,
      logout,
      refresh: handleRefresh,
    }),
    [
      user,
      accessToken,
      initializing,
      login,
      register,
      updateProfile,
      changePassword,
      resendVerificationEmail,
      verifyEmail,
      logout,
      handleRefresh,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
