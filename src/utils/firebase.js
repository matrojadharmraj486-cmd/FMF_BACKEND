let cached = null;

const tryParseJson = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export const getFirebaseAdmin = async () => {
  if (cached) return cached;

  let admin;
  try {
    const mod = await import("firebase-admin");
    admin = mod.default || mod;
  } catch (e) {
    const err = new Error("firebase-admin is not installed");
    err.code = "FIREBASE_ADMIN_MISSING";
    err.cause = e;
    throw err;
  }

  if (admin.apps?.length) {
    cached = admin;
    return admin;
  }

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT || "";
  const parsed = tryParseJson(json);
  if (!parsed) {
    const err = new Error("Firebase service account JSON is not configured");
    err.code = "FIREBASE_NOT_CONFIGURED";
    throw err;
  }

  admin.initializeApp({
    credential: admin.credential.cert(parsed)
  });

  cached = admin;
  return admin;
};

