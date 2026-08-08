import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function waitForUniverse(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/universe\?source=demo$/);
  await expect(page.getByRole('main', { name: '记忆宇宙' })).toBeVisible();
  await expect(page.getByRole('group', { name: /键盘浏览记忆/ })).toBeVisible();
}

test('Flow A explores, echoes, relayouts, and persists a constellation', async ({ page }) => {
  const externalRequests: string[] = [];
  const runtimeErrors: string[] = [];
  const failedResponses: string[] = [];
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:4173')) {
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
  await waitForUniverse(page);

  const navigator = page.getByRole('group', { name: /键盘浏览记忆/ });
  const currentMemory = navigator.locator('button').nth(1);
  await currentMemory.hover();
  await expect(page.locator('.hover-inspector strong')).toContainText('雨停后的路口');
  await currentMemory.click();
  await expect(page.locator('.hover-inspector')).toContainText('再次选择');
  await currentMemory.click();
  await expect(page).toHaveURL(/\/memory\/demo-memory-001$/);
  await expect(page.getByRole('heading', { name: '雨停后的路口' })).toBeVisible();

  const echoButtons = page.locator('.echo-strip button');
  await expect(echoButtons).toHaveCount(5, { timeout: 10_000 });
  const firstEchoTitle = await echoButtons.nth(0).locator('span').innerText();
  await echoButtons.nth(0).click();
  await expect(page).toHaveURL(/\/memory\/demo-memory-/);
  await expect(page.getByRole('heading', { name: firstEchoTitle })).toBeVisible();
  await page.keyboard.press('Escape');
  await waitForUniverse(page);

  for (const label of ['时间', '人物', '地点', '情绪']) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(page.getByRole('button', { name: label, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  }
  const rangeInputs = page.getByRole('slider');
  await rangeInputs.nth(0).fill('20');
  await rangeInputs.nth(1).fill('80');
  const selectCurrent = navigator.getByRole('button', { name: /选择雨停后的路口/ });
  await selectCurrent.click();
  await navigator.getByRole('button', { name: '下一段记忆' }).click();
  await navigator.locator('button').nth(2).click();
  await expect(page.getByText('已选择 2 段记忆')).toBeVisible();
  await page.getByRole('button', { name: '连接为星座' }).click();
  const composer = page.getByRole('dialog', { name: '把这些记忆连接起来' });
  await composer.getByRole('textbox').nth(0).fill('流年回声');
  await composer.getByRole('textbox').nth(1).fill('一条由关系牵引的回到。');
  await composer.getByRole('button', { name: '保存星座' }).click();
  await expect(page).toHaveURL(/\/constellation\/demo-user-constellation-/);
  await expect(page.locator('#constellation-title')).toHaveValue('流年回声');
  await page.locator('#constellation-title').fill('流年回声·已编辑');
  await page.getByRole('button', { name: '保存修改' }).click();
  await expect(page.getByText('已保存到当前浏览器。')).toBeVisible();
  await page.reload();
  await expect(page.locator('#constellation-title')).toHaveValue('流年回声·已编辑');

  expect(externalRequests).toEqual([]);
  expect(failedResponses).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});
