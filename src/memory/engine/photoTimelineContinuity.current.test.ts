import { describe, expect, it } from 'vitest';

import type { Memory } from '../../domain/memory';
import { highSchoolTemplate } from '../config/high-school';
import { layoutEngine } from './LayoutEngine';
import { buildSongTimelineConfig } from './SongTimeline';
import { composePhaseLayouts } from './composePhaseLayouts';
import { evaluatePhotoState } from './TimelineEngine';

function memory(id: string, index: number): Memory {
  return {
    id,
    source: 'demo',
    title: id,
    description: '',
    capturedAt: null,
    capturedAtMs: null,
    dateSource: 'unknown',
    personIds: [],
    placeId: null,
    mood: null,
    tags: [],
    dominantColor: { rgb: [100, 120, 140], hsl: [210, 18, 48], luminance: 0.35, algorithmVersion: 1 },
    assetKeys: { micro: `micro-${id}`, thumbnail: `thumb-${id}`, preview: `preview-${id}` },
    width: index % 3 === 0 ? 900 : 1600,
    height: index % 3 === 0 ? 1600 : 1067,
    orientationApplied: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    schemaVersion: 1,
  };
}

describe('photo timeline continuity regression', () => {
  const memories = Array.from({ length: 96 }, (_, index) => memory(`memory-${String(index)}`, index));
  const config = buildSongTimelineConfig(highSchoolTemplate, 180);
  const heroPhotoId = memories[48]?.id ?? null;
  const layouts = layoutEngine.prepare(config, memories, heroPhotoId);
  const context = {
    config,
    memories,
    heroPhotoId,
    layouts,
    phaseLayouts: composePhaseLayouts(config, memories, layouts, heroPhotoId),
  };
  const probeMemory = memories[10];
  if (!probeMemory) throw new Error('Expected probe memory.');

  it('keeps a visible card movement below a single-frame jump across the full song', () => {
    let maxStep = 0;
    let worstPhase = '';
    let worstMemory = '';
    let worstProgress = 0;
    for (const phase of config.phases) {
      const phaseSteps = Math.max(1, Math.ceil((phase.end - phase.start) * config.durationSeconds * 60));
      for (let step = 0; step < phaseSteps; step += 1) {
        const leftProgress = phase.start + ((phase.end - phase.start) * step) / phaseSteps;
        const rightProgress = phase.start + ((phase.end - phase.start) * (step + 1)) / phaseSteps;
        const left = new Map(memories.map((item, index) => [item.id, evaluatePhotoState(leftProgress, context, item, index)]));
        for (let index = 0; index < memories.length; index += 1) {
          const item = memories[index];
          if (!item) continue;
          const from = left.get(item.id);
          const to = evaluatePhotoState(rightProgress, context, item, index);
          if (!from || !to || from.transform.opacity < 0.2 || to.transform.opacity < 0.2) continue;
          const stepDistance = Math.hypot(
            to.transform.position[0] - from.transform.position[0],
            to.transform.position[1] - from.transform.position[1],
            to.transform.position[2] - from.transform.position[2],
          );
          if (stepDistance > maxStep) {
            maxStep = stepDistance;
            worstPhase = phase.id;
            worstMemory = item.id;
            worstProgress = leftProgress;
          }
        }
      }
    }
    expect(maxStep, `worst phase: ${worstPhase}, memory: ${worstMemory}, progress: ${String(worstProgress)}`).toBeLessThan(0.75);
  }, 20_000);

  it('marks geometric chapters as volumetric photo surfaces', () => {
    const geometric = config.phases.find((phase) => phase.layout === 'sphere');
    if (!geometric) throw new Error('Expected a sphere chapter in the long-form timeline.');
    const progress = geometric.start + (geometric.end - geometric.start) * 0.5;
    const state = evaluatePhotoState(progress, context, probeMemory, 10);
    expect(state?.surface).toBe('geometric');

    const motionDrivenVolume = config.phases.find((phase) => phase.motion === 'prism-turn');
    if (!motionDrivenVolume) throw new Error('Expected a motion-driven prism chapter in the long-form timeline.');
    const motionProgress = motionDrivenVolume.start + (motionDrivenVolume.end - motionDrivenVolume.start) * 0.5;
    const motionState = evaluatePhotoState(motionProgress, context, probeMemory, 10);
    expect(motionState?.surface).toBe('geometric');
  });
});
