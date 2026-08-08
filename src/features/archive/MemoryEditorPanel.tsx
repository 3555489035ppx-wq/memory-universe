import { useEffect, useRef, useState, type ReactNode, type SyntheticEvent } from 'react';

import { deletePerson, savePerson } from '../../data/repositories/peopleRepository';
import { deletePlace, savePlace } from '../../data/repositories/placesRepository';
import { updateMemory } from '../../data/repositories/memoryRepository';
import type { Memory, Mood } from '../../domain/memory';
import { normalizeTags } from '../../domain/memory';
import type { Person } from '../../domain/person';
import type { Place } from '../../domain/place';

interface MemoryEditorPanelProps {
  memory: Memory;
  people: Person[];
  places: Place[];
  onClose: () => void;
  onSaved: (memory: Memory) => void;
  onPeopleChanged: (people: Person[]) => void;
  onPlacesChanged: (places: Place[]) => void;
}

const MOODS: ReadonlyArray<{ value: Exclude<Mood, null>; label: string }> = [
  { value: 'happy', label: '快乐' },
  { value: 'calm', label: '平静' },
  { value: 'nostalgic', label: '怀念' },
  { value: 'excited', label: '兴奋' },
  { value: 'chaotic', label: '混乱' },
  { value: 'lonely', label: '孤独' },
];

