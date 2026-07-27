import { chromium, type Page } from "playwright";
import path from "path";

const EVIDENCE_DIR = path.resolve(
  ".no-mistakes/evidence/fm/blf-008-transparency-fix"
);

// Mock Supabase REST API responses
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

async function loadBoardWithCIQ(page: Page, port: number) {
  await page.goto(`http://localhost:${port}/backlog-frontend/`);
  await page.evaluate(() => {
    localStorage.setItem("backlog-last-project-id", "3");
  });
  await page.reload();
  await page.waitForSelector("text=CIQ-002", { timeout: 10000 });
  await page.waitForTimeout(500);
}

async function main() {
  // Parse port from command line or default
  const port = parseInt(process.argv[2] ?? "5200", 10);
  console.log(`Connecting to dev server on port ${port}...`);

  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  await setupMockRoutes(page);

  await loadBoardWithCIQ(page, port);

  // Screenshot 1: Board loaded with Backlog column
  await page.screenshot({
    path: path.join(EVIDENCE_DIR, "01-board-loaded.png"),
    fullPage: false,
  });
  console.log("Screenshot 1: Board loaded");

  // Click CIQ-002 to open the detail overlay
  await page.click("text=CIQ-002");
  await page.waitForSelector("text=Sign in to edit", { timeout: 5000 });

  // --- KEY VALIDATION: Check overlay background is NOT transparent ---
  const overlayBgCheck = await page.evaluate(() => {
    const overlay = document.querySelector(".animate-slide-in-right");
    if (!overlay) return { error: "Overlay not found" };
    const style = getComputedStyle(overlay);
    return {
      backgroundColor: style.backgroundColor,
      position: style.position,
      inset: `${style.top} ${style.right} ${style.bottom} ${style.left}`,
      zIndex: style.zIndex,
    };
  });
  console.log("Overlay computed styles:", JSON.stringify(overlayBgCheck, null, 2));

  // Validate: background should be rgb(11, 14, 20) = #0B0E14 (canvas color)
  const expectedBg = "rgb(11, 14, 20)";
  const bgIsOpaque = overlayBgCheck.backgroundColor === expectedBg;
  console.log(`Background color: ${overlayBgCheck.backgroundColor}`);
  console.log(`Expected: ${expectedBg}`);
  console.log(`Background is opaque (matches canvas): ${bgIsOpaque ? "PASS" : "FAIL"}`);

  // Additional: verify the CSS custom property resolves correctly
  const cssVarCheck = await page.evaluate(() => {
    const overlay = document.querySelector(".animate-slide-in-right");
    if (!overlay) return null;
    const style = getComputedStyle(overlay);
    // Check that --color-canvas exists on root
    const rootStyle = getComputedStyle(document.documentElement);
    return {
      canvasVar: rootStyle.getPropertyValue("--color-canvas").trim(),
      overlayBgVar: style.backgroundColor,
    };
  });
  console.log("CSS variable check:", JSON.stringify(cssVarCheck, null, 2));

  // Screenshot 2: Detail overlay open with opaque background
  await page.screenshot({
    path: path.join(EVIDENCE_DIR, "02-detail-overlay-open.png"),
    fullPage: false,
  });
  console.log("Screenshot 2: Detail overlay open (with opaque background)");

  // Verify all four utility classes resolve correctly
  const classBgCheck = await page.evaluate(() => {
    // Create temporary test elements to verify each class works
    const testCases = [
      { cls: "bg-canvas", expectedVar: "--color-canvas" },
      { cls: "bg-surface", expectedVar: "--color-surface" },
      { cls: "bg-surface-raised", expectedVar: "--color-surface-raised" },
      { cls: "bg-surface-hover", expectedVar: "--color-surface-hover" },
    ];
    const results: any[] = [];
    for (const { cls, expectedVar } of testCases) {
      const el = document.createElement("div");
      el.className = cls;
      el.style.position = "absolute";
      el.style.visibility = "hidden";
      document.body.appendChild(el);
      const style = getComputedStyle(el);
      const rootStyle = getComputedStyle(document.documentElement);
      const expectedValue = rootStyle.getPropertyValue(expectedVar).trim();
      results.push({
        class: cls,
        computedBg: style.backgroundColor,
        cssVar: expectedVar,
        cssVarValue: expectedValue,
        classExists: style.backgroundColor !== "rgba(0, 0, 0, 0)",
      });
      document.body.removeChild(el);
    }
    return results;
  });
  console.log("Utility class validation:");
  for (const r of classBgCheck) {
    console.log(`  .${r.class}: ${r.classExists ? "EXISTS" : "MISSING"} (bg=${r.computedBg}, var=${r.cssVar}=${r.cssVarValue})`);
  }

  await context.close();
  await browser.close();

  // Final verdict
  console.log("\n=== VERDICT ===");
  if (!bgIsOpaque) {
    console.log("FAIL: Overlay background is transparent or wrong color - bug is NOT fixed");
    process.exit(1);
  }
  const allClassesExist = classBgCheck.every(r => r.classExists);
  if (!allClassesExist) {
    console.log("FAIL: Some utility classes are missing from generated CSS");
    process.exit(1);
  }
  console.log("PASS: All validation checks passed. The transparency bug is fixed.");
}

main().catch((err) => {
  console.error("Visual test failed:", err);
  process.exit(1);
});
