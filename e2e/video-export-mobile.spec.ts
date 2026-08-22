import { expect, test } from '@playwright/test';

test.use({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});

test('mobile export sheet keeps native 4K as the default and never treats a stream as exportable audio', async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });

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
  await expect(dialog.locator('button[data-selected="true"]')).toContainText('手机 4K');
  await expect(dialog.getByText('2160 × 3840 · 30 fps · H.264 / 高品质音频 MP4')).toBeVisible();
  await expect(dialog.getByRole('button', { name: '开始 手机 4K 导出' })).toBeDisabled();
  await expect(dialog.getByRole('status')).toContainText('系统音乐库');

  const layerAudit = await page.evaluate(() => {
    const backdrop = document.querySelector<HTMLElement>('.video-export__backdrop');
    const player = document.querySelector<HTMLElement>('.music-experience');
    if (!backdrop || !player) return null;
    const playerBox = player.getBoundingClientRect();
    const point = document.elementFromPoint(
      playerBox.left + playerBox.width / 2,
      playerBox.top + playerBox.height / 2,
    );
    return {
      backdropZIndex: Number.parseInt(window.getComputedStyle(backdrop).zIndex, 10),
      playerZIndex: Number.parseInt(window.getComputedStyle(player).zIndex, 10),
      playerHidden: window.getComputedStyle(player).opacity === '0',
      pointIsInExportLayer: Boolean(point?.closest('.video-export__backdrop')),
    };
  });
  expect(layerAudit).not.toBeNull();
  expect(layerAudit?.backdropZIndex).toBeGreaterThan(layerAudit?.playerZIndex ?? Number.POSITIVE_INFINITY);
  expect(layerAudit?.playerHidden || layerAudit?.pointIsInExportLayer).toBe(true);

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(runtimeErrors).toEqual([]);
});
