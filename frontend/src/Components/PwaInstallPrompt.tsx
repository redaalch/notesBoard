import { useEffect, useState } from "react";
import { DownloadIcon, XIcon, WifiOffIcon } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISS_KEY = "notesboard.pwa.install.dismissed";
const DISMISS_DAYS = 14;

const isDismissedRecently = (): boolean => {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const dismissedAt = Number.parseInt(raw, 10);
    if (Number.isNaN(dismissedAt)) return false;
    const ageMs = Date.now() - dismissedAt;
    return ageMs < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
};

const isRunningAsInstalledPwa = (): boolean => {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (
      window.navigator as Navigator & { standalone?: boolean }
    ).standalone === true
  );
};

const PwaInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );

  useEffect(() => {
    if (isRunningAsInstalledPwa()) return;
    if (isDismissedRecently()) return;

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const handleInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  useEffect(() => {
    const updateOnline = () => setIsOffline(!navigator.onLine);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "dismissed") {
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
      }
    } catch {
      // silently ignore; some browsers throw if already consumed
    }
    setDeferredPrompt(null);
    setVisible(false);
  };

  const handleDismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // storage may be unavailable in private mode
    }
  };

  return (
    <>
      {isOffline && (
        <div className="fixed top-2 left-1/2 z-[9998] -translate-x-1/2 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-warning/90 px-3 py-1 text-xs font-medium text-warning-content shadow-lg backdrop-blur">
            <WifiOffIcon className="size-3.5" />
            You're offline — edits will sync when you reconnect
          </div>
        </div>
      )}
      {visible && deferredPrompt && (
        <div className="fixed bottom-4 left-1/2 z-[9997] -translate-x-1/2 w-[calc(100%-1rem)] max-w-md pointer-events-none">
          <div className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-base-content/10 bg-base-100 p-3 shadow-2xl">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <DownloadIcon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Install NotesBoard</p>
              <p className="text-xs text-base-content/60">
                Add to your home screen for a faster, offline-capable
                experience.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="btn btn-primary btn-xs"
                  onClick={handleInstall}
                >
                  Install
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={handleDismiss}
                >
                  Not now
                </button>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-circle"
              onClick={handleDismiss}
              aria-label="Dismiss install prompt"
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default PwaInstallPrompt;
