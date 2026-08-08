import { describe, expect, it } from 'vitest';

import {
  MAX_DECODED_PIXELS,
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_FILES,
} from './importLimits';
import {
  ImportValidationError,
  imageKindFromFile,
  validateBatchSize,
  validateDecodedDimensions,
  validateImage,
} from './validateImage';

function file(name: string, type: string, bytes = 1): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

function validationCode(action: () => void): string {
  try {
    action();
  } catch (error) {
    if (error instanceof ImportValidationError) return error.code;
    throw error;
  }
  throw new Error('Expected validation to fail');
}

describe('image import limits', () => {
  it('accepts supported MIME types and falls back to a known extension', () => {
    expect(validateImage(file('photo.jpg', 'image/jpeg'))).toBe('jpeg');
    expect(validateImage(file('photo.avif', ''))).toBe('avif');
    expect(imageKindFromFile(file('photo.heif', 'application/octet-stream'))).toBe('heic');
  });

  it('rejects empty, oversized, and unsupported files with stable codes', () => {
    expect(validationCode(() => validateImage(file('empty.jpg', 'image/jpeg', 0)))).toBe(
      'EMPTY_FILE',
    );
    const oversized = new File([new Uint8Array(1)], 'huge.jpg', { type: 'image/jpeg' });
    Object.defineProperty(oversized, 'size', { value: MAX_IMPORT_FILE_BYTES + 1 });
    expect(validationCode(() => validateImage(oversized))).toBe('FILE_TOO_LARGE');
    expect(validationCode(() => validateImage(file('notes.txt', 'text/plain')))).toBe(
      'UNSUPPORTED_TYPE',
    );
  });

  it('enforces inclusive file and decoded pixel boundaries', () => {
    expect(() => validateBatchSize(MAX_IMPORT_FILES)).not.toThrow();
    expect(validationCode(() => validateBatchSize(MAX_IMPORT_FILES + 1))).toBe('TOO_MANY_FILES');
    expect(() => validateDecodedDimensions(MAX_DECODED_PIXELS, 1)).not.toThrow();
    expect(
      validationCode(() => validateDecodedDimensions(MAX_DECODED_PIXELS + 1, 1)),
    ).toBe('PIXEL_LIMIT_EXCEEDED');
  });
});
