import "dotenv/config";
import fs from "fs";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import {
  sourceAccount,
  destAccount,
  withAccount,
  listAllResources,
  runPooled,
  errorMessage,
  RESOURCE_TYPES
} from "./lib/cloudinary-accounts.js";

const APPLY = process.argv.includes("--apply");
const CONCURRENCY = Number(process.env.MIGRATE_CONCURRENCY || 5);
const STATE_FILE = path.join(process.cwd(), "scripts", ".cloudinary-migrate-state.json");

const loadState = () => {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return { done: {} };
  }
};

const saveState = (state) => {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
};

const run = async () => {
  const source = sourceAccount();
  const dest = destAccount();

  if (source.cloudName === dest.cloudName) {
    throw new Error("Source and destination are the same cloud. Check CLOUDINARY_DEST_CLOUD_NAME.");
  }

  const state = loadState();

  const resources = [];
  const listErrors = [];
  for (const resourceType of RESOURCE_TYPES) {
    try {
      const found = await listAllResources(source, resourceType);
      resources.push(...found);
    } catch (e) {
      listErrors.push(`${resourceType}: ${errorMessage(e)}`);
    }
  }

  // A total listing failure (bad credentials, network) must not look like "nothing to migrate" —
  // that reads as success and would green-light the DB rewrite against an empty destination.
  if (listErrors.length === RESOURCE_TYPES.length) {
    throw new Error(`Could not list any assets from "${source.cloudName}":\n  ${listErrors.join("\n  ")}`);
  }
  for (const err of listErrors) {
    console.warn(`Warning: skipped a resource type — ${err}`);
  }

  const pending = resources.filter((r) => !state.done[`${r.resource_type}:${r.public_id}`]);

  console.log(
    `${source.cloudName} -> ${dest.cloudName}: ${resources.length} assets found, ` +
      `${resources.length - pending.length} already copied, ${pending.length} to copy.`
  );

  if (!APPLY) {
    for (const r of pending.slice(0, 20)) {
      console.log(`  would copy ${r.resource_type}: ${r.public_id}`);
    }
    if (pending.length > 20) console.log(`  ...and ${pending.length - 20} more`);
    console.log("\nDry run. Nothing was copied. Re-run with --apply to perform the copy.");
    return;
  }

  let copied = 0;
  let failed = 0;

  const results = await runPooled(pending, CONCURRENCY, async (r) => {
    const key = `${r.resource_type}:${r.public_id}`;
    try {
      // public_id already carries the folder path, so `folder` must not be set alongside it.
      // overwrite:false makes re-runs idempotent — an existing asset is returned, not duplicated.
      const uploaded = await cloudinary.uploader.upload(
        r.secure_url,
        withAccount(dest, {
          public_id: r.public_id,
          resource_type: r.resource_type,
          type: r.type,
          overwrite: false,
          use_filename: false,
          unique_filename: false,
          invalidate: false
        })
      );
      state.done[key] = { url: uploaded.secure_url, bytes: uploaded.bytes };
      copied++;
      if (copied % 25 === 0) {
        saveState(state);
        console.log(`  ${copied}/${pending.length} copied...`);
      }
      return { ok: true };
    } catch (e) {
      failed++;
      return { ok: false, publicId: r.public_id, error: errorMessage(e) };
    }
  });

  saveState(state);

  const failures = results.filter((r) => r && !r.ok);
  console.log(JSON.stringify({ copied, failed, failures: failures.slice(0, 25) }, null, 2));
  console.log(`\nState written to ${STATE_FILE} — re-running skips assets already copied.`);
  if (failed) process.exitCode = 1;
};

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
