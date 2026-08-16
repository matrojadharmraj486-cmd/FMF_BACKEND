// -----------------------------------------------------------------------------
// Google Play (Android) In-App Purchase verification.
//
// Unlike Apple's StoreKit 2 receipts, a Google Play purchase token is an OPAQUE
// string — it carries no signature we can verify offline. The only authoritative
// way to validate it is to call the Google Play Developer API
// (androidpublisher.purchases.subscriptions.get / .products.get) using a Google
// service account that has been granted access in the Play Console.
//
// Those credentials are not yet configured, so this module fails safe: it throws
// a clearly-coded error rather than pretending a purchase is valid. When the
// service account JSON is available, implement `verifyGooglePurchase` here using
// google-auth-library + the androidpublisher REST endpoint, and flip
// `isGooglePlayConfigured` to reflect real configuration.
// -----------------------------------------------------------------------------

export const isGooglePlayConfigured = () =>
  !!process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;

/**
 * Verify an Android Play Billing purchase.
 * @param {{ packageName?: string, productId?: string, purchaseToken?: string }} _params
 * @throws {Error} always, until Google Play Developer API credentials are wired up.
 */
export const verifyGooglePurchase = async (_params) => {
  const e = new Error(
    "Google Play verification is not configured. Provide a Google Play Developer " +
      "API service account (GOOGLE_PLAY_SERVICE_ACCOUNT_JSON) to enable Android IAP."
  );
  e.code = "GOOGLE_PLAY_NOT_CONFIGURED";
  throw e;
};
