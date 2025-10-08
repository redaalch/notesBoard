import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import api from "../lib/axios.js";

import AuthContext from "./authContext.js";
const ACCESS_TOKEN_KEY = "notesboard.accessToken";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const refreshPromiseRef = useRef(null);

  const applyAccessToken = useCallback((token) => {
    if (token) {
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
      localStorage.setItem(ACCESS_TOKEN_KEY, token);
      setAccessToken(token);
    } else {
      delete api.defaults.headers.common.Authorization;
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      setAccessToken(null);
    }
  }, []);

  const clearSession = useCallback(() => {
    applyAccessToken(null);
    setUser(null);
  }, [applyAccessToken]);

  const handleRefresh = useCallback(() => {
    if (!refreshPromiseRef.current) {
      refreshPromiseRef.current = (async () => {
        try {
          const response = await api.post("/auth/refresh", undefined, {
            validateStatus: (status) =>
              status === 200 || status === 204 || status === 401,
          });

          if (response.status !== 200) {
            clearSession();
            return null;
          }

          const { accessToken: token, user: profile } = response.data ?? {};

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
    const storedToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (storedToken) {
      applyAccessToken(storedToken);
    }

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
      async (error) => {
        const originalRequest = error.config;
        const status = error.response?.status;
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

            originalRequest._retry = true;
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return api(originalRequest);
          } catch (refreshError) {
            clearSession();
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.response.eject(interceptorId);
    };
  }, [clearSession, handleRefresh]);

  const login = useCallback(
    async ({ email, password }) => {
      try {
        const response = await api.post("/auth/login", { email, password });
        const { accessToken: token, user: profile } = response.data ?? {};
        if (!token || !profile) {
          throw new Error("Malformed login response");
        }
        applyAccessToken(token);
        setUser(profile);
        toast.success(`Welcome back, ${profile.name}`);
        return profile;
      } catch (error) {
        const status = error.response?.status;
        const message =
          error.response?.data?.message ??
          "Failed to log in. Check credentials.";
        if (status === 403) {
          toast.error(message || "Please verify your email before signing in.");
        } else {
          toast.error(message);
        }
        throw error;
      }
    },
    [applyAccessToken]
  );

  const register = useCallback(async ({ name, email, password }) => {
    try {
      const response = await api.post("/auth/register", {
        name,
        email,
        password,
      });
      const message =
        response.data?.message ??
        "Please confirm your email address to finish signing up.";
      toast.success(message);
      return { message };
    } catch (error) {
      const message =
        error.response?.data?.message ?? "Registration failed. Try again.";
      toast.error(message);
      throw error;
    }
  }, []);

  const resendVerificationEmail = useCallback(
    async ({ email, verificationRedirectUrl }) => {
      try {
        const response = await api.post("/auth/verify-email/resend", {
          email,
          verificationRedirectUrl,
        });
        const message =
          response.data?.message ??
          "If your account exists and isn't verified, we've sent a confirmation email.";
        toast.success(message);
        return { message };
      } catch (error) {
        const message =
          error.response?.data?.message ??
          "Couldn't resend the verification email. Try again later.";
        toast.error(message);
        throw error;
      }
    },
    []
  );

  const verifyEmail = useCallback(
    async (token) => {
      try {
        const response = await api.post("/auth/verify-email", { token });
        const { accessToken: tokenValue, user: profile } = response.data ?? {};
        if (!tokenValue || !profile) {
          throw new Error("Malformed verify email response");
        }
        applyAccessToken(tokenValue);
        setUser(profile);
        toast.success("Email confirmed! You're all set.");
        return profile;
      } catch (error) {
        const message =
          error.response?.data?.message ??
          "Email verification failed. The link may have expired.";
        toast.error(message);
        throw error;
      }
    },
    [applyAccessToken]
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Ignore network errors on logout
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      initializing,
      login,
      register,
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
      resendVerificationEmail,
      verifyEmail,
      logout,
      handleRefresh,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
