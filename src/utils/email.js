import { logger } from "./logger.js";
import nodemailer from "nodemailer";

const env = (name) => String(process.env[name] || "").trim();
const hasEnv = (name) => env(name).length > 0;

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "ssl"].includes(String(value).trim().toLowerCase());
};

const getSmtpConfig = () => {
  const host = env("SMTP_HOST");
  const port = Number(env("SMTP_PORT") || 465);
  const family = Number(env("SMTP_FAMILY") || 4);
  const user = env("SMTP_USER") || env("EMAIL_USER");
  const pass = env("SMTP_PASS") || env("EMAIL_PASS");
  const secure = parseBoolean(process.env.SMTP_SECURE, port === 465);
  const fromEmail = env("EMAIL_FROM") || env("SMTP_FROM") || user;
  const fromName = env("EMAIL_FROM_NAME") || env("SMTP_FROM_NAME") || "Family Medicine Flashback";

  return { host, port, family, secure, user, pass, fromEmail, fromName };
};

export const getEmailConfigSummary = () => {
  const config = getSmtpConfig();
  return {
    provider: config.host ? "smtp" : (env("EMAIL_SERVICE") || "gmail"),
    smtpHost: config.host || null,
    smtpPort: config.host ? config.port : null,
    smtpFamily: config.host ? config.family : null,
    smtpSecure: config.host ? config.secure : null,
    hasSmtpUser: Boolean(config.user),
    hasSmtpPass: Boolean(config.pass),
    fromEmail: config.fromEmail || null,
    hasBulk9EmailUrl: hasEnv("BULK9_EMAIL_URL")
  };
};

const createSmtpTransport = () => {
  const config = getSmtpConfig();
  if (!config.user || !config.pass) return null;

  if (config.host) {
    return nodemailer.createTransport({
      host: config.host,
      port: config.port,
      family: config.family,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
      connectionTimeout: Number(env("SMTP_CONNECTION_TIMEOUT_MS") || 15000),
      greetingTimeout: Number(env("SMTP_GREETING_TIMEOUT_MS") || 15000),
      socketTimeout: Number(env("SMTP_SOCKET_TIMEOUT_MS") || 20000)
    });
  }

  return nodemailer.createTransport({
    service: env("EMAIL_SERVICE") || "gmail",
    auth: { user: config.user, pass: config.pass }
  });
};

const sendSmtpEmail = async ({ to, subject, text, html }) => {
  const transport = createSmtpTransport();
  if (!transport) {
    const errMsg = "SMTP email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS";
    logger.error("sendSmtpEmail failed: no transport", {
      to,
      subject,
      config: getEmailConfigSummary()
    });
    throw new Error(errMsg);
  }

  const config = getSmtpConfig();

  logger.info("SMTP email send starting", {
    to,
    from: config.fromEmail,
    config: getEmailConfigSummary(),
    subject
  });

  try {
    const info = await transport.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
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
      code: err.code,
      command: err.command,
      responseCode: err.responseCode,
      response: err.response,
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
