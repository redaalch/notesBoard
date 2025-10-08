import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftIcon, LoaderIcon, MailIcon } from "lucide-react";
import toast from "react-hot-toast";
import api from "../lib/axios.js";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    try {
      const redirectUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/reset-password`
          : undefined;

      await api.post("/auth/password/forgot", {
        email,
        ...(redirectUrl ? { redirectUrl } : {}),
      });

      setSent(true);
      setSubmittedEmail(email);
      toast.success(
        "If an account exists, you'll receive a reset email shortly."
      );
    } catch (error) {
      const message =
        error?.response?.data?.message ??
        "We couldn't send the reset email. Please try again.";
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
                <h1 className="text-2xl font-semibold">Reset your password</h1>
                <p className="text-base-content/70 text-sm">
                  Enter the email associated with your account. We'll send a
                  link to create a new password.
                </p>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <label className="form-control">
                  <span className="label">
                    <span className="label-text">Email address</span>
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="input input-bordered"
                    required
                    autoComplete="email"
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
                      Sending reset link...
                    </>
                  ) : (
                    <>
                      <MailIcon className="size-4" />
                      Email me a reset link
                    </>
                  )}
                </button>
              </form>

              {sent ? (
                <div className="alert alert-success text-sm">
                  <span>
                    If an account exists for <strong>{submittedEmail}</strong>,
                    you'll receive an email with further instructions shortly.
                  </span>
                </div>
              ) : null}

              <div className="text-center text-sm text-base-content/70 space-y-1">
                <p>
                  Remembered your password?{" "}
                  <Link to="/login" className="link link-primary">
                    Sign in instead
                  </Link>
                </p>
                <p>
                  Need a new account?{" "}
                  <Link to="/register" className="link link-primary">
                    Create one now
                  </Link>
                </p>
              </div>
            </div>
          </div>

          <Link
            to="/login"
            className="mt-6 inline-flex items-center gap-2 text-sm text-base-content/70 hover:text-base-content transition"
          >
            <ArrowLeftIcon className="size-4" />
            Back to sign in
          </Link>
        </div>
      </main>
    </div>
  );
};

export default ForgotPasswordPage;
