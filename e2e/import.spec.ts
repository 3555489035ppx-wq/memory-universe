import { expect, test, type Page } from '@playwright/test';

// Chromium AVIF fixture, pinned at ea65e68024a37583df1c120c7ae597b65a503a94.
// Source: third_party/blink/web_tests/images/resources/avif/red-full-range-420-8bpc.avif (BSD-3-Clause).
const AVIF_FIXTURE_BASE64 =
  'AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAACQAAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAMAAAADAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACxtZGF0EgAKCBgEa7IEBAMIMhYQEAAAQAAAAABXsunfm9lZKpLo/41Q';

export async function canvasImage(
  page: Page,
  width: number,
  height: number,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
): Promise<Buffer> {
  const result = await page.evaluate(
    async ({ width: targetWidth, height: targetHeight, mimeType: targetMime }) => {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas unavailable');
      const gradient = context.createLinearGradient(0, 0, targetWidth, targetHeight);
      gradient.addColorStop(0, '#273544');
      gradient.addColorStop(0.52, '#c58f66');
      gradient.addColorStop(1, '#e5d7bd');
      context.fillStyle = gradient;
      context.fillRect(0, 0, targetWidth, targetHeight);
      context.fillStyle = 'rgba(20, 18, 16, 0.35)';
      context.beginPath();
      context.arc(
        targetWidth * 0.7,
        targetHeight * 0.42,
        Math.min(targetWidth, targetHeight) * 0.18,
        0,
        Math.PI * 2,
      );
      context.fill();
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) => (value ? resolve(value) : reject(new Error('Image encoding failed'))),
          targetMime,
          0.9,
        ),
      );
      if (blob.type !== targetMime) throw new Error(`Unexpected encoded type: ${blob.type}`);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = '';
      const chunkSize = 0x8000;
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
      }
      return btoa(binary);
    },
    { width, height, mimeType },
  );
  return Buffer.from(result, 'base64');
}

function exifTiff(orientation: number): Buffer {
  const buffer = Buffer.alloc(96);
  buffer.set([0x49, 0x49, 0x2a, 0x00]);
  buffer.writeUInt32LE(8, 4);
  buffer.writeUInt16LE(3, 8);
  buffer.writeUInt16LE(0x0112, 10);
  buffer.writeUInt16LE(3, 12);
  buffer.writeUInt32LE(1, 14);
  buffer.writeUInt16LE(orientation, 18);
  buffer.writeUInt16LE(0x0110, 22);
  buffer.writeUInt16LE(2, 24);
  buffer.writeUInt32LE(8, 26);
  buffer.writeUInt32LE(50, 30);
  buffer.writeUInt16LE(0x8769, 34);
  buffer.writeUInt16LE(4, 36);
  buffer.writeUInt32LE(1, 38);
  buffer.writeUInt32LE(58, 42);
  buffer.writeUInt32LE(0, 46);
  buffer.write('MEMENTO\0', 50, 'ascii');
  buffer.writeUInt16LE(1, 58);
  buffer.writeUInt16LE(0x9003, 60);
  buffer.writeUInt16LE(2, 62);
  buffer.writeUInt32LE(20, 64);
  buffer.writeUInt32LE(76, 68);
  buffer.writeUInt32LE(0, 72);
  buffer.write('2024:08:03 14:25:10\0', 76, 'ascii');
  return buffer;
}

function injectExif(jpeg: Buffer, orientation: number): Buffer {
  expect(jpeg.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), exifTiff(orientation)]);
  const segment = Buffer.alloc(payload.length + 4);
  segment.set([0xff, 0xe1]);
  segment.writeUInt16BE(payload.length + 2, 2);
  payload.copy(segment, 4);
  return Buffer.concat([jpeg.subarray(0, 2), segment, jpeg.subarray(2)]);
}

async function readPersonalDatabase(page: Page) {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('memento-db');
      request.onerror = () => reject(request.error ?? new Error('Database open failed'));
      request.onsuccess = () => resolve(request.result);
    });
    const transaction = database.transaction(['memories', 'assets'], 'readonly');
    const memories = await new Promise<
      Array<{
        title: string;
        width: number;
        height: number;
        capturedAt: string | null;
        assetKeys: { original?: string };
      }>
    >((resolve, reject) => {
      const request = transaction.objectStore('memories').index('by-source').getAll('personal');
      request.onerror = () => reject(request.error ?? new Error('Memory read failed'));
      request.onsuccess = () => resolve(request.result);
    });
    const assets = await new Promise<Array<{ source: string }>>((resolve, reject) => {
      const request = transaction.objectStore('assets').index('by-source').getAll('personal');
      request.onerror = () => reject(request.error ?? new Error('Asset read failed'));
      request.onsuccess = () => resolve(request.result);
    });
    database.close();
    return { memories, assetCount: assets.length };
  });
}

