import { chromium } from 'playwright';

const EVIDENCE_DIR = '.no-mistakes/evidence/fm/blf-009-detail-content';
const SUPABASE_URL = 'https://mxxjaefcqgosyqbfyzxk.supabase.co';

const mockProjects = [
  { id: 1, name: 'Alpha Project', slug: 'AP', github_repo: null },
  { id: 2, name: 'Beta Project', slug: 'BP', github_repo: null },
  { id: 3, name: 'Contract IQ', slug: 'CIQ', github_repo: 'DietKyle956/contract-iq' },
];

const mockStories = [
  { id: 1, project_id: 3, key: 'CIQ-001', title: 'Set up project scaffolding',
    description: 'Initial project setup with Vite and React\n\nSteps:\n1. Init Vite project\n2. Add React\n3. Configure TypeScript',
    status: 'done', acceptance_criteria: ['Project builds', 'Tests run'], priority: 1,
    created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-02T00:00:00Z', reviewed_by: 'Tyler' },
  { id: 2, project_id: 3, key: 'CIQ-002', title: 'Add GitHub OAuth login',
    description: 'Implement GitHub OAuth login with the following requirements:\n\n- Support GitHub as the primary OAuth provider\n- Handle session persistence across page reloads\n- Show user avatar and name when logged in\n- Provide sign out functionality',
    status: 'backlog', acceptance_criteria: ['Login works with GitHub', 'Session persists after refresh', 'User avatar shown in header', 'Sign out clears session'],
    priority: 2, created_at: '2026-07-03T00:00:00Z', updated_at: '2026-07-03T00:00:00Z', reviewed_by: null },
  { id: 3, project_id: 3, key: 'CIQ-003', title: 'Build Kanban board',
    description: 'Create the mobile-first board UI', status: 'backlog',
    acceptance_criteria: ['Columns render', 'Swiping works'], priority: 3,
    created_at: '2026-07-04T00:00:00Z', updated_at: '2026-07-04T00:00:00Z', reviewed_by: null },
  { id: 5, project_id: 1, key: 'AP-001', title: 'Alpha story',
    description: 'A story in another project', status: 'backlog', acceptance_criteria: [], priority: 1,
    created_at: '2026-07-06T00:00:00Z', updated_at: '2026-07-06T00:00:00Z', reviewed_by: null },
];

const mockBlockers = [
  { id: 1, story_id: 2, blocking_story_id: 1, description: 'Waiting on CIQ-001 project scaffolding to be completed',
    resolved_at: null, created_at: '2026-07-03T00:00:00Z' },
  { id: 2, story_id: 2, blocking_story_id: 3, description: 'Design review approved',
    resolved_at: '2026-07-05T00:00:00Z', created_at: '2026-07-02T00:00:00Z' },
];

const mockDependencies = [
  { story_id: 2, depends_on_id: 1 },
  { story_id: 3, depends_on_id: 1 },
  { story_id: 3, depends_on_id: 2 },
];

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  // Start with clean localStorage
  storageState: undefined,
});
const page = await context.newPage();

// Intercept all Supabase calls
await page.route('**/*.supabase.co/**', async (route) => {
  const url = route.request().url();
  let body = [];
  if (url.includes('/rest/v1/projects')) body = mockProjects;
  else if (url.includes('/rest/v1/stories')) body = mockStories;
  else if (url.includes('/rest/v1/blockers')) body = mockBlockers;
  else if (url.includes('/rest/v1/dependencies')) body = mockDependencies;
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
});

await page.goto('http://localhost:5199/', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

// Debug what we see
const text = await page.textContent('body');
console.log('Page text:', text.substring(0, 300));

// Select Contract IQ (value 3) from the dropdown
await page.selectOption('select', '3');
await page.waitForTimeout(1500);

const text2 = await page.textContent('body');
console.log('After select:', text2.substring(0, 300));

// Screenshot 1: Board with CIQ-002 and CIQ-003
await page.screenshot({ path: `${EVIDENCE_DIR}/01-board-view.png`, fullPage: false });
console.log('01-board-view.png');

// Click CIQ-002 card to open detail overlay
const cards = await page.locator('button').filter({ hasText: 'CIQ-002' }).count();
console.log('CIQ-002 card count:', cards);

// Click on the story card for CIQ-002
await page.locator('button:has-text("CIQ-002")').first().click();
await page.waitForTimeout(1000);

// Verify overlay opened
const overlayText = await page.textContent('.animate-slide-in-right');
console.log('Overlay text preview:', overlayText?.substring(0, 200));

// Screenshot 2: Detail overlay top with blockers
await page.screenshot({ path: `${EVIDENCE_DIR}/02-detail-top.png`, fullPage: false });
console.log('02-detail-top.png');

// Scroll overlay to see description and AC
await page.evaluate(() => {
  const ov = document.querySelector('.animate-slide-in-right');
  if (ov) ov.scrollTop = 280;
});
await page.waitForTimeout(500);

// Screenshot 3: Description section
await page.screenshot({ path: `${EVIDENCE_DIR}/03-detail-description.png`, fullPage: false });
console.log('03-detail-description.png');

// Scroll to AC + Dependencies
await page.evaluate(() => {
  const ov = document.querySelector('.animate-slide-in-right');
  if (ov) ov.scrollTop = 520;
});
await page.waitForTimeout(500);

// Screenshot 4: AC + Dependencies
await page.screenshot({ path: `${EVIDENCE_DIR}/04-detail-ac-deps.png`, fullPage: false });
console.log('04-detail-ac-deps.png');

// Full page
await page.evaluate(() => {
  const ov = document.querySelector('.animate-slide-in-right');
  if (ov) ov.scrollTop = 0;
});
await page.waitForTimeout(300);
await page.screenshot({ path: `${EVIDENCE_DIR}/05-detail-full.png`, fullPage: true });
console.log('05-detail-full.png');

await browser.close();
console.log('\nDone.');
