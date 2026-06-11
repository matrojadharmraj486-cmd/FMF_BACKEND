import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../src/config/database.js";
import Banner from "../src/models/Banner.js";
import { getBannerTypeAliases } from "../src/utils/bannerTypes.js";

const run = async () => {
  await connectDB();

  const updates = [1, 2, 3, 4, 5].map(async (number) => {
    const bannerType = `banner${number}`;
    const aliases = getBannerTypeAliases(bannerType).filter((value) => value !== bannerType);
    const result = await Banner.updateMany(
      { bannerType: { $in: aliases } },
      { $set: { bannerType } },
      { runValidators: false }
    );

    return { bannerType, matched: result.matchedCount || 0, modified: result.modifiedCount || 0 };
  });

  const results = await Promise.all(updates);
  console.log(JSON.stringify({ success: true, results }, null, 2));
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
