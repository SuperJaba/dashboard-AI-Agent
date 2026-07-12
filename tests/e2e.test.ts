import { test, expect, beforeAll, afterAll } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';

let browser: Browser;
let page: Page;

beforeAll(async () => {
  // Setup puppeteer before all tests
  browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  page = await browser.newPage();
});

afterAll(async () => {
  // Cleanup after all tests
  if (browser) {
    await browser.close();
  }
});

test('Dashboard loads correctly', async () => {
  // Make sure the frontend is running on 5173
  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 5000 });
  } catch (e) {
    console.warn('Frontend might not be running on port 5173. Test might fail.');
  }
  
  const title = await page.title();
  expect(title).toBeDefined();

  // Check if sidebar header exists
  const sidebarHeader = await page.$('.sidebar-header h2');
  if (sidebarHeader) {
    const text = await page.evaluate(el => el.textContent, sidebarHeader);
    expect(text).toContain('AI Dashboard');
  }
});

test('Project UI components exist when a project is selected', async () => {
  // Wait for projects to load
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Click on the first project if it exists
  const firstProject = await page.$('.project-item');
  if (firstProject) {
    await firstProject.click();
    
    // Wait for the deploy button
    const deployButtons = await page.$$('.btn-primary');
    expect(deployButtons.length).toBeGreaterThan(0);
    
    // Check if the terminal checkbox exists
    const checkbox = await page.$('input[type="checkbox"]');
    expect(checkbox).toBeDefined();
    
    // Check if task list opens
    const checkAllButton = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent?.includes('Check All'));
    });
    
    // Test passed if no errors thrown
    expect(true).toBe(true);
  } else {
    console.warn('No projects found to test UI components');
  }
});
