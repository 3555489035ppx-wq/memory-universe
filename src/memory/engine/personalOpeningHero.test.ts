import { describe, expect, it } from 'vitest';

import { PERSONAL_OPENING_HERO_TAG } from '../../domain/memory';
import { createMemoryFixture } from '../../test/fixtures/memoryFixture';
import {
  includeOpeningHeroInSelection,
  resolvePersonalOpeningHeroId,
} from './personalOpeningHero';

describe('personal opening hero', () => {
  it('uses a marked personal photo and ignores identically tagged demo content', () => {
    const memories = [
      createMemoryFixture({ id: 'demo-hero', source: 'demo', tags: [PERSONAL_OPENING_HERO_TAG] }),
      createMemoryFixture({ id: 'personal-hero', source: 'personal', tags: [PERSONAL_OPENING_HERO_TAG] }),
    ];

    expect(resolvePersonalOpeningHeroId(memories)).toBe('personal-hero');
    const demoMemory = memories[0];
    if (!demoMemory) throw new Error('Demo memory fixture is missing.');
    expect(resolvePersonalOpeningHeroId([demoMemory])).toBeNull();
  });

  it('keeps the marked photo inside a size-limited template selection', () => {
    expect(includeOpeningHeroInSelection(['a', 'b', 'c'], 'personal-hero', 3)).toEqual([
      'a',
      'personal-hero',
      'c',
    ]);
  });
});
