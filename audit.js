import puppeteer from 'puppeteer';
import fs from 'fs';

const AUDIT_SCRIPT = fs.readFileSync('/home/seba/.gemini/antigravity-cli/skills/design-spatial/scripts/layout-audit.js', 'utf8');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  
  console.log('Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  
  console.log('Injecting layout-audit.js...');
  const auditResult = await page.evaluate(`
    ${AUDIT_SCRIPT}
    __audit({});
  `);
  
  console.log('--- AUDIT RESULTS (1440px) ---');
  console.log(JSON.stringify(auditResult, null, 2));

  // Also check narrow
  await page.setViewport({ width: 390, height: 844 });
  const narrowResult = await page.evaluate(`__audit({})`);
  console.log('--- AUDIT RESULTS (390px) ---');
  console.log(JSON.stringify(narrowResult, null, 2));

  await browser.close();
  process.exit(0);
})();
