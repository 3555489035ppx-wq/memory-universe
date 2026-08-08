import { useMemo, useRef, type PointerEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import type { UniverseView } from '../../engine/layout/layoutTypes';
import { useSceneStore } from '../../stores/sceneStore';
import { useUiStore } from '../../stores/uiStore';
import { ConstellationComposer } from '../constellation/ConstellationComposer';
import { UniverseKeyboardNavigator } from './UniverseKeyboardNavigator';
import { formatMemoryDate, placeName } from './formatMemory';

const VIEW_LABELS: ReadonlyArray<{ id: UniverseView; label: string }> = [
  { id: 'time', label: '时间' },
  { id: 'people', label: '人物' },
  { id: 'place', label: '地点' },
  { id: 'emotion', label: '情绪' },
];

const VIEW_NOTES: Record<UniverseView, string> = {
  time: '过去在深处，现在更靠近你',
  people: '共同出现的人让记忆形成轨道',
  place: '这里呈现记忆之间的距离，不是地理距离',
  emotion: '照片保留原色，情绪只改变空间节奏',
};

export function UniverseHUD(): ReactNode {
  const source = useSceneStore((state) => state.source);
  const view = useSceneStore((state) => state.view);
  const setView = useSceneStore((state) => state.setView);
  const dataStatus = useSceneStore((state) => state.dataStatus);
  const dataError = useSceneStore((state) => state.dataError);
  const dataset = useSceneStore((state) => state.dataset);
  const hoveredMemoryId = useSceneStore((state) => state.hoveredMemoryId);
  const focusedMemoryId = useSceneStore((state) => state.focusedMemoryId);
  const timeRange = useSceneStore((state) => state.timeRange);
  const hubFocusId = useSceneStore((state) => state.hubFocusId);
  const setHubFocus = useSceneStore((state) => state.setHubFocus);
  const setTimeRange = useSceneStore((state) => state.setTimeRange);
  const openImport = useUiStore((state) => state.openImport);
  const activeRangeThumb = useRef<0 | 1 | null>(null);
  const inspected = dataset?.memories.find(
    (memory) => memory.id === (hoveredMemoryId ?? focusedMemoryId),
  );
  const yearRange = useMemo(() => {
    const years = (dataset?.memories ?? [])
      .map((memory) =>
        memory.capturedAtMs === null ? null : new Date(memory.capturedAtMs).getFullYear(),
      )
      .filter((year): year is number => year !== null);
    return years.length > 0
      ? `${String(Math.min(...years))}—${String(Math.max(...years))}`
      : '时间未标记';
  }, [dataset?.memories]);

  const setRangeFromPointer = (event: PointerEvent<HTMLDivElement>, thumb: 0 | 1): void => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const value = ratio * 100;
    setTimeRange(thumb === 0 ? [value, timeRange[1]] : [timeRange[0], value]);
  };

  const handleRangePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const start = timeRange[0] / 100;
    const end = timeRange[1] / 100;
    const thumb: 0 | 1 = Math.abs(ratio - start) <= Math.abs(ratio - end) ? 0 : 1;
    activeRangeThumb.current = thumb;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    setRangeFromPointer(event, thumb);
  };

  const handleRangePointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (activeRangeThumb.current === null) return;
    setRangeFromPointer(event, activeRangeThumb.current);
  };

  const handleRangePointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    activeRangeThumb.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <main className="universe-hud" aria-label="记忆宇宙">
      <section className="universe-source" aria-label="当前数据源">
        <span>{source === 'demo' ? '演示宇宙' : '我的宇宙'}</span>
        <Link to={`/universe?source=${source === 'demo' ? 'personal' : 'demo'}`}>
          {source === 'demo' ? '进入我的记忆' : '查看演示'}
        </Link>
      </section>

      <nav className="view-switcher" aria-label="空间观察方式">
        {VIEW_LABELS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={view === item.id}
            onClick={() => setView(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <p className="view-note">{VIEW_NOTES[view]}</p>

      {view === 'people' && dataset && (
        <aside className="hub-index" aria-label="人物记忆轨道">
          <span>人物 Hub</span>
          {dataset.people.map((person) => {
            const count = dataset.memories.filter((memory) =>
              memory.personIds.includes(person.id),
            ).length;
            return (
              <button
                key={person.id}
                type="button"
                aria-pressed={hubFocusId === person.id}
                onClick={() => setHubFocus(hubFocusId === person.id ? null : person.id)}
              >
                {person.name} <small>{count}</small>
              </button>
            );
          })}
          {hubFocusId && (
            <button type="button" onClick={() => setHubFocus(null)}>
              查看全部
            </button>
          )}
        </aside>
      )}

      {dataStatus === 'loading' && (
        <div className="scene-status" role="status">
          <span>正在建立关系空间</span>
          <i />
        </div>
      )}
      {dataStatus === 'error' && (
        <div className="scene-status scene-status--error" role="alert">
          <strong>这次没有成功打开记忆空间</strong>
          <span>
            {dataError === 'DEMO_DATA_UNAVAILABLE'
              ? '演示数据暂时不可用。'
              : '请刷新后重试，本地照片不会被删除。'}
          </span>
        </div>
      )}
      {dataStatus === 'empty' && source === 'personal' && (
        <section className="personal-empty" aria-labelledby="personal-empty-title">
          <p className="eyebrow">你的空间还没有第一段记忆</p>
          <h1 id="personal-empty-title">从一张真正属于你的照片开始。</h1>
          <button type="button" className="primary-action" onClick={openImport}>
            导入本地照片
          </button>
          <small>照片仅在当前浏览器处理与保存。</small>
        </section>
      )}

      {inspected && dataset && (
        <aside className="hover-inspector" aria-live="polite">
          <p>
            {formatMemoryDate(inspected)} · {placeName(inspected, dataset)}
          </p>
          <strong>{inspected.title}</strong>
          <span>{focusedMemoryId === inspected.id ? '再次选择，进入这段记忆' : '选择以聚焦'}</span>
        </aside>
      )}

      {dataStatus === 'ready' && (
        <footer className="universe-footer">
          <div
            className="range-control"
            aria-label="时间范围"
            onPointerDown={handleRangePointerDown}
            onPointerMove={handleRangePointerMove}
            onPointerUp={handleRangePointerUp}
            onPointerCancel={handleRangePointerUp}
          >
            <span>{yearRange}</span>
            <label>
              <span className="sr-only">时间范围起点</span>
              <input
                type="range"
                min="0"
                max="100"
                value={timeRange[0]}
                onChange={(event) => setTimeRange([Number(event.target.value), timeRange[1]])}
                aria-label="时间范围起点"
              />
            </label>
            <label>
              <span className="sr-only">时间范围终点</span>
              <input
                type="range"
                min="0"
                max="100"
                value={timeRange[1]}
                onChange={(event) => setTimeRange([timeRange[0], Number(event.target.value)])}
                aria-label="时间范围终点"
              />
            </label>
          </div>
        </footer>
      )}
      {dataStatus === 'ready' && <UniverseKeyboardNavigator />}
      {dataStatus === 'ready' && <ConstellationComposer />}
    </main>
  );
}
