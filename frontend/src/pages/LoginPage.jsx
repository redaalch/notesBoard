import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogInIcon, LoaderIcon } from "lucide-react";
import useAuth from "../hooks/useAuth.js";

const LoginPage = () => {
  const { login, user, initializing } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!initializing && user) {
      const redirectTo = location.state?.from ?? "/";
      navigate(redirectTo, { replace: true });
    }
  }, [user, initializing, navigate, location.state]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      await login({ email, password });
      const redirectTo = location.state?.from ?? "/";
      navigate(redirectTo, { replace: true });
    } catch {
      // error handled by auth hook toast
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center px-4 py-12">
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
                  onChange={(event) => setEmail(event.target.value)}
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
                  onChange={(event) => setPassword(event.target.value)}
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
    </div>
  );
};

export default LoginPage;
