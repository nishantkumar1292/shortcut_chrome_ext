// ============================================================
// Build the Chrome Web Store upload package
// ============================================================
// Produces shortcut-to-url-v<version>-chrome-web-store.zip from an
// EXPLICIT allow-list of files, so dev tooling (scripts, screenshots,
// node_modules, package files, the unreferenced source icon.png) can
// never accidentally end up in the published package.
//
// Usage:  node scripts/build-zip.mjs
// ============================================================

import { execFileSync } from "node:child_process";
import { existsSync, rmSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// The complete set of files that make up the published extension.
// Anything not listed here is intentionally excluded.
const FILES = [
  "manifest.json",
  "background.js",
  "shortcut-status.js",
  "popup.html",
  "popup.css",
  "popup.js",
  "options.html",
  "options.css",
  "options.js",
  "icon16.png",
  "icon32.png",
  "icon48.png",
  "icon128.png",
];

const manifest = JSON.parse(readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
const version = manifest.version;
const zipName = `shortcut-to-url-v${version}-chrome-web-store.zip`;
const zipPath = path.join(ROOT, zipName);

// Fail loudly if anything in the allow-list is missing.
const missing = FILES.filter((f) => !existsSync(path.join(ROOT, f)));
if (missing.length) {
  console.error("Cannot build package — missing files:\n  " + missing.join("\n  "));
  process.exit(1);
}

// Always start from a fresh archive.
if (existsSync(zipPath)) rmSync(zipPath);

// -X strips extra macOS attributes; -q keeps output quiet.
execFileSync("zip", ["-q", "-X", zipPath, ...FILES], { cwd: ROOT });

const sizeKb = (statSync(zipPath).size / 1024).toFixed(1);
console.log(`Built ${zipName}`);
console.log(`  ${FILES.length} files, ${sizeKb} KB`);
console.log(`  ${zipPath}`);
