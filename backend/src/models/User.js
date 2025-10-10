import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const REFRESH_TOKEN_LIMIT = 5;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      validate: {
        validator: (value) =>
          /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value).toLowerCase()),
        message: "Email is invalid",
      },
    },
    passwordHash: {
      type: String,
      required: true,
      minlength: 60,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    refreshTokens: {
      type: [
        new mongoose.Schema(
          {
            token: { type: String, required: true },
            expiresAt: { type: Date, required: true },
            createdAt: { type: Date, default: Date.now },
            userAgent: { type: String },
            ip: { type: String },
          },
          { _id: false }
        ),
      ],
      default: [],
      validate: {
        validator(tokens) {
          return Array.isArray(tokens) && tokens.length <= REFRESH_TOKEN_LIMIT;
        },
        message: "Too many active sessions",
      },
    },
    passwordReset: {
      token: { type: String },
      expiresAt: { type: Date },
      createdAt: { type: Date },
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerifiedAt: {
      type: Date,
    },
    emailVerification: {
      token: { type: String },
      expiresAt: { type: Date },
      createdAt: { type: Date },
    },
    defaultWorkspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
    },
    defaultBoard: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Board",
    },
    customNoteOrder: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Note",
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = async function comparePassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.methods.setPassword = async function setPassword(password) {
  const salt = await bcrypt.genSalt(12);
  this.passwordHash = await bcrypt.hash(password, salt);
};

userSchema.methods.addRefreshToken = function addRefreshToken(entry) {
  this.refreshTokens.push(entry);
  if (this.refreshTokens.length > REFRESH_TOKEN_LIMIT) {
    this.refreshTokens = this.refreshTokens.slice(-REFRESH_TOKEN_LIMIT);
  }
};

userSchema.methods.removeRefreshToken = function removeRefreshToken(token) {
  this.refreshTokens = this.refreshTokens.filter(
    (entry) => entry.token !== token
  );
};

userSchema.methods.clearRefreshTokens = function clearRefreshTokens() {
  this.refreshTokens = [];
};

userSchema.methods.setPasswordResetToken = function setPasswordResetToken(
  token,
  expiresAt
) {
  this.passwordReset = {
    token,
    expiresAt,
    createdAt: new Date(),
  };
};

userSchema.methods.clearPasswordResetToken =
  function clearPasswordResetToken() {
    this.passwordReset = undefined;
    this.markModified("passwordReset");
  };

userSchema.methods.setEmailVerificationToken =
  function setEmailVerificationToken(token, expiresAt) {
    this.emailVerification = {
      token,
      expiresAt,
      createdAt: new Date(),
    };
    this.markModified("emailVerification");
  };

userSchema.methods.clearEmailVerificationToken =
  function clearEmailVerificationToken() {
    this.emailVerification = undefined;
    this.markModified("emailVerification");
  };

userSchema.methods.markEmailVerified = function markEmailVerified() {
  this.emailVerified = true;
  this.emailVerifiedAt = new Date();
  this.clearEmailVerificationToken();
};

const User = mongoose.model("User", userSchema);

export default User;
