import { chromium } from 'playwright';
import assert from 'node:assert/strict';

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const consoleErrors = [];
  const consoleWarnings = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error') {
      consoleErrors.push(text);
    } else if (msg.type() === 'warning') {
      consoleWarnings.push(text);
    }
  });

  page.on('response', (res) => {
    if (res.status() >= 400) {
      console.log(`HTTP ${res.status()} from ${res.url()}`);
    }
  });

  console.log('1. Navigating to http://localhost:3000 on Desktop (1440x900)...');
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });

  // 1. Verify Header
  const header = page.locator('header.sticky').first();
  await header.waitFor({ state: 'visible' });

  // 2. Open CommandBar
  console.log('2. Opening CommandBar to test Apple-Grade Keyboard Navigation...');
  await page.locator('[data-testid="command-bar-trigger"]').click();
  await page.waitForTimeout(500);

  const input = page.locator('[data-testid="command-bar-input"]');
  await input.waitFor({ state: 'visible' });

  // Item 0 should initially have active styling (bg-[#9274FF])
  const firstItem = page.locator('[data-command-bar-action-index="0"]');
  const firstItemClass = await firstItem.getAttribute('class');
  assert.ok(firstItemClass.includes('bg-[#9274FF]'), 'First item should have bg-[#9274FF] active styling');

  // Test ArrowDown navigation across Recent Searches
  console.log('3. Pressing ArrowDown...');
  await input.press('ArrowDown');
  await page.waitForTimeout(100);

  const secondItem = page.locator('[data-command-bar-action-index="1"]');
  const secondItemClass = await secondItem.getAttribute('class');
  console.log(`Second item class contains active: ${secondItemClass.includes('bg-[#9274FF]')}`);
  assert.ok(secondItemClass.includes('bg-[#9274FF]'), 'Second item should now have active focus styling');

  // Test ArrowUp navigation
  console.log('4. Pressing ArrowUp...');
  await input.press('ArrowUp');
  await page.waitForTimeout(100);
  const firstItemClassAfterUp = await firstItem.getAttribute('class');
  assert.ok(firstItemClassAfterUp.includes('bg-[#9274FF]'), 'First item should be re-selected after ArrowUp');

  // Test Enter on Recent Search (populates search query)
  console.log('4b. Pressing Enter on Recent Search item 0...');
  await input.press('Enter');
  await page.waitForTimeout(150);
  const inputValue = await input.inputValue();
  console.log(`Input value after Enter on Recent Search: "${inputValue}"`);
  assert.ok(inputValue.length > 0, 'Search query should be populated by Enter on Recent Search');

  // Test Top Results & keyword highlighting with query "Inflation"
  console.log('4c. Typing "Inflation" to verify Top Results & Keyword Highlighting...');
  await input.fill('Inflation');
  await page.waitForTimeout(150);
  const highlightedSpan = page.locator('[data-command-bar-highlight="true"]').first();
  await highlightedSpan.waitFor({ state: 'visible' });
  const highlightedText = await highlightedSpan.textContent();
  console.log(`Highlighted match text: "${highlightedText}"`);
  assert.equal(highlightedText?.toLowerCase(), 'inflation', 'Keyword highlighting should match "inflation"');

  // Close CommandBar
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 5. Test Course Syllabus view & Download PDF button
  console.log('5. Navigating to course view to test Syllabus & Download PDF button...');
  await page.goto('http://localhost:3000/course/course-macro-stabilization', { waitUntil: 'domcontentloaded' });

  const downloadPdfBtn = page.locator('[data-testid="syllabus-download-pdf-btn"]');
  await downloadPdfBtn.waitFor({ state: 'visible', timeout: 10000 });
  console.log('Download PDF button is visible in Course Syllabus view!');

  // Verify printable syllabus table exists in DOM
  const printTable = page.locator('.print-syllabus-table');
  assert.ok((await printTable.count()) > 0, 'Printable syllabus table must exist in DOM');

  // 6. Test Print Media Emulation (@media print)
  console.log('6. Emulating Print Media (@media print)...');
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(200);

  // In print media:
  // - .no-print elements should be display: none
  const headerDisplay = await header.evaluate((el) => window.getComputedStyle(el).display);
  console.log(`Header display in print media: ${headerDisplay}`);
  assert.equal(headerDisplay, 'none', 'Header should be display: none in print media');

  // - print table should be display: table
  const printTableDisplay = await printTable.evaluate((el) => window.getComputedStyle(el).display);
  console.log(`Print table display in print media: ${printTableDisplay}`);
  assert.equal(printTableDisplay, 'table', 'Print table should be display: table in print media');

  // Reset media
  await page.emulateMedia({ media: 'screen' });

  // 7. Check Console Errors and GSAP Warnings
  console.log('7. Checking console errors & warnings...');
  console.log('Console Errors found:', consoleErrors);
  console.log('Console Warnings found:', consoleWarnings);
  const gsapScopeWarnings = consoleWarnings.filter((w) => w.toLowerCase().includes('invalid scope'));
  assert.equal(gsapScopeWarnings.length, 0, 'No GSAP invalid scope warnings allowed');
  assert.equal(consoleErrors.length, 0, 'No console errors allowed');

  await browser.close();
  console.log('SUCCESS! All Keyboard Navigation, Print Stylesheet, and a11y checks passed with 0 errors!');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
