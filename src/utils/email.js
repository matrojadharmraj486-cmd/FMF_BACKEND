import nodemailer from "nodemailer";
import { logger } from "./logger.js";

const buildTransport = () => {
  const service = process.env.EMAIL_SERVICE;
  const host = process.env.EMAIL_HOST;
  const port = process.env.EMAIL_PORT ? Number(process.env.EMAIL_PORT) : undefined;
  const secure = process.env.EMAIL_SECURE
    ? String(process.env.EMAIL_SECURE).toLowerCase() === "true"
    : undefined;
  const connectionTimeout = Number(process.env.EMAIL_CONNECTION_TIMEOUT || 10000);
  const greetingTimeout = Number(process.env.EMAIL_GREETING_TIMEOUT || 10000);
  const socketTimeout = Number(process.env.EMAIL_SOCKET_TIMEOUT || 15000);

  if (service) {
    return nodemailer.createTransport({
      service,
      family: 4,
      connectionTimeout,
      greetingTimeout,
      socketTimeout,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  return nodemailer.createTransport({
    host: host || "smtp.gmail.com",
    port: port || 587,
    secure: secure ?? false,
    family: 4,
    connectionTimeout,
    greetingTimeout,
    socketTimeout,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

export const sendSmtpEmail = async ({ to, subject, text, html }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS)
    throw new Error("EMAIL_USER and EMAIL_PASS are required for SMTP email");

  const transporter = buildTransport();
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;

  logger.info("SMTP sendMail starting", {
    to,
    from,
    subject,
    service: process.env.EMAIL_SERVICE || null,
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: process.env.EMAIL_PORT ? Number(process.env.EMAIL_PORT) : 587,
    family: 4,
    connectionTimeout: Number(process.env.EMAIL_CONNECTION_TIMEOUT || 10000),
    greetingTimeout: Number(process.env.EMAIL_GREETING_TIMEOUT || 10000),
    socketTimeout: Number(process.env.EMAIL_SOCKET_TIMEOUT || 15000),
    secure: process.env.EMAIL_SECURE
      ? String(process.env.EMAIL_SECURE).toLowerCase() === "true"
      : false
  });

  const result = await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html
  });

  logger.info("SMTP sendMail completed", {
    to,
    messageId: result.messageId || null,
    accepted: result.accepted || [],
    rejected: result.rejected || []
  });

  return result;
};
