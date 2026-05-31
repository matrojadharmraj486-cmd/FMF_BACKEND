import { logger } from "./logger.js";
import { postJson } from "./httpClient.js";

export const sendBrevoEmail = async ({ to, subject, text, html }) => {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || "notification@familymedicineflashback.com";
  const senderName = process.env.BREVO_SENDER_NAME || "Family Medicine Flashback";
  const apiUrl = process.env.BREVO_API_URL || "https://api.brevo.com/v3/smtp/email";

  if (!apiKey)
    throw new Error("BREVO_API_KEY is required for Brevo email");

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
