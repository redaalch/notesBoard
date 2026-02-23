import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircleIcon, LoaderIcon, LockIcon } from "lucide-react";
import { toast } from "sonner";
import api from "../lib/axios";

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);

  const tokenMissing = !token;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    if (tokenMissing) {
      toast.error("Your reset link is missing a token.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/password/reset", { token, password });
      setCompleted(true);
      setPassword("");
      setConfirmPassword("");
      toast.success("Password updated. You can now sign in.");
    } catch (error) {
      const message =
        error?.response?.data?.message ??
        "We couldn't reset your password. Please request a new link.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-200">
      <main
        id="main-content"
        tabIndex={-1}
        className="flex min-h-screen items-center justify-center px-4 py-12"
      >
        <div className="w-full max-w-md">
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body space-y-6">
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-semibold">
                  Choose a new password
                </h1>
                <p className="text-base-content/70 text-sm">
                  Create a strong password to keep your notes secure.
                </p>
              </div>

              {tokenMissing ? (
                <div className="alert alert-warning text-sm">
                  <span>
                    This reset link is missing the security token. Request a new
                    link from the {""}
                    <Link to="/forgot-password" className="link link-secondary">
                      password reset page
                    </Link>
                    .
                  </span>
                </div>
              ) : completed ? (
                <div className="space-y-4 text-center">
                  <div className="inline-flex size-16 items-center justify-center rounded-full bg-success/10 text-success">
                    <CheckCircleIcon className="size-8" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold">Password updated</h2>
                    <p className="text-sm text-base-content/70">
                      You're all set. You can now sign in with your new
                      password.
                    </p>
                  </div>
                  <Link to="/login" className="btn btn-primary w-full">
                    Go to sign in
                  </Link>
                </div>
              ) : (
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <label className="form-control">
                    <span className="label">
                      <span className="label-text">New password</span>
                    </span>
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="8+ characters with a mix of letters & numbers"
                      className="input input-bordered"
                      required
                      autoComplete="new-password"
                      disabled={loading}
                    />
                  </label>

                  <label className="form-control">
                    <span className="label">
                      <span className="label-text">Confirm password</span>
                    </span>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                      placeholder="Re-enter your new password"
                      className="input input-bordered"
                      required
                      autoComplete="new-password"
                      disabled={loading}
                    />
                  </label>

                  <button
                    type="submit"
                    className="btn btn-primary w-full"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <LoaderIcon className="size-4 animate-spin" />
                        Updating password...
                      </>
                    ) : (
                      <>
                        <LockIcon className="size-4" />
                        Update password
                      </>
                    )}
                  </button>
                </form>
              )}

              <div className="text-center text-sm text-base-content/70 space-y-1">
                <p>
                  Need a new link?{" "}
                  <Link to="/forgot-password" className="link link-primary">
                    Request another reset email
                  </Link>
                </p>
                <p>
                  Remember your password?{" "}
                  <Link to="/login" className="link link-primary">
                    Head back to sign in
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ResetPasswordPage;
