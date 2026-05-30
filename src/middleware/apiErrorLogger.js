import { logger } from "../utils/logger.js";

const SENSITIVE_KEYS = new Set([
  "authorization",
  "password",
  "token",
  "otp",
  "razorpay_signature",
  "keysecret",
  "secret",
  "saltid"
]);

const sanitizeValue = (value) => {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (!value || typeof value !== "object") return value;

  return Object.entries(value).reduce((acc, [key, item]) => {
    const normalizedKey = String(key).toLowerCase();
    acc[key] = SENSITIVE_KEYS.has(normalizedKey) ? "[redacted]" : sanitizeValue(item);
    return acc;
  }, {});
};

const sanitizeHeaders = (headers = {}) => {
  const safe = { ...headers };
  if (safe.authorization) safe.authorization = "[redacted]";
  if (safe.cookie) safe.cookie = "[redacted]";
  return safe;
};

const isApiRequest = (req) => String(req.originalUrl || req.url || "").startsWith("/api");

export const apiFailureLogger = (req, res, next) => {
  if (!isApiRequest(req)) return next();

  const startedAt = Date.now();
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    res.locals.responseBody = body;
    return originalJson(body);
  };

  res.on("finish", () => {
    if (res.statusCode < 400) return;
    if (res.locals.errorLogged) return;

    const responseBody = res.locals.responseBody;
    logger.error("API request failed", {
      requestId: req.headers["x-request-id"] || null,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      message: responseBody?.message || responseBody?.error || null,
      userId: req.user?._id || null,
      ip: req.ip,
      query: sanitizeValue(req.query),
      body: sanitizeValue(req.body),
      headers: sanitizeHeaders({
        "user-agent": req.headers["user-agent"],
        origin: req.headers.origin,
        referer: req.headers.referer,
        authorization: req.headers.authorization
      })
    });
  });

  return next();
};

export const notFoundHandler = (req, res, next) => {
  if (!isApiRequest(req)) return next();
  return res.status(404).json({
    status: 404,
    message: "API route not found"
  });
};

export const globalErrorHandler = (err, req, res, next) => {
  if (!isApiRequest(req)) return next(err);

  const statusCode = Number(err?.statusCode || err?.status || 500);
  const safeStatusCode = statusCode >= 400 && statusCode < 600 ? statusCode : 500;

  logger.error("Unhandled API error", {
    requestId: req.headers["x-request-id"] || null,
    method: req.method,
    path: req.originalUrl,
    statusCode: safeStatusCode,
    message: err?.message,
    stack: err?.stack,
    userId: req.user?._id || null,
    ip: req.ip,
    query: sanitizeValue(req.query),
    body: sanitizeValue(req.body)
  });
  res.locals.errorLogged = true;

  if (res.headersSent) return next(err);

  return res.status(safeStatusCode).json({
    status: safeStatusCode,
    message: safeStatusCode >= 500 ? "Internal server error" : err.message
  });
};
