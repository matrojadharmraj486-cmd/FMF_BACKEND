import nodemailer from "nodemailer";

export const sendOtpEmail = async (to, otp) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  await transporter.sendMail({
    from: `"FMF App" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Your OTP Code",
    html: `<h2>Your OTP is <b>${otp}</b></h2>`
  });
};
