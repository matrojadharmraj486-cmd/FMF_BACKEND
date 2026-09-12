import { logger } from "./logger.js";
import dns from "dns";
import nodemailer from "nodemailer";
import { postJson } from "./httpClient.js";

const env = (name) => String(process.env[name] || "").trim();
const hasEnv = (name) => env(name).length > 0;

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "ssl"].includes(String(value).trim().toLowerCase());
};

const createSmtpLookup = (family) => (hostname, options, callback) => {
  dns.lookup(
    hostname,
    {
      ...options,
      all: false,
      family
    },
    callback
  );
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

// Brevo transactional email over HTTPS (port 443). Preferred on hosts that block
// outbound SMTP ports (e.g. DigitalOcean droplets), where sendSmtpEmail times out.
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

const getBrevoConfig = () => {
  const apiKey = env("BREVO_API_KEY");
  const fromEmail = env("EMAIL_FROM") || env("SMTP_FROM") || env("SMTP_USER") || env("EMAIL_USER");
  const fromName = env("EMAIL_FROM_NAME") || env("SMTP_FROM_NAME") || "Family Medicine Flashback";
  return { apiKey, fromEmail, fromName };
};

export const getEmailConfigSummary = () => {
  const config = getSmtpConfig();
  const useBrevoApi = hasEnv("BREVO_API_KEY");
  return {
    provider: useBrevoApi ? "brevo-api" : (config.host ? "smtp" : (env("EMAIL_SERVICE") || "gmail")),
    hasBrevoApiKey: useBrevoApi,
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
      lookup: createSmtpLookup(config.family),
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

const sendBrevoApiEmail = async ({ to, subject, text, html }) => {
  const config = getBrevoConfig();
  if (!config.apiKey) throw new Error("BREVO_API_KEY is not configured");
  if (!config.fromEmail) {
    throw new Error("Sender email is not configured. Set EMAIL_FROM");
  }
  if (!html && !text) {
    throw new Error("Email must have text or html content");
  }

  logger.info("Brevo API email send starting", {
    to,
    from: config.fromEmail,
    subject
  });

  const payload = {
    sender: { name: config.fromName, email: config.fromEmail },
    to: [{ email: to }],
    subject,
    ...(html ? { htmlContent: html } : {}),
    ...(text ? { textContent: text } : {})
  };

  const response = await postJson(BREVO_API_URL, payload, {
    "api-key": config.apiKey,
    accept: "application/json"
  });

  if (!response.ok) {
    logger.error("Brevo API email send failed", {
      to,
      subject,
      status: response.status,
      response: response.data
    });
    const detail =
      (response.data && (response.data.message || response.data.code)) ||
      `status ${response.status}`;
    throw new Error(`Brevo API email failed: ${detail}`);
  }

  logger.info("Brevo API email send completed", {
    to,
    status: response.status,
    messageId: response.data && response.data.messageId
  });

  return response.data;
};

export const sendEmail = async ({ to, subject, text, html }) => {
  const useBrevoApi = hasEnv("BREVO_API_KEY");
  logger.info("sendEmail called", {
    to,
    subject,
    provider: useBrevoApi ? "brevo-api" : "smtp",
    hasText: !!text,
    hasHtml: !!html
  });

  try {
    const result = useBrevoApi
      ? await sendBrevoApiEmail({ to, subject, text, html })
      : await sendSmtpEmail({ to, subject, text, html });
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

// Fire-and-forget email: sends in the background, never blocks the caller and
// never throws. Use this for notification emails (payment activation, welcome,
// support-ticket updates) where the API response must NOT wait on the mail
// server and a delivery failure must not slow down or break the request.
// Do NOT use this for OTP / password-reset, where the response must reflect
// whether the mail was actually sent.
export const sendEmailInBackground = (opts) => {
  Promise.resolve()
    .then(() => sendEmail(opts))
    .catch(() => {
      // sendEmail already logs the failure in detail; swallow the rejection
      // here so a background send can never crash the process.
    });
};
