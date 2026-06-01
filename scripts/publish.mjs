// ============================================================
// Publish the extension to the Chrome Web Store (CWS API v1.1)
// ============================================================
// Uploads the built package and submits it for publishing.
//
// Credentials are read from environment variables and are NEVER
// committed. Provide them via your shell or a gitignored .env file:
//
//   CWS_CLIENT_ID       OAuth 2.0 client ID
//   CWS_CLIENT_SECRET   OAuth 2.0 client secret
//   CWS_REFRESH_TOKEN   refresh token for that client
//   CWS_EXTENSION_ID    the published extension's app ID
//
// Usage:
//   node scripts/build-zip.mjs            # build the package first
//   node --env-file=.env scripts/publish.mjs   # then publish
//   # (or: export the vars, then `node scripts/publish.mjs`)
//
// See scripts/PUBLISHING.md for how to obtain the credentials.
// ============================================================

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const CLIENT_ID = process.env.CWS_CLIENT_ID;
const CLIENT_SECRET = process.env.CWS_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.CWS_REFRESH_TOKEN;
const EXTENSION_ID = process.env.CWS_EXTENSION_ID;

const missing = Object.entries({
  CWS_CLIENT_ID: CLIENT_ID,
  CWS_CLIENT_SECRET: CLIENT_SECRET,
  CWS_REFRESH_TOKEN: REFRESH_TOKEN,
  CWS_EXTENSION_ID: EXTENSION_ID,
})
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missing.length) {
  console.error("Missing required env vars:\n  " + missing.join("\n  "));
  console.error("\nSee scripts/PUBLISHING.md for how to obtain them.");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
const zipName = `shortcut-to-url-v${manifest.version}-chrome-web-store.zip`;
const zipPath = path.join(ROOT, zipName);

if (!existsSync(zipPath)) {
  console.error(`Package not found: ${zipName}`);
  console.error("Run `node scripts/build-zip.mjs` first.");
  process.exit(1);
}

async function getAccessToken() {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`OAuth token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function uploadPackage(token) {
  const res = await fetch(
    `https://www.googleapis.com/upload/chromewebstore/v1.1/items/${EXTENSION_ID}`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "x-goog-api-version": "2" },
      body: readFileSync(zipPath),
    }
  );
  const data = await res.json();
  if (!res.ok || data.uploadState === "FAILURE") {
    throw new Error(`Upload failed: ${JSON.stringify(data, null, 2)}`);
  }
  return data;
}

async function submitForPublish(token) {
  const res = await fetch(
    `https://www.googleapis.com/chromewebstore/v1.1/items/${EXTENSION_ID}/publish`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "x-goog-api-version": "2",
        "Content-Length": "0",
      },
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Publish failed: ${JSON.stringify(data, null, 2)}`);
  return data;
}

async function main() {
  console.log(`Publishing ${zipName} → extension ${EXTENSION_ID}`);
  const token = await getAccessToken();
  console.log("✓ Authenticated");
  const up = await uploadPackage(token);
  console.log(`✓ Uploaded (state: ${up.uploadState})`);
  const pub = await submitForPublish(token);
  console.log(`✓ Submitted (status: ${JSON.stringify(pub.status)})`);
  console.log(
    "\nDone. Google may hold the update for review before it goes live — " +
      "track it in the Developer Dashboard."
  );
}

main().catch((err) => {
  console.error("\n" + (err.message || err));
  process.exit(1);
});
