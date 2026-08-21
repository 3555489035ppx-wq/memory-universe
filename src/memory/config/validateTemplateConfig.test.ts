import { describe, expect, it } from 'vitest';

import { memoryTemplates } from './index';
import { validateTemplateConfig } from './validateTemplateConfig';

describe('memory template registry', () => {
  it('keeps every shipped template contiguous and playable', () => {
    expect(memoryTemplates).toHaveLength(5);
    for (const template of memoryTemplates) {
      expect(() => validateTemplateConfig(template)).not.toThrow();
      expect(template.phases[0]?.start).toBe(0);
      expect(template.phases.at(-1)?.end).toBe(1);
      expect(template.phases.map((phase) => phase.layout)).not.toHaveLength(0);
      expect(template.minPhotos).toBe(24);
      expect(template.maxPhotos).toBe(96);
    }
  });

  it('rejects gaps and overlaps instead of silently changing story timing', () => {
    const base = memoryTemplates[0];
    expect(base).toBeDefined();
    if (!base) return;
    const first = base.phases[0];
    const second = base.phases[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (!first || !second) return;
    expect(() =>
      validateTemplateConfig({
        ...base,
        phases: [
          { ...first, start: 0, end: 0.4 },
          { ...second, start: 0.5, end: 1 },
        ],
      }),
    ).toThrow(/overlap or have gaps/);
  });
});
