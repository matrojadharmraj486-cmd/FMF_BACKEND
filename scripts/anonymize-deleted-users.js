import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../src/config/database.js";
import User from "../src/models/User.js";

const isAlreadyAnonymized = (value) => String(value || "").startsWith("deleted_");

const run = async () => {
  await connectDB();

  const users = await User.find({
    isDeleted: true,
    $or: [
      { email: { $exists: true, $ne: null, $not: /^deleted_/ } },
      { mobileNumber: { $exists: true, $ne: null, $not: /^deleted_/ } }
    ]
  }).select("email mobileNumber");

  let modified = 0;
  for (const user of users) {
    const suffix = `${Date.now()}_${user._id}`;
    const update = { isActive: false };

    if (user.email && !isAlreadyAnonymized(user.email)) {
      update.email = `deleted_${suffix}_${user.email}`;
    }
    if (user.mobileNumber && !isAlreadyAnonymized(user.mobileNumber)) {
      update.mobileNumber = `deleted_${suffix}_${user.mobileNumber}`;
    }

    const result = await User.updateOne({ _id: user._id }, { $set: update });
    modified += Number(result.modifiedCount || 0);
  }

  console.log(JSON.stringify({
    success: true,
    matched: users.length,
    modified
  }, null, 2));
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
