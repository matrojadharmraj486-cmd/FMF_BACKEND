import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// -----------------------------------------------------------------------------
// Apple In-App Purchase verification (StoreKit 2 signed transactions).
//
// The iOS app sends the `Transaction.jwsRepresentation` produced by StoreKit 2.
// It is a JWS (JWT) signed with ES256 whose header carries an `x5c` certificate
// chain: [ leaf, intermediate, Apple Root CA - G3 ]. We verify it entirely
// offline — no Apple Server API credentials required — by:
//   1. rebuilding the certificate chain from the `x5c` header,
//   2. proving the chain terminates at the *pinned* Apple Root CA - G3 that we
//      ship in src/config (so a self-signed/forged chain cannot pass),
//   3. verifying the JWS signature with the leaf certificate's public key,
//   4. returning the decoded transaction payload for the caller to check
//      (bundleId, productId, expiry, environment).
//
// If we ever obtain App Store Server API credentials we can layer a live
// `transactions/{id}` lookup on top of this; the offline check stays valid.
// -----------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APPLE_ROOT_PEM = fs.readFileSync(
  path.join(__dirname, "..", "config", "apple-root-ca-g3.pem"),
  "utf8"
);
const APPLE_ROOT_CERT = new crypto.X509Certificate(APPLE_ROOT_PEM);

const b64urlToBuffer = (input) =>
  Buffer.from(String(input || "").replace(/-/g, "+").replace(/_/g, "/"), "base64");

const decodeJwsSegment = (segment) => JSON.parse(b64urlToBuffer(segment).toString("utf8"));

const isWithinValidity = (cert) => {
  const now = Date.now();
  const from = new Date(cert.validFrom).getTime();
  const to = new Date(cert.validTo).getTime();
  return Number.isFinite(from) && Number.isFinite(to) && now >= from && now <= to;
};

/**
 * Verify a StoreKit 2 signed JWS string.
 * @param {string} jws the signed transaction representation from StoreKit 2.
 * @param {object} [opts]
 * @param {crypto.X509Certificate} [opts.trustedRoot] root to pin against
 *        (defaults to the bundled Apple Root CA - G3; overridable for tests).
 * @returns {{ payload: object, header: object }} the verified transaction payload.
 * @throws {Error} with a `.code` describing why verification failed.
 */
export const verifyAppleSignedData = (jws, { trustedRoot = APPLE_ROOT_CERT } = {}) => {
  const parts = String(jws || "").split(".");
  if (parts.length !== 3) {
    const e = new Error("Malformed Apple JWS (expected 3 segments)");
    e.code = "APPLE_JWS_MALFORMED";
    throw e;
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const header = decodeJwsSegment(headerB64);

  if (header.alg !== "ES256") {
    const e = new Error(`Unexpected Apple JWS alg: ${header.alg}`);
    e.code = "APPLE_JWS_ALG";
    throw e;
  }
  if (!Array.isArray(header.x5c) || header.x5c.length < 2) {
    const e = new Error("Apple JWS missing x5c certificate chain");
    e.code = "APPLE_JWS_NO_CHAIN";
    throw e;
  }

  // Build the certificate chain from the header (leaf → intermediate → root).
  const chain = header.x5c.map((c) => new crypto.X509Certificate(Buffer.from(c, "base64")));
  const leaf = chain[0];
  const intermediate = chain[1];

  // All presented certs must currently be valid.
  for (const cert of chain) {
    if (!isWithinValidity(cert)) {
      const e = new Error("Apple JWS certificate is expired or not yet valid");
      e.code = "APPLE_CERT_VALIDITY";
      throw e;
    }
  }

  // Pin: the intermediate must be signed by *our* bundled Apple Root CA - G3.
  // We deliberately trust our pinned root rather than the root inside x5c.
  if (!intermediate.checkIssued(trustedRoot) || !intermediate.verify(trustedRoot.publicKey)) {
    const e = new Error("Apple JWS chain does not terminate at the pinned Apple Root CA - G3");
    e.code = "APPLE_CHAIN_UNTRUSTED";
    throw e;
  }

  // The leaf must be signed by that intermediate.
  if (!leaf.checkIssued(intermediate) || !leaf.verify(intermediate.publicKey)) {
    const e = new Error("Apple JWS leaf certificate is not issued by the intermediate");
    e.code = "APPLE_CHAIN_BROKEN";
    throw e;
  }

  // Verify the JWS signature over `header.payload` with the leaf's public key.
  // Apple emits the raw IEEE-P1363 (r||s) signature format used by JOSE.
  const signatureValid = crypto.verify(
    "sha256",
    Buffer.from(`${headerB64}.${payloadB64}`),
    { key: leaf.publicKey, dsaEncoding: "ieee-p1363" },
    b64urlToBuffer(signatureB64)
  );
  if (!signatureValid) {
    const e = new Error("Apple JWS signature verification failed");
    e.code = "APPLE_SIGNATURE_INVALID";
    throw e;
  }

  return { header, payload: decodeJwsSegment(payloadB64) };
};

/**
 * Decode a JWS payload WITHOUT verifying it. For logging/diagnostics only —
 * never trust the result for granting entitlements.
 */
export const decodeAppleSignedDataUnsafe = (jws) => {
  try {
    const parts = String(jws || "").split(".");
    if (parts.length !== 3) return null;
    return decodeJwsSegment(parts[1]);
  } catch {
    return null;
  }
};
