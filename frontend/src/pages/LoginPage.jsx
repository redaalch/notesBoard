import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogInIcon, LoaderIcon, MailCheckIcon } from "lucide-react";
import useAuth from "../hooks/useAuth";

const LoginPage = () => {
  const { login, user, initializing, resendVerificationEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingVerificationEmail, setPendingVerificationEmail] =
    useState(null);
  const [resendLoading, setResendLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!initializing && user) {
      const redirectTo = location.state?.from ?? "/app";
      navigate(redirectTo, { replace: true });
    }
  }, [user, initializing, navigate, location.state]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;
    setErrorMessage("");
    setPendingVerificationEmail(null);
    setLoading(true);
    try {
      await login({ email, password });
      const redirectTo = location.state?.from ?? "/app";
      navigate(redirectTo, { replace: true });
    } catch (error) {
      const message =
        error?.response?.data?.message ?? "Invalid email or password.";
      setErrorMessage(message);
      if (error?.response?.status === 403) {
        setPendingVerificationEmail(email.trim());
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!pendingVerificationEmail || resendLoading) {
      return;
    }

    setResendLoading(true);
    try {
      await resendVerificationEmail({ email: pendingVerificationEmail });
    } finally {
      setResendLoading(false);
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
                <h1 className="text-2xl font-semibold">Welcome back</h1>
                <p className="text-base-content/70 text-sm">
                  Sign in to access your notes and continue where you left off.
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
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (errorMessage) setErrorMessage("");
                      if (pendingVerificationEmail) {
                        setPendingVerificationEmail(null);
                      }
                    }}
                    placeholder="you@example.com"
                    className="input input-bordered"
                    required
                    autoComplete="email"
                  />
                </label>

                <label className="form-control">
                  <span className="label">
                    <span className="label-text">Password</span>
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      if (errorMessage) setErrorMessage("");
                    }}
                    placeholder="••••••••"
                    className="input input-bordered"
                    required
                    autoComplete="current-password"
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
                      Signing in...
                    </>
                  ) : (
                    <>
                      <LogInIcon className="size-4" />
                      Sign in
                    </>
                  )}
                </button>
                {errorMessage ? (
                  <div className="alert alert-error text-sm" role="alert">
                    <span>{errorMessage}</span>
                  </div>
                ) : null}

                {pendingVerificationEmail ? (
                  <div className="alert alert-warning text-sm" role="alert">
                    <div className="flex flex-col gap-2">
                      <span>
                        It looks like your email still needs confirmation. We'll
                        resend the verification link to{" "}
                        <span className="font-semibold">
                          {pendingVerificationEmail}
                        </span>
                        .
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm self-start border-base-content/40 bg-base-100 text-base-content shadow-sm transition hover:border-base-content/70 hover:bg-base-100/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-base-content disabled:cursor-not-allowed disabled:opacity-70"
                        onClick={handleResendVerification}
                        disabled={resendLoading}
                      >
                        {resendLoading ? (
                          <>
                            <LoaderIcon className="size-4 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <MailCheckIcon className="size-4" />
                            Resend verification email
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : null}
              </form>

              <p className="text-center text-sm text-base-content/70">
                Forgot your password?{" "}
                <Link to="/forgot-password" className="link link-primary">
                  Reset it here
                </Link>
              </p>

              <p className="text-center text-sm text-base-content/70">
                Need an account?{" "}
                <Link to="/register" className="link link-primary">
                  Create one here
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
