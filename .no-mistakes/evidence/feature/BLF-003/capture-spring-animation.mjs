import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = "http://localhost:5173/backlog-frontend/";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  try {
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForSelector("h1", { timeout: 15000 });

    let title = await page.textContent("h1");
    console.log(`Initial column: ${title}`);

    // Navigate to Ready via dot to preload both columns
    // Then go back to Backlog for a clean animation capture
    await page.locator('[aria-label="Ready"]').click();
    await page.waitForTimeout(600);
    await page.locator('[aria-label="Backlog"]').click();
    await page.waitForTimeout(600);

    // Screenshot 1: Before animation (Backlog static)
    await page.screenshot({
      path: path.join(__dirname, "spring-before-animation.png"),
    });
    console.log("Captured: spring-before-animation.png (Backlog - static)");

    // Click Next and IMMEDIATELY capture during spring animation (~150ms)
    const nextBtn = page.locator('[aria-label="Next column"]');
    await nextBtn.click();
    await page.waitForTimeout(150);

    // At 150ms into 400ms animation, springInRight should be around 30%,
    // showing content partially through the overshoot phase
    await page.screenshot({
      path: path.join(__dirname, "spring-during-animation.png"),
    });
    console.log("Captured: spring-during-animation.png (150ms into spring animation)");

    // Wait for animation to complete
    await page.waitForTimeout(400);

    title = await page.textContent("h1");
    console.log(`After animation: ${title}`);

    // Verify spring animation class was present
    const contentArea = page.locator(".overflow-y-auto");
    const hasSpringRight = await contentArea.evaluate((el) =>
      el.classList.contains("animate-spring-in-right")
    );
    console.log(`Spring animation class (spring-in-right) applied: ${hasSpringRight}`);

    // Screenshot 3: After animation settles
    await page.screenshot({
      path: path.join(__dirname, "spring-after-animation.png"),
    });
    console.log("Captured: spring-after-animation.png (Ready - settled)");

    console.log("\nSpring animation evidence captured successfully.");
  } catch (error) {
    console.error("Error:", error);
    try {
      await page.screenshot({
        path: path.join(__dirname, "spring-error-state.png"),
        fullPage: true,
      });
    } catch {}
    throw error;
  } finally {
    await browser.close();
  }
}

main();
