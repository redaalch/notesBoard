import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";

// Must be declared before importing the module under test so vitest hoists
// the factory and the mocked module is resolved first.
vi.mock("../../lib/axios", () => ({
  default: {
    post: vi.fn(),
    put: vi.fn(),
    defaults: { headers: { common: {} } },
    interceptors: {
      response: {
        use: vi.fn(() => 1),
        eject: vi.fn(),
      },
    },
  },
}));

import { AuthProvider } from "../AuthContext";
import useAuth from "../../hooks/useAuth";
import api from "../../lib/axios";

const mockedApi = api as unknown as {
  post: Mock;
  put: Mock;
  defaults: { headers: { common: Record<string, string> } };
};

// ── Test helpers ────────────────────────────────────────────────────────────

const renderWithAuth = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{ui}</AuthProvider>
    </QueryClientProvider>,
  );
};

// Simple consumer components that expose specific auth context actions.

const LoginConsumer = ({
  onResult,
}: {
  onResult: (v: unknown) => void;
}) => {
  const { login, user } = useAuth();
  return (
    <div>
      <span data-testid="user-name">{user?.name ?? "none"}</span>
      <button
        type="button"
        onClick={() =>
          login({ email: "ada@example.com", password: "Secure123!" })
            .then(onResult)
            .catch(onResult)
        }
      >
        login
      </button>
    </div>
  );
};

const RegisterConsumer = ({
  onResult,
}: {
  onResult: (v: unknown) => void;
}) => {
  const { register } = useAuth();
  return (
    <button
      type="button"
      onClick={() =>
        register({
          name: "Ada",
          email: "ada@example.com",
          password: "Secure123!",
        })
          .then(onResult)
          .catch(onResult)
      }
    >
      register
    </button>
  );
};

const LogoutConsumer = ({
  onDone,
}: {
  onDone: () => void;
}) => {
  const { logout } = useAuth();
  return (
    <button
      type="button"
      onClick={() => logout().then(onDone).catch(onDone)}
    >
      logout
    </button>
  );
};

// The boot sequence calls api.post('/auth/refresh') immediately on mount.
// Mocking it to return a 401-like response causes the boot to fail cleanly,
// leaving the session cleared so subsequent test actions start from scratch.
const mockBootFailure = () =>
  mockedApi.post.mockResolvedValueOnce({ status: 401, data: {} });

// ── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  mockedApi.post.mockReset();
  mockedApi.put.mockReset();
  // Clean up the Authorization header mutated by applyAccessToken.
  Object.keys(mockedApi.defaults.headers.common).forEach((key) => {
    delete (mockedApi.defaults.headers.common as Record<string, string>)[key];
  });
});

// ── login ───────────────────────────────────────────────────────────────────

