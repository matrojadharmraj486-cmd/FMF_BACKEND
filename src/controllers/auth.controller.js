const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const User = require('../models/user.model');
const otpService = require('../services/otp.service');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// 1️⃣ Send OTP
const sendOtp = catchAsync(async (req, res) => {
  const { email, mobile } = req.body;

  if (!email && !mobile) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email or mobile is required');
  }

  const otp = await otpService.generateOtp(email || mobile);
  res.status(httpStatus.OK).send({ message: 'OTP sent successfully', otp }); // (send otp in response only for dev/testing)
});

// 2️⃣ Check if user exists
const checkUserExistence = catchAsync(async (req, res) => {
  const { email, mobile } = req.body;

  const user = await User.findOne({
    $or: [{ email }, { mobile }],
  });

  if (user) {
    return res.status(httpStatus.OK).send({ exists: true, user });
  }
  res.status(httpStatus.OK).send({ exists: false });
});

// 3️⃣ Register user
const registerUser = catchAsync(async (req, res) => {
  const { name, email, mobile, password, otp } = req.body;

  const isValidOtp = await otpService.verifyOtp(email || mobile, otp);
  if (!isValidOtp) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid or expired OTP');
  }

  const user = await User.create({ name, email, mobile, password });
  res.status(httpStatus.CREATED).send(user);
});

// 4️⃣ Verify OTP
const verifyOtp = catchAsync(async (req, res) => {
  const { email, mobile, otp } = req.body;

  const isValid = await otpService.verifyOtp(email || mobile, otp);
  if (!isValid) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid or expired OTP');
  }

  res.status(httpStatus.OK).send({ verified: true });
});

// 5️⃣ Login
const loginUser = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (!user || !(await user.isPasswordMatch(password))) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect email or password');
  }

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1d' });
  res.status(httpStatus.OK).send({ message: 'Login successful', token, user });
});

module.exports = {
  sendOtp,
  checkUserExistence,
  registerUser,
  verifyOtp,
  loginUser,
};
