import Otp from "../models/Otp.js";
import { generateOtp } from "../utils/genarateOtp.js";
import { sendOtpEmail } from "../utils/sendEmail.js";

export const sendOtp = async (req, res) => {
  try {
    const { email, mobileNumber } = req.body;

    if (!email && !mobileNumber) {
      return res.status(400).json({
        status: 400,
        message: "Email or mobile number is required"
      });
    }

    let otp;

    if (mobileNumber) {
      otp = "123456";
    } else {
      otp = generateOtp();
      await sendOtpEmail(email, otp);
    }

    await Otp.deleteMany({ email, mobileNumber });

    await Otp.create({
      email,
      mobileNumber,
      otp,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    });

    return res.json({
      status: 200,
      message: email
        ? "OTP sent to email"
        : "OTP generated for mobile",
      data: {
        isUserExist: false
      }
    });

  } catch (error) {
    return res.status(500).json({
      status: 500,
      message: error.message
    });
  }
};

export const verifyOtp = async (req, res) => {
  const { email, mobileNumber, otp } = req.body;

  const record = await Otp.findOne({
    otp,
    isVerified: false,
    expiresAt: { $gt: new Date() },
    ...(email && { email }),
    ...(mobileNumber && { mobileNumber })
  });

  if (!record) {
    return res.status(400).json({
      status: 400,
      message: "Invalid or expired OTP"
    });
  }

  record.isVerified = true;
  await record.save();

  return res.json({
    status: 200,
    message: "OTP verified successfully",
    data: {
      isVerified: true
    }
  });
};

