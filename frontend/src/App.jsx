import { Route, Routes } from "react-router-dom";

import HomePage from "./pages/HomePage";
import CreatePage from "./pages/CreatePage";
import NoteDetailPage from "./pages/NoteDetailPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import RequireAuth from "./Components/RequireAuth";
import LandingPage from "./pages/LandingPage";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import ProfilePage from "./pages/ProfilePage";
import SkipToContent from "./Components/SkipToContent";
import NotebookInvitePage from "./pages/NotebookInvitePage";
import PublishedNotebookPage from "./pages/published-notebook-page";

const App = () => {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-base-200">
      <SkipToContent />
      <div className="pointer-events-none absolute inset-0 -z-10 h-full w-full bg-gradient-to-br from-base-300/40 via-base-200/60 to-base-100/80" />
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
        <Route
          path="/notebook/invite"
          element={
            <RequireAuth>
              <NotebookInvitePage />
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
    </div>
  );
};
export default App;
