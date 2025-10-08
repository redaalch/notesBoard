import { useEffect, useMemo, useState } from "react";
import {
  BadgeAlertIcon,
  BadgeCheckIcon,
  CalendarIcon,
  KeyRoundIcon,
  LoaderIcon,
  MailIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  UserIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import Navbar from "../Components/Navbar.jsx";
import useAuth from "../hooks/useAuth.js";
import { formatDate, formatRelativeTime } from "../lib/Utils.js";

const emptyPasswordState = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

function ProfilePage() {
  const { user, updateProfile, changePassword } = useAuth();
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    currentPassword: "",
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordForm, setPasswordForm] = useState(emptyPasswordState);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);

  useEffect(() => {
    if (!user) return;
    setProfileForm((prev) => ({
      ...prev,
      name: user.name ?? "",
      email: user.email ?? "",
      currentPassword: "",
    }));
    setPendingVerification(!user.emailVerified);
  }, [user]);

  const joinedDate = useMemo(() => {
    if (!user?.createdAt) return "–";
    try {
      return formatDate(new Date(user.createdAt));
    } catch {
      return "–";
    }
  }, [user]);

  const lastUpdated = useMemo(() => {
    if (!user?.updatedAt) return "–";
    try {
      return formatRelativeTime(new Date(user.updatedAt));
    } catch {
      return "–";
    }
  }, [user]);

  if (!user) {
    return null;
  }

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    if (profileLoading) return;

    const trimmedName = profileForm.name.trim();
    const trimmedEmail = profileForm.email.trim();
    const currentEmail = user.email ?? "";
    const updates = {};

    if (trimmedName && trimmedName !== user.name) {
      updates.name = trimmedName;
    }

    const emailChanged =
      trimmedEmail && trimmedEmail.toLowerCase() !== currentEmail.toLowerCase();

    if (emailChanged) {
      updates.email = trimmedEmail;
      if (!profileForm.currentPassword) {
        toast.error("Enter your current password to change email.");
        return;
      }
      updates.currentPassword = profileForm.currentPassword;
      if (typeof window !== "undefined") {
        updates.verificationRedirectUrl = `${window.location.origin}/verify-email`;
      }
    }

    if (Object.keys(updates).length === 0) {
      toast("No profile changes to save.");
      return;
    }

    try {
      setProfileLoading(true);
      const result = await updateProfile(updates);
      const updatedUser = result?.user ?? user;
      setPendingVerification(
        result?.emailVerificationRequired ?? !updatedUser.emailVerified
      );
      setProfileForm((prev) => ({
        ...prev,
        name: updatedUser.name ?? trimmedName,
        email: updatedUser.email ?? trimmedEmail,
        currentPassword: "",
      }));
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    if (passwordLoading) return;

    if (!passwordForm.currentPassword) {
      toast.error("Enter your current password.");
      return;
    }

    if (!passwordForm.newPassword) {
      toast.error("Enter a new password.");
      return;
    }

    if (passwordForm.currentPassword === passwordForm.newPassword) {
      toast.error("New password must be different from your current password.");
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }

    if (!/[A-Z]/.test(passwordForm.newPassword)) {
      toast.error("Password needs at least one uppercase letter.");
      return;
    }

    if (!/[a-z]/.test(passwordForm.newPassword)) {
      toast.error("Password needs at least one lowercase letter.");
      return;
    }

    if (!/[0-9]/.test(passwordForm.newPassword)) {
      toast.error("Password needs at least one number.");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New password and confirmation do not match.");
      return;
    }

    try {
      setPasswordLoading(true);
      await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm(emptyPasswordState);
    } catch (error) {
      // changePassword already surfaces a toast; swallow error to avoid bubbling
      if (import.meta.env.DEV) {
        console.warn("Password update failed", error);
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-200">
      <Navbar />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 lg:px-8"
      >
        <section className="rounded-3xl border border-base-content/10 bg-base-100/80 p-6 shadow-lg shadow-primary/10 backdrop-blur">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h1 className="text-3xl font-semibold text-base-content">
                Profile
              </h1>
              <p className="mt-1 text-sm text-base-content/70">
                Review your account details and manage security settings.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {user.emailVerified ? (
                <span className="badge badge-success badge-lg gap-2 text-success-content">
                  <ShieldCheckIcon className="size-4" />
                  Email verified
                </span>
              ) : (
                <span className="badge badge-warning badge-lg gap-2 text-warning-content">
                  <ShieldAlertIcon className="size-4" />
                  Verification needed
                </span>
              )}
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-2xl border border-base-content/10 bg-base-100 p-4 shadow-sm">
              <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
                <UserIcon className="size-5" />
              </span>
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-base-content/50">
                  Display name
                </p>
                <p className="text-base font-semibold text-base-content">
                  {user.name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-base-content/10 bg-base-100 p-4 shadow-sm">
              <span className="grid size-10 place-items-center rounded-xl bg-secondary/15 text-secondary">
                <MailIcon className="size-5" />
              </span>
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-base-content/50">
                  Email address
                </p>
                <p className="text-base font-semibold text-base-content">
                  {user.email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-base-content/10 bg-base-100 p-4 shadow-sm">
              <span className="grid size-10 place-items-center rounded-xl bg-accent/15 text-accent">
                <CalendarIcon className="size-5" />
              </span>
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-base-content/50">
                  Joined
                </p>
                <p className="text-base font-semibold text-base-content">
                  {joinedDate}
                </p>
                <p className="text-xs text-base-content/60">
                  Updated {lastUpdated}
                </p>
              </div>
            </div>
          </div>

          {pendingVerification ? (
            <div className="mt-6 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-warning-content">
              <div className="flex items-start gap-3">
                <BadgeAlertIcon className="mt-0.5 size-5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold">
                    Email verification pending
                  </p>
                  <p className="text-sm leading-relaxed">
                    We sent a confirmation link to {profileForm.email}. Once you
                    verify the new email, your account will be fully up to date.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-success/30 bg-success/20 p-4 text-success-content">
              <div className="flex items-start gap-3">
                <BadgeCheckIcon className="mt-0.5 size-5" />
                <div>
                  <p className="text-sm font-semibold text-success-content">
                    Everything looks good
                  </p>
                  <p className="text-sm leading-relaxed text-success-content/90">
                    Your email is verified. Keep your details current to make
                    the most of NotesBoard.
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <form
            className="flex flex-col gap-4 rounded-3xl border border-base-content/10 bg-base-100/90 p-6 shadow-md shadow-primary/10 backdrop-blur"
            onSubmit={handleProfileSubmit}
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-base-content">
              <UserIcon className="size-5" />
              Personal details
            </div>

            <label className="form-control">
              <span className="label">
                <span className="label-text">Display name</span>
              </span>
              <input
                type="text"
                className="input input-bordered"
                value={profileForm.name}
                onChange={(event) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
                placeholder="Ada Lovelace"
                autoComplete="name"
              />
            </label>

            <label className="form-control">
              <span className="label">
                <span className="label-text">Email address</span>
              </span>
              <input
                type="email"
                className="input input-bordered"
                value={profileForm.email}
                onChange={(event) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    email: event.target.value,
                  }))
                }
                placeholder="you@example.com"
                autoComplete="email"
              />
            </label>

            <label className="form-control">
              <span className="label">
                <span className="label-text">Current password</span>
                <span className="label-text-alt text-xs text-base-content/60">
                  Required only when changing email
                </span>
              </span>
              <input
                type="password"
                className="input input-bordered"
                value={profileForm.currentPassword}
                onChange={(event) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    currentPassword: event.target.value,
                  }))
                }
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </label>

            <button
              type="submit"
              className="btn btn-primary mt-2 gap-2"
              disabled={profileLoading}
            >
              {profileLoading ? (
                <>
                  <LoaderIcon className="size-4 animate-spin" />
                  Saving changes
                </>
              ) : (
                "Save profile"
              )}
            </button>
          </form>

          <form
            className="flex flex-col gap-4 rounded-3xl border border-base-content/10 bg-base-100/90 p-6 shadow-md shadow-secondary/10 backdrop-blur"
            onSubmit={handlePasswordSubmit}
          >
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={user.email ?? ""}
              readOnly
              aria-hidden="true"
              tabIndex={-1}
              className="sr-only"
            />
            <div className="flex items-center gap-2 text-sm font-semibold text-base-content">
              <KeyRoundIcon className="size-5" />
              Change password
            </div>

            <label className="form-control">
              <span className="label">
                <span className="label-text">Current password</span>
              </span>
              <input
                type="password"
                className="input input-bordered"
                value={passwordForm.currentPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    currentPassword: event.target.value,
                  }))
                }
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </label>

            <label className="form-control">
              <span className="label">
                <span className="label-text">New password</span>
                <span className="label-text-alt text-xs text-base-content/60">
                  Must be at least 8 characters with upper, lower, and number
                </span>
              </span>
              <input
                type="password"
                className="input input-bordered"
                value={passwordForm.newPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    newPassword: event.target.value,
                  }))
                }
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </label>

            <label className="form-control">
              <span className="label">
                <span className="label-text">Confirm new password</span>
              </span>
              <input
                type="password"
                className="input input-bordered"
                value={passwordForm.confirmPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    confirmPassword: event.target.value,
                  }))
                }
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </label>

            <button
              type="submit"
              className="btn btn-secondary mt-2 gap-2"
              disabled={passwordLoading}
            >
              {passwordLoading ? (
                <>
                  <LoaderIcon className="size-4 animate-spin" />
                  Updating password
                </>
              ) : (
                "Update password"
              )}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

export default ProfilePage;
