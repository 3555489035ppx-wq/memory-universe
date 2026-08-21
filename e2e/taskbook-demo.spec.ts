import { expect, test } from '@playwright/test';

test('taskbook keeps the Demo path complete and other templates explicit', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: '体验高中回忆 Demo' })).toBeVisible();
  await page.getByRole('link', { name: '体验高中回忆 Demo' }).click();
  await expect(page).toHaveURL(/\/universe\?source=demo&demo=high-school/);
  await expect(page.getByTestId('template-preview')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: '那年夏天' })).toBeVisible();
  await expect(page.getByText('96 张照片')).toBeVisible();

  await page.goto('/universe?source=demo');
  const launcher = page.getByTestId('template-launcher');
  await launcher.getByRole('button', { name: '记忆模板' }).click();
  await expect(page.getByTestId('template-card')).toHaveCount(6);
  await expect(page.locator('[data-testid="template-card"][data-status="available"]')).toHaveCount(1);

  const comingSoon = page.locator('[data-testid="template-card"]').filter({ hasText: '与你有关' });
  await comingSoon.getByRole('button', { name: '查看开发状态' }).click();
  await expect(page.getByRole('alert')).toContainText('该主题正在开发中，未来将支持更多AI记忆场景。');
  await page.getByRole('button', { name: '返回模板选择' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('clicking a Demo photo resolves to image, time and story', async ({ page }) => {
  await page.goto('/memory/demo-memory-001?source=demo');
  await expect(page.locator('.memory-dive__image img')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.memory-dive__image figcaption')).toContainText('·');
  await expect(page.locator('.memory-description')).toBeVisible();
});

test('local music fallback exposes QR states and confirms the demo track', async ({ page }) => {
  await page.goto('/universe?source=demo&demo=high-school');
  const preview = page.getByTestId('template-preview');
  await expect(preview).toBeVisible({ timeout: 30_000 });
  await preview.getByRole('button', { name: '更换音乐' }).click();
  await page.getByRole('button', { name: '登录平台' }).click();

  const dialog = page.getByRole('dialog', { name: '连接音乐源' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('tab', { name: /酷狗音乐/ }).click();
  await expect(dialog.getByText('演示二维码 · 不连接第三方账号')).toBeVisible();
  await dialog.getByRole('button', { name: '开始演示扫码' }).click();
  await expect(dialog.getByTestId('demo-track-result')).toBeVisible({ timeout: 5_000 });
  await expect(dialog.getByTestId('demo-track-result')).toContainText('那年夏天');
  await dialog.getByRole('button', { name: '使用这首音乐生成记忆宇宙' }).click();
  await expect(dialog).toHaveCount(0);
});