test('imports real browser images, isolates failures, and persists after reload', async ({
  page,
}) => {
  const externalRequests: string[] = [];
  const runtimeErrors: string[] = [];
  const failedResponses: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (/^https?:/.test(url) && !/^http:\/\/127\.0\.0\.1:\d+\//.test(url)) {
      externalRequests.push(url);
    }
  });
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400)
      failedResponses.push(`${String(response.status())} ${response.url()}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  await page.goto('/');
  await page.getByRole('link', { name: '点击进入' }).click();
  await page.goto('/archive?source=personal&import=1');
  const closeButton = page.locator('.import-header .text-button');
  await expect(closeButton).toBeFocused();
  await expect(closeButton).toHaveCSS('outline-style', 'none');
  await expect(page.locator('.import-footer')).toHaveCSS('position', 'static');
  await expect(page.getByRole('dialog', { name: '把照片带入记忆宇宙' })).toBeVisible();

  const landscape = await canvasImage(page, 1200, 800, 'image/png');
  const rawPortrait = await canvasImage(page, 1800, 1200, 'image/jpeg');
  const portraitWithExif = injectExif(rawPortrait, 6);
  const webp = await canvasImage(page, 900, 1400, 'image/webp');

  await page.locator('#local-photo-input').setInputFiles([
    { name: '海边横图.png', mimeType: 'image/png', buffer: landscape },
    { name: '旋转竖图.jpg', mimeType: 'image/jpeg', buffer: portraitWithExif },
    { name: '雨夜竖图.webp', mimeType: 'image/webp', buffer: webp },
    {
      name: '红色样本.avif',
      mimeType: 'image/avif',
      buffer: Buffer.from(AVIF_FIXTURE_BASE64, 'base64'),
    },
    { name: '损坏照片.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]) },
    {
      name: '浏览器不支持.heic',
      mimeType: 'image/heic',
      buffer: Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]),
    },
  ]);

  await expect(page.getByRole('button', { name: '开始处理 6 张' })).toBeEnabled();
  await page.getByRole('button', { name: '开始处理 6 张' }).click();
  await expect(page.getByLabel('导入结果').getByText('4 张完成，2 张失败')).toBeVisible({
    timeout: 60_000,
  });
  const queue = page.getByLabel('待导入照片');
  await expect(queue.getByText(/当前浏览器暂时无法直接读取这张 HEIC 照片/)).toBeVisible();
  await expect(queue.getByText(/照片像素无法解码/)).toBeVisible();

  const databaseBeforeReload = await readPersonalDatabase(page);
  expect(databaseBeforeReload.memories).toHaveLength(4);
  expect(databaseBeforeReload.assetCount).toBe(16);
  expect(databaseBeforeReload.memories.every((memory) => Boolean(memory.assetKeys.original))).toBe(true);
  const rotated = databaseBeforeReload.memories.find((memory) => memory.title === '旋转竖图');
  expect(rotated?.capturedAt).toBe('2024-08-03T14:25:10');
  expect(rotated?.height).toBeGreaterThan(rotated?.width ?? Number.POSITIVE_INFINITY);

  await page.getByRole('button', { name: '进入我的记忆宇宙' }).click();
  await expect(page).toHaveURL(/\/universe\?source=personal$/);
  await page.reload();
  await expect(page).toHaveURL(/\/universe\?source=personal$/);
  const databaseAfterReload = await readPersonalDatabase(page);
  expect(databaseAfterReload.memories).toHaveLength(4);
  expect(databaseAfterReload.assetCount).toBe(16);
  expect(databaseAfterReload.memories.every((memory) => Boolean(memory.assetKeys.original))).toBe(true);
  expect(externalRequests).toEqual([]);
  expect(failedResponses).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});

test('clears completed rows so a new import batch can be selected', async ({ page }) => {
  await page.goto('/archive?source=personal&import=1');
  const image = await canvasImage(page, 120, 120, 'image/png');

  await page.locator('#local-photo-input').setInputFiles([
    { name: 'clear-completed.png', mimeType: 'image/png', buffer: image },
  ]);
  await page.locator('.import-footer .primary-action').click();
  await expect(page.getByTestId('clear-completed-imports')).toBeVisible({ timeout: 60_000 });

  await page.getByTestId('clear-completed-imports').click();
  await expect(page.locator('.import-row')).toHaveCount(0);
  await page.locator('#local-photo-input').setInputFiles([
    { name: 'next-batch.png', mimeType: 'image/png', buffer: image },
  ]);
  await expect(page.locator('.import-footer .primary-action')).toBeEnabled();
  await expect(page.locator('[role="alert"]')).toHaveCount(0);
});

test('automatically releases completed rows when the next batch is selected', async ({ page }) => {
  await page.goto('/archive?source=personal&import=1');
  const image = await canvasImage(page, 120, 120, 'image/png');

  await page.locator('#local-photo-input').setInputFiles(
    Array.from({ length: 100 }, (_, index) => ({
      name: `completed-${String(index + 1).padStart(3, '0')}.png`,
      mimeType: 'image/png',
      buffer: image,
    })),
  );
  await page.locator('.import-footer .primary-action').click();
  await expect(page.getByTestId('clear-completed-imports')).toBeVisible({ timeout: 60_000 });

  await page.locator('#local-photo-input').setInputFiles([
    { name: 'next-batch-without-manual-clear.png', mimeType: 'image/png', buffer: image },
  ]);

  await expect(page.locator('.import-row')).toHaveCount(1);
  await expect(page.getByRole('button', { name: '开始处理 1 张' })).toBeEnabled();
  await expect(page.locator('[role="alert"]')).toHaveCount(0);
});
