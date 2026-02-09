export const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  const otpDoc = await Otp.findOne({ identifier: email, otp });

  if (!otpDoc)
    return errorResponse(res, 400, "Invalid OTP");

  const user = await User.findOne({ email });

  user.password = newPassword;
  await user.save();

  await Otp.deleteOne({ _id: otpDoc._id });

  return successResponse(res, 200, "Password reset successful");
};
