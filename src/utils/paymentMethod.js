// Resolves the human-facing payment source/method for a Payment document.
//
// The mobile app creates a Razorpay order first, so `Payment.provider` defaults
// to "razorpay" — but the user may actually be charged through the Apple App
// Store or Google Play in-app purchase. In that case `Payment.platform` is set
// to "apple"/"google" when the purchase is verified. The store platform, when
// present, is therefore the source of truth for how the user actually paid;
// `provider` is only the fallback (used by genuine Razorpay payments, and by
// IAP payments created directly through the productId fallback path).

const SOURCE_LABELS = {
  apple: "App Store",
  google: "Google Play",
  razorpay: "Razorpay"
};

// Returns a canonical source key: "apple" | "google" | "razorpay" (or the raw
// lowercased provider if it is something else entirely).
export const resolvePaymentSource = (payment = {}) => {
  const platform = String(payment?.platform || "").trim().toLowerCase();
  if (platform === "apple" || platform === "ios") return "apple";
  if (platform === "google" || platform === "android") return "google";

  const provider = String(payment?.provider || "").trim().toLowerCase();
  if (provider === "apple" || provider === "ios") return "apple";
  if (provider === "google" || provider === "android") return "google";
  if (provider === "razorpay") return "razorpay";

  return provider || "razorpay";
};

// Returns the display label shown in the admin panel / invoices.
export const resolvePaymentMethodLabel = (payment = {}) => {
  const source = resolvePaymentSource(payment);
  if (SOURCE_LABELS[source]) return SOURCE_LABELS[source];
  return source ? source.charAt(0).toUpperCase() + source.slice(1) : "Razorpay";
};

export default resolvePaymentMethodLabel;
