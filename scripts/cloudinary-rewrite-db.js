import "dotenv/config";
import mongoose from "mongoose";
import {
  sourceAccount,
  destAccount,
  urlMarker,
  deepReplace,
  connectMongo
} from "./lib/cloudinary-accounts.js";

const APPLY = process.argv.includes("--apply");

const run = async () => {
  const source = sourceAccount();
  const dest = destAccount();

  if (source.cloudName === dest.cloudName) {
    throw new Error("Source and destination are the same cloud. Check CLOUDINARY_DEST_CLOUD_NAME.");
  }

  const from = urlMarker(source.cloudName);
  const to = urlMarker(dest.cloudName);

  await connectMongo();
  const collections = await mongoose.connection.db.listCollections().toArray();

  const summary = [];
  let totalDocs = 0;
  let totalUrls = 0;

  for (const { name } of collections) {
    const collection = mongoose.connection.db.collection(name);
    const docs = await collection.find({}).toArray();

    let changedDocs = 0;
    let changedUrls = 0;
    const samples = [];

    for (const doc of docs) {
      const { _id, ...rest } = doc;
      const [next, hits] = deepReplace(rest, from, to);
      if (!hits) continue;

      changedDocs++;
      changedUrls += hits;
      if (samples.length < 3) samples.push(String(_id));

      if (APPLY) {
        await collection.replaceOne({ _id }, next);
      }
    }

    if (changedDocs) {
      summary.push({ collection: name, changedDocs, changedUrls, sampleIds: samples });
      totalDocs += changedDocs;
      totalUrls += changedUrls;
    }
  }

  console.log(
    JSON.stringify(
      { mode: APPLY ? "applied" : "dry-run", from, to, totalDocs, totalUrls, summary },
      null,
      2
    )
  );

  if (!APPLY) {
    console.log("\nDry run. Nothing was written. Back up MongoDB, then re-run with --apply.");
  }
};

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