export function MemoryEditorPanel({
  memory,
  people,
  places,
  onClose,
  onSaved,
  onPeopleChanged,
  onPlacesChanged,
}: MemoryEditorPanelProps): ReactNode {
  const [title, setTitle] = useState(memory.title);
  const [capturedAt, setCapturedAt] = useState(memory.capturedAt?.slice(0, 16) ?? '');
  const [placeId, setPlaceId] = useState(memory.placeId ?? '');
  const [personIds, setPersonIds] = useState(memory.personIds);
  const [mood, setMood] = useState<Mood>(memory.mood);
  const [tags, setTags] = useState(memory.tags.join('，'));
  const [description, setDescription] = useState(memory.description);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPlaceName, setNewPlaceName] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const createdPersonIds = useRef(new Set<string>());
  const createdPlaceIds = useRef(new Set<string>());
  const dirty =
    title !== memory.title ||
    capturedAt !== (memory.capturedAt?.slice(0, 16) ?? '') ||
    placeId !== (memory.placeId ?? '') ||
    personIds.join('|') !== memory.personIds.join('|') ||
    mood !== memory.mood ||
    tags !== memory.tags.join('，') ||
    description !== memory.description;

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (dirty) setConfirmClose(true);
      else onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [dirty, onClose]);

  const requestClose = (): void => {
    if (dirty) setConfirmClose(true);
    else onClose();
  };

  const submit = (event: SyntheticEvent<HTMLFormElement, SubmitEvent>): void => {
    event.preventDefault();
    if (!title.trim()) {
      setStatus('标题不能为空。');
      return;
    }
    const capturedAtMs = capturedAt ? new Date(capturedAt).getTime() : null;
    if (capturedAt && !Number.isFinite(capturedAtMs)) {
      setStatus('拍摄时间格式不正确。');
      return;
    }
    const updated: Memory = {
      ...memory,
      title: title.trim(),
      capturedAt: capturedAt ? `${capturedAt}:00` : null,
      capturedAtMs,
      dateSource: capturedAt ? 'manual' : 'unknown',
      placeId: placeId || null,
      personIds: [...personIds].sort(),
      mood,
      tags: normalizeTags(tags.split(/[，,]/u)),
      description: description.trim(),
      updatedAt: new Date().toISOString(),
    };
    setSaving(true);
    setStatus('正在保存…');
    void updateMemory(updated)
      .then(() => {
        createdPersonIds.current.clear();
        createdPlaceIds.current.clear();
        onSaved(updated);
        setStatus('已保存，关系空间将在下次进入时重新计算。');
      })
      .catch(() => setStatus('保存失败，请重试。'))
      .finally(() => setSaving(false));
  };

  const addPerson = (): void => {
    const name = newPersonName.trim();
    if (!name) return;
    const now = new Date().toISOString();
    const person: Person = {
      id: `personal-person-${crypto.randomUUID()}`,
      source: 'personal',
      name,
      createdAt: now,
      updatedAt: now,
    };
    void savePerson(person)
      .then(() => {
        createdPersonIds.current.add(person.id);
        onPeopleChanged([...people, person]);
        setPersonIds((ids) => [...ids, person.id]);
        setNewPersonName('');
      })
      .catch(() => setStatus('人物没有创建成功。'));
  };

  const addPlace = (): void => {
    const name = newPlaceName.trim();
    if (!name) return;
    const now = new Date().toISOString();
    const place: Place = {
      id: `personal-place-${crypto.randomUUID()}`,
      source: 'personal',
      name,
      createdAt: now,
      updatedAt: now,
    };
    void savePlace(place)
      .then(() => {
        createdPlaceIds.current.add(place.id);
        onPlacesChanged([...places, place]);
        setPlaceId(place.id);
        setNewPlaceName('');
      })
      .catch(() => setStatus('地点没有创建成功。'));
  };

  const discardChanges = (): void => {
    const personIdsToDelete = [...createdPersonIds.current];
    const placeIdsToDelete = [...createdPlaceIds.current];
    void Promise.all([
      ...personIdsToDelete.map((id) => deletePerson(id)),
      ...placeIdsToDelete.map((id) => deletePlace(id)),
    ]).finally(() => {
      onPeopleChanged(people.filter((person) => !createdPersonIds.current.has(person.id)));
      onPlacesChanged(places.filter((place) => !createdPlaceIds.current.has(place.id)));
      createdPersonIds.current.clear();
      createdPlaceIds.current.clear();
      onClose();
    });
  };

  return (
    <div
      className="editor-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <aside
        className="memory-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="memory-editor-title"
      >
        <header>
          <div>
            <p className="eyebrow">EDIT MEMORY</p>
            <h2 id="memory-editor-title">整理这段记忆</h2>
          </div>
          <button type="button" className="text-button" onClick={requestClose}>
            关闭
          </button>
        </header>
        <form onSubmit={submit}>
          <label>
            <span>标题</span>
            <input
              value={title}
              maxLength={80}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label>
            <span>拍摄时间</span>
            <input
              type="datetime-local"
              value={capturedAt}
              onChange={(event) => setCapturedAt(event.target.value)}
            />
          </label>
          <label>
            <span>地点</span>
            <select
              className="glass-select"
              value={placeId}
              onChange={(event) => setPlaceId(event.target.value)}
            >
              <option value="">地点未标记</option>
              {places.map((place) => (
                <option key={place.id} value={place.id}>
                  {place.name}
                </option>
              ))}
            </select>
          </label>
          <div className="editor-create-row">
            <input
              aria-label="新地点名称"
              value={newPlaceName}
              placeholder="创建新地点"
              onChange={(event) => setNewPlaceName(event.target.value)}
            />
            <button type="button" onClick={addPlace} disabled={!newPlaceName.trim()}>
              创建
            </button>
          </div>
          <fieldset>
            <legend>人物</legend>
            <div className="editor-checks">
              {people.map((person) => (
                <label key={person.id}>
                  <input
                    type="checkbox"
                    checked={personIds.includes(person.id)}
                    onChange={() =>
                      setPersonIds((ids) =>
                        ids.includes(person.id)
                          ? ids.filter((id) => id !== person.id)
                          : [...ids, person.id],
                      )
                    }
                  />
                  <span>{person.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="editor-create-row">
            <input
              aria-label="新人物名称"
              value={newPersonName}
              placeholder="创建新人物"
              onChange={(event) => setNewPersonName(event.target.value)}
            />
            <button type="button" onClick={addPerson} disabled={!newPersonName.trim()}>
              创建
            </button>
          </div>
          <label>
            <span>情绪</span>
            <select
              className="glass-select"
              value={mood ?? ''}
              onChange={(event) => setMood((event.target.value || null) as Mood)}
            >
              <option value="">情绪未标记</option>
              {MOODS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>标签（用逗号分隔）</span>
            <input value={tags} onChange={(event) => setTags(event.target.value)} />
          </label>
          <label>
            <span>描述</span>
            <textarea
              rows={5}
              maxLength={500}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          {status && (
            <p className="editor-status" role="status">
              {status}
            </p>
          )}
          <button type="submit" className="primary-action" disabled={!dirty || saving}>
            {saving ? '正在保存…' : '保存修改'}
          </button>
        </form>
        {confirmClose && (
          <div className="editor-close-confirm" role="alertdialog" aria-label="放弃未保存修改">
            <p>这次修改还没有保存。</p>
            <button type="button" onClick={() => setConfirmClose(false)}>
              继续编辑
            </button>
            <button type="button" className="danger-action" onClick={discardChanges}>
              放弃修改
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
