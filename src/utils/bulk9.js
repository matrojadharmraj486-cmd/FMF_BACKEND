import { postJson, getJson } from "./httpClient.js";

const buildAuthHeaders = () => {
  const header = process.env.BULK9_AUTH_HEADER;
  const value = process.env.BULK9_AUTH_VALUE;
  if (header && value) return { [header]: value };

  const apiKey = process.env.BULK9_API_KEY;
  if (apiKey) return { Authorization: `Bearer ${apiKey}` };

  return {};
};

export const sendBulk9Sms = async ({ to, message, otp }) => {
  const url = process.env.BULK9_SMS_URL;
  if (!url) throw new Error("BULK9_SMS_URL is not configured");

  const authKey = process.env.BULK9_API_KEY || process.env.BULK9_AUTH_VALUE;
  if (!authKey) throw new Error("BULK9_API_KEY is not configured");

  const params = new URLSearchParams();
  params.set("authorization", authKey);
  params.set("route", process.env.BULK9_ROUTE || "dlt");
  if (process.env.BULK9_SENDER_ID) params.set("sender_id", process.env.BULK9_SENDER_ID);
  const messageId = process.env.BULK9_MESSAGE_ID;
  if (process.env.BULK9_TEMPLATE_ID) params.set("template_id", process.env.BULK9_TEMPLATE_ID);
  if (process.env.BULK9_ENTITY_ID) params.set("entity_id", process.env.BULK9_ENTITY_ID);
  params.set("message", messageId || message);
  params.set("variables_values", otp || "");
  params.set("numbers", to || "");
  params.set("flash", process.env.BULK9_FLASH || "0");

  const fullUrl = url.includes("?") ? `${url}&${params}` : `${url}?${params}`;
  const response = await getJson(fullUrl);

  if (response.ok && response.data && response.data.return === false) {
    return { ...response, ok: false };
  }

  return response;
};

export const sendBulk9Email = async ({ to, subject, message, otp }) => {
  const url = process.env.BULK9_EMAIL_URL;
  if (!url) throw new Error("BULK9_EMAIL_URL is not configured");

  const payload = {
    to,
    subject,
    message,
    otp,
    from: process.env.BULK9_FROM_EMAIL
  };

  const headers = buildAuthHeaders();
  return postJson(url, payload, headers);
};
