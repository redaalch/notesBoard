import { Route, Routes } from "react-router-dom";

import HomePage from "./pages/HomePage.jsx";
import CreatePage from "./pages/CreatePage.jsx";
import NoteDetailPage from "./pages/NoteDetailPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import ForgotPasswordPage from "./pages/ForgotPasswordPage.jsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.jsx";
import RequireAuth from "./Components/RequireAuth.jsx";

const App = () => {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-base-200">
      <div className="pointer-events-none absolute inset-0 -z-10 h-full w-full bg-gradient-to-br from-base-300/40 via-base-200/60 to-base-100/80" />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/"
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
      </Routes>
    </div>
  );
};
export default App;
