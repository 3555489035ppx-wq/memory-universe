import { useEffect, useMemo, type ReactNode } from 'react';

import { rankEchoCandidates } from '../../engine/relationship/buildRelationshipGraph';
import { useSceneStore } from '../../stores/sceneStore';
import {
  explainRelationshipWithNames,
  formatMemoryDate,
  placeName,
} from '../universe/formatMemory';
import { useAssetImageUrl } from '../archive/useAssetImageUrl';

export function MemoryDiveOverlay(): ReactNode {
  const dataset = useSceneStore((state) => state.dataset);
  const relationships = useSceneStore((state) => state.relationships);
  const activeMemoryId = useSceneStore((state) => state.activeMemoryId);
  const echoPath = useSceneStore((state) => state.echoPath);
  const dataStatus = useSceneStore((state) => state.dataStatus);
  const requestMemory = useSceneStore((state) => state.requestMemory);
  const requestUniverse = useSceneStore((state) => state.requestUniverse);
  const memory = dataset?.memories.find((candidate) => candidate.id === activeMemoryId);
  const imageUrl = useAssetImageUrl(memory?.assetKeys.thumbnail ?? '');
  const echoes = useMemo(() => {
    if (!activeMemoryId || !dataset) return [];
    return rankEchoCandidates(activeMemoryId, relationships, echoPath, 5)
      .map((candidate) => ({
        ...candidate,
        memory: dataset.memories.find((item) => item.id === candidate.memoryId),
      }))
      .filter((candidate) => candidate.memory !== undefined);
  }, [activeMemoryId, dataset, echoPath, relationships]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      requestUniverse();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [requestUniverse]);

  if (dataStatus === 'loading') {
    return (
      <main className="memory-dive" aria-label="正在进入记忆">
        <p className="memory-dive__loading" role="status">正在靠近这段记忆…</p>
      </main>
    );
  }

  if (!memory || !dataset) {
    return (
      <main className="memory-dive memory-dive--missing">
        <h1>没有找到这段记忆</h1>
        <p>它可能已从当前浏览器删除，或属于另一个数据源。</p>
        <button type="button" className="primary-action" onClick={requestUniverse}>返回记忆宇宙</button>
      </main>
    );
  }

  return (
    <main className="memory-dive" aria-labelledby="memory-title">
      <button type="button" className="memory-return" onClick={requestUniverse}>
        <span aria-hidden="true">←</span> 返回记忆宇宙
      </button>
      <figure className="memory-dive__image">
        {imageUrl ? <img src={imageUrl} alt={memory.title} decoding="async" /> : <span role="status">正在读取照片…</span>}
        <figcaption>{formatMemoryDate(memory, true)} · {placeName(memory, dataset)}</figcaption>
      </figure>
      <section className="memory-copy">
        <p className="memory-kicker">
          {formatMemoryDate(memory, true)} · {placeName(memory, dataset)}
        </p>
        <h1 id="memory-title">{memory.title}</h1>
        {memory.description && <p className="memory-description">{memory.description}</p>}
      </section>
      <p className="memory-position" aria-label={`探索路径第 ${String(echoPath.length)} 段`}>
        PATH {String(echoPath.length).padStart(2, '0')}
      </p>
      <aside className="echo-strip" aria-labelledby="echo-title">
        <div>
          <p className="eyebrow">MEMORY ECHO</p>
          <h2 id="echo-title">沿着关系继续</h2>
        </div>
        <ol>
          {echoes.map((candidate) => (
            <li key={candidate.memoryId}>
              <button type="button" onClick={() => requestMemory(candidate.memoryId)}>
                <span>{candidate.memory?.title}</span>
                <small>{explainRelationshipWithNames(candidate.relationship, dataset)}</small>
              </button>
            </li>
          ))}
        </ol>
      </aside>
    </main>
  );
}
