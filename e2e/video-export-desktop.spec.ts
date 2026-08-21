import { expect, test } from '@playwright/test';

test.use({
  viewport: { width: 1018, height: 568 },
  deviceScaleFactor: 1,
});

test('desktop export dialog stays centered and fully inside a short viewport', async ({ page }) => {
  await page.goto('/universe?source=demo');
  const launcher = page.getByTestId('template-launcher');
  await expect(launcher).toBeVisible();
  await page.getByRole('button', { name: '记忆模板' }).click();
  await launcher.getByRole('button', { name: '预览 那年夏天' }).click();

  const preview = page.getByTestId('template-preview');
  await expect(preview).toBeVisible();
  await preview.getByRole('button', { name: '导出视频' }).click();

  const dialog = page.getByRole('dialog', { name: '导出记忆电影' });
  await expect(dialog).toBeVisible();

  const audit = await dialog.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      centerOffset: Math.abs(box.left + box.width / 2 - window.innerWidth / 2),
      top: box.top,
      bottom: box.bottom,
      viewportHeight: window.innerHeight,
      maxHeight: Number.parseFloat(window.getComputedStyle(element).maxHeight),
    };
  });

  expect(audit.centerOffset).toBeLessThanOrEqual(2);
  expect(audit.top).toBeGreaterThanOrEqual(8);
  expect(audit.bottom).toBeLessThanOrEqual(audit.viewportHeight - 8);
  expect(audit.maxHeight).toBeLessThanOrEqual(audit.viewportHeight - 8);
});