describe("login", () => {
  it("sets user state and Authorization header on success", async () => {
    mockBootFailure();
    mockedApi.post.mockResolvedValueOnce({
      data: {
        accessToken: "tok-abc",
        user: { id: "u1", name: "Ada Lovelace", email: "ada@example.com" },
      },
    });

    const onResult = vi.fn();
    renderWithAuth(<LoginConsumer onResult={onResult} />);

    await userEvent.click(await screen.findByRole("button", { name: "login" }));

    await waitFor(() =>
      expect(onResult).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Ada Lovelace" }),
      ),
    );

    expect(screen.getByTestId("user-name").textContent).toBe("Ada Lovelace");
    expect(mockedApi.defaults.headers.common["Authorization"]).toBe(
      "Bearer tok-abc",
    );
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining("Ada Lovelace"),
    );
  });

  it("toasts the server error message on a 401 response", async () => {
    mockBootFailure();
    mockedApi.post.mockRejectedValueOnce({
      response: {
        status: 401,
        data: { message: "Invalid credentials." },
      },
    });

    const onResult = vi.fn();
    renderWithAuth(<LoginConsumer onResult={onResult} />);

    await userEvent.click(await screen.findByRole("button", { name: "login" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Invalid credentials."),
    );
  });

  it("shows the 403 message for unverified email responses", async () => {
    mockBootFailure();
    mockedApi.post.mockRejectedValueOnce({
      response: {
        status: 403,
        data: { message: "Please verify your email before signing in." },
      },
    });

    const onResult = vi.fn();
    renderWithAuth(<LoginConsumer onResult={onResult} />);

    await userEvent.click(await screen.findByRole("button", { name: "login" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Please verify your email before signing in.",
      ),
    );
  });

  it("re-throws the error so callers can handle it", async () => {
    mockBootFailure();
    mockedApi.post.mockRejectedValueOnce({
      response: { status: 401, data: { message: "Bad credentials." } },
    });

    const onResult = vi.fn();
    renderWithAuth(<LoginConsumer onResult={onResult} />);

    await userEvent.click(await screen.findByRole("button", { name: "login" }));

    await waitFor(() =>
      expect(onResult).toHaveBeenCalledWith(
        expect.objectContaining({
          response: expect.objectContaining({ status: 401 }),
        }),
      ),
    );
  });
});

// ── register ─────────────────────────────────────────────────────────────────

describe("register", () => {
  it("toasts success and resolves with the server message", async () => {
    mockBootFailure();
    mockedApi.post.mockResolvedValueOnce({
      data: { message: "Check your inbox to confirm your email." },
    });

    const onResult = vi.fn();
    renderWithAuth(<RegisterConsumer onResult={onResult} />);

    await userEvent.click(
      await screen.findByRole("button", { name: "register" }),
    );

    await waitFor(() =>
      expect(onResult).toHaveBeenCalledWith({
        message: "Check your inbox to confirm your email.",
      }),
    );
    expect(toast.success).toHaveBeenCalledWith(
      "Check your inbox to confirm your email.",
    );
  });

  it("toasts the first field-specific validation error on 400", async () => {
    mockBootFailure();
    mockedApi.post.mockRejectedValueOnce({
      response: {
        data: {
          message: "Validation failed",
          errors: [
            {
              field: "password",
              message:
                "Password must have at least 8 characters with upper & lowercase and a number.",
            },
          ],
        },
      },
    });

    const onResult = vi.fn();
    renderWithAuth(<RegisterConsumer onResult={onResult} />);

    await userEvent.click(
      await screen.findByRole("button", { name: "register" }),
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Password must have at least 8 characters with upper & lowercase and a number.",
      ),
    );
  });

  it("falls back to data.message when no errors array is present", async () => {
    mockBootFailure();
    mockedApi.post.mockRejectedValueOnce({
      response: {
        data: { message: "An account with that email already exists." },
      },
    });

    const onResult = vi.fn();
    renderWithAuth(<RegisterConsumer onResult={onResult} />);

    await userEvent.click(
      await screen.findByRole("button", { name: "register" }),
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "An account with that email already exists.",
      ),
    );
  });

  it("uses a generic fallback when the error response has no message", async () => {
    mockBootFailure();
    mockedApi.post.mockRejectedValueOnce({ response: { data: {} } });

    const onResult = vi.fn();
    renderWithAuth(<RegisterConsumer onResult={onResult} />);

    await userEvent.click(
      await screen.findByRole("button", { name: "register" }),
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Registration failed. Try again."),
    );
  });
});

// ── logout ───────────────────────────────────────────────────────────────────

describe("logout", () => {
  it("calls the logout endpoint and clears the session", async () => {
    // Boot: succeed (simulates a logged-in session)
    mockedApi.post
      .mockResolvedValueOnce({
        status: 200,
        data: {
          accessToken: "tok-boot",
          user: { id: "u1", name: "Ada", email: "ada@example.com" },
        },
      })
      // Logout endpoint
      .mockResolvedValueOnce({ data: {} });

    const onDone = vi.fn();
    renderWithAuth(<LogoutConsumer onDone={onDone} />);

    await userEvent.click(
      await screen.findByRole("button", { name: "logout" }),
    );

    await waitFor(() => expect(onDone).toHaveBeenCalled());

    // Authorization header must be cleared after logout
    expect(
      mockedApi.defaults.headers.common["Authorization"],
    ).toBeUndefined();
    expect(localStorage.getItem("notesboard.accessToken")).toBeNull();
  });

  it("clears the session even when the logout endpoint fails", async () => {
    mockBootFailure();
    mockedApi.post.mockRejectedValueOnce(new Error("Network error"));

    const onDone = vi.fn();
    renderWithAuth(<LogoutConsumer onDone={onDone} />);

    await userEvent.click(
      await screen.findByRole("button", { name: "logout" }),
    );

    // logout swallows network errors — onDone resolves either way
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });
});
