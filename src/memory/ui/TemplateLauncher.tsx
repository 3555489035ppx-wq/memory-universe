import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';

import { GlassButton } from '../../components/ui/glass-button';
import { useMemoryTemplateStore } from '../../stores/memoryTemplateStore';
import { useSceneStore } from '../../stores/sceneStore';
import { memoryTemplates } from '../config';
import { selectTemplateMemoryIds } from '../engine/selectTemplateMemoryIds';
import {
  includeOpeningHeroInSelection,
  resolvePersonalOpeningHeroId,
} from '../engine/personalOpeningHero';
import type { MemoryTemplateConfig, MemoryTemplateId } from '../types';

type DirectoryTemplate = Pick<
  MemoryTemplateConfig,
  'id' | 'title' | 'category' | 'description' | 'available' | 'minPhotos' | 'maxPhotos'
> | {
  id: 'custom';
  title: string;
  category: string;
  description: string;
  available: false;
  minPhotos: number;
  maxPhotos: number;
};

const templateDirectory: readonly DirectoryTemplate[] = [
  ...memoryTemplates,
  {
    id: 'custom',
    title: '自定义',
    category: '个人创作',
    description: '自定义节奏、音乐与叙事结构，正在准备中。',
    available: false,
    minPhotos: 24,
    maxPhotos: 96,
  },
];

const unavailableMessage = '该主题正在开发中，未来将支持更多AI记忆场景。';

