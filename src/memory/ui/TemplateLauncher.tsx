import { useMemo, type ReactNode } from 'react';

import { memoryTemplates } from '../config';
import { useMemoryTemplateStore } from '../../stores/memoryTemplateStore';
import { useSceneStore } from '../../stores/sceneStore';

export function TemplateLauncher(): ReactNode {
  const dataset = useSceneStore((state) => state.dataset);
  const source = useSceneStore((state) => state.source);
  const dataStatus = useSceneStore((state) => state.dataStatus);
  const session = useMemoryTemplateStore((state) => state.session);
  const prepare = useMemoryTemplateStore((state) => state.prepare);
  const selectedIds = useMemo(
    () => (dataset?.memories ?? []).toSorted((left, right) => left.id.localeCompare(right.id)).map((memory) => memory.id),
    [dataset?.memories],
  );

  if (dataStatus !== 'ready' || !dataset || selectedIds.length === 0 || session) return null;
  const templates = memoryTemplates.filter((template) => template.available);

  return (
    <section className="memory-template-launcher" aria-labelledby="memory-template-title" data-testid="template-launcher">
      <div className="memory-template-launcher__heading">
        <div>
          <p className="eyebrow">记忆模板</p>
          <h2 id="memory-template-title">把照片交给一段有节奏的叙事。</h2>
        </div>
        <span>{selectedIds.length} 张照片可用</span>
      </div>
      <div className="memory-template-launcher__grid">
        {templates.map((template) => (
          <article className="memory-template-card" key={template.id}>
            <div>
              <p>{template.category}</p>
              <h3>{template.title}</h3>
              <span>{template.description}</span>
            </div>
            <button
              type="button"
              className="memory-template-card__action"
              aria-label={`预览 ${template.title}`}
              onClick={() => {
                prepare({
                  templateId: template.id,
                  source,
                  memoryIds: selectedIds,
                });
              }}
            >
              预览
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
