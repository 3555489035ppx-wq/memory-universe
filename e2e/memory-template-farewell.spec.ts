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
    wav.writeInt16LE(Math.round(Math.sin(index / sampleRate * Math.PI * 220) * 2_400), 44 + index * 2);
  }
  return wav;
}

test('farewell sequence forms text and then enters its particle tail without runtime errors', async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/universe?source=demo');
  const launcher = page.getByTestId('template-launcher');
  await expect(launcher).toBeVisible();
  await launcher.locator('button').first().click();
  await expect(page.getByTestId('template-launcher-panel')).toBeVisible();
  await page.locator('.memory-template-card button').first().click();

  const preview = page.getByTestId('template-preview');
  await expect(preview).toBeVisible();
  await page.locator('input[type=file][accept*="audio"]').setInputFiles({
    name: 'three-minute-farewell-qa.wav',
    mimeType: 'audio/wav',
    buffer: createThreeMinuteWav(),
  });

  const templateSeek = preview.locator('input[type="range"]').first();
  await templateSeek.fill('99');
  await expect(page.locator('.farewell-overlay[data-stage="text-hold"]')).toBeVisible();
  // The farewell copy is rendered by the R3F particle layer, never by a
  // solid DOM text overlay.
  await expect(page.locator('.farewell-overlay__text')).toHaveCount(0);
  await expect(page.locator('canvas')).toBeVisible();

  await templateSeek.fill('99.8');
  await expect(page.locator('.farewell-overlay[data-stage="tail"]')).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});
