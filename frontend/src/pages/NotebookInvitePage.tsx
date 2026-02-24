import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  LoaderIcon,
  XCircleIcon,
} from "lucide-react";
import { toast } from "sonner";
import api from "../lib/axios";

type InviteStatus = "loading" | "success" | "expired" | "error";

interface StatusCopy {
  title: string;
  description: string;
}

const STATUS_COPY: Record<InviteStatus, StatusCopy> = {
  loading: {
    title: "Accepting invitation…",
    description: "We're validating your invite and preparing the notebook.",
  },
  success: {
    title: "You're in!",
    description:
      "Your access has been activated. Head to the notebook to start collaborating.",
  },
  expired: {
    title: "Invitation expired",
    description:
      "This invite has expired or was revoked. Ask the sender for a new link.",
  },
  error: {
    title: "Something went wrong",
    description:
      "We couldn't accept this invitation. Try again or contact the notebook owner.",
  },
};

function NotebookInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const notebookIdFromUrl = searchParams.get("notebookId");
  const navigate = useNavigate();
  const [status, setStatus] = useState<InviteStatus>(
    token ? "loading" : "error",
  );
  const [message, setMessage] = useState("");
  const [notebookId, setNotebookId] = useState<string | null>(
    notebookIdFromUrl ?? null,
  );

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage(
        "An invitation token is required. Check the link you received and try again.",
      );
      return;
    }

    let cancelled = false;

    const acceptInvitation = async () => {
      setStatus("loading");
      try {
        const response = await api.post("/notebooks/invitations/accept", {
          token,
        });
        if (cancelled) return;
        setStatus("success");
        const body = response?.data ?? {};
        if (body.message) {
          setMessage(body.message as string);
        }
        if (body.notebookId) {
          setNotebookId(body.notebookId as string);
        }
        toast.success("Notebook invitation accepted");
      } catch (error: any) {
        if (cancelled) return;
        const errorMessage =
          error?.response?.data?.message ??
          "We couldn't accept this invitation.";
        if (error?.response?.status === 410) {
          setStatus("expired");
        } else {
          setStatus("error");
        }
        setMessage(errorMessage);
        toast.error(errorMessage);
      }
    };

    acceptInvitation();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const copy = useMemo(
    () => STATUS_COPY[status] ?? STATUS_COPY.error,
    [status],
  );
  const finalMessage = message || copy.description;
  const showGoButton = status === "success";

  const handleNavigateHome = () => {
    navigate("/app", { replace: true });
  };

  const handleNavigateNotebook = () => {
    if (notebookId) {
      navigate(`/app?notebook=${encodeURIComponent(notebookId)}`, {
        replace: true,
      });
    } else {
      handleNavigateHome();
    }
  };

  const Icon =
    status === "success"
      ? CheckCircleIcon
      : status === "loading"
        ? LoaderIcon
        : XCircleIcon;

  return (
    <div className="min-h-screen bg-base-200">
      <main
        id="main-content"
        tabIndex={-1}
        className="flex min-h-screen items-center justify-center px-4 py-12"
      >
        <div className="w-full max-w-md">
          <div className="card bg-base-100 shadow-xl border border-base-300/60">
            <div className="card-body space-y-6">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={handleNavigateHome}
                >
                  <ArrowLeftIcon className="size-4" />
                  Back to notes
                </button>
              </div>

              <div className="space-y-3 text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon
                    className={`size-7 ${
                      status === "loading" ? "animate-spin" : ""
                    }`}
                  />
                </div>
                <h1 className="text-2xl font-semibold text-base-content">
                  {copy.title}
                </h1>
                <p className="text-sm text-base-content/70">{finalMessage}</p>
              </div>

              {status === "loading" ? (
                <div className="flex items-center justify-center text-sm text-base-content/60">
                  <LoaderIcon className="size-4 animate-spin" /> Validating
                  invite…
                </div>
              ) : null}

              <div className="space-y-3">
                {showGoButton ? (
                  <button
                    type="button"
                    className="btn btn-primary w-full gap-2"
                    onClick={handleNavigateNotebook}
                  >
                    Continue to notebook
                    <ArrowRightIcon className="size-4" />
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-outline w-full"
                  onClick={handleNavigateHome}
                >
                  Go to dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default NotebookInvitePage;
