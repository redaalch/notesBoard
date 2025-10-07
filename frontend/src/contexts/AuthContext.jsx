import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
          const response = await api.post("/auth/refresh");
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
        await handleRefresh();
      } catch {
        // Ignore errors; user will be required to login
      } finally {
        setInitializing(false);
      }
    };

    boot();
  }, [applyAccessToken, handleRefresh]);

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
        const message =
          error.response?.data?.message ??
          "Failed to log in. Check credentials.";
        toast.error(message);
        throw error;
      }
    },
    [applyAccessToken]
  );

  const register = useCallback(
    async ({ name, email, password }) => {
      try {
        const response = await api.post("/auth/register", {
          name,
          email,
          password,
        });
        const { accessToken: token, user: profile } = response.data ?? {};
        if (!token || !profile) {
          throw new Error("Malformed register response");
        }
        applyAccessToken(token);
        setUser(profile);
        toast.success("Account created. You're all set!");
        return profile;
      } catch (error) {
        const message =
          error.response?.data?.message ?? "Registration failed. Try again.";
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
      logout,
      refresh: handleRefresh,
    }),
    [user, accessToken, initializing, login, register, logout, handleRefresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
