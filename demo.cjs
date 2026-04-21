const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 600 });
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);

  console.log('1. Login...');
  await page.goto('http://localhost:3000/login');
  await page.waitForLoadState('networkidle');
  await page.fill('#email', 'mcoyllmdata@gmail.com');
  await page.fill('#password', 'Supabase2026');
  await page.click('button[type="submit"]');

  console.log('2. Waiting for board...');
  await page.waitForURL('**/board', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  console.log('3. Opening create task dialog...');
  // Click the first + icon button (ghost, h-7 w-7) in Todo column
  await page.locator('button.h-7').first().click().catch(() =>
    page.locator('button[class*="ghost"]').first().click()
  );
  await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
  await page.waitForTimeout(400);

  console.log('4. Filling form...');
  await page.fill('#title', 'Demo MCP en vivo');
  await page.selectOption('#priority', 'high');

  console.log('5. Submit...');
  await page.click('button[type="submit"]');
  await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const out = path.join(__dirname, 'demo-screenshot.png');
  await page.screenshot({ path: out, fullPage: false });
  console.log('Screenshot saved:', out);
  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
