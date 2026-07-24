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

    // Screenshot 1: Backlog column
    await page.screenshot({ path: path.join(__dirname, "01-backlog-column.png") });
    console.log("Captured: 01-backlog-column.png");

    // Navigate right to Ready
    const nextBtn = page.locator('[aria-label="Next column"]');
    await nextBtn.click();
    await page.waitForTimeout(600);
    title = await page.textContent("h1");
    console.log(`After next: ${title}`);

    // Screenshot 2: Ready column
    await page.screenshot({ path: path.join(__dirname, "02-ready-column.png") });
    console.log("Captured: 02-ready-column.png");

    // Navigate right to In Progress
    await nextBtn.click();
    await page.waitForTimeout(600);
    title = await page.textContent("h1");
    console.log(`After next: ${title}`);

    // Screenshot 3: In Progress column
    await page.screenshot({ path: path.join(__dirname, "03-in-progress-column.png") });
    console.log("Captured: 03-in-progress-column.png");

    // Navigate left to Ready
    const prevBtn = page.locator('[aria-label="Previous column"]');
    await prevBtn.click();
    await page.waitForTimeout(600);
    title = await page.textContent("h1");
    console.log(`After prev: ${title}`);

    // Screenshot 4: Back at Ready
    await page.screenshot({ path: path.join(__dirname, "04-back-to-ready.png") });
    console.log("Captured: 04-back-to-ready.png");

    // Navigate to Done (last column)
    await page.locator('[aria-label="Done"]').click();
    await page.waitForTimeout(600);
    title = await page.textContent("h1");
    console.log(`After Done dot: ${title}`);

    // Screenshot 5: Done - boundary
    await page.screenshot({ path: path.join(__dirname, "05-done-column-boundary.png") });
    console.log("Captured: 05-done-column-boundary.png");

    console.log(`Next disabled at Done: ${await nextBtn.isDisabled()}`);

    // Back to Backlog
    await page.locator('[aria-label="Backlog"]').click();
    await page.waitForTimeout(600);

    // Screenshot 6: Backlog - boundary
    await page.screenshot({ path: path.join(__dirname, "06-backlog-boundary.png") });
    console.log("Captured: 06-backlog-boundary.png");

    console.log(`Prev disabled at Backlog: ${await prevBtn.isDisabled()}`);
    console.log("\nAll screenshots captured successfully.");
  } catch (error) {
    console.error("Error:", error);
    try {
      await page.screenshot({ path: path.join(__dirname, "error-state.png"), fullPage: true });
    } catch {}
    throw error;
  } finally {
    await browser.close();
  }
}

main();
