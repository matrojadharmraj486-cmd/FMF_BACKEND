import { logger } from "./logger.js";
import { postJson } from "./httpClient.js";
import nodemailer from "nodemailer";

const createSmtpTransport = () => {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) return null;

  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
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
    throw new Error("Email provider is not configured. Set BREVO_API_KEY or EMAIL_USER/EMAIL_PASS");
  }

  const fromEmail = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  const fromName = process.env.EMAIL_FROM_NAME || process.env.BREVO_SENDER_NAME || "Family Medicine Flashback";

  logger.info("SMTP email send starting", {
    to,
    from: fromEmail,
    provider: process.env.SMTP_HOST ? "smtp" : (process.env.EMAIL_SERVICE || "gmail"),
    subject
  });

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
};

export const sendBrevoEmail = async ({ to, subject, text, html }) => {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || "notification@familymedicineflashback.com";
  const senderName = process.env.BREVO_SENDER_NAME || "Family Medicine Flashback";
  const apiUrl = process.env.BREVO_API_URL || "https://api.brevo.com/v3/smtp/email";

  if (!apiKey) {
    logger.warn("BREVO_API_KEY missing, using SMTP email fallback if configured", {
      hasEmailUser: !!process.env.EMAIL_USER,
      hasEmailPass: !!process.env.EMAIL_PASS
    });
    return sendSmtpEmail({ to, subject, text, html });
  }

  const payload = {
    sender: {
      email: senderEmail,
      name: senderName
    },
    to: [{ email: to }],
    subject,
    textContent: text,
    htmlContent: html
  };

  logger.info("Brevo email send starting", {
    to,
    from: senderEmail,
    senderName,
    subject,
    apiUrl
  });

  const response = await postJson(apiUrl, payload, {
    "api-key": apiKey,
    accept: "application/json"
  });

  logger.info("Brevo email send completed", {
    to,
    status: response.status,
    ok: response.ok,
    data: response.data
  });

  if (!response.ok) {
    const details = typeof response.data === "object"
      ? JSON.stringify(response.data)
      : String(response.data);
    logger.error("Brevo email failure details", {
      status: response.status,
      details,
      payload: { ...payload, htmlContent: payload.htmlContent ? "(truncated)" : undefined }
    });
    throw new Error(`Brevo email failed with status ${response.status}: ${details}`);
  }

  return response.data;
};
