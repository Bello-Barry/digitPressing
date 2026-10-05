import { chromium } from 'playwright';

async function debugLogin() {
  const baseUrl = process.env.E2E_BASE_URL;
  const email = process.env.E2E_OWNER_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  if (!baseUrl || !email || !password) {
    throw new Error('Set E2E_BASE_URL, E2E_OWNER_EMAIL and E2E_TEST_PASSWORD in your local environment.');
  }
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  await page.goto(`${baseUrl.replace(/\/$/, '')}/admin/login`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  await page.waitForTimeout(3000);

  console.log('Final URL:', page.url());
  const bodyText = await page.innerText('body');
  console.log('Body Text:', bodyText);

  await page.screenshot({ path: '/tmp/login-debug.png' });
  await browser.close();
}

debugLogin();
