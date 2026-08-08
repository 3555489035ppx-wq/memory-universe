export type MemorySource = 'demo' | 'personal';
export type DateSource = 'exif' | 'file' | 'manual' | 'unknown';
export type Mood =
  | 'happy'
  | 'calm'
  | 'nostalgic'
  | 'excited'
  | 'chaotic'
  | 'lonely'
  | null;

export interface DominantColor {
  rgb: readonly [number, number, number];
  hsl: readonly [number, number, number];
  luminance: number;
  algorithmVersion: number;
}

export interface Memory {
  id: string;
  source: MemorySource;
  title: string;
  description: string;
  capturedAt: string | null;
  capturedAtMs: number | null;
  dateSource: DateSource;
  personIds: string[];
  placeId: string | null;
  mood: Mood;
  tags: string[];
  dominantColor: DominantColor;
  assetKeys: {
    micro: string;
    thumbnail: string;
    preview: string;
    original?: string;
  };
  width: number;
  height: number;
  orientationApplied: boolean;
  cameraModel?: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
}

export function isMemorySource(value: string): value is MemorySource {
  return value === 'demo' || value === 'personal';
}

export function normalizeTags(tags: readonly string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim().toLocaleLowerCase('zh-CN')).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right, 'zh-CN'),
  );
}
