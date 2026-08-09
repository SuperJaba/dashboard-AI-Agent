import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  page.on('requestfailed', req => console.log('REQ FAILED:', req.url(), req.failure()?.errorText));

  console.log('Navigating to http://dashboard.jagger2.ct8.pl ...');
  await page.goto('http://dashboard.jagger2.ct8.pl', { waitUntil: 'networkidle' });

  console.log('Page Title:', await page.title());

  await page.screenshot({ path: '/home/seba/.gemini/antigravity-cli/brain/8d24fcbf-066f-48b5-a35e-ae57c269227c/dashboard_screenshot.png', fullPage: true });
  console.log('Screenshot saved to brain directory');

  await browser.close();
})();
