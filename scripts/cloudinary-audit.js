import "dotenv/config";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import {
  sourceAccount,
  destAccount,
  withAccount,
  listAllResources,
  folderOf,
  urlMarker,
  errorMessage,
  connectMongo,
  RESOURCE_TYPES
} from "./lib/cloudinary-accounts.js";

const formatBytes = (bytes) => {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = n / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(2)} ${units[unit]}`;
};

const auditAccount = async (account) => {
  const byFolder = new Map();
  const byResourceType = {};
  let totalBytes = 0;
  let totalCount = 0;
  const listErrors = [];

  for (const resourceType of RESOURCE_TYPES) {
    let resources = [];
    try {
      resources = await listAllResources(account, resourceType);
    } catch (e) {
      const message = errorMessage(e);
      listErrors.push(`${resourceType}: ${message}`);
      byResourceType[resourceType] = { error: message };
      continue;
    }
    byResourceType[resourceType] = { count: resources.length };
    for (const r of resources) {
      const key = `${resourceType}:${folderOf(r.public_id)}`;
      const entry = byFolder.get(key) || { count: 0, bytes: 0 };
      entry.count += 1;
      entry.bytes += Number(r.bytes) || 0;
      byFolder.set(key, entry);
      totalBytes += Number(r.bytes) || 0;
      totalCount += 1;
    }
  }

  if (listErrors.length === RESOURCE_TYPES.length) {
    throw new Error(`Could not read account "${account.cloudName}":\n  ${listErrors.join("\n  ")}`);
  }

  let usage = null;
  try {
    const u = await cloudinary.api.usage(withAccount(account));
    usage = {
      plan: u.plan,
      storageUsed: formatBytes(u.storage?.usage),
      objects: u.objects?.usage,
      bandwidthUsed: formatBytes(u.bandwidth?.usage),
      transformations: u.transformations?.usage
    };
  } catch (e) {
    usage = { error: errorMessage(e) };
  }

  const folders = Array.from(byFolder.entries())
    .map(([key, v]) => ({ folder: key, count: v.count, size: formatBytes(v.bytes) }))
    .sort((a, b) => b.count - a.count);

  return {
    cloudName: account.cloudName,
    usage,
    byResourceType,
    totals: { assets: totalCount, size: formatBytes(totalBytes) },
    folders
  };
};

const auditDatabase = async (sourceCloud, destCloud) => {
  const sourceMark = urlMarker(sourceCloud);
  const destMark = destCloud ? urlMarker(destCloud) : null;
  const collections = await mongoose.connection.db.listCollections().toArray();
  const report = [];

  for (const { name } of collections) {
    const docs = await mongoose.connection.db.collection(name).find({}).toArray();
    let sourceRefs = 0;
    let destRefs = 0;
    let localRefs = 0;
    let otherCloudRefs = 0;

    for (const doc of docs) {
      const json = JSON.stringify(doc);
      const count = (needle) => (needle ? json.split(needle).length - 1 : 0);
      sourceRefs += count(sourceMark);
      destRefs += count(destMark);
      localRefs += count('"/uploads/');
      const allCloudRefs = count("res.cloudinary.com/");
      otherCloudRefs += allCloudRefs - count(sourceMark) - count(destMark);
    }

    if (sourceRefs || destRefs || localRefs || otherCloudRefs) {
      report.push({
        collection: name,
        docs: docs.length,
        sourceCloudinaryUrls: sourceRefs,
        destCloudinaryUrls: destRefs,
        localUploadPaths: localRefs,
        otherCloudinaryUrls: otherCloudRefs
      });
    }
  }
  return report;
};

const run = async () => {
  const source = sourceAccount();

  let dest = null;
  try {
    dest = destAccount();
  } catch {
    // Destination is optional for an audit — you may not have created it yet.
  }

  console.log("Auditing source Cloudinary account...");
  const sourceReport = await auditAccount(source);

  let destReport = null;
  if (dest) {
    console.log("Auditing destination Cloudinary account...");
    destReport = await auditAccount(dest);
  }

  // Printed before the DB scan so an unreachable database can't discard the Cloudinary findings.
  console.log("\n===== CLOUDINARY =====");
  console.log(
    JSON.stringify(
      {
        source: sourceReport,
        destination: destReport || "(not configured — set CLOUDINARY_DEST_* to audit it)"
      },
      null,
      2
    )
  );

  console.log("\n===== MONGODB =====");
  try {
    await connectMongo();
    const dbReport = await auditDatabase(source.cloudName, dest?.cloudName);
    console.log(JSON.stringify({ database: dbReport }, null, 2));
  } catch (e) {
    console.error(`Skipped the database scan.\n  ${e.message}`);
    process.exitCode = 1;
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
