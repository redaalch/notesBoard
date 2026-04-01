import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { LazyMotion, domAnimation } from "framer-motion";

import RequireAuth from "./Components/RequireAuth";
import SkipToContent from "./Components/SkipToContent";

const LandingPage = lazy(() => import("./pages/LandingPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const PublishedNotebookPage = lazy(
  () => import("./pages/published-notebook-page"),
);
const PublishedNotePage = lazy(() => import("./pages/published-note-page"));
const NotebookInvitePage = lazy(() => import("./pages/NotebookInvitePage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const CreatePage = lazy(() => import("./pages/CreatePage"));
const NoteDetailPage = lazy(() => import("./pages/NoteDetailPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));

const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center px-4">
    <div className="inline-flex items-center gap-2 rounded-full border border-base-300/60 bg-base-100/85 px-4 py-2 text-sm text-base-content/70">
      <span className="loading loading-spinner loading-sm" />
      Loading page...
    </div>
  </div>
);

const App = () => {
  return (
    <LazyMotion features={domAnimation} strict>
    <div className="relative min-h-screen w-full overflow-x-hidden bg-base-200">
      <SkipToContent />
      <div className="pointer-events-none absolute inset-0 -z-10 h-full w-full bg-gradient-to-br from-base-300/40 via-base-200/60 to-base-100/80" />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/published/:slug" element={<PublishedNotebookPage />} />
          <Route path="/published/note/:slug" element={<PublishedNotePage />} />
          <Route
            path="/notebook/invite"
            element={
              <RequireAuth>
                <NotebookInvitePage />
              </RequireAuth>
            }
          />
          <Route
            path="/home"
            element={
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/app"
            element={
              <RequireAuth>
                <HomePage />
              </RequireAuth>
            }
          />
          <Route
            path="/create"
            element={
              <RequireAuth>
                <CreatePage />
              </RequireAuth>
            }
          />
          <Route
            path="/note/:id"
            element={
              <RequireAuth>
                <NoteDetailPage />
              </RequireAuth>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <ProfilePage />
              </RequireAuth>
            }
          />
        </Routes>
      </Suspense>
    </div>
    </LazyMotion>
  );
};
export default App;
