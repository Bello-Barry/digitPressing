import { chromium } from 'playwright';
import { requireE2EConfig } from './e2e-config';

async function runE2ETests() {
  const config = requireE2EConfig();
  console.log('=== STARTING PLAYWRIGHT E2E MOBILE (390px) VERIFICATION ===');
  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
  });

  const page = await context.newPage();

  async function login(email: string, pass: string = config.password) {
    await page.goto(`${config.baseUrl}/admin/login`);
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', pass);
    await page.click('button[type="submit"]', { force: true });
    await page.waitForURL('**/admin', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);
  }

  async function logout() {
    await page.click('#mobile-logout-btn', { force: true });
    await page.waitForURL('**/admin/login', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);
  }

  const testEmail = `pwcashier_${Date.now()}@example.invalid`;

  // 1. OWNER TEST
  console.log('\n--- 1. TESTING OWNER ROLE ---');
  await login(config.ownerEmail);
  console.log('Current URL after login:', page.url());

  await page.screenshot({ path: '/tmp/owner-dashboard-390px.png' });
  console.log('📸 Saved OWNER dashboard screenshot to /tmp/owner-dashboard-390px.png');

  // Open mobile menu
  await page.click('button[aria-label="Menu navigation"]', { force: true });
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/owner-mobile-menu-390px.png' });
  console.log('📸 Saved OWNER mobile menu screenshot to /tmp/owner-mobile-menu-390px.png');

  const menuText = await page.locator('header').innerText();
  console.log('OWNER Navigation Menu content:', menuText.replace(/\n/g, ' | '));

  // Navigate to /users
  console.log('Navigating to Équipe (/users)...');
  await page.goto(`${config.baseUrl}/users`);
  await page.waitForTimeout(1000);
  console.log('Current URL on Équipe page:', page.url());
  await page.screenshot({ path: '/tmp/owner-users-page-390px.png' });
  console.log('📸 Saved Équipe page screenshot to /tmp/owner-users-page-390px.png');

  // Create new staff member (CASHIER)
  console.log(`Testing new staff member creation (${testEmail}) via createStaffMemberAction...`);
  await page.click('button:has-text("Nouveau membre")', { force: true });
  await page.waitForTimeout(500);
  await page.fill('input[name="fullName"]', 'Playwright Cashier Test');
  await page.fill('input[name="email"]', testEmail);
  await page.fill('input[name="password"]', config.password);
  await page.selectOption('select[name="role"]', 'CASHIER');

  await page.click('button[type="submit"]:has-text("Créer le membre")', { force: true });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/owner-users-after-creation-390px.png' });

  const usersPageText = await page.innerText('body');
  const createdSuccess = usersPageText.includes('Playwright Cashier Test');
  console.log('New CASHIER created & visible in table:', createdSuccess ? '✅ YES' : '❌ NO');

  // Sign Out as OWNER
  console.log('Testing Sign Out as OWNER...');
  await logout();
  console.log('URL after Sign Out:', page.url());

  await page.goto(`${config.baseUrl}/admin`);
  await page.waitForTimeout(1000);
  console.log('Attempting to re-enter /admin without session -> Redirected URL:', page.url());
  const ownerAccessDenied = page.url().includes('/admin/login');
  console.log('OWNER Sign Out & Access Restriction: ', ownerAccessDenied ? '✅ PASSED' : '❌ FAILED');

  // 2. MANAGER TEST
  console.log('\n--- 2. TESTING MANAGER ROLE ---');
  await login(config.managerEmail);
  console.log('Current URL after MANAGER login:', page.url());

  await page.click('button[aria-label="Menu navigation"]', { force: true });
  await page.waitForTimeout(300);
  const managerMenuText = await page.locator('header').innerText();
  console.log('MANAGER Navigation Menu:', managerMenuText.replace(/\n/g, ' | '));
  const managerHasUsersLink = managerMenuText.includes('Équipe');
  console.log('MANAGER sees Équipe link:', managerHasUsersLink ? '❌ YES (UNEXPECTED)' : '✅ NO (CORRECTLY HIDDEN)');

  await page.goto(`${config.baseUrl}/users`);
  await page.waitForTimeout(1000);
  const managerUsersAccessText = await page.innerText('body');
  const managerUsersRestricted = managerUsersAccessText.includes('Accès restreint');
  console.log('MANAGER access to /users restricted:', managerUsersRestricted ? '✅ PASSED' : '❌ FAILED');

  await page.goto(`${config.baseUrl}/admin`);
  await logout();

  // 3. CASHIER TEST
  console.log('\n--- 3. TESTING CASHIER ROLE ---');
  await login(config.cashierEmail);
  console.log('Current URL after CASHIER login:', page.url());

  await page.goto(`${config.baseUrl}/admin/commandes`);
  await page.waitForTimeout(800);
  console.log('CASHIER accessed Commandes:', page.url());

  await page.goto(`${config.baseUrl}/users`);
  await page.waitForTimeout(800);
  const cashierUsersRestricted = (await page.innerText('body')).includes('Accès restreint');
  console.log('CASHIER access to /users restricted:', cashierUsersRestricted ? '✅ PASSED' : '❌ FAILED');

  await page.goto(`${config.baseUrl}/admin`);
  await logout();

  // 4. DELIVERY TEST
  console.log('\n--- 4. TESTING DELIVERY ROLE ---');
  await login(config.deliveryEmail);
  console.log('Current URL after DELIVERY login:', page.url());

  await page.click('button[aria-label="Menu navigation"]', { force: true });
  await page.waitForTimeout(300);
  const deliveryMenuText = await page.locator('header').innerText();
  console.log('DELIVERY Navigation Menu:', deliveryMenuText.replace(/\n/g, ' | '));

  await page.goto(`${config.baseUrl}/admin/paiements`);
  await page.waitForTimeout(800);
  console.log('DELIVERY route access check:', page.url());

  await page.goto(`${config.baseUrl}/admin`);
  await logout();

  // 5. NEWLY CREATED CASHIER LOGIN
  console.log(`\n--- 5. TESTING NEWLY CREATED CASHIER ACCOUNT (${testEmail}) ---`);
  await login(testEmail);
  console.log('Current URL after New CASHIER login:', page.url());
  const newCashierLoginSuccess = page.url().includes('/admin');
  console.log('New CASHIER Login Success:', newCashierLoginSuccess ? '✅ PASSED' : '❌ FAILED');

  await logout();

  await browser.close();
  console.log('\n=== PLAYWRIGHT E2E MOBILE VERIFICATION COMPLETE ===');
}

runE2ETests().catch(err => {
  console.error('Playwright E2E Error:', err);
  process.exit(1);
});
