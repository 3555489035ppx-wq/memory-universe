import { expect, test } from '@playwright/test';

test('production preview serves deep routes and fallback states without overflow', async ({
  page,
}) => {
  const runtimeErrors: string[] = [];
  const failedResponses: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400)
      failedResponses.push(`${String(response.status())} ${response.url()}`);
  });

  const routes = [
    '/',
    '/universe?source=demo',
    '/memory/demo-memory-001',
    '/constellation/demo-constellation-rain',
    '/archive?source=demo',
    '/settings',
    '/about',
    '/privacy',
    '/route-that-does-not-exist',
  ];
  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator('#root')).toBeVisible();
    await expect
      .poll(async () =>
        page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      )
      .toBe(true);
  }

  await expect(page.locator('.page-panel')).toContainText('这里没有这段记忆');
  expect(runtimeErrors).toEqual([]);
  expect(failedResponses).toEqual([]);
});
