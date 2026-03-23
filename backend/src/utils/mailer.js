import nodemailer from "nodemailer";
import logger from "./logger.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  return nodemailer.createTransport(mailerUrl);
};

const getTransporter = () => {
  if (!transporter) {
    transporter = buildTransporter();
  }
  return transporter;
};

export const sendMail = async (options) => {
  if (options?.to && !EMAIL_RE.test(options.to)) {
    logger.warn("Invalid recipient email, skipping send", { to: options.to });
    return null;
  }

  const transport = getTransporter();

  try {
    const response = await transport.sendMail({
      from:
        process.env.MAIL_FROM_ADDRESS ||
        `NotesBoard <no-reply@${
          process.env.MAIL_FROM_DOMAIN || "example.com"
        }>`,
      ...options,
    });

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
    throw error;
  }
};

export const __resetTransportForTesting = () => {
  transporter = null;
};
