const { test, expect } = require('@playwright/test');

test('Show Grafana URL', async ({ page }) => {
  // Navigate to the Grafana UI (port 3000)
  await page.goto('http://10.10.10.100:3000');
  // Wait for the page to load fully
  await page.waitForLoadState('networkidle');

  // Optionally verify the title contains "Grafana"
  const title = await page.title();
  expect(title).toContain('Grafana');

  // Capture a screenshot for confirmation
  await page.screenshot({ path: 'grafana.png', fullPage: true });
});
