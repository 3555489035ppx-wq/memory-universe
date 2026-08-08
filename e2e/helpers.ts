import type { Page } from '@playwright/test';

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
      context.fillStyle = '#c58f66';
      context.fillRect(0, 0, targetWidth, targetHeight);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) => (value ? resolve(value) : reject(new Error('Image encoding failed'))),
          targetMime,
          0.9,
        ),
      );
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      }
      return btoa(binary);
    },
    { width, height, mimeType },
  );
  return Buffer.from(result, 'base64');
}
