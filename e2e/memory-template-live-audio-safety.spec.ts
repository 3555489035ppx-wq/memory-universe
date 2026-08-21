import { expect, test } from '@playwright/test';

function createThreeMinuteWav(): Buffer {
  const sampleRate = 8_000;
  const seconds = 180;
  const dataSize = sampleRate * seconds * 2;
  const wav = Buffer.alloc(44 + dataSize);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(dataSize, 40);
  for (let index = 0; index < sampleRate * seconds; index += 1) {
    wav.writeInt16LE(Math.round(Math.sin(index / sampleRate * Math.PI * 440) * 2_400), 44 + index * 2);
  }
  return wav;
}

test('three-minute local audio can seek into a 3D chapter without runtime errors', async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });

  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto('/universe?source=demo');
  const launcher = page.getByTestId('template-launcher');
  await expect(launcher).toBeVisible();
  await launcher.locator('button').first().click();
  await expect(page.getByTestId('template-launcher-panel')).toBeVisible();
  await page.locator('.memory-template-card button').first().click();

  const preview = page.getByTestId('template-preview');
  await expect(preview).toBeVisible();
  await page.locator('input[type=file][accept*="audio"]').setInputFiles({
    name: 'three-minute-qa.wav',
    mimeType: 'audio/wav',
    buffer: createThreeMinuteWav(),
  });
  await page.locator('.music-console__reference-play').click();
  await expect(preview.getByRole('status')).toContainText('正在播放');

  const templateSeek = preview.locator('input[type="range"]');
  await templateSeek.fill('31');
  await expect(templateSeek).toHaveValue('31');
  await page.waitForTimeout(2_000);

  await expect(preview.getByRole('status')).toContainText('正在播放');
  expect(runtimeErrors).toEqual([]);
});
