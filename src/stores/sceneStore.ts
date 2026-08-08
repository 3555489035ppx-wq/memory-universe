import { create } from 'zustand';

import type { Constellation } from '../domain/constellation';
import type { Memory, MemorySource } from '../domain/memory';
import type { Person } from '../domain/person';
import type { Place } from '../domain/place';
import type { Relationship } from '../domain/relationship';
import type { LayoutPositions, UniverseView } from '../engine/layout/layoutTypes';
import type { CameraState } from '../scene/camera/CameraStateMachine';

export type SceneMode = 'entry' | 'universe' | 'memory' | 'constellation' | 'covered';
export type SceneDataStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

export interface UniverseDataset {
  memories: Memory[];
  people: Person[];
  places: Place[];
  constellations: Constellation[];
}

export type UniverseLayouts = Record<UniverseView, LayoutPositions>;

export interface NavigationRequest {
  id: number;
  path: string;
  replace: boolean;
}

interface SceneState {
  routePath: string;
  mode: SceneMode;
  source: MemorySource;
  view: UniverseView;
  dataStatus: SceneDataStatus;
  dataError: string | null;
  dataset: UniverseDataset | null;
  relationships: Relationship[];
  layouts: UniverseLayouts | null;
  hoveredMemoryId: string | null;
  focusedMemoryId: string | null;
  activeMemoryId: string | null;
  activeConstellationId: string | null;
  hubFocusId: string | null;
  echoPath: string[];
  timeRange: readonly [number, number];
  collapsed: boolean;
  cameraState: CameraState;
  navigationRequest: NavigationRequest | null;
  syncRoute: (path: string, search?: string) => void;
  beginDataLoad: (source: MemorySource) => void;
  setSceneData: (
    source: MemorySource,
    dataset: UniverseDataset,
    relationships: Relationship[],
    layouts: UniverseLayouts,
  ) => void;
  setDataError: (source: MemorySource, message: string) => void;
  setView: (view: UniverseView) => void;
  setHubFocus: (hubId: string | null) => void;
  setHoveredMemory: (memoryId: string | null) => void;
  focusMemory: (memoryId: string) => void;
  requestMemory: (memoryId: string, replace?: boolean) => void;
  requestUniverse: () => void;
  clearNavigationRequest: (id: number) => void;
  clearFocus: () => void;
  setTimeRange: (range: readonly [number, number]) => void;
  setCollapsed: (collapsed: boolean) => void;
  setCameraState: (cameraState: CameraState) => void;
  upsertConstellation: (constellation: Constellation) => void;
  removeConstellation: (constellationId: string) => void;
}

function modeFromPath(path: string): SceneMode {
  if (path === '/') return 'entry';
  if (path === '/universe') return 'universe';
  if (path.startsWith('/memory/')) return 'memory';
  if (path.startsWith('/constellation/')) return 'constellation';
  return 'covered';
}

