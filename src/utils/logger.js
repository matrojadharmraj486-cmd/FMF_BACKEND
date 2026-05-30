import fs from "fs";
import path from "path";

const logDir = process.env.LOG_DIR
  ? path.resolve(process.env.LOG_DIR)
  : path.join(process.cwd(), "logs");
const errorLogFile = process.env.API_ERROR_LOG_FILE
  ? path.resolve(process.env.API_ERROR_LOG_FILE)
  : path.join(logDir, "api-errors.log");

const ensureLogDir = () => {
  try {
    fs.mkdirSync(path.dirname(errorLogFile), { recursive: true });
  } catch {
    // Logging must never break API responses.
  }
};

const formatMeta = (meta) => {
  if (!meta || typeof meta !== "object") return "";

  try {
    const safe = JSON.stringify(meta);
    return safe ? ` ${safe}` : "";
  } catch {
    return " [unserializable-meta]";
  }
};

const writeLog = (level, message, meta) => {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level}] ${message}${formatMeta(meta)}`;

  if (level === "ERROR" || level === "WARN") {
    console.error(line);
    ensureLogDir();
    fs.appendFile(errorLogFile, `${line}\n`, () => {});
    return;
  }

  console.log(line);
};

export const logger = {
  info(message, meta) {
    writeLog("INFO", message, meta);
  },
  warn(message, meta) {
    writeLog("WARN", message, meta);
  },
  error(message, meta) {
    writeLog("ERROR", message, meta);
  }
};

