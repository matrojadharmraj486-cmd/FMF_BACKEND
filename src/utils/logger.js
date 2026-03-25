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

