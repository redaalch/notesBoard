import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import { safeRedirectPath } from "../lib/safeRedirect";

interface RequireAuthProps {
  children: ReactNode;
}

function RequireAuth({ children }: RequireAuthProps) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base-200">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (!user) {
    const raw = `${location.pathname}${location.search}${location.hash}`;
    const redirectPath = safeRedirectPath(raw);
    return <Navigate to="/login" state={{ from: redirectPath }} replace />;
  }

  return children;
}

export default RequireAuth;
