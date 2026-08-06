import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
  fullName: String,
  gender: String,
  email: { type: String, unique: true, sparse: true },
  mobileNumber: { type: String, unique: true, sparse: true },
  age: Number,
  role: { type: String, default: "App" },
  isSubscribed: { type: Boolean, default: false },
  subscription: {
    plan: { type: mongoose.Schema.Types.ObjectId, ref: "Subscription" },
    status: {
      type: String,
      enum: ["active", "expired", "canceled"],
      default: "expired"
    },
    startDate: Date,
    endDate: Date,
    lastPaymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" }
  },
  state: {
    id: String,
    name: String
  },
  district: {
    id: String,
    name: String
  },

  profileImg: String,
  address: {
    addressLine1: String,
    addressLine2: String,
    city: String,
    state: String,
    country: String,
    pincode: String
  },
  cityId: mongoose.Schema.Types.ObjectId,
  password: { type: String, select: false },
  isVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
  // Firebase Auth uid. Only set on accounts that signed in with Google/Apple,
  // so the sparse unique index ignores every password/OTP account.
  firebaseUid: { type: String, unique: true, sparse: true },
  authProvider: { type: String, default: "local" },
  // Single-device login. Every app login writes a fresh id here and stamps it
  // into the JWT, so the token held by the previously signed-in device stops
  // matching and is rejected on its next request. Admin accounts are exempt.
  activeSessionId: { type: String, default: null },
  // Set only when the client sends one. Lets the same physical device log in
  // again (retry, token refresh) without rotating the session on itself.
  activeDeviceId: { type: String, default: "" },
  lastLogin: Date
}, { timestamps: true });

// Social sign-in gives us no phone number, so these are collected afterwards
// through the profile screen before the account counts as usable.
export const PROFILE_REQUIRED_FIELDS = ["fullName", "mobileNumber"];

userSchema.methods.getMissingProfileFields = function () {
  return PROFILE_REQUIRED_FIELDS.filter((field) => !String(this[field] ?? "").trim());
};

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function (password) {
  // Social-only accounts have no password; bcrypt would throw on undefined.
  if (!this.password) return false;
  return bcrypt.compare(password, this.password);
};

export default mongoose.model("User", userSchema);
