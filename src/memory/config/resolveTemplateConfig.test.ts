import { describe, expect, it } from 'vitest';

import { getMemoryTemplate, resolveTemplateConfig } from './index';

describe('template session overrides', () => {
  it('returns a non-mutating resolved config with phase and layout overrides', () => {
    const base = getMemoryTemplate('high-school');
    const originalHeroLabel = base.phases.find((phase) => phase.id === 'hero')?.label;
    const resolved = resolveTemplateConfig(base, {
      layoutPreset: 'helix',
      phaseOverrides: { hero: { label: '毕业照', camera: 'approach' } },
    });
    expect(resolved.layout).toBe('helix');
    expect(resolved.phases.find((phase) => phase.id === 'hero')?.label).toBe('毕业照');
    expect(base.layout).toBe('orbit');
    expect(base.phases.find((phase) => phase.id === 'hero')?.label).toBe(originalHeroLabel);
  });

  it('rejects an override that breaks the contiguous timeline', () => {
    const base = getMemoryTemplate('high-school');
    expect(() => resolveTemplateConfig(base, { phaseOverrides: { hook: { end: 0.25 } } })).toThrow(
      /Invalid timeline phase|Timeline must end/,
    );
  });
});
