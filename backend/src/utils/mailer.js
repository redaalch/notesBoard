import nodemailer from "nodemailer";
import logger from "./logger.js";

// #19 — Stricter email regex: requires valid chars, one @, valid domain, TLD ≥ 2 chars.
const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

// #6 — Maximum time to wait for SMTP to accept a message.
const SEND_TIMEOUT_MS = 30_000;

const isValidSmtpUrl = (url) => {
  if (!url || typeof url !== "string") return false;
  return /^smtps?:\/\//i.test(url) || /^smtp\+starttls:/i.test(url);
};

let transporter;

const buildTransporter = () => {
  const mailerUrl = process.env.MAILER_TO_GO_URL || process.env.MAILERTOGO_URL;

  if (!mailerUrl || !isValidSmtpUrl(mailerUrl)) {
    logger.warn(
      "MAILER_TO_GO_URL/MAILERTOGO_URL is not configured. Email sending is disabled."
    );
    return {
      sendMail: async (options) => {
        logger.info("Email suppressed (no transport configured)", {
          to: options?.to,
          subject: options?.subject,
        });
      },
    };
  }

  return nodemailer.createTransport(mailerUrl, {
    // #6 — Connection-level timeouts so a dead SMTP server doesn't hang forever.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: SEND_TIMEOUT_MS,
  });
};

const getTransporter = () => {
  if (!transporter) {
    transporter = buildTransporter();
  }
  return transporter;
};

// #18 — Warn once if MAIL_FROM_DOMAIN is missing; do not silently use example.com.
let _fromDomainWarned = false;

const getFromAddress = () => {
  if (process.env.MAIL_FROM_ADDRESS) {
    return process.env.MAIL_FROM_ADDRESS;
  }
  const domain = process.env.MAIL_FROM_DOMAIN;
  if (!domain) {
    if (!_fromDomainWarned) {
      logger.warn(
        "MAIL_FROM_DOMAIN is not set — emails will be sent from no-reply@example.com " +
          "which will likely fail SPF/DKIM checks and be marked as spam.",
      );
      _fromDomainWarned = true;
    }
    return "NotesBoard <no-reply@example.com>";
  }
  return `NotesBoard <no-reply@${domain}>`;
};

export const sendMail = async (options) => {
  // #19 — Validate recipient with stricter regex before hitting the network.
  if (options?.to && !EMAIL_RE.test(options.to)) {
    logger.warn("Invalid recipient email, skipping send", { to: options.to });
    return null;
  }

  const transport = getTransporter();

  try {
    // #6 — Race the send against a hard deadline (socketTimeout on the
    // transporter handles the connection phase; this covers the full call).
    const sendPromise = transport.sendMail({
      from: getFromAddress(),
      ...options,
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`sendMail timed out after ${SEND_TIMEOUT_MS}ms`)),
        SEND_TIMEOUT_MS,
      ),
    );

    const response = await Promise.race([sendPromise, timeoutPromise]);

    logger.info("Email dispatched", {
      to: options?.to,
      subject: options?.subject,
      messageId: response?.messageId,
    });

    return response;
  } catch (error) {
    logger.error("Failed to send email", {
      error: error?.message,
      to: options?.to,
      subject: options?.subject,
    });

    // #10 — Reset the singleton so the next call gets a fresh connection.
    // This handles dropped SMTP connections and rotated credentials.
    transporter = null;

    throw error;
  }
};

// #8 — Guard the test helper so it cannot be accidentally invoked in production.
export const __resetTransportForTesting = () => {
  if (process.env.NODE_ENV === "production") {
    throw new Error("__resetTransportForTesting must not be called in production");
  }
  transporter = null;
  _fromDomainWarned = false;
};
