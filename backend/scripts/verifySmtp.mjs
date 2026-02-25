/**
 * SMTP Verification Script
 * ────────────────────────
 * Tests the Resend SMTP connection configured in .env
 *
 * Usage:  node scripts/verifySmtp.mjs [recipient@example.com]
 */

import "dotenv/config";
import nodemailer from "nodemailer";

const SMTP_URL =
  process.env.MAILER_TO_GO_URL || process.env.MAILERTOGO_URL || "";
const FROM =
  process.env.MAIL_FROM_ADDRESS ||
  `NotesBoard <no-reply@${process.env.MAIL_FROM_DOMAIN || "example.com"}>`;

if (!SMTP_URL) {
  console.error("✗ MAILER_TO_GO_URL is not set in .env — cannot verify SMTP.");
  process.exit(1);
}

console.log("─── SMTP Verification ───");
console.log(`Provider URL : ${SMTP_URL.replace(/:[^:]+@/, ":****@")}`);
console.log(`From address : ${FROM}`);
console.log();

const transporter = nodemailer.createTransport(SMTP_URL);

// Step 1 — Verify the connection
console.log("1. Testing SMTP connection…");
try {
  await transporter.verify();
  console.log("   ✓ SMTP connection successful!\n");
} catch (err) {
  console.error(`   ✗ Connection failed: ${err.message}\n`);
  process.exit(1);
}

// Step 2 — Optionally send a test email
const recipient = process.argv[2];
if (!recipient) {
  console.log(
    "2. Skipping test email (no recipient provided).\n" +
      "   Run again with:  node scripts/verifySmtp.mjs you@example.com\n",
  );
  console.log("─── Done ───");
  process.exit(0);
}

console.log(`2. Sending test email to ${recipient}…`);
try {
  const info = await transporter.sendMail({
    from: FROM,
    to: recipient,
    subject: "NotesBoard — SMTP Test ✓",
    text: "If you can read this, your Resend SMTP integration is working correctly.",
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #6366f1;">NotesBoard — SMTP Test</h2>
        <p>If you can read this, your <strong>Resend SMTP</strong> integration is working correctly.</p>
        <p style="color: #888; font-size: 12px; margin-top: 32px;">
          Sent at ${new Date().toISOString()}
        </p>
      </div>
    `,
  });

  console.log(`   ✓ Email sent!  Message ID: ${info.messageId}\n`);
} catch (err) {
  console.error(`   ✗ Failed to send: ${err.message}\n`);
  process.exit(1);
}

console.log("─── Done ───");
