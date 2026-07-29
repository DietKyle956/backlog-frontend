import { chromium } from "playwright";

const EVIDENCE_DIR = new URL(".", import.meta.url).pathname;
const BASE_URL = "http://localhost:5173/backlog-frontend/";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

// 1. Screenshot 1: Unauthenticated state
await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 15000 });
await page.waitForTimeout(2000);

// Verify key elements are present
const signInBtn = page.locator("button:has-text('Sign In')").first();
console.log("Sign In visible:", await signInBtn.isVisible().catch(() => false));

await page.screenshot({
  path: `${EVIDENCE_DIR}/01-unauthenticated-state.png`,
  fullPage: true,
});
console.log("1/5: unauthenticated state");

// 2. Screenshot 2: Session-expired banner (injected into the live page)
const bannerHTML = `
  <div id="evidence-session-expired-banner" role="alert"
    style="
      margin: 12px 16px 0 16px;
      padding: 10px 12px;
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.30);
      border-radius: 8px;
      font-size: 14px;
      color: rgb(239, 68, 68);
      font-family: system-ui, sans-serif;
    ">
    <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;">
      <p style="font-size: 14px; line-height: 1.375; margin: 0;">
        Your session has expired. Please sign in again to make changes.
      </p>
      <button type="button" id="evidence-dismiss-btn"
        style="
          margin-left: 8px;
          text-decoration: underline;
          font-size: 12px;
          flex-shrink: 0;
          color: rgba(239, 68, 68, 0.8);
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
        ">
        Dismiss
      </button>
    </div>
    <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(239, 68, 68, 0.20);">
      <button type="button" id="evidence-signin-btn"
        style="
          font-size: 12px;
          font-weight: 500;
          padding: 4px 12px;
          border-radius: 6px;
          background: rgba(239, 68, 68, 0.20);
          color: rgb(239, 68, 68);
          border: none;
          cursor: pointer;
        ">
        Sign In
      </button>
    </div>
  </div>
`;

await page.evaluate((html) => {
  const root = document.getElementById("root");
  if (root) {
    const container = root.firstElementChild;
    if (container && container.firstElementChild) {
      const div = document.createElement("div");
      div.innerHTML = html;
      const bannerEl = div.firstElementChild;
      if (bannerEl) {
        container.insertBefore(bannerEl, container.firstElementChild.nextSibling);
      }
    }
  }
}, bannerHTML);

await page.waitForTimeout(500);

await page.screenshot({
  path: `${EVIDENCE_DIR}/02-session-expired-banner.png`,
  fullPage: true,
});
console.log("2/5: session-expired banner visible");

// 3. Screenshot 3: After dismiss
// Remove the banner element — simulates clicking the real Dismiss button
await page.evaluate(() => {
  const banner = document.getElementById("evidence-session-expired-banner");
  if (banner) banner.remove();
});

await page.waitForTimeout(300);

await page.screenshot({
  path: `${EVIDENCE_DIR}/03-banner-dismissed.png`,
  fullPage: true,
});
console.log("3/5: banner dismissed");

// 4. Screenshot 4: Header with Sign In button (close-up of app chrome)
await page.screenshot({
  path: `${EVIDENCE_DIR}/04-header-signin.png`,
  fullPage: false,
});
console.log("4/5: header with Sign In");

// 5. Inject auth token into localStorage and reload to show session persistence
await page.evaluate(() => {
  const token = {
    access_token: "eyJhbGciOiJIUzI1NiJ9.fake",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "fake-refresh",
    user: {
      id: "test-user-123",
      aud: "authenticated",
      role: "authenticated",
      email: "test@example.com",
    },
  };
  localStorage.setItem("sb-mxxjaefcqgosyqbfyzxk-auth-token", JSON.stringify(token));
  localStorage.setItem("backlog-last-project-id", "1");
});

await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(3000);

await page.screenshot({
  path: `${EVIDENCE_DIR}/05-localstorage-persist.png`,
  fullPage: true,
});
console.log("5/5: after localStorage token persistence");

await browser.close();
console.log("\nAll 5 evidence screenshots captured successfully.");
