import { useEffect, useState, type ReactNode, type SyntheticEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { saveConstellation } from '../../data/repositories/constellationRepository';
import type { Constellation } from '../../domain/constellation';
import { useSceneStore } from '../../stores/sceneStore';
import { useSelectionStore } from '../../stores/selectionStore';

export function ConstellationComposer(): ReactNode {
  const navigate = useNavigate();
  const selectedIds = useSelectionStore((state) => state.selectedIds);
  const clearSelection = useSelectionStore((state) => state.clear);
  const dataset = useSceneStore((state) => state.dataset);
  const source = useSceneStore((state) => state.source);
  const upsertConstellation = useSceneStore((state) => state.upsertConstellation);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !saving) setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open, saving]);

  if (selectedIds.length === 0) return null;
  const selectedMemories = (dataset?.memories ?? []).filter((memory) =>
    selectedIds.includes(memory.id),
  );

  const submit = (event: SyntheticEvent<HTMLFormElement, SubmitEvent>): void => {
    event.preventDefault();
    const normalizedName = name.trim();
    if (normalizedName.length === 0) {
      setError('请为这组记忆写下一个名称。');
      return;
    }
    if (selectedIds.length < 2) {
      setError('至少选择两段记忆才能形成星座。');
      return;
    }
    const now = new Date().toISOString();
    const constellation: Constellation = {
      id: `${source}-user-constellation-${crypto.randomUUID()}`,
      source,
      name: normalizedName,
      description: description.trim(),
      memoryIds: [...selectedIds].sort(),
      createdAt: now,
      updatedAt: now,
    };
    setSaving(true);
    setError('');
    void saveConstellation(constellation)
      .then(() => {
        upsertConstellation(constellation);
        clearSelection();
        setOpen(false);
        void navigate(`/constellation/${encodeURIComponent(constellation.id)}`);
      })
      .catch(() => setError('星座没有保存成功，请稍后重试。'))
      .finally(() => setSaving(false));
  };

  return (
    <>
      <aside className="selection-bar" aria-live="polite">
        <span>已选择 {selectedIds.length} 段记忆</span>
        <div>
          <button type="button" onClick={clearSelection}>取消</button>
          <button
            type="button"
            className="primary-action"
            disabled={selectedIds.length < 2}
            onClick={() => setOpen(true)}
          >
            连接为星座
          </button>
        </div>
      </aside>
      {open && (
        <div className="constellation-composer-backdrop">
          <section
            className="constellation-composer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="constellation-composer-title"
          >
            <div>
              <p className="eyebrow">NEW CONSTELLATION</p>
              <h2 id="constellation-composer-title">把这些记忆连接起来</h2>
            </div>
            <p className="constellation-selection-preview">
              {selectedMemories.map((memory) => memory.title).join(' · ')}
            </p>
            <form onSubmit={submit}>
              <label>
                <span>名称</span>
                <input
                  autoFocus
                  value={name}
                  maxLength={60}
                  onChange={(event) => {
                    setName(event.target.value);
                    setError('');
                  }}
                />
              </label>
              <label>
                <span>描述（可选）</span>
                <textarea
                  value={description}
                  maxLength={240}
                  rows={3}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
              {error && <p className="inline-error" role="alert">{error}</p>}
              <div className="constellation-composer__actions">
                <button type="button" className="secondary-action" onClick={() => setOpen(false)} disabled={saving}>
                  返回
                </button>
                <button type="submit" className="primary-action" disabled={saving}>
                  {saving ? '正在连接…' : '保存星座'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
