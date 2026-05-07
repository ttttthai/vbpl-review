// Best-effort install of Chromium for the Playwright scraper. We deliberately
// always exit 0 so that hosts that only need the static site (Render, Vercel,
// Netlify, etc.) don't fail their build over a missing scraper dependency.
//
// The GitHub Action that runs the scraper (.github/workflows/scrape.yml) does
// its own explicit `npx playwright install --with-deps chromium` step so it
// gets the apt-get system libraries — we don't need --with-deps here.

"use strict";

const { execSync } = require("child_process");

try {
  execSync("npx playwright install chromium", { stdio: "inherit" });
} catch (err) {
  console.log("[postinstall] Chromium install skipped:", err.message);
  console.log("[postinstall] (this is fine for static-site deploys; the GitHub Action installs its own browser)");
}

process.exit(0);
