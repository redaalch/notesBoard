import axios from "axios";

const resolveBaseUrl = (): string => {
  const envUrl: string | undefined = import.meta.env.VITE_API_BASE_URL;

  if (envUrl) {
    // Relative paths ("/api") are always safe — same origin.
    if (envUrl.startsWith("/")) return envUrl;

    // Absolute URLs must match the current origin to prevent exfiltration
    // via a compromised build injecting an attacker-controlled base URL.
    try {
      const parsed = new URL(envUrl);
      if (parsed.origin === globalThis.location?.origin) return envUrl;
    } catch {
      // invalid URL — fall through to default
    }

    if (import.meta.env.DEV) {
      // In development, allow explicit localhost URLs for the API server.
      return envUrl;
    }

    // Production: reject untrusted absolute URL, fall back to /api.
    console.warn(
      "[axios] Ignoring untrusted VITE_API_BASE_URL in production:",
      envUrl,
    );
    return "/api";
  }

  return import.meta.env.MODE === "development"
    ? "http://localhost:5001/api"
    : "/api";
};

const BASE_URL = resolveBaseUrl();

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

export default api;
