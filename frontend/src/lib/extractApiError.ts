const MAX_MESSAGE_LENGTH = 200;
const UNSAFE_PATTERN = /(<\/?[a-z][\s\S]*>|^\s*at\s+\S+\s*\(|Error:|Traceback)/m;

/**
 * Extract a safe, user-facing error message from an Axios error response.
 *
 * - Only surfaces the backend `message` for validation/client errors (4xx).
 * - Returns the generic `fallback` for 5xx, network errors, or any response
 *   that looks like it might leak internal details (stack traces, long
 *   messages, HTML).
 * - Truncates to 200 chars to prevent UI overflow.
 */
export function extractApiError(
  error: unknown,
  fallback: string,
): string {
  const axiosError = error as {
    response?: { status?: number; data?: { message?: string } };
  } | null;

  const status = axiosError?.response?.status;
  const raw = axiosError?.response?.data?.message;

  const isServerError = typeof status === "number" && status >= 500;

  if (
    typeof raw === "string" &&
    raw.length > 0 &&
    raw.length <= MAX_MESSAGE_LENGTH &&
    !isServerError &&
    !UNSAFE_PATTERN.test(raw)
  ) {
    return raw;
  }

  return fallback;
}
