import { expect, test } from '@playwright/test';

test('taskbook keeps the Demo path complete and other templates explicit', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: '体验高中回忆 Demo' })).toBeVisible();
  await page.getByRole('link', { name: '体验高中回忆 Demo' }).click();
  await expect(page).toHaveURL(/\/universe\?source=demo&demo=high-school/);
  await expect(page.getByTestId('template-preview')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: '那年夏天' })).toBeVisible();
  await expect(page.getByTestId('template-preview').getByText('96 张照片', { exact: true })).toBeVisible();
  await expect(page.locator('audio').first()).toHaveAttribute('src', /te-bie-de-ren-fang-datong\.mp3/);

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

test('music layer exposes system and upload sources without account setup', async ({ page }) => {
  await page.goto('/universe?source=demo&demo=high-school');
  const preview = page.getByTestId('template-preview');
  await expect(preview).toBeVisible({ timeout: 30_000 });
  await preview.getByRole('button', { name: '更换音乐' }).click();
  const panel = page.getByRole('complementary', { name: '音乐层' });
  await expect(panel.getByRole('tab', { name: /系统音乐库/ })).toBeVisible();
  await panel.getByRole('tab', { name: /我的上传/ }).click();
  await expect(panel.getByText('还没有上传音乐', { exact: true })).toBeVisible();
  await expect(panel.getByText(/无需账号/)).toBeVisible();
});

test('Demo music layer lets users choose the bundled high-school track', async ({ page }) => {
  await page.goto('/universe?source=demo&demo=high-school');
  await expect(page.getByTestId('template-preview')).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: '打开音乐层' }).click();
  const panel = page.getByRole('complementary', { name: '音乐层' });
  await expect(panel.getByRole('region', { name: '高中回忆' })).toBeVisible();
  await expect(panel.getByText('特别的人', { exact: true })).toBeVisible();

  await panel.getByRole('button', { name: '播放 特别的人' }).click();
  await expect(page.locator('audio').first()).toHaveAttribute('src', /te-bie-de-ren-fang-datong\.mp3/);
});
