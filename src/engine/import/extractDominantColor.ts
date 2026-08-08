import { FastAverageColor } from 'fast-average-color';

import type { DominantColor } from '../../domain/memory';

export const DOMINANT_COLOR_ALGORITHM_VERSION = 1;

let averageColor: FastAverageColor | null = null;

function getAverageColor(): FastAverageColor {
  averageColor ??= new FastAverageColor();
  return averageColor;
}

function rgbToHsl(red: number, green: number, blue: number): readonly [number, number, number] {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const maximum = Math.max(r, g, b);
  const minimum = Math.min(r, g, b);
  const delta = maximum - minimum;
  const lightness = (maximum + minimum) / 2;
  if (delta === 0) return [0, 0, Math.round(lightness * 1000) / 10];
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;
  if (maximum === r) hue = 60 * (((g - b) / delta) % 6);
  else if (maximum === g) hue = 60 * ((b - r) / delta + 2);
  else hue = 60 * ((r - g) / delta + 4);
  if (hue < 0) hue += 360;
  return [Math.round(hue * 10) / 10, Math.round(saturation * 1000) / 10, Math.round(lightness * 1000) / 10];
}

function relativeLuminance(red: number, green: number, blue: number): number {
  const linear = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return Math.round((0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue)) * 10_000) / 10_000;
}

export function dominantColorFromRgb(
  rgb: readonly [number, number, number],
): DominantColor {
  const normalized = rgb.map((channel) => Math.round(Math.min(255, Math.max(0, channel)))) as [
    number,
    number,
    number,
  ];
  return {
    rgb: normalized,
    hsl: rgbToHsl(...normalized),
    luminance: relativeLuminance(...normalized),
    algorithmVersion: DOMINANT_COLOR_ALGORITHM_VERSION,
  };
}

export function extractDominantColor(microCanvas: HTMLCanvasElement): DominantColor {
  const result = getAverageColor().getColor(microCanvas, {
    algorithm: 'dominant',
    mode: 'precision',
    silent: false,
  });
  return dominantColorFromRgb([result.value[0], result.value[1], result.value[2]]);
}
