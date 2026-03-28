import User from "../models/User.js";
import Otp from "../models/Otp.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { sendBulk9Email } from "../utils/bulk9.js";
import { generateOtp, getOtpExpiry, hashOtp, formatOtpMessage } from "../utils/otp.js";
import { sendSmtpEmail } from "../utils/email.js";

export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });

  if (!user)
    return errorResponse(res, 404, "User not found");

  const otp = generateOtp();
  const expiresAt = getOtpExpiry();
  const ttlMinutes = Number(process.env.OTP_TTL_MINUTES || 5);
  const message = formatOtpMessage(otp, ttlMinutes);

  await Otp.deleteMany({ identifier: email });

  await Otp.create({
    identifier: email,
    otp: hashOtp(otp, email),
    expiresAt
  });

  try {
    const subject = process.env.BULK9_EMAIL_SUBJECT || "Your OTP";
    if (process.env.BULK9_EMAIL_URL) {
      const response = await sendBulk9Email({
        to: email,
        subject,
        message,
        otp
      });

      if (!response.ok)
        return errorResponse(res, 502, "Failed to send OTP email");
    } else {
      await sendSmtpEmail({
        to: email,
        subject,
        text: message
      });
    }
  } catch (err) {
    return errorResponse(res, 502, err.message || "Failed to send OTP email");
  }

  return successResponse(res, 200, "OTP sent to email", {
    email,
    expiresIn: `${ttlMinutes} minutes`
  });
};
