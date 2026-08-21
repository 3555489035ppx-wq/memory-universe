import type { Memory } from '../../domain/memory';

import { dimensions, sortedMemories } from './shared';

export interface PackedPhotoSlot {
  position: readonly [number, number, number];
  scale: number;
  width: number;
  height: number;
  row: number;
  column: number;
}

export interface JustifiedPhotoPackingOptions {
  maxWidth?: number;
  maxHeight?: number;
  targetRowHeight?: number;
  gap?: number;
}

interface RowEntry {
  memory: Memory;
  aspect: number;
}

interface PackedRow {
  entries: RowEntry[];
  height: number;
  width: number;
}

function boundedAspect(memory: Memory): number {
  return Math.min(4, Math.max(0.25, memory.width / Math.max(1, memory.height)));
}

/**
 * Produces a deterministic, justified contact sheet. Every row has one shared
 * rendered height, so portraits, squares and panoramas meet without leaving
 * the empty grid cells caused by fixed column layouts. The final composition
 * is uniformly reduced only when every row cannot fit inside the safe frame.
 */
export function packJustifiedPhotoRows(
  memories: readonly Memory[],
  options: JustifiedPhotoPackingOptions = {},
): Record<string, PackedPhotoSlot> {
  const maxWidth = Math.max(1, options.maxWidth ?? 10.6);
  const maxHeight = Math.max(1, options.maxHeight ?? 5.35);
  const targetRowHeight = Math.max(0.2, options.targetRowHeight ?? 0.86);
  const gap = Math.max(0, options.gap ?? 0.08);
  const ordered = sortedMemories(memories);
  if (ordered.length === 0) return {};

  const rows: RowEntry[][] = [];
  let row: RowEntry[] = [];
  let aspectTotal = 0;

  for (const memory of ordered) {
    const entry = { memory, aspect: boundedAspect(memory) };
    const candidateAspect = aspectTotal + entry.aspect;
    const candidateWidth = candidateAspect * targetRowHeight + gap * row.length;
    // Keep a row from becoming a one-photo island. If the next photo would
    // overflow a one-item row, keep both together and let the justified
    // height shrink to the safe frame. A lone photo is only valid when the
    // entire input contains one photo.
    if (row.length > 1 && candidateWidth > maxWidth) {
      rows.push(row);
      row = [entry];
      aspectTotal = entry.aspect;
    } else {
      row.push(entry);
      aspectTotal = candidateAspect;
    }
  }
  if (row.length > 0) rows.push(row);

  // Avoid an isolated final tile. Merging the final two rows lets the
  // justified-height calculation shrink that row instead of leaving a lone
  // photo stranded at the edge of an otherwise empty rectangle.
  const lastRow = rows.at(-1);
  const previousRow = rows.at(-2);
  if (lastRow?.length === 1 && previousRow) {
    rows.splice(rows.length - 2, 2, [...previousRow, ...lastRow]);
  }

  const packedRows: PackedRow[] = rows.map((entries, rowIndex) => {
    const sumAspect = entries.reduce((sum, entry) => sum + entry.aspect, 0);
    const idealHeight = (maxWidth - gap * Math.max(0, entries.length - 1)) / Math.max(0.25, sumAspect);
    const isLast = rowIndex === rows.length - 1;
    const fillAtTarget = (sumAspect * targetRowHeight + gap * Math.max(0, entries.length - 1)) / maxWidth;
    const shouldJustify = !isLast || fillAtTarget >= 0.76;
    const height = shouldJustify
      ? Math.min(targetRowHeight * 1.16, Math.max(0.2, idealHeight))
      : targetRowHeight;
    return {
      entries,
      height,
      width: sumAspect * height + gap * Math.max(0, entries.length - 1),
    };
  });

  const naturalHeight = packedRows.reduce(
    (sum, candidate) => sum + candidate.height,
    gap * Math.max(0, packedRows.length - 1),
  );
  const globalScale = Math.min(1, maxHeight / Math.max(0.001, naturalHeight));
  const scaledGap = gap * globalScale;
  const contentHeight = naturalHeight * globalScale;
  const result: Record<string, PackedPhotoSlot> = {};
  let top = contentHeight / 2;

  packedRows.forEach((packedRow, rowIndex) => {
    const rowHeight = packedRow.height * globalScale;
    const rowWidth = packedRow.width * globalScale;
    let left = -rowWidth / 2;
    const y = top - rowHeight / 2;

    packedRow.entries.forEach((entry, column) => {
      const width = entry.aspect * rowHeight;
      const [planeWidth, planeHeight] = dimensions(entry.memory);
      const scale = rowHeight / planeHeight;
      result[entry.memory.id] = {
        position: [left + width / 2, y, 0],
        scale,
        width: planeWidth * scale,
        height: planeHeight * scale,
        row: rowIndex,
        column,
      };
      left += width + scaledGap;
    });

    top -= rowHeight + scaledGap;
  });

  return result;
}
