import { logger } from "./logger.js";
import nodemailer from "nodemailer";

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "ssl"].includes(String(value).trim().toLowerCase());
};

const createSmtpTransport = () => {
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  if (!user || !pass) return null;

  if (process.env.SMTP_HOST) {
    const port = Number(process.env.SMTP_PORT || 465);
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: parseBoolean(process.env.SMTP_SECURE, port === 465),
      auth: { user, pass }
    });
  }

  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || "gmail",
    auth: { user, pass }
  });
};

const sendSmtpEmail = async ({ to, subject, text, html }) => {
  const transport = createSmtpTransport();
  if (!transport) {
    const errMsg = "SMTP email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS";
    logger.error("sendSmtpEmail failed: no transport", { to, subject });
    throw new Error(errMsg);
  }

  const fromEmail = process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || process.env.EMAIL_USER;
  const fromName = process.env.EMAIL_FROM_NAME || process.env.SMTP_FROM_NAME || "Family Medicine Flashback";

  logger.info("SMTP email send starting", {
    to,
    from: fromEmail,
    provider: process.env.SMTP_HOST ? "smtp" : (process.env.EMAIL_SERVICE || "gmail"),
    subject
  });

  try {
    const info = await transport.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      text,
      html
    });

    logger.info("SMTP email send completed", {
      to,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected
    });

    return info;
  } catch (err) {
    logger.error("SMTP email send failed", {
      to,
      subject,
      error: err.message,
      stack: err.stack
    });
    throw err;
  }
};

export const sendEmail = async ({ to, subject, text, html }) => {
  logger.info("sendEmail called", {
    to,
    subject,
    hasText: !!text,
    hasHtml: !!html
  });

  try {
    const result = await sendSmtpEmail({ to, subject, text, html });
    logger.info("sendEmail completed successfully", { to, subject });
    return result;
  } catch (err) {
    logger.error("sendEmail failed", {
      to,
      subject,
      error: err.message,
      stack: err.stack
    });
    throw err;
  }
};

export const sendBrevoEmail = sendEmail;
