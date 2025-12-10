import User from "../models/User.js";
import { generateToken } from "../utils/jwt.js";

export const register = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // 1. Required fields validation
    if (!name || !password) {
      return res.status(400).json({
        success: false,
        message: "Name and password are required."
      });
    }

    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        message: "Either email or phone is required."
      });
    }

    // 2. Check if user already exists (email or phone)
    const existingUser = await User.findOne({
      $or: [{ email }, { phone }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email or phone."
      });
    }

    // 3. Create new user
    const user = await User.create({
      name,
      email,
      phone,
      password
    });

    // 4. Generate JWT token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: "User registered successfully.",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        token
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error in registration.",
      error: error.message
    });
  }
};



export const login = async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    // At least one of email or phone must be provided
    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        message: "Email or phone is required to login."
      });
    }

    // Find user using email or phone
    const user = await User.findOne({
      $or: [{ email }, { phone }]
    }).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid password."
      });
    }

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: "Login successful.",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        token
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error in login.",
      error: error.message
    });
  }
};
