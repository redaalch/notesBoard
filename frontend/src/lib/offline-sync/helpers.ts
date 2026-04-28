import type { InternalAxiosRequestConfig } from "axios";
import api from "../axios";

export const NOTE_ID_REGEX = /\/api\/notes\/([0-9a-fA-F]{24})$/u;

export const isMongoId = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-fA-F]{24}$/u.test(value.trim());

export const generateOpId = (): string => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `op-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const normalizeNotebookId = (value: unknown): string | null => {
  if (!value) return null;
  const normalized = String(value).trim();
  if (normalized === "uncategorized" || normalized === "all") {
    return null;
  }
  return isMongoId(normalized) ? normalized : null;
};

export const normalizeUrl = (config: InternalAxiosRequestConfig): string => {
  const baseURL =
    config.baseURL ?? api.defaults.baseURL ?? window.location.origin;
  const requestURL = config.url ?? "";
  try {
    const url = new URL(requestURL, baseURL);
    if (config.params) {
      const params = new URLSearchParams(
        config.params as Record<string, string>,
      );
      params.forEach((value, key) => {
        url.searchParams.set(key, value);
      });
    }
    return url.toString();
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[offline] normalizeUrl failed", error);
    }
    return `${baseURL}${requestURL}`;
  }
};

export const toSerializable = (value: unknown): unknown => {
  if (value === undefined || value === null) return null;
  if (value instanceof FormData) {
    const entries: Record<string, FormDataEntryValue> = {};
    for (const [key, formValue] of value.entries()) {
      entries[key] = formValue;
    }
    return { formData: entries };
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[offline] value not serializable", value, error);
    }
    return value;
  }
};

export const normalizeTagsArray = (tags: unknown): string[] => {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((tag) =>
      typeof tag === "string"
        ? tag.trim().toLowerCase().replace(/\s+/g, " ")
        : "",
    )
    .filter(Boolean);
};

const PRECACHE_SHELLS = ["/app", "/create", "/profile"];

export const precacheShells = (): void => {
  if (!("serviceWorker" in navigator)) return;
  if (!navigator.serviceWorker.controller) return;
  navigator.serviceWorker.controller.postMessage({
    type: "PRECACHE_URLS",
    payload: { urls: PRECACHE_SHELLS },
  });
};
