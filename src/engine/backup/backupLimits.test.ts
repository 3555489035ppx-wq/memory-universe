import { describe, expect, it } from 'vitest';

import { validateBackupPath } from './backupLimits';

describe('backup path validation', () => {
  it('accepts only known metadata and image paths', () => {
    expect(validateBackupPath('manifest.json')).toBe('manifest.json');
    expect(validateBackupPath('assets/previews/personal-memory.webp')).toBe(
      'assets/previews/personal-memory.webp',
    );
  });

  it.each([
    '../metadata.json',
    '/metadata.json',
    'C:/metadata.json',
    'assets\\previews\\photo.webp',
    'assets/previews/archive.zip',
    'assets/previews/payload.js',
    'unknown.json',
  ])('rejects unsafe path %s', (path) => {
    expect(() => validateBackupPath(path)).toThrow();
  });
});