export function TemplateLauncher(): ReactNode {
  const [open, setOpen] = useState(false);
  const [unavailableNotice, setUnavailableNotice] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const autoStartedDemo = useRef(false);
  const dataset = useSceneStore((state) => state.dataset);
  const source = useSceneStore((state) => state.source);
  const dataStatus = useSceneStore((state) => state.dataStatus);
  const session = useMemoryTemplateStore((state) => state.session);
  const prepare = useMemoryTemplateStore((state) => state.prepare);
  const availableTemplates = useMemo(
    () => memoryTemplates.filter((template) => template.available),
    [],
  );
  const maxPhotos = Math.max(...memoryTemplates.map((template) => template.maxPhotos));
  const heroPhotoId = useMemo(
    () => source === 'personal'
      ? resolvePersonalOpeningHeroId(dataset?.memories ?? [])
      : null,
    [dataset?.memories, source],
  );
  const selectedIds = useMemo(() => includeOpeningHeroInSelection(
    selectTemplateMemoryIds(dataset?.memories ?? [], maxPhotos),
    heroPhotoId,
    maxPhotos,
  ), [dataset?.memories, heroPhotoId, maxPhotos]);
  const canOpen = dataStatus === 'ready' && Boolean(dataset) && selectedIds.length > 0;
  const panelOpen = open && canOpen && !session;

  useEffect(() => {
    if (!panelOpen) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [panelOpen]);

  useEffect(() => {
    if (
      autoStartedDemo.current
      || searchParams.get('demo') !== 'high-school'
      || !canOpen
      || session
    ) return;
    const highSchool = availableTemplates.find((template) => template.id === 'high-school');
    if (!highSchool) return;
    autoStartedDemo.current = true;
    prepare({ templateId: highSchool.id, source, memoryIds: selectedIds, heroPhotoId });
    queueMicrotask(() => useMemoryTemplateStore.getState().start());
  }, [availableTemplates, canOpen, heroPhotoId, prepare, searchParams, selectedIds, session, source]);

  const chooseTemplate = (templateId: MemoryTemplateId, startImmediately: boolean): void => {
    setUnavailableNotice(null);
    setOpen(false);
    prepare({ templateId, source, memoryIds: selectedIds, heroPhotoId });
    if (startImmediately) queueMicrotask(() => useMemoryTemplateStore.getState().start());
  };

  const showUnavailable = (template: DirectoryTemplate): void => {
    setUnavailableNotice(`${template.title}：${unavailableMessage}`);
  };

  return (
    <div className="memory-template-library" data-open={panelOpen || undefined} data-testid="template-launcher">
      <button
        className="memory-template-trigger edge-action"
        type="button"
        aria-expanded={panelOpen}
        aria-controls="memory-template-panel"
        disabled={!canOpen || Boolean(session)}
        onClick={() => {
          setUnavailableNotice(null);
          setOpen((value) => !value);
        }}
      >
        记忆模板
      </button>

      {panelOpen && (
        <section id="memory-template-panel" className="memory-template-launcher" aria-labelledby="memory-template-title" data-testid="template-launcher-panel">
          <div className="memory-template-launcher__heading">
            <div>
              <span className="memory-template-launcher__eyebrow">MEMORY TEMPLATE / LOCAL FIRST</span>
              <h2 id="memory-template-title">先从一段完整的高中回忆开始。</h2>
              <p>演示模板会直接进入生成；其他主题保留入口，但不会打开空白或未完成页面。</p>
            </div>
            <div className="memory-template-launcher__heading-actions">
              <span>{selectedIds.length} 张照片可用</span>
              <button className="memory-template-launcher__close" type="button" aria-label="关闭记忆模板" onClick={() => setOpen(false)}>×</button>
            </div>
          </div>

          {unavailableNotice && (
            <div className="memory-template-launcher__notice" role="alert" aria-live="polite">
              <p>{unavailableNotice}</p>
              <button className="text-button" type="button" onClick={() => setUnavailableNotice(null)}>
                返回模板选择
              </button>
            </div>
          )}

          <div className="memory-template-launcher__grid">
            {templateDirectory.map((template) => {
              const photoCount = Math.min(selectedIds.length, template.maxPhotos);
              const missingPhotoCount = Math.max(0, template.minPhotos - photoCount);
              const enoughPhotos = missingPhotoCount === 0;
              const isAvailable = template.id !== 'custom' && template.available;
              return (
                <article
                  className={'memory-template-card ' + (isAvailable ? '' : 'memory-template-card--coming-soon')}
                  data-status={isAvailable ? 'available' : 'coming-soon'}
                  data-testid="template-card"
                  key={template.id}
                >
                  <div className="memory-template-card__body">
                    <div className="memory-template-card__title-row">
                      <h3>{template.title}</h3>
                      <span className="memory-template-card__status">
                        {isAvailable ? '可体验' : '即将开放'}
                      </span>
                    </div>
                    <p className="memory-template-card__description">{template.description}</p>
                    <div className="memory-template-card__meta">
                      <span>{template.category}</span>
                      <span>{isAvailable ? (enoughPhotos ? `${String(photoCount)} 张将参与` : `还需 ${String(missingPhotoCount)} 张`) : '正在完善体验'}</span>
                    </div>
                    <p className="memory-template-card__requirement">
                      {isAvailable ? `至少 ${String(template.minPhotos)} 张 · 最多 ${String(template.maxPhotos)} 张按章节轮换` : unavailableMessage}
                    </p>
                  </div>
                  <div className="memory-template-card__actions">
                    {isAvailable ? (
                      <>
                        <GlassButton
                          type="button"
                          className="memory-template-card__action-wrap"
                          buttonClassName="memory-template-card__action"
                          size="sm"
                          strength="subtle"
                          disabled={!enoughPhotos}
                          aria-label={`预览 ${template.title}`}
                          onClick={() => chooseTemplate(template.id, false)}
                        >
                          预览
                        </GlassButton>
                        <GlassButton
                          type="button"
                          className="memory-template-card__action-wrap"
                          buttonClassName="memory-template-card__action memory-template-card__action--primary"
                          size="sm"
                          strength="medium"
                          disabled={!enoughPhotos}
                          aria-label={`使用 ${template.title}`}
                          onClick={() => chooseTemplate(template.id, true)}
                        >
                          使用模板
                        </GlassButton>
                      </>
                    ) : (
                      <button className="secondary-action memory-template-card__status-action" type="button" onClick={() => showUnavailable(template)}>
                        查看开发状态
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
