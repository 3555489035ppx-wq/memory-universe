import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';

import { useSceneStore } from '../../stores/sceneStore';
import { useSelectionStore } from '../../stores/selectionStore';
import { formatMemoryDate } from './formatMemory';

export function UniverseKeyboardNavigator(): ReactNode {
  const dataset = useSceneStore((state) => state.dataset);
  const focusMemory = useSceneStore((state) => state.focusMemory);
  const clearFocus = useSceneStore((state) => state.clearFocus);
  const setHoveredMemory = useSceneStore((state) => state.setHoveredMemory);
  const selectedIds = useSelectionStore((state) => state.selectedIds);
  const toggleSelection = useSelectionStore((state) => state.toggle);
  const [index, setIndex] = useState(0);
  const memories = useMemo(
    () =>
      (dataset?.memories ?? []).toSorted(
        (left, right) =>
          (left.capturedAtMs ?? Number.NEGATIVE_INFINITY) -
            (right.capturedAtMs ?? Number.NEGATIVE_INFINITY) || left.id.localeCompare(right.id),
      ),
    [dataset?.memories],
  );
  const current = memories[index];

  const move = (offset: number): void => {
    if (memories.length === 0) return;
    setIndex((value) => (value + offset + memories.length) % memories.length);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'Enter' && current) {
      event.preventDefault();
      if (event.shiftKey) toggleSelection(current.id, true);
      else focusMemory(current.id);
    } else if (event.key === 'Escape') {
      clearFocus();
    }
  };

  if (!current) return null;
  return (
    <div className="keyboard-navigator-dock">
      <div
        className="keyboard-navigator"
        role="group"
        aria-label="键盘浏览记忆。使用方向键切换，回车聚焦或进入，Shift 加回车加入星座选择，Esc 退出聚焦。"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <span className="keyboard-navigator__index">
          {String(index + 1).padStart(2, '0')} / {String(memories.length).padStart(2, '0')}
        </span>
        <button type="button" onClick={() => move(-1)} aria-label="上一段记忆">
          ←
        </button>
        <button
          type="button"
          onMouseEnter={() => setHoveredMemory(current.id)}
          onMouseLeave={() => setHoveredMemory(null)}
          onClick={(event) => {
            if (event.shiftKey) toggleSelection(current.id, true);
            else focusMemory(current.id);
          }}
        >
          <span>{formatMemoryDate(current)}</span>
          <strong>{current.title}</strong>
        </button>
        <button
          type="button"
          className="keyboard-navigator__select"
          aria-label={`${selectedIds.includes(current.id) ? '取消选择' : '选择'}${current.title}`}
          aria-pressed={selectedIds.includes(current.id)}
          onClick={() => toggleSelection(current.id, true)}
        >
          {selectedIds.includes(current.id) ? '已选' : '选择'}
        </button>
        <button type="button" onClick={() => move(1)} aria-label="下一段记忆">
          →
        </button>
      </div>
    </div>
  );
}
