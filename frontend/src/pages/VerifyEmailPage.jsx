import { useEffect, useMemo, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  LoaderIcon,
  MailCheckIcon,
  ShieldCheckIcon,
  RotateCcwIcon,
} from "lucide-react";
import useAuth from "../hooks/useAuth";

const VerifyEmailPage = () => {
  const { verifyEmail, user, initializing } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const token = searchParams.get("token");
  const emailFromQuery = searchParams.get("email") ?? location.state?.email;
  const pendingEmail = useMemo(() => {
    if (typeof emailFromQuery !== "string") return "";
    return emailFromQuery.trim().toLowerCase();
  }, [emailFromQuery]);

  const nextParam = searchParams.get("next") ?? location.state?.next;
  const nextPath = useMemo(() => {
    if (typeof nextParam === "string" && nextParam.startsWith("/")) {
      return nextParam;
    }
    return "/app";
  }, [nextParam]);

  const [status, setStatus] = useState(token ? "verifying" : "instructions");
  const [errorMessage, setErrorMessage] = useState("");
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    const timeoutId = setTimeout(async () => {
      setStatus("verifying");
      try {
        await verifyEmail(token);
        if (cancelled) return;
        setStatus("success");
        setTimeout(() => {
          navigate(nextPath, { replace: true });
        }, 1200);
      } catch (error) {
        if (cancelled) return;
        const message =
          error.response?.data?.message ??
          "We couldn't verify your email. The link may have expired.";
        setErrorMessage(message);
        setStatus("error");
      }
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [token, verifyEmail, navigate, nextPath]);

  useEffect(() => {
    if (!token && !initializing && user) {
      navigate(nextPath, { replace: true });
    }
  }, [token, user, initializing, navigate, nextPath]);

  const instructionMessage = pendingEmail
    ? `We sent a confirmation link to ${pendingEmail}.`
    : "Check your inbox for our confirmation email.";

  const retryVerification = async () => {
    if (!token) return;
    setRetrying(true);
    try {
      await verifyEmail(token);
      setStatus("success");
      setTimeout(() => {
        navigate(nextPath, { replace: true });
      }, 1200);
    } catch (error) {
      const message =
        error.response?.data?.message ??
        "We couldn't verify your email. The link may have expired.";
      setErrorMessage(message);
      setStatus("error");
    } finally {
      setRetrying(false);
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
            <div className="card-body space-y-6 text-center">
              {status === "instructions" && (
                <>
                  <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <MailCheckIcon className="size-7" />
                  </div>
                  <h1 className="text-2xl font-semibold">Confirm your email</h1>
                  <p className="text-base-content/70">
                    {instructionMessage} It may take a minute to arrive. Be sure
                    to check your spam or promotions folder if you don&apos;t
                    see it.
                  </p>
                  <div className="space-y-3">
                    <p className="text-sm text-base-content/60">
                      When you find the email, click the confirmation button
                      inside to activate your account.
                    </p>
                    <Link to="/login" className="btn btn-outline w-full">
                      Back to sign in
                    </Link>
                  </div>
                </>
              )}

              {status === "verifying" && (
                <>
                  <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <LoaderIcon className="size-7 animate-spin" />
                  </div>
                  <h1 className="text-2xl font-semibold">
                    Verifying your email
                  </h1>
                  <p className="text-base-content/70">
                    Hold tight while we confirm your email address.
                  </p>
                </>
              )}

              {status === "success" && (
                <>
                  <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-success/10 text-success">
                    <ShieldCheckIcon className="size-7" />
                  </div>
                  <h1 className="text-2xl font-semibold">Email confirmed</h1>
                  <p className="text-base-content/70">
                    You&apos;re all set! We&apos;re redirecting you to your
                    workspace.
                  </p>
                  <p className="text-sm text-base-content/60">
                    If nothing happens, you can continue manually below.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary w-full"
                    onClick={() => navigate(nextPath, { replace: true })}
                  >
                    Go to NotesBoard
                  </button>
                </>
              )}

              {status === "error" && (
                <>
                  <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-error/10 text-error">
                    <RotateCcwIcon className="size-7" />
                  </div>
                  <h1 className="text-2xl font-semibold">
                    Verification failed
                  </h1>
                  <p className="text-base-content/70">{errorMessage}</p>
                  <p className="text-sm text-base-content/60">
                    Need a new link? Head back to the register page and sign up
                    again with the same email to receive a fresh confirmation
                    email.
                  </p>
                  {token && (
                    <button
                      type="button"
                      className="btn btn-outline w-full"
                      onClick={retryVerification}
                      disabled={retrying}
                    >
                      {retrying ? (
                        <>
                          <LoaderIcon className="size-4 animate-spin" />{" "}
                          Re-trying
                        </>
                      ) : (
                        <>Try again</>
                      )}
                    </button>
                  )}
                  <Link to="/register" className="btn btn-primary w-full">
                    Back to sign up
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default VerifyEmailPage;
