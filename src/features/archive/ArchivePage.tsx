import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { loadDemoDataset } from '../../data/demoRepository';
import { listConstellations } from '../../data/repositories/constellationRepository';
import { deleteMemory, listMemories } from '../../data/repositories/memoryRepository';
import { listPeople } from '../../data/repositories/peopleRepository';
import { listPlaces } from '../../data/repositories/placesRepository';
import type { Constellation } from '../../domain/constellation';
import {
  isPersonalOpeningHero,
  withPersonalOpeningHeroTag,
  type Memory,
  type MemorySource,
} from '../../domain/memory';
import type { Person } from '../../domain/person';
import type { Place } from '../../domain/place';
import { localTextureManager } from '../../scene/textures/LocalTextureManager';
import { useUiStore } from '../../stores/uiStore';
import { formatMemoryDate } from '../universe/formatMemory';
import { MemoryEditorPanel } from './MemoryEditorPanel';
import { useAssetImageUrl } from './useAssetImageUrl';

interface ArchiveDataset {
  memories: Memory[];
  people: Person[];
  places: Place[];
  constellations: Constellation[];
}

type ArchiveFilter = 'all' | 'people' | 'place' | 'emotion' | 'constellation';
type ArchiveSort = 'captured' | 'imported' | 'edited';

const ARCHIVE_SORT_LABELS: Record<ArchiveSort, string> = {
  captured: '拍摄时间',
  imported: '导入时间',
  edited: '最近编辑',
};

