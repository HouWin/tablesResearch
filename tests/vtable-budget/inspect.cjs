const { chromium, expect } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1600, height: 1000 },
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(process.env.VTABLE_URL || 'http://localhost:8000/vtable');
    await expect(
      page.getByRole('grid', { name: '费用预算表', exact: true }),
    ).toHaveAttribute('aria-rowcount', '40', { timeout: 60000 });
    await expect(page.locator('.vt-host canvas').first()).toBeVisible();
    console.log(
      JSON.stringify({
        text: (await page.locator('body').innerText()).slice(-4500),
        errors,
      }),
    );
    await page.screenshot({
      path: 'test-results/vtable-first.png',
      fullPage: true,
    });
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
  }
})();
