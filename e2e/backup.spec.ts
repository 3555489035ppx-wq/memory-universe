import { expect, test, type Page } from '@playwright/test';

import { canvasImage } from './helpers';

async function waitForOperation(page: Page, pattern: RegExp): Promise<void> {
  await expect(page.locator('.settings-operation strong')).toContainText(pattern, {
    timeout: 30_000,
  });
}

test('Flow B edits, exports, clears, restores, and persists personal data', async ({ page }) => {
  const externalRequests: string[] = [];
  const runtimeErrors: string[] = [];
  const failedResponses: string[] = [];
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && !/^http:\/\/127\.0\.0\.1:\d+\//.test(request.url())) {
      externalRequests.push(request.url());
    }
  });
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400)
      failedResponses.push(`${String(response.status())} ${response.url()}`);
  });

  await page.goto('/');
  await page.getByRole('link', { name: '点击进入' }).click();
  await page.goto('/archive?source=personal&import=1');
  const importDialog = page.locator('[role="dialog"]');
  await expect(importDialog).toBeVisible();
  const image = await canvasImage(page, 960, 640, 'image/png');
  await page.locator('#local-photo-input').setInputFiles({
    name: 'backup-flow.png',
    mimeType: 'image/png',
    buffer: image,
  });
  const importStart = importDialog.locator('footer button.primary-action');
  await expect(importStart).toBeEnabled();
  await importStart.click();
  await expect(importDialog.locator('.import-summary')).toBeVisible({ timeout: 60_000 });
  await importDialog.locator('footer button.primary-action').click();
  await expect(page).toHaveURL(/\/universe\?source=personal$/);

  await page.goto('/archive?source=personal');
  const card = page.locator('.archive-memory').first();
  await expect(card).toBeVisible();
  await card.locator('.archive-memory__actions button').first().click();
  const editor = page.locator('[role="dialog"][aria-labelledby="memory-editor-title"]');
  await expect(editor).toBeVisible();
  await editor.locator('form input').first().fill('已编辑的备份记忆');
  await editor.locator('form textarea').fill('Flow B 验证了编辑、导出与恢复闭环。');
  await editor.locator('form button.primary-action').click();
  await expect(editor.locator('[role="status"]')).toBeVisible();
  await expect(card.locator('h2')).toHaveText('已编辑的备份记忆');
  await page.reload();
  await expect(page.locator('.archive-memory h2')).toHaveText('已编辑的备份记忆');

  await page.goto('/settings');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('.settings-actions button.primary-action').click();
  const download = await downloadPromise;
  const backupPath = await download.path();
  expect(backupPath).toBeTruthy();
  await waitForOperation(page, /备份已生成/);

  await page.locator('button.danger-outline').click();
  const clearDialog = page.locator('[role="alertdialog"]');
  await expect(clearDialog).toBeVisible();
  await clearDialog.locator('input').fill('清除记忆');
  await clearDialog.locator('button.danger-action').click();
  await expect(page).toHaveURL(/\/universe\?source=personal$/);
  await page.goto('/archive?source=personal');
  await expect(page.locator('.archive-empty')).toBeVisible();

  await page.goto('/settings');
  await page.locator('.restore-input input[type="file"]').setInputFiles(backupPath);
  await waitForOperation(page, /检查通过/);
  await page.locator('.restore-preview button.primary-action').click();
  await waitForOperation(page, /恢复完成/);
  await page.goto('/archive?source=personal');
  await expect(page.locator('.archive-memory h2')).toHaveText('已编辑的备份记忆');
  await page.reload();
  await expect(page.locator('.archive-memory h2')).toHaveText('已编辑的备份记忆');

  expect(externalRequests).toEqual([]);
  expect(failedResponses).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});
