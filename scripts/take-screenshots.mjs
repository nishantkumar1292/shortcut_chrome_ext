import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXT_DIR = path.resolve(__dirname, "..");
const SCREENSHOTS_DIR = path.join(EXT_DIR, "screenshots");
const STORE_DIR = path.join(SCREENSHOTS_DIR, "store");

// Sample data to seed into the extension
const SAMPLE_SHORTCUTS = [
  { key: "g", name: "Gmail", url: "mail.google.com" },
  { key: "d", name: "Google Drive", url: "drive.google.com" },
  { key: "h", name: "GitHub", url: "github.com" },
  { key: "y", name: "YouTube", url: "youtube.com" },
];

const SAMPLE_REDIRECT_RULES = [
  {
    name: "AWS SSO Re-auth",
    matchType: "contains",
    matchPattern: "signin.aws.amazon.com/saml",
    redirectUrl: "https://mycompany.awsapps.com/start",
    enabled: true,
  },
  {
    name: "HTTP to HTTPS",
    matchType: "wildcard",
    matchPattern: "http://docs.example.com/*",
    redirectUrl: "https://docs.example.com/",
    enabled: true,
  },
  {
    name: "Old Dashboard",
    matchType: "regex",
    matchPattern: "^https://legacy\\.example\\.com/dashboard",
    redirectUrl: "https://app.example.com/dashboard",
    enabled: false,
  },
];

async function main() {
  // Ensure output directories exist
  fs.mkdirSync(STORE_DIR, { recursive: true });

  console.log("Launching Chromium with extension loaded...");
  const context = await chromium.launchPersistentContext("", {
    headless: false,
    args: [
      `--disable-extensions-except=${EXT_DIR}`,
      `--load-extension=${EXT_DIR}`,
      "--no-first-run",
      "--disable-default-apps",
    ],
  });

  // Wait for the service worker to register so we can find the extension ID
  console.log("Waiting for extension service worker...");
  let extensionId;
  const swTarget = await waitForServiceWorker(context);
  const swUrl = swTarget.url();
  extensionId = swUrl.match(/chrome-extension:\/\/([^/]+)/)?.[1];
  if (!extensionId) {
    throw new Error("Could not determine extension ID from service worker URL");
  }
  console.log(`Extension ID: ${extensionId}`);

  // Seed storage data via the options page
  console.log("Seeding sample data...");
  const setupPage = await context.newPage();
  await setupPage.goto(`chrome-extension://${extensionId}/options.html`);
  await setupPage.waitForLoadState("domcontentloaded");

  await setupPage.evaluate(
    ({ shortcuts, redirectRules }) => {
      return new Promise((resolve) => {
        chrome.storage.sync.set(
          { shortcuts, redirectRules, theme: "dark" },
          resolve
        );
      });
    },
    { shortcuts: SAMPLE_SHORTCUTS, redirectRules: SAMPLE_REDIRECT_RULES }
  );
  await setupPage.close();

  // ------------------------------------------------------------------
  // Screenshot 1: Popup — SKIPPED (capture manually with browser chrome visible)
  // Place your manual screenshot at screenshots/popup.png
  // ------------------------------------------------------------------

  // ------------------------------------------------------------------
  // Screenshot 2: Options page - Shortcuts section
  // ------------------------------------------------------------------
  console.log("Capturing: options-shortcuts");
  const optionsPage = await context.newPage();
  await optionsPage.setViewportSize({ width: 900, height: 700 });
  await optionsPage.goto(`chrome-extension://${extensionId}/options.html`);
  await optionsPage.waitForLoadState("domcontentloaded");
  await optionsPage.waitForSelector(".shortcut-item");
  await sleep(300);
  // Scroll to top to show shortcuts section
  await optionsPage.evaluate(() => window.scrollTo(0, 0));
  await sleep(200);
  await captureScreenshot(optionsPage, "options-shortcuts");

  // ------------------------------------------------------------------
  // Screenshot 3: Options page - Redirects section (NEW)
  // ------------------------------------------------------------------
  console.log("Capturing: options-redirects");
  await optionsPage.waitForSelector(".redirect-item");
  // Scroll to the redirects section
  await optionsPage.evaluate(() => {
    document.querySelector(".redirects-section").scrollIntoView({
      behavior: "instant",
      block: "start",
    });
  });
  await sleep(300);
  await captureScreenshot(optionsPage, "options-redirects");

  // ------------------------------------------------------------------
  // Screenshot 4: Add Shortcut modal
  // ------------------------------------------------------------------
  console.log("Capturing: add-shortcut");
  await optionsPage.evaluate(() => window.scrollTo(0, 0));
  await sleep(200);
  await optionsPage.click("#add-shortcut");
  await optionsPage.waitForSelector("#modal", { state: "visible" });
  // Fill in sample data so the modal looks realistic
  await optionsPage.fill("#shortcut-key", "s");
  await optionsPage.fill("#shortcut-name", "Slack");
  await optionsPage.fill("#shortcut-url", "app.slack.com");
  await sleep(200);
  await captureScreenshot(optionsPage, "add-shortcut");
  await optionsPage.click("#cancel-btn");
  await sleep(200);

  // ------------------------------------------------------------------
  // Screenshot 5: Add Redirect Rule modal (NEW)
  // ------------------------------------------------------------------
  console.log("Capturing: add-redirect");
  // Scroll to redirects section so the modal context makes sense
  await optionsPage.evaluate(() => {
    document.querySelector(".redirects-section").scrollIntoView({
      behavior: "instant",
      block: "start",
    });
  });
  await sleep(200);
  await optionsPage.click("#add-redirect");
  await optionsPage.waitForSelector("#redirect-modal", { state: "visible" });
  // Fill in sample data
  await optionsPage.fill("#redirect-name", "Jira Legacy");
  await optionsPage.selectOption("#redirect-match-type", "contains");
  await optionsPage.fill("#redirect-pattern", "jira.old.example.com");
  await optionsPage.fill("#redirect-url", "https://jira.example.com");
  await sleep(200);
  await captureScreenshot(optionsPage, "add-redirect");
  await optionsPage.click("#redirect-cancel-btn");
  await sleep(200);
  await optionsPage.close();

  // ------------------------------------------------------------------
  // Screenshot 6: Themes (dark + light side by side via sequential capture)
  // ------------------------------------------------------------------
  console.log("Capturing: themes");
  await captureThemeScreenshots(context, extensionId);

  await context.close();
  console.log("\nAll screenshots saved to:");
  console.log(`  README:  ${SCREENSHOTS_DIR}/`);
  console.log(`  Store:   ${STORE_DIR}/`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function waitForServiceWorker(context, timeout = 15000) {
  // Check existing service workers first
  for (const sw of context.serviceWorkers()) {
    if (sw.url().includes("chrome-extension://")) return sw;
  }
  // Wait for one to appear
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Timed out waiting for service worker")),
      timeout
    );
    context.on("serviceworker", (sw) => {
      if (sw.url().includes("chrome-extension://")) {
        clearTimeout(timer);
        resolve(sw);
      }
    });
  });
}