function ArchiveSortMenu({
  value,
  onChange,
}: {
  value: ArchiveSort;
  onChange: (value: ArchiveSort) => void;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsidePointer = (event: PointerEvent): void => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [open]);

  return (
    <div className="archive-sort" ref={menuRef}>
      <span>排序</span>
      <div className="archive-sort__control">
        <button
          type="button"
          className="archive-sort__button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
          }}
        >
          {ARCHIVE_SORT_LABELS[value]}
          <span aria-hidden="true">⌄</span>
        </button>
        {open && (
          <div className="archive-sort__menu" role="listbox" aria-label="排序方式">
            {(Object.keys(ARCHIVE_SORT_LABELS) as ArchiveSort[]).map((option) => (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={value === option}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
              >
                {ARCHIVE_SORT_LABELS[option]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

async function loadArchive(source: MemorySource): Promise<ArchiveDataset> {
  if (source === 'demo') {
    const [demo, stored] = await Promise.all([loadDemoDataset(), listConstellations('demo')]);
    const constellations = new Map(
      [...demo.constellations, ...stored].map((constellation) => [constellation.id, constellation]),
    );
    return { ...demo, constellations: [...constellations.values()] };
  }
  const [memories, people, places, constellations] = await Promise.all([
    listMemories('personal'),
    listPeople('personal'),
    listPlaces('personal'),
    listConstellations('personal'),
  ]);
  return { memories, people, places, constellations };
}

function ArchiveMemoryCard({
  memory,
  editable,
  onEdit,
  onDelete,
}: {
  memory: Memory;
  editable: boolean;
  onEdit: () => void;
  onDelete: () => void;
}): ReactNode {
  const imageUrl = useAssetImageUrl(memory.assetKeys.thumbnail);
  const color = `rgb(${memory.dominantColor.rgb.join(' ')})`;
  return (
    <article className="archive-memory" style={{ '--memory-color': color } as React.CSSProperties}>
      <Link
        to={`/memory/${encodeURIComponent(memory.id)}`}
        className="archive-memory__image"
        aria-label={`进入${memory.title}`}
        style={{ aspectRatio: `${String(memory.width)} / ${String(memory.height)}` }}
      >
        {imageUrl && <img src={imageUrl} alt="" loading="lazy" decoding="async" />}
      </Link>
      <div className="archive-memory__meta">
        <div>
          <time>{formatMemoryDate(memory)}</time>
          <h2>{memory.title}</h2>
        </div>
        {editable && (
          <div className="archive-memory__actions">
            <button type="button" onClick={onEdit}>
              编辑
            </button>
            <button type="button" onClick={onDelete}>
              删除
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

export function ArchivePage(): ReactNode {
  const [searchParams, setSearchParams] = useSearchParams();
  const source: MemorySource = searchParams.get('source') === 'demo' ? 'demo' : 'personal';
  const revision = useUiStore((state) => state.dataRevision);
  const markDataChanged = useUiStore((state) => state.markDataChanged);
  const openImport = useUiStore((state) => state.openImport);
  const [loaded, setLoaded] = useState<{
    source: MemorySource;
    data: ArchiveDataset | null;
    error: boolean;
  }>({ source, data: null, error: false });
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ArchiveFilter>('all');
  const [sort, setSort] = useState<ArchiveSort>('captured');
  const [editing, setEditing] = useState<Memory | null>(null);
  const [deleting, setDeleting] = useState<Memory | null>(null);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    let active = true;
    void loadArchive(source)
      .then((data) => {
        if (active) setLoaded({ source, data, error: false });
      })
      .catch(() => {
        if (active) setLoaded({ source, data: null, error: true });
      });
    return () => {
      active = false;
    };
  }, [revision, source]);

  const data = loaded.source === source ? loaded.data : null;
  const peopleById = useMemo(
    () => new Map((data?.people ?? []).map((person) => [person.id, person.name])),
    [data?.people],
  );
  const placesById = useMemo(
    () => new Map((data?.places ?? []).map((place) => [place.id, place.name])),
    [data?.places],
  );
  const results = useMemo(() => {
    if (!data) return [];
    const needle = source === 'demo' ? '' : query.trim().toLocaleLowerCase('zh-CN');
    return data.memories
      .filter((memory) => {
        if (filter === 'people' && memory.personIds.length === 0) return false;
        if (filter === 'place' && !memory.placeId) return false;
        if (filter === 'emotion' && !memory.mood) return false;
        if (
          filter === 'constellation' &&
          !data.constellations.some((item) => item.memoryIds.includes(memory.id))
        )
          return false;
        if (!needle) return true;
        const haystack = [
          memory.title,
          memory.description,
          ...memory.tags,
          ...memory.personIds.map((id) => peopleById.get(id) ?? ''),
          memory.placeId ? (placesById.get(memory.placeId) ?? '') : '',
        ]
          .join(' ')
          .toLocaleLowerCase('zh-CN');
        return haystack.includes(needle);
      })
      .toSorted((left, right) => {
        if (sort === 'imported') return right.createdAt.localeCompare(left.createdAt);
        if (sort === 'edited') return right.updatedAt.localeCompare(left.updatedAt);
        return (
          (right.capturedAtMs ?? Number.NEGATIVE_INFINITY) -
          (left.capturedAtMs ?? Number.NEGATIVE_INFINITY)
        );
      });
  }, [data, filter, peopleById, placesById, query, sort, source]);

  const updateData = (update: (data: ArchiveDataset) => ArchiveDataset): void => {
    setLoaded((state) => (state.data ? { ...state, data: update(state.data) } : state));
  };

  const performDelete = (): void => {
    if (!deleting) return;
    setDeleteError('');
    void deleteMemory(deleting.id)
      .then(() => {
        updateData((current) => ({
          ...current,
          memories: current.memories.filter((memory) => memory.id !== deleting.id),
        }));
        localTextureManager.clear();
        markDataChanged();
        setDeleting(null);
      })
      .catch(() => setDeleteError('这段记忆没有删除成功，本地数据保持不变，请重试。'));
  };

  return (
    <main className="archive-page">
      <header className="archive-header">
        <div>
          <p className="eyebrow">LOCAL MEMORY ARCHIVE</p>
          <h1>记忆档案</h1>
        </div>
        <div className="archive-source-switch" aria-label="档案数据源">
          <button
            type="button"
            aria-pressed={source === 'personal'}
            onClick={() => setSearchParams({ source: 'personal' })}
          >
            我的记忆
          </button>
          <button
            type="button"
            aria-pressed={source === 'demo'}
            onClick={() => setSearchParams({ source: 'demo' })}
          >
            演示档案
          </button>
        </div>
      </header>

      <section
        className={`archive-toolbar ${source === 'demo' ? 'archive-toolbar--demo' : ''}`}
        aria-label="搜索、筛选和排序"
      >
        {source === 'personal' && (
          <label className="archive-search">
            <span className="sr-only">搜索记忆</span>
            <input
              type="search"
              value={query}
              placeholder="搜索标题、描述、标签、人物或地点"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        )}
        <div className="archive-filters">
          {(
            [
              ['all', '全部'],
              ['people', '人物'],
              ['place', '地点'],
              ['emotion', '情绪'],
              ['constellation', '星座'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <ArchiveSortMenu value={sort} onChange={setSort} />
        {source === 'personal' && (
          <button type="button" className="primary-action" onClick={openImport}>
            导入照片
          </button>
        )}
      </section>

      {loaded.error && (
        <p className="archive-message" role="alert">
          档案没有加载成功，请刷新后重试。
        </p>
      )}
      {!data && !loaded.error && (
        <p className="archive-message" role="status">
          正在读取当前浏览器中的记忆…
        </p>
      )}
      {data && results.length > 0 && (
        <>
          <p className="archive-count">
            {results.length} / {data.memories.length} 段记忆
          </p>
          <section className="archive-grid" aria-label="记忆照片">
            {results.map((memory) => (
              <ArchiveMemoryCard
                key={memory.id}
                memory={memory}
                editable={source === 'personal'}
                onEdit={() => setEditing(memory)}
                onDelete={() => {
                  setDeleteError('');
                  setDeleting(memory);
                }}
              />
            ))}
          </section>
        </>
      )}
      {data && results.length === 0 && (
        <section className="archive-empty">
          <h2>{data.memories.length === 0 ? '这里还没有记忆' : '没有符合当前条件的记忆'}</h2>
          <p>
            {data.memories.length === 0
              ? '导入照片后，它们会在当前浏览器中形成可搜索的记忆档案。'
              : '尝试清除搜索词或切换筛选条件。'}
          </p>
          {data.memories.length === 0 && source === 'personal' && (
            <button type="button" className="primary-action" onClick={openImport}>
              导入第一批照片
            </button>
          )}
          <Link className="secondary-action" to="/universe?source=demo">
            探索演示宇宙
          </Link>
        </section>
      )}

      {editing && data && (
        <MemoryEditorPanel
          key={editing.id}
          memory={editing}
          people={data.people}
          places={data.places}
          onClose={() => setEditing(null)}
          onSaved={(memory) => {
            updateData((current) => ({
              ...current,
              memories: current.memories.map((item) => {
                if (item.id === memory.id) return memory;
                return isPersonalOpeningHero(memory) && isPersonalOpeningHero(item)
                  ? withPersonalOpeningHeroTag(item, false)
                  : item;
              }),
            }));
            setEditing(memory);
            markDataChanged();
          }}
          onPeopleChanged={(people) => updateData((current) => ({ ...current, people }))}
          onPlacesChanged={(places) => updateData((current) => ({ ...current, places }))}
        />
      )}
      {deleting && (
        <div className="delete-backdrop">
          <section
            className="delete-confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-memory-title"
          >
            <p className="eyebrow">DELETE MEMORY</p>
            <h2 id="delete-memory-title">删除“{deleting.title}”？</h2>
            <p>
              这会删除应用内的记忆与本地衍生图片，无法从 Memuniverse
              恢复。不会删除设备相册中的原始文件。
            </p>
            {deleteError && (
              <p className="inline-error" role="alert">
                {deleteError}
              </p>
            )}
            <div>
              <button
                type="button"
                className="secondary-action"
                onClick={() => {
                  setDeleting(null);
                  setDeleteError('');
                }}
              >
                取消
              </button>
              <button type="button" className="danger-action" onClick={performDelete}>
                确认删除
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
