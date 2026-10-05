import { chromium } from 'playwright';

async function debugLogin() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  await page.goto('http://localhost:3000/admin/login');
  await page.fill('input[type="email"]', 'obusiness715@gmail.com');
  await page.fill('input[type="password"]', 'barry@2014');
  await page.click('button[type="submit"]');

  await page.waitForTimeout(3000);

  console.log('Final URL:', page.url());
  const bodyText = await page.innerText('body');
  console.log('Body Text:', bodyText);

  await page.screenshot({ path: '/tmp/login-debug.png' });
  await browser.close();
}

debugLogin();
