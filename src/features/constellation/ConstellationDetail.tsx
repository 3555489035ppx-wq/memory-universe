import { useState, type ReactNode, type SyntheticEvent } from 'react';
import { useParams } from 'react-router-dom';

import {
  deleteConstellation,
  saveConstellation,
} from '../../data/repositories/constellationRepository';
import type { Constellation } from '../../domain/constellation';
import type { Memory } from '../../domain/memory';
import { useSceneStore } from '../../stores/sceneStore';

interface EditorProps {
  constellation: Constellation;
  memories: Memory[];
}

function ConstellationEditor({ constellation, memories }: EditorProps): ReactNode {
  const [name, setName] = useState(constellation.name);
  const [description, setDescription] = useState(constellation.description);
  const [memoryIds, setMemoryIds] = useState(constellation.memoryIds);
  const [candidateId, setCandidateId] = useState('');
  const [status, setStatus] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const upsertConstellation = useSceneStore((state) => state.upsertConstellation);
  const removeConstellation = useSceneStore((state) => state.removeConstellation);
  const requestMemory = useSceneStore((state) => state.requestMemory);
  const requestUniverse = useSceneStore((state) => state.requestUniverse);
  const members = memoryIds
    .map((id) => memories.find((memory) => memory.id === id))
    .filter((memory): memory is Memory => memory !== undefined);
  const available = memories.filter((memory) => !memoryIds.includes(memory.id));
  const dirty =
    name !== constellation.name ||
    description !== constellation.description ||
    memoryIds.join('|') !== constellation.memoryIds.join('|');
  const canDelete = constellation.id.includes('-user-constellation-');

  const submit = (event: SyntheticEvent<HTMLFormElement, SubmitEvent>): void => {
    event.preventDefault();
    if (!name.trim()) {
      setStatus('名称不能为空。');
      return;
    }
    if (memoryIds.length < 2) {
      setStatus('星座至少需要两段记忆。');
      return;
    }
    const updated: Constellation = {
      ...constellation,
      name: name.trim(),
      description: description.trim(),
      memoryIds: [...memoryIds].sort(),
      updatedAt: new Date().toISOString(),
    };
    setStatus('正在保存…');
    void saveConstellation(updated)
      .then(() => {
        upsertConstellation(updated);
        setMemoryIds(updated.memoryIds);
        setStatus('已保存到当前浏览器。');
      })
      .catch(() => setStatus('保存失败，请重试。'));
  };

  const remove = (memoryId: string): void => {
    if (memoryIds.length <= 2) {
      setStatus('至少保留两段记忆。');
      return;
    }
    setMemoryIds((ids) => ids.filter((id) => id !== memoryId));
    setStatus('有未保存的修改。');
  };

  const performDelete = (): void => {
    void deleteConstellation(constellation.id)
      .then(() => {
        removeConstellation(constellation.id);
        requestUniverse();
      })
      .catch(() => setStatus('删除失败，请重试。'));
  };

  return (
    <main className="constellation-detail" aria-labelledby="constellation-title">
      <button type="button" className="memory-return" onClick={requestUniverse}>← 返回记忆宇宙</button>
      <form className="constellation-editor" onSubmit={submit}>
        <p className="eyebrow">CONSTELLATION · {String(memoryIds.length).padStart(2, '0')}</p>
        <label>
          <span className="sr-only">星座名称</span>
          <input id="constellation-title" value={name} maxLength={60} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          <span className="sr-only">星座描述</span>
          <textarea value={description} maxLength={240} rows={3} placeholder="写下这些记忆为何相连" onChange={(event) => setDescription(event.target.value)} />
        </label>
        <div className="constellation-editor__actions">
          <button type="submit" className="primary-action" disabled={!dirty}>保存修改</button>
          {canDelete && !confirmDelete && (
            <button type="button" className="text-button danger-text" onClick={() => setConfirmDelete(true)}>删除星座</button>
          )}
        </div>
        {confirmDelete && (
          <div className="inline-confirm" role="alert">
            <p>只删除这组关系，不会删除其中的照片。</p>
            <button type="button" onClick={() => setConfirmDelete(false)}>取消</button>
            <button type="button" className="danger-action" onClick={performDelete}>确认删除</button>
          </div>
        )}
        {status && <p className="constellation-status" aria-live="polite">{status}</p>}
      </form>
      <aside className="constellation-members" aria-label="星座中的记忆">
        <ol>
          {members.map((memory, index) => (
            <li key={memory.id}>
              <button type="button" onClick={() => requestMemory(memory.id)}>
                <span>{String(index + 1).padStart(2, '0')}</span> {memory.title}
              </button>
              <button type="button" onClick={() => remove(memory.id)} aria-label={`从星座移除${memory.title}`}>移除</button>
            </li>
          ))}
        </ol>
        {available.length > 0 && (
          <div className="constellation-add">
            <select className="glass-select" value={candidateId} onChange={(event) => setCandidateId(event.target.value)} aria-label="选择要加入的记忆">
              <option value="">加入另一段记忆</option>
              {available.map((memory) => <option key={memory.id} value={memory.id}>{memory.title}</option>)}
            </select>
            <button
              type="button"
              disabled={!candidateId}
              onClick={() => {
                if (!candidateId) return;
                setMemoryIds((ids) => [...ids, candidateId]);
                setCandidateId('');
                setStatus('有未保存的修改。');
              }}
            >
              加入
            </button>
          </div>
        )}
      </aside>
    </main>
  );
}

export function ConstellationDetail(): ReactNode {
  const { id } = useParams();
  const dataset = useSceneStore((state) => state.dataset);
  const status = useSceneStore((state) => state.dataStatus);
  const requestUniverse = useSceneStore((state) => state.requestUniverse);
  const constellation = dataset?.constellations.find((candidate) => candidate.id === id);

  if (status === 'loading') return <main className="constellation-detail"><p role="status">正在重组这组记忆…</p></main>;
  if (!constellation || !dataset) {
    return (
      <main className="constellation-detail constellation-detail--missing">
        <h1>没有找到这个记忆星座</h1>
        <p>它可能已被删除，或属于另一个数据源。</p>
        <button type="button" className="primary-action" onClick={requestUniverse}>返回记忆宇宙</button>
      </main>
    );
  }
  return <ConstellationEditor key={constellation.id} constellation={constellation} memories={dataset.memories} />;
}
