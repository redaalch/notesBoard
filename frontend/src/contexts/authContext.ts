import { createContext } from "react";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  initializing: boolean;
  login: (credentials: {
    email: string;
    password: string;
  }) => Promise<AuthUser>;
  register: (data: {
    name: string;
    email: string;
    password: string;
  }) => Promise<{ message: string }>;
  updateProfile: (data: {
    name?: string;
    email?: string;
    currentPassword?: string;
    verificationRedirectUrl?: string;
  }) => Promise<Record<string, unknown>>;
  changePassword: (data: {
    currentPassword: string;
    newPassword: string;
  }) => Promise<Record<string, unknown>>;
  resendVerificationEmail: (data: {
    email: string;
    verificationRedirectUrl?: string;
  }) => Promise<{ message: string }>;
  verifyEmail: (token: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export default AuthContext;
