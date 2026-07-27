import { chromium, type Page } from "playwright";
import path from "path";

const EVIDENCE_DIR = path.resolve(
  ".no-mistakes/evidence/fm/blf-008-detail-overlay"
);

// Mock Supabase REST API responses matching the test fixtures, keyed by table name
const MOCK_RESPONSES: Record<string, any[]> = {
  "projects": [
    { id: 1, name: "Alpha Project", slug: "AP", github_repo: null },
    { id: 2, name: "Beta Project", slug: "BP", github_repo: null },
    { id: 3, name: "Contract IQ", slug: "CIQ", github_repo: "DietKyle956/contract-iq" },
  ],
  "stories": [
    { id: 1, project_id: 3, key: "CIQ-001", title: "Set up project scaffolding", description: "Initial project setup with Vite and React", status: "done", acceptance_criteria: ["Project builds", "Tests run"], priority: 1, created_at: "2026-07-01T00:00:00Z", updated_at: "2026-07-02T00:00:00Z", reviewed_by: "Tyler" },
    { id: 2, project_id: 3, key: "CIQ-002", title: "Add authentication", description: "Implement GitHub OAuth login", status: "backlog", acceptance_criteria: ["Login works", "Session persists"], priority: 2, created_at: "2026-07-03T00:00:00Z", updated_at: "2026-07-03T00:00:00Z", reviewed_by: null },
    { id: 3, project_id: 3, key: "CIQ-003", title: "Build Kanban board", description: "Create the mobile-first board UI", status: "backlog", acceptance_criteria: ["Columns render", "Swiping works"], priority: 3, created_at: "2026-07-04T00:00:00Z", updated_at: "2026-07-04T00:00:00Z", reviewed_by: null },
    { id: 4, project_id: 3, key: "CIQ-004", title: "Cancelled story", description: "This one was cancelled", status: "cancelled", acceptance_criteria: [], priority: 4, created_at: "2026-07-05T00:00:00Z", updated_at: "2026-07-05T00:00:00Z", reviewed_by: null },
    { id: 5, project_id: 1, key: "AP-001", title: "Alpha story", description: "A story in another project", status: "backlog", acceptance_criteria: [], priority: 1, created_at: "2026-07-06T00:00:00Z", updated_at: "2026-07-06T00:00:00Z", reviewed_by: null },
  ],
  "blockers": [
    { id: 1, story_id: 2, blocking_story_id: 1, description: "Waiting on CIQ-001 completion", resolved_at: null, created_at: "2026-07-03T00:00:00Z" },
  ],
  "dependencies": [
    { story_id: 2, depends_on_id: 1 },
    { story_id: 3, depends_on_id: 1 },
    { story_id: 3, depends_on_id: 2 },
  ],
};

const SUPABASE_URL = "https://mxxjaefcqgosyqbfyzxk.supabase.co";

function getTableFromPath(pathname: string): string {
  if (pathname.includes("/rest/v1/")) {
    return pathname.replace(/^.*\/rest\/v1\//, "");
  }
  return pathname.split("/").pop() ?? "";
}

async function setupMockRoutes(page: Page) {
  await page.route(`${SUPABASE_URL}/**/*`, async (route) => {
    const url = new URL(route.request().url());
    const table = getTableFromPath(url.pathname);

    if (table === "auth" || url.pathname.includes("/auth/")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      return;
    }

    const data = MOCK_RESPONSES[table] ?? null;
    if (data) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }
  });
}

async function loadBoardWithCIQ(page: Page) {
  await page.goto("http://localhost:5173/backlog-frontend/");
  await page.evaluate(() => {
    localStorage.setItem("backlog-last-project-id", "3");
  });
  await page.reload();
  await page.waitForSelector("text=CIQ-002", { timeout: 10000 });
  await page.waitForTimeout(500);
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  // --- Standard (no reduced-motion) tests ---
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14 size
    deviceScaleFactor: 2,
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  await setupMockRoutes(page);

  await loadBoardWithCIQ(page);

  // Screenshot 1: Board loaded with Backlog column
  await page.screenshot({
    path: path.join(EVIDENCE_DIR, "01-board-loaded.png"),
    fullPage: false,
  });
  console.log("Screenshot 1: Board loaded");

  // Click CIQ-002 to open the detail overlay
  await page.click("text=CIQ-002");

  // Wait for the overlay to appear
  await page.waitForSelector("text=Sign in to edit", { timeout: 5000 });

  // Verify the slide-in-right class is present
  const hasSlideClass = await page.evaluate(() => {
    return document.querySelector(".animate-slide-in-right") !== null;
  });
  console.log(`Overlay has animate-slide-in-right class: ${hasSlideClass}`);

  // Screenshot 2: Detail overlay open
  await page.screenshot({
    path: path.join(EVIDENCE_DIR, "02-detail-overlay-open.png"),
    fullPage: false,
  });
  console.log("Screenshot 2: Detail overlay open");

  // Verify the overlay is full-screen
  const overlayInfo = await page.evaluate(() => {
    const el = document.querySelector(".animate-slide-in-right");
    if (!el) return null;
    return {
      hasFixed: el.classList.contains("fixed"),
      hasInset0: el.classList.contains("inset-0"),
      hasZ50: el.classList.contains("z-50"),
    };
  });
  console.log("Overlay full-screen classes:", JSON.stringify(overlayInfo));

  // Click close button
  await page.click('[aria-label="Close detail"]');
  await page.waitForTimeout(500);

  // Screenshot 3: Board after closing overlay
  await page.screenshot({
    path: path.join(EVIDENCE_DIR, "03-overlay-closed.png"),
    fullPage: false,
  });
  console.log("Screenshot 3: Overlay closed");

  await context.close();

  // --- Reduced-motion tests ---
  console.log("\nTesting reduced-motion preference...");
  const reducedContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
  });
  const reducedPage = await reducedContext.newPage();
  await setupMockRoutes(reducedPage);

  await loadBoardWithCIQ(reducedPage);

  // Click to open detail with reduced motion
  await reducedPage.click("text=CIQ-002");
  await reducedPage.waitForSelector("text=Sign in to edit", { timeout: 5000 });

  // Check that the animation is disabled via the media query
  const reducedMotionInfo = await reducedPage.evaluate(() => {
    const el = document.querySelector(".animate-slide-in-right");
    if (!el) return null;
    const style = getComputedStyle(el);
    return {
      animationName: style.animationName,
      animationDuration: style.animationDuration,
    };
  });
  console.log("Reduced-motion animation state:", JSON.stringify(reducedMotionInfo));

  // Verify animation is "none" when reduced-motion is preferred
  if (reducedMotionInfo && reducedMotionInfo.animationName === "none") {
    console.log("PASS: Animation is disabled under prefers-reduced-motion");
  } else {
    console.log("WARNING: Animation may still be active under prefers-reduced-motion. Check CSS cascade.");
  }

  await reducedPage.screenshot({
    path: path.join(EVIDENCE_DIR, "04-reduced-motion-overlay.png"),
    fullPage: false,
  });
  console.log("Screenshot 4: Overlay with reduced-motion");

  await reducedContext.close();
  await browser.close();

  console.log("\nAll visual evidence captured successfully.");
}

main().catch((err) => {
  console.error("Visual test failed:", err);
  process.exit(1);
});
