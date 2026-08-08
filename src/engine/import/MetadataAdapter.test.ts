import { describe, expect, it, vi } from 'vitest';

import { normalizeExifDate, readMetadata } from './MetadataAdapter';

function createExifTiff(): ArrayBuffer {
  const buffer = new ArrayBuffer(96);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  bytes.set([0x49, 0x49, 0x2a, 0x00]);
  view.setUint32(4, 8, true);
  view.setUint16(8, 3, true);

  view.setUint16(10, 0x0112, true);
  view.setUint16(12, 3, true);
  view.setUint32(14, 1, true);
  view.setUint16(18, 6, true);

  view.setUint16(22, 0x0110, true);
  view.setUint16(24, 2, true);
  view.setUint32(26, 8, true);
  view.setUint32(30, 50, true);

  view.setUint16(34, 0x8769, true);
  view.setUint16(36, 4, true);
  view.setUint32(38, 1, true);
  view.setUint32(42, 58, true);
  view.setUint32(46, 0, true);

  bytes.set(new TextEncoder().encode('MEMENTO\0'), 50);
  view.setUint16(58, 1, true);
  view.setUint16(60, 0x9003, true);
  view.setUint16(62, 2, true);
  view.setUint32(64, 20, true);
  view.setUint32(68, 76, true);
  view.setUint32(72, 0, true);
  bytes.set(new TextEncoder().encode('2024:08:03 14:25:10\0'), 76);
  return buffer;
}

describe('MetadataAdapter', () => {
  it('parses a real EXIF TIFF through ExifReader and preserves local-time semantics', async () => {
    const tiff = createExifTiff();
    const file = new File([tiff], 'portrait.tiff', {
      type: 'image/tiff',
      lastModified: 1_700_000_000_000,
    });
    Object.defineProperty(file, 'arrayBuffer', { value: () => Promise.resolve(tiff) });

    const metadata = await readMetadata(file);

    expect(metadata.capturedAt).toBe('2024-08-03T14:25:10');
    expect(metadata.dateSource).toBe('exif');
    expect(metadata.orientation).toBe(6);
    expect(metadata.cameraModel).toBe('MEMENTO');
  });

  it('falls back to file time and reports invalid metadata without failing the image', async () => {
    const lastModified = new Date(2025, 1, 3, 4, 5, 6).getTime();
    const warning = vi.fn();
    const file = new File([new Uint8Array([1, 2, 3])], 'broken.jpg', {
      type: 'image/jpeg',
      lastModified,
    });

    const metadata = await readMetadata(file, { onWarning: warning });

    expect(metadata.dateSource).toBe('file');
    expect(metadata.capturedAtMs).toBe(lastModified);
    expect(warning).toHaveBeenCalledWith(expect.objectContaining({ code: 'METADATA_INVALID' }));
  });

  it('times out an untrusted loader and continues with a warning', async () => {
    vi.useFakeTimers();
    const warning = vi.fn();
    const file = new File([new Uint8Array([1])], 'slow.jpg', {
      type: 'image/jpeg',
      lastModified: 1000,
    });
    const promise = readMetadata(file, {
      timeoutMs: 20,
      loader: () => new Promise(() => undefined),
      onWarning: warning,
    });
    await vi.advanceTimersByTimeAsync(21);

    await expect(promise).resolves.toEqual(expect.objectContaining({ dateSource: 'file' }));
    expect(warning).toHaveBeenCalledWith(expect.objectContaining({ code: 'METADATA_TIMEOUT' }));
    vi.useRealTimers();
  });

  it('normalizes explicit offsets and rejects impossible dates', () => {
    expect(normalizeExifDate('2024:08:03 14:25:10', '+0800')?.capturedAt).toBe(
      '2024-08-03T14:25:10+08:00',
    );
    expect(normalizeExifDate('2024:02:31 14:25:10')).toBeNull();
  });
});
