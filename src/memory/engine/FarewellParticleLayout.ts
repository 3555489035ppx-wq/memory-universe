export type FarewellParticlePoint = readonly [number, number, number];

const FAREWELL_PARTICLE_COPY = '\u518D\u89C1\u4E86\uFF0C\u6211\u4EEC\u7684\u9752\u6625';
const textTargetCache = new Map<string, Float32Array>();

function unit(index: number, salt: number): number {
  const value = Math.sin(index * 91.731 + salt * 17.137) * 43_758.545_312_3;
  return value - Math.floor(value);
}

function fallbackTargets(count: number, seed: number): Float32Array {
  const targets = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;
    const column = index % 48;
    const row = Math.floor(index / 48);
    targets[offset] = (column / 47 - 0.5) * 6.4 + (unit(index, seed + 1) - 0.5) * 0.035;
    targets[offset + 1] = (0.5 - row / Math.max(1, Math.ceil(count / 48) - 1)) * 1.45;
    targets[offset + 2] = 0.28 + (unit(index, seed + 2) - 0.5) * 0.1;
  }
  return targets;
}

/**
 * Builds a deterministic point cloud from the actual CJK copy. Canvas text is
 * used only to sample the glyph silhouette; the returned points are ordinary
 * world-space coordinates, so WebGL preview and Canvas export can share the
 * same visual intent without shipping a second font asset.
 */
export function createFarewellTextTargets(count: number, seed: number): Float32Array {
  const safeCount = Math.max(0, Math.floor(count));
  if (safeCount === 0) return new Float32Array(0);
  const cacheKey = String(safeCount) + ':' + String(seed);
  const cached = textTargetCache.get(cacheKey);
  if (cached) return cached;
  if (typeof document === 'undefined') {
    const fallback = fallbackTargets(safeCount, seed);
    textTargetCache.set(cacheKey, fallback);
    return fallback;
  }

  const canvas = document.createElement('canvas');
  // Leave enough horizontal and vertical resolution for the full CJK copy.
  // The old 1200x240 canvas clipped the last glyphs at larger point counts,
  // which made the text read like a dim horizontal smear instead of a word.
  canvas.width = 1400;
  canvas.height = 300;
  const context = canvas.getContext('2d');
  if (!context) {
    const fallback = fallbackTargets(safeCount, seed);
    textTargetCache.set(cacheKey, fallback);
    return fallback;
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#fff';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = '700 126px "Microsoft YaHei", "Noto Serif SC", serif';
  context.fillText(FAREWELL_PARTICLE_COPY, canvas.width * 0.5, canvas.height * 0.51);

  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const candidates: Array<[number, number]> = [];
  for (let y = 20; y < canvas.height - 20; y += 3) {
    for (let x = 20; x < canvas.width - 20; x += 3) {
      if ((pixels[(y * canvas.width + x) * 4 + 3] ?? 0) >= 100) candidates.push([x, y]);
    }
  }
  if (candidates.length === 0) {
    const fallback = fallbackTargets(safeCount, seed);
    textTargetCache.set(cacheKey, fallback);
    return fallback;
  }

  const targets = new Float32Array(safeCount * 3);
  for (let index = 0; index < safeCount; index += 1) {
    const candidate = candidates[
      Math.floor(((index + 0.5) / safeCount) * candidates.length) % candidates.length
    ];
    if (!candidate) continue;
    const offset = index * 3;
    const jitterX = (unit(index, seed + 101) - 0.5) * 0.035;
    const jitterY = (unit(index, seed + 103) - 0.5) * 0.035;
    targets[offset] = (candidate[0] / canvas.width - 0.5) * 8.4 + jitterX;
    targets[offset + 1] = (0.5 - candidate[1] / canvas.height) * 2.02 + jitterY;
    targets[offset + 2] = 0.32 + (unit(index, seed + 107) - 0.5) * 0.1;
  }
  textTargetCache.set(cacheKey, targets);
  return targets;
}

export function farewellParticleBurst(index: number, seed: number): FarewellParticlePoint {
  const angle = unit(index, seed + 113) * Math.PI * 2;
  const speed = 1.2 + unit(index, seed + 127) * 2.5;
  return [
    Math.cos(angle) * speed,
    Math.sin(angle) * speed * 0.72,
    (unit(index, seed + 131) - 0.5) * 2.4,
  ];
}
