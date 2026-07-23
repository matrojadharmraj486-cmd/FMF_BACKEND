import { v2 as cloudinary } from "cloudinary";
import mongoose from "mongoose";

// src/config/database.js exits the process on failure, which is right for the server but would
// discard a half-finished report here. These scripts connect directly so they can handle it.
export const connectMongo = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set in .env");
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  } catch (e) {
    const hint = /whitelist|IP that isn't|ServerSelection/i.test(e.message)
      ? "\n  Your current IP is probably not on the MongoDB Atlas IP allowlist.\n" +
        "  Atlas -> Network Access -> Add IP Address -> Add Current IP Address."
      : "";
    throw new Error(`Could not connect to MongoDB: ${e.message}${hint}`);
  }
};

const readAccount = (prefix, label) => {
  const cloudName = process.env[`${prefix}CLOUD_NAME`];
  const apiKey = process.env[`${prefix}API_KEY`];
  const apiSecret = process.env[`${prefix}API_SECRET`];
  const missing = [
    !cloudName && `${prefix}CLOUD_NAME`,
    !apiKey && `${prefix}API_KEY`,
    !apiSecret && `${prefix}API_SECRET`
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(`${label} Cloudinary account not configured. Missing: ${missing.join(", ")}`);
  }
  return { label, cloudName, apiKey, apiSecret };
};

export const sourceAccount = () => readAccount("CLOUDINARY_", "Source");
export const destAccount = () => readAccount("CLOUDINARY_DEST_", "Destination");

// The SDK resolves credentials per call (options win over the global config), which is what
// lets one process talk to both accounts. It also consumes/deletes keys off the object it is
// handed, so every call needs a freshly built options object.
export const withAccount = (account, options = {}) => ({
  cloud_name: account.cloudName,
  api_key: account.apiKey,
  api_secret: account.apiSecret,
  ...options
});

export const RESOURCE_TYPES = ["image", "video", "raw"];

// Cloudinary rejects with { error: { message } } rather than a real Error, so e.message is undefined.
export const errorMessage = (e) =>
  e?.error?.message || e?.message || (typeof e === "string" ? e : JSON.stringify(e));

export const listAllResources = async (account, resourceType) => {
  const out = [];
  let nextCursor;
  do {
    const res = await cloudinary.api.resources(
      withAccount(account, {
        resource_type: resourceType,
        type: "upload",
        max_results: 500,
        ...(nextCursor ? { next_cursor: nextCursor } : {})
      })
    );
    out.push(...(res.resources || []));
    nextCursor = res.next_cursor;
  } while (nextCursor);
  return out;
};

export const folderOf = (publicId) => {
  const i = String(publicId || "").lastIndexOf("/");
  return i === -1 ? "(root)" : publicId.slice(0, i);
};

// Matches any delivery URL for a cloud, whatever transformations or version it carries.
export const urlMarker = (cloudName) => `res.cloudinary.com/${cloudName}/`;

// Walks every string in a document rather than a fixed field list: editor images are embedded
// inside rich-text HTML (question_text, answerBlocks[].text), which a field list would miss.
// Returns [nextValue, replacementCount]; nextValue is the original reference when nothing changed.
export const deepReplace = (value, from, to) => {
  if (typeof value === "string") {
    if (!value.includes(from)) return [value, 0];
    const hits = value.split(from).length - 1;
    return [value.split(from).join(to), hits];
  }
  if (Array.isArray(value)) {
    let total = 0;
    const next = value.map((item) => {
      const [replaced, hits] = deepReplace(item, from, to);
      total += hits;
      return replaced;
    });
    return total ? [next, total] : [value, 0];
  }
  // Only walk plain objects — BSON values (ObjectId, Date, Binary) must pass through untouched.
  if (value && typeof value === "object" && value.constructor === Object) {
    let total = 0;
    const next = {};
    for (const [k, v] of Object.entries(value)) {
      const [replaced, hits] = deepReplace(v, from, to);
      total += hits;
      next[k] = replaced;
    }
    return total ? [next, total] : [value, 0];
  }
  return [value, 0];
};

export const runPooled = async (items, limit, worker) => {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
};
