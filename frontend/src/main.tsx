import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { CommandPaletteProvider } from "./contexts/CommandPaletteContext";
import { OfflineSyncProvider } from "./contexts/OfflineSyncContext";
import { syncServiceWorkerRegistration } from "./lib/serviceWorkerLifecycle";

const ToasterProvider = lazy(() => import("./Components/ToasterProvider"));
const PwaInstallPrompt = lazy(() => import("./Components/PwaInstallPrompt"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void syncServiceWorkerRegistration(import.meta.env.PROD);
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <OfflineSyncProvider>
          <AuthProvider>
            <CommandPaletteProvider>
              <App />
              <Suspense fallback={null}>
                <PwaInstallPrompt />
              </Suspense>
            </CommandPaletteProvider>
            <Suspense fallback={null}>
              <ToasterProvider />
            </Suspense>
          </AuthProvider>
        </OfflineSyncProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
);