function memoryIdFromPath(path: string): string | null {
  if (!path.startsWith('/memory/')) return null;
  const encoded = path.slice('/memory/'.length).split('/')[0];
  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

function constellationIdFromPath(path: string): string | null {
  if (!path.startsWith('/constellation/')) return null;
  const encoded = path.slice('/constellation/'.length).split('/')[0];
  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

function sourceFromRoute(path: string, search: string, previous: MemorySource): MemorySource {
  const requested = new URLSearchParams(search).get('source');
  if (requested === 'demo' || requested === 'personal') return requested;
  const memoryId = memoryIdFromPath(path);
  if (memoryId?.startsWith('demo-')) return 'demo';
  if (memoryId) return 'personal';
  const constellationId = constellationIdFromPath(path);
  if (constellationId?.startsWith('demo-')) return 'demo';
  if (constellationId) return 'personal';
  return previous;
}

let navigationSequence = 0;

export const useSceneStore = create<SceneState>((set, get) => ({
  routePath: '/',
  mode: 'entry',
  source: 'demo',
  view: 'time',
  dataStatus: 'idle',
  dataError: null,
  dataset: null,
  relationships: [],
  layouts: null,
  hoveredMemoryId: null,
  focusedMemoryId: null,
  activeMemoryId: null,
  activeConstellationId: null,
  hubFocusId: null,
  echoPath: [],
  timeRange: [0, 100],
  collapsed: false,
  cameraState: 'idle',
  navigationRequest: null,
  syncRoute: (routePath, search = '') =>
    set((state) => {
      const source = sourceFromRoute(routePath, search, state.source);
      const activeMemoryId = memoryIdFromPath(routePath);
      const activeConstellationId = constellationIdFromPath(routePath);
      const sourceChanged = source !== state.source;
      const echoPath =
        activeMemoryId && state.echoPath.at(-1) !== activeMemoryId
          ? [...state.echoPath, activeMemoryId].slice(-12)
          : state.echoPath;
      return {
        routePath,
        mode: modeFromPath(routePath),
        source,
        activeMemoryId,
        activeConstellationId,
        echoPath,
        ...(sourceChanged
          ? {
              dataStatus: 'idle' as const,
              dataError: null,
              dataset: null,
              relationships: [],
              layouts: null,
              hoveredMemoryId: null,
              focusedMemoryId: null,
              hubFocusId: null,
              echoPath: activeMemoryId ? [activeMemoryId] : [],
            }
          : {}),
      };
    }),
  beginDataLoad: (source) => {
    if (get().source !== source) return;
    set({ dataStatus: 'loading', dataError: null });
  },
  setSceneData: (source, dataset, relationships, layouts) => {
    if (get().source !== source) return;
    set({
      dataset,
      relationships,
      layouts,
      dataStatus: dataset.memories.length > 0 ? 'ready' : 'empty',
      dataError: null,
    });
  },
  setDataError: (source, dataError) => {
    if (get().source !== source) return;
    set({ dataStatus: 'error', dataError });
  },
  setView: (view) => set({ view, hubFocusId: null }),
  setHubFocus: (hubFocusId) => set({ hubFocusId, focusedMemoryId: null }),
  setHoveredMemory: (hoveredMemoryId) => set({ hoveredMemoryId }),
  focusMemory: (memoryId) => {
    const state = get();
    if (state.focusedMemoryId === memoryId) {
      state.requestMemory(memoryId);
      return;
    }
    set({ focusedMemoryId: memoryId, hoveredMemoryId: memoryId });
  },
  requestMemory: (memoryId, replace = false) => {
    navigationSequence += 1;
    set({
      focusedMemoryId: memoryId,
      navigationRequest: {
        id: navigationSequence,
        path: `/memory/${encodeURIComponent(memoryId)}`,
        replace,
      },
    });
  },
  requestUniverse: () => {
    navigationSequence += 1;
    const source = get().source;
    set({
      navigationRequest: {
        id: navigationSequence,
        path: `/universe?source=${source}`,
        replace: true,
      },
    });
  },
  clearNavigationRequest: (id) =>
    set((state) => (state.navigationRequest?.id === id ? { navigationRequest: null } : state)),
  clearFocus: () => set({ focusedMemoryId: null, hoveredMemoryId: null }),
  setTimeRange: (timeRange) => {
    const values = timeRange.map((value) => Math.max(0, Math.min(100, value))).toSorted((a, b) => a - b);
    const start = values[0] ?? 0;
    const end = values[1] ?? start;
    set({ timeRange: [start, end] });
  },
  setCollapsed: (collapsed) => set({ collapsed }),
  setCameraState: (cameraState) => set({ cameraState }),
  upsertConstellation: (constellation) =>
    set((state) => {
      if (!state.dataset || constellation.source !== state.source) return state;
      const constellations = state.dataset.constellations
        .filter((item) => item.id !== constellation.id)
        .concat(constellation)
        .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      return { dataset: { ...state.dataset, constellations } };
    }),
  removeConstellation: (constellationId) =>
    set((state) =>
      state.dataset
        ? {
            dataset: {
              ...state.dataset,
              constellations: state.dataset.constellations.filter(
                (constellation) => constellation.id !== constellationId,
              ),
            },
          }
        : state,
    ),
}));
