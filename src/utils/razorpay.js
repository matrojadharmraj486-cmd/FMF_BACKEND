import Razorpay from "razorpay";

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || !keySecret) {
  console.warn("RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is missing");
}

const razorpay =
  keyId && keySecret
    ? new Razorpay({
        key_id: keyId,
        key_secret: keySecret
      })
    : null;

export { razorpay, keyId, keySecret };
