import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE = __dirname;
const APP_URL = "http://127.0.0.1:5173/backlog-frontend/";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 430, height: 932 }, // iPhone-like viewport
  deviceScaleFactor: 2,
});

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(EVIDENCE, name), fullPage: false });
  console.log(`Captured: ${name}`);
}

async function waitForApp(page) {
  // Wait for either the board (data loaded) or error state
  await page.waitForFunction(() => {
    const hasCards = document.querySelector('[class*="rounded-xl"]');
    const hasError = document.querySelector('[class*="error"]');
    const hasSkeleton = document.querySelector('[class*="skeleton"]');
    return (hasCards || hasError) && !document.querySelector("text=Loading");
  }, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1000);
}

try {
  const page = await context.newPage();
  await page.goto(APP_URL, { waitUntil: "networkidle", timeout: 30000 });

  // Wait for the app to load
  await waitForApp(page);
  await screenshot(page, "01-board-loaded.png");

  // Click on a story card to open the detail overlay
  const storyCard = page.locator('text=CIQ-').first();
  if (await storyCard.isVisible({ timeout: 5000 }).catch(() => false)) {
    await storyCard.click();
    await page.waitForTimeout(500);

    // Check if the detail overlay opened
    const transitionSection = page.locator('text=Transition');
    if (await transitionSection.isVisible({ timeout: 3000 }).catch(() => false)) {
      await screenshot(page, "02-detail-overlay-open.png");

      // Click a transition button (e.g. "Ready")
      const readyButton = page.locator('button:has-text("Ready")');
      if (await readyButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await readyButton.click();
        await page.waitForTimeout(500);
        await screenshot(page, "03-after-transition-click.png");

        // Check if error banner appeared (transition may fail without auth)
        const errorBanner = page.locator('[class*="accent-danger"]');
        if (await errorBanner.isVisible({ timeout: 3000 }).catch(() => false)) {
          await screenshot(page, "04-error-banner.png");

          // Click Dismiss
          const dismissButton = page.locator('button:has-text("Dismiss")');
          if (await dismissButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await dismissButton.click();
            await page.waitForTimeout(300);
            await screenshot(page, "05-error-dismissed.png");
          }
        }
      }
    }
  }
} catch (e) {
  console.error("Screenshot capture error:", e.message);
} finally {
  await browser.close();
}
console.log("Screenshots complete");
