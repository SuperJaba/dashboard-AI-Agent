import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Navigating to http://dashboard.jagger2.ct8.pl ...');
  await page.goto('http://dashboard.jagger2.ct8.pl', { waitUntil: 'networkidle' });

  // Check setup screen: Fill admin credentials to register admin
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');

  await page.waitForTimeout(3000);

  await page.screenshot({ path: '/home/seba/.gemini/antigravity-cli/brain/8d24fcbf-066f-48b5-a35e-ae57c269227c/logged_in_dashboard.png', fullPage: true });
  console.log('Screenshot saved!');

  await browser.close();
})();
