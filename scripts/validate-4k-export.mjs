#!/usr/bin/env node

import { chromium } from '@playwright/test';

const loopbackHost = [127, 0, 0, 1].join('.');
const baseUrl = process.env['MEMENTO_DEV_URL'] ?? `http://${loopbackHost}:5173`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  const result = await page.evaluate(async () => {
    const [{ exportMemoryFilmVideo }, { getVideoExportPreset }, { getMemoryTemplate }, { inspectEncodedMp4 }] = await Promise.all([
      import('/src/features/export/videoExportController.ts'),
      import('/src/features/export/videoExportTypes.ts'),
      import('/src/memory/config/index.ts'),
      import('/src/features/export/inspectMp4Output.ts'),
    ]);
    const imageCanvas = document.createElement('canvas');
    imageCanvas.width = 64;
    imageCanvas.height = 96;
    const imageContext = imageCanvas.getContext('2d');
    if (!imageContext) throw new Error('VALIDATION_IMAGE_CANVAS_UNAVAILABLE');
    imageContext.fillStyle = '#355a85';
    imageContext.fillRect(0, 0, 64, 96);
    imageContext.fillStyle = '#ffcf8f';
    imageContext.beginPath();
    imageContext.arc(32, 38, 20, 0, Math.PI * 2);
    imageContext.fill();
    const assetKey = imageCanvas.toDataURL('image/png');
    const memory = {
      id: 'validation-memory',
      source: 'personal',
      title: '4K validation memory',
      description: '',
      capturedAt: null,
      capturedAtMs: null,
      dateSource: 'unknown',
      personIds: [],
      placeId: null,
      mood: null,
      tags: [],
      dominantColor: { rgb: [53, 90, 133], hsl: [212, 43, 36], luminance: 0.1, algorithmVersion: 1 },
      assetKeys: { micro: assetKey, thumbnail: assetKey, preview: assetKey, original: assetKey },
      width: 64,
      height: 96,
      orientationApplied: true,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
      schemaVersion: 1,
    };
    const sampleRate = 48_000;
    const frames = 4_800;
    const wav = new ArrayBuffer(44 + frames * 2 * 2);
    const view = new DataView(wav);
    const write = (offset, value) => [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
    write(0, 'RIFF');
    view.setUint32(4, 36 + frames * 4, true);
    write(8, 'WAVE');
    write(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 2, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 4, true);
    view.setUint16(32, 4, true);
    view.setUint16(34, 16, true);
    write(36, 'data');
    view.setUint32(40, frames * 4, true);
    for (let frame = 0; frame < frames; frame += 1) {
      const sample = Math.round(Math.sin((frame / sampleRate) * Math.PI * 2 * 440) * 0.12 * 32767);
      const offset = 44 + frame * 4;
      view.setInt16(offset, sample, true);
      view.setInt16(offset + 2, sample, true);
    }
    const audioFile = new File([wav], 'validation-tone.wav', { type: 'audio/wav' });
    const base = getMemoryTemplate('high-school');
    const phase = {
      ...base.phases[0],
      id: 'validation',
      start: 0,
      end: 1,
      layout: 'mosaic',
      camera: 'wide',
      motion: 'gallery-lock',
      visibleCount: 1,
      photoOffset: 0,
      stagger: 0,
      settleAt: 1,
    };
    const config = { ...base, durationSeconds: 0.1, phases: [phase] };
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = () => undefined;
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: undefined });
    let metadata = null;
    try {
      try {
        const result = await exportMemoryFilmVideo({
          preset: getVideoExportPreset('mobile-4k'),
          config,
          memories: [memory],
          heroPhotoId: memory.id,
          audioFile,
          audioPresetId: 'studio-master-v1',
          reducedMotion: true,
          onOutputBlob: async (blob) => {
            metadata = await inspectEncodedMp4(blob);
          },
        });
        return { result, metadata };
      } catch (error) {
        const thrown = error instanceof Error ? error : new Error(String(error));
        const cause = thrown.cause instanceof Error ? thrown.cause : null;
        return {
          failure: {
            name: thrown.name,
            message: thrown.message,
            stack: thrown.stack ?? null,
            causeName: cause?.name ?? null,
            causeMessage: cause?.message ?? (thrown.cause ? String(thrown.cause) : null),
            causeStack: cause?.stack ?? null,
          },
        };
      }
    } finally {
      HTMLAnchorElement.prototype.click = originalClick;
    }
  });
  if (result.failure) {
    throw new Error(`4K export runtime failed: ${JSON.stringify(result.failure)}`);
  }
  const metadata = result.metadata;
  if (!metadata || metadata.width !== 2160 || metadata.height !== 3840 || metadata.sampleRate !== 48_000 || metadata.byteLength <= 0) {
    throw new Error(`4K export validation failed: ${JSON.stringify(result)}`);
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  await browser.close();
}
