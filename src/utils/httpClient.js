import https from "https";
import http from "http";

const safeJsonParse = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export const postJson = async (url, body, headers = {}) => {
  if (!url) throw new Error("Missing URL");

  const target = new URL(url);
  const payload = JSON.stringify(body ?? {});
  const isHttps = target.protocol === "https:";
  const client = isHttps ? https : http;

  const options = {
    method: "POST",
    hostname: target.hostname,
    port: target.port || (isHttps ? 443 : 80),
    path: `${target.pathname}${target.search}`,
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
      ...headers
    }
  };

  return new Promise((resolve, reject) => {
    const req = client.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        const parsed = safeJsonParse(data);
        resolve({
          status: res.statusCode || 0,
          ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300,
          data: parsed ?? data
        });
      });
    });

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
};

export const getJson = async (url, headers = {}) => {
  if (!url) throw new Error("Missing URL");

  const target = new URL(url);
  const isHttps = target.protocol === "https:";
  const client = isHttps ? https : http;

  const options = {
    method: "GET",
    hostname: target.hostname,
    port: target.port || (isHttps ? 443 : 80),
    path: `${target.pathname}${target.search}`,
    headers: {
      ...headers
    }
  };

  return new Promise((resolve, reject) => {
    const req = client.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        const parsed = safeJsonParse(data);
        resolve({
          status: res.statusCode || 0,
          ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300,
          data: parsed ?? data
        });
      });
    });

    req.on("error", reject);
    req.end();
  });
};
