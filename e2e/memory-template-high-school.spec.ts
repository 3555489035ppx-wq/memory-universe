import { expect, test } from '@playwright/test';

test('P0 template completes preview, playback, seek, replay and exit without external requests', async ({ page }) => {
  const externalRequests: string[] = [];
  const runtimeErrors: string[] = [];
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && !/^http:\/\/127\.0\.0\.1:\d+\//.test(request.url())) {
      externalRequests.push(request.url());
    }
  });
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });

  await page.goto('/universe?source=demo');
  const launcher = page.getByTestId('template-launcher');
  await expect(launcher).toBeVisible();
  const templateTrigger = page.getByRole('button', { name: '记忆模板' });
  await expect(templateTrigger).toBeEnabled();
  await templateTrigger.click();
  await expect(launcher.getByRole('button', { name: '关闭记忆模板' })).toBeVisible();
  await launcher.getByRole('button', { name: '关闭记忆模板' }).click();
  await expect(launcher.getByRole('button', { name: '关闭记忆模板' })).toHaveCount(0);
  await templateTrigger.click();
  await launcher.getByRole('button', { name: '预览 那年夏天' }).click();

  const preview = page.getByTestId('template-preview');
  await expect(preview).toBeVisible();
  await expect(preview.getByRole('heading', { name: '那年夏天' })).toBeVisible();
  await expect(preview.getByRole('button', { name: '更换音乐' })).toBeVisible();
  await page.keyboard.press('Space');
  await expect(preview.getByRole('status')).toContainText('正在播放');

  await page.keyboard.press('Space');
  await expect(preview.getByRole('status')).toContainText('已暂停');
  await page.keyboard.press('Space');
  await expect(preview.getByRole('status')).toContainText('正在播放');

  const progress = preview.getByRole('slider', { name: /播放进度/ });
  await progress.fill('75');
  await expect(progress).toHaveValue('75');
  await page.keyboard.press('Space');
  await preview.getByRole('button', { name: '退出模板' }).click();
  await expect(page.getByTestId('template-launcher')).toBeVisible();

  expect(externalRequests).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});