async function captureScreenshot(page, name, opts = {}) {
  // README size — natural page size
  const readmePath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: readmePath, ...opts });
  console.log(`  saved ${readmePath}`);

  // Store size — 1280x800
  const origViewport = page.viewportSize();
  await page.setViewportSize({ width: 1280, height: 800 });
  await sleep(200);
  const storePath = path.join(STORE_DIR, `${name}-1280x800.png`);
  await page.screenshot({ path: storePath });
  console.log(`  saved ${storePath}`);

  // Restore original viewport
  if (origViewport) {
    await page.setViewportSize(origViewport);
    await sleep(100);
  }
}

async function captureThemeScreenshots(context, extensionId) {
  // Capture dark theme options page
  const darkPage = await context.newPage();
  await darkPage.setViewportSize({ width: 900, height: 700 });
  await darkPage.goto(`chrome-extension://${extensionId}/options.html`);
  await darkPage.waitForLoadState("domcontentloaded");
  await darkPage.waitForSelector(".shortcut-item");
  await sleep(300);
  // Ensure dark theme
  await darkPage.evaluate(() => {
    document.body.setAttribute("data-theme", "dark");
    return new Promise((r) =>
      chrome.storage.sync.set({ theme: "dark" }, r)
    );
  });
  await sleep(200);
  const darkPath = path.join(SCREENSHOTS_DIR, "theme-dark-tmp.png");
  await darkPage.screenshot({ path: darkPath });

  // Switch to light theme
  await darkPage.evaluate(() => {
    document.body.setAttribute("data-theme", "light");
    return new Promise((r) =>
      chrome.storage.sync.set({ theme: "light" }, r)
    );
  });
  await sleep(200);
  const lightPath = path.join(SCREENSHOTS_DIR, "theme-light-tmp.png");
  await darkPage.screenshot({ path: lightPath });
  await darkPage.close();

  // Combine side-by-side using Canvas API in a regular page
  const combinerPage = await context.newPage();
  await combinerPage.setViewportSize({ width: 1800, height: 800 });

  const darkBuf = fs.readFileSync(darkPath);
  const lightBuf = fs.readFileSync(lightPath);
  const darkB64 = darkBuf.toString("base64");
  const lightB64 = lightBuf.toString("base64");

  const combinedB64 = await combinerPage.evaluate(
    async ({ darkB64, lightB64 }) => {
      function loadImg(src) {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.src = src;
        });
      }
      const darkImg = await loadImg(`data:image/png;base64,${darkB64}`);
      const lightImg = await loadImg(`data:image/png;base64,${lightB64}`);

      const gap = 24;
      const canvas = document.createElement("canvas");
      canvas.width = darkImg.width + lightImg.width + gap;
      canvas.height = Math.max(darkImg.height, lightImg.height);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#e0e0e0";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(darkImg, 0, 0);
      ctx.drawImage(lightImg, darkImg.width + gap, 0);
      return canvas.toDataURL("image/png").split(",")[1];
    },
    { darkB64, lightB64 }
  );

  // Write combined screenshot
  const readmePath = path.join(SCREENSHOTS_DIR, "themes.png");
  fs.writeFileSync(readmePath, Buffer.from(combinedB64, "base64"));
  console.log(`  saved ${readmePath}`);

  // Store-size version
  const storePath = path.join(STORE_DIR, "themes-1280x800.png");
  // Re-capture at store size
  const storeDarkPage = await context.newPage();
  await storeDarkPage.setViewportSize({ width: 640, height: 800 });
  await storeDarkPage.goto(`chrome-extension://${extensionId}/options.html`);
  await storeDarkPage.waitForLoadState("domcontentloaded");
  await storeDarkPage.waitForSelector(".shortcut-item");
  await sleep(300);

  await storeDarkPage.evaluate(() => {
    document.body.setAttribute("data-theme", "dark");
    return new Promise((r) =>
      chrome.storage.sync.set({ theme: "dark" }, r)
    );
  });
  await sleep(200);
  const storeDarkPath = path.join(SCREENSHOTS_DIR, "store-dark-tmp.png");
  await storeDarkPage.screenshot({ path: storeDarkPath });

  await storeDarkPage.evaluate(() => {
    document.body.setAttribute("data-theme", "light");
    return new Promise((r) =>
      chrome.storage.sync.set({ theme: "light" }, r)
    );
  });
  await sleep(200);
  const storeLightPath = path.join(SCREENSHOTS_DIR, "store-light-tmp.png");
  await storeDarkPage.screenshot({ path: storeLightPath });
  await storeDarkPage.close();

  // Combine at store size
  const sDarkBuf = fs.readFileSync(storeDarkPath);
  const sLightBuf = fs.readFileSync(storeLightPath);
  const sDarkB64 = sDarkBuf.toString("base64");
  const sLightB64 = sLightBuf.toString("base64");

  const storeCombinedB64 = await combinerPage.evaluate(
    async ({ darkB64, lightB64 }) => {
      function loadImg(src) {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.src = src;
        });
      }
      const darkImg = await loadImg(`data:image/png;base64,${darkB64}`);
      const lightImg = await loadImg(`data:image/png;base64,${lightB64}`);

      const gap = 0;
      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 800;
      const ctx = canvas.getContext("2d");

      // Scale each half to fit 640x800
      const halfW = 640;
      ctx.drawImage(darkImg, 0, 0, halfW, 800);
      ctx.drawImage(lightImg, halfW, 0, halfW, 800);
      return canvas.toDataURL("image/png").split(",")[1];
    },
    { darkB64: sDarkB64, lightB64: sLightB64 }
  );

  fs.writeFileSync(storePath, Buffer.from(storeCombinedB64, "base64"));
  console.log(`  saved ${storePath}`);

  await combinerPage.close();

  // Clean up temp files
  for (const f of [darkPath, lightPath, storeDarkPath, storeLightPath]) {
    fs.unlinkSync(f);
  }

  // Reset theme back to dark
  const resetPage = await context.newPage();
  await resetPage.goto(`chrome-extension://${extensionId}/options.html`);
  await resetPage.waitForLoadState("domcontentloaded");
  await resetPage.evaluate(() =>
    new Promise((r) => chrome.storage.sync.set({ theme: "dark" }, r))
  );
  await resetPage.close();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
