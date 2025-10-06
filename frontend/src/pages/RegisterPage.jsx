import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LoaderIcon, UserPlusIcon } from "lucide-react";
import useAuth from "../hooks/useAuth.js";

const RegisterPage = () => {
  const { register, user, initializing } = useAuth();
  const [name, setName] = useState("");
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
      await register({ name, email, password });
      const redirectTo = location.state?.from ?? "/";
      navigate(redirectTo, { replace: true });
    } catch {
      // handled via toast
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
              <h1 className="text-2xl font-semibold">Create your workspace</h1>
              <p className="text-base-content/70 text-sm">
                A few quick details and your notes will sync across devices.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="form-control">
                <span className="label">
                  <span className="label-text">Full name</span>
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ada Lovelace"
                  className="input input-bordered"
                  required
                  autoComplete="name"
                />
              </label>

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
                  placeholder="8+ characters with a mix of letters & numbers"
                  className="input input-bordered"
                  required
                  autoComplete="new-password"
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
                    Creating account...
                  </>
                ) : (
                  <>
                    <UserPlusIcon className="size-4" />
                    Sign up
                  </>
                )}
              </button>
            </form>

            <p className="text-center text-sm text-base-content/70">
              Already have an account?{" "}
              <Link to="/login" className="link link-primary">
                Sign in instead
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
