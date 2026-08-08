import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { clearPersonalData } from '../../data/repositories/personalDataRepository';
import { saveSettings } from '../../data/repositories/settingsRepository';
import type { QualitySetting, Settings } from '../../domain/settings';
import { exportPersonalBackup, type BackupProgress } from '../../engine/backup/exportBackup';
import {
  commitRestore,
  inspectBackup,
  type RestorePlan,
  type RestoreSummary,
} from '../../engine/backup/restoreBackup';
import { localTextureManager } from '../../scene/textures/LocalTextureManager';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUiStore } from '../../stores/uiStore';

function backupErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  if (code.includes('TOO_LARGE') || code.includes('TOO_MANY'))
    return '备份超过安全处理限制，未写入任何数据。';
  if (code.includes('PATH') || code.includes('EXECUTABLE') || code.includes('NESTED'))
    return '备份包含不安全或未知路径，已拒绝恢复。';
  if (code.includes('CHECKSUM')) return '备份文件校验失败，内容可能已损坏或被修改。';
  if (code.includes('UNSUPPORTED')) return '这个备份版本与当前 Memuniverse 不兼容。';
  if (
    code.includes('JSON') ||
    code.includes('METADATA') ||
    code.includes('INVALID') ||
    code.includes('MISSING')
  ) {
    return '备份中的数据结构或引用无法通过安全检查。';
  }
  if (error instanceof DOMException && error.name === 'AbortError')
    return '操作已取消，没有生成备份文件。';
  return '操作没有完成，请检查文件后重试。';
}

function progressLabel(progress: BackupProgress | null): string {
  if (!progress) return '';
  const stage =
    progress.stage === 'collecting' ? '读取' : progress.stage === 'hashing' ? '校验' : '打包';
  return `${stage} · ${String(progress.completed)} / ${String(progress.total)} · ${progress.label}`;
}

function getStorageApi(): StorageManager | undefined {
  const storageValue: unknown = Reflect.get(navigator, 'storage');
  if (!storageValue || typeof storageValue !== 'object') return undefined;
  return storageValue as StorageManager;
}

export function SettingsPage(): ReactNode {
  const navigate = useNavigate();
  const settings = useSettingsStore((state) => state.settings);
  const setSettings = useSettingsStore((state) => state.setSettings);
  const markDataChanged = useUiStore((state) => state.markDataChanged);
  const pushToast = useUiStore((state) => state.pushToast);
  const exportAbort = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const [operationStatus, setOperationStatus] = useState('');
  const [exporting, setExporting] = useState(false);
  const [restorePlan, setRestorePlan] = useState<RestorePlan | null>(null);
  const [restoreFileName, setRestoreFileName] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreSummary, setRestoreSummary] = useState<RestoreSummary | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearPhrase, setClearPhrase] = useState('');
  const [storageInfo, setStorageInfo] = useState(() =>
    getStorageApi()?.estimate ? '正在读取浏览器存储信息…' : '当前浏览器不提供存储配额信息。',
  );
  const [persistenceInfo, setPersistenceInfo] = useState('');

  useEffect(() => {
    let active = true;
    const storage = getStorageApi();
    if (!storage?.estimate) {
      return () => {
        active = false;
        exportAbort.current?.abort();
      };
    }
    void storage
      .estimate()
      .then((estimate) => {
        if (!active) return;
        const used = (estimate.usage ?? 0) / 1024 / 1024;
        const quota = (estimate.quota ?? 0) / 1024 / 1024;
        setStorageInfo(`已使用 ${used.toFixed(1)} MB · 浏览器可用配额约 ${quota.toFixed(0)} MB`);
      })
      .catch(() => {
        if (active) setStorageInfo('当前浏览器不提供存储配额信息。');
      });
    return () => {
      active = false;
      exportAbort.current?.abort();
    };
  }, []);

  const updateSettings = (patch: Partial<Settings>): void => {
    const next = { ...settings, ...patch };
    setSettings(next);
    setOperationStatus('正在保存设置…');
    void saveSettings(next)
      .then(() => setOperationStatus('设置已保存。'))
      .catch(() => setOperationStatus('设置未能保存，请重试。'));
  };

  const exportBackup = (): void => {
    const controller = new AbortController();
    exportAbort.current = controller;
    setExporting(true);
    setProgress(null);
    setOperationStatus('正在准备 personal 数据备份…');
    void exportPersonalBackup({
      includeOriginals: settings.includeOriginalsInBackup,
      signal: controller.signal,
      onProgress: setProgress,
    })
      .then(({ blob, manifest }) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'memento-backup.zip';
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
        setOperationStatus(
          `备份已生成：${String(manifest.sourceCounts.memories)} 段记忆，${String(manifest.files.length)} 个已校验文件。`,
        );
      })
      .catch((error: unknown) => setOperationStatus(backupErrorMessage(error)))
      .finally(() => {
        exportAbort.current = null;
        setExporting(false);
      });
  };

  const inspectRestoreFile = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setRestorePlan(null);
    setRestoreSummary(null);
    setRestoreFileName(file.name);
    setOperationStatus('正在安全检查备份…');
    setProgress(null);
    void inspectBackup(file, setProgress)
      .then((plan) => {
        setRestorePlan(plan);
        setOperationStatus('检查通过。确认后将以“合并且不静默覆盖”的策略恢复。');
      })
      .catch((error: unknown) => setOperationStatus(backupErrorMessage(error)));
  };

  const restore = (): void => {
    if (!restorePlan) return;
    setRestoring(true);
    setOperationStatus('正在事务中恢复；完成前不会留下半成品。');
    void commitRestore(restorePlan)
      .then((summary) => {
        setRestoreSummary(summary);
        setSettings(restorePlan.settings);
        localTextureManager.clear();
        markDataChanged();
        setOperationStatus('恢复完成，刷新后数据仍会保留。');
        pushToast('本地备份恢复完成。', 'success');
      })
      .catch((error: unknown) => setOperationStatus(backupErrorMessage(error)))
      .finally(() => setRestoring(false));
  };

  const requestPersistence = (): void => {
    const storage = getStorageApi();
    if (!storage?.persist) {
      setPersistenceInfo('当前浏览器不支持持久存储请求；请定期导出备份。');
      return;
    }
    setPersistenceInfo('正在请求…');
    void storage
      .persist()
      .then((granted) =>
        setPersistenceInfo(
          granted ? '浏览器已允许持久存储。' : '浏览器未授予；不影响继续使用，请定期备份。',
        ),
      )
      .catch(() => setPersistenceInfo('请求没有完成；不影响继续使用。'));
  };

  const clearData = (): void => {
    if (clearPhrase !== '清除记忆') return;
    setOperationStatus('正在清除 personal 数据…');
    void clearPersonalData()
      .then(() => {
        localTextureManager.clear();
        markDataChanged();
        setClearOpen(false);
        setClearPhrase('');
        pushToast('个人记忆已从当前浏览器清除。', 'success');
        void navigate('/universe?source=personal');
      })
      .catch(() => setOperationStatus('清除没有完成，请重试。'));
  };

  return (
    <main className="settings-page">
      <header className="settings-header">
        <p className="eyebrow">LOCAL SYSTEM</p>
        <h1>设置与本地数据</h1>
        <p>
          Memuniverse 的计算与照片存储默认发生在当前浏览器。这里的选择不会更改设备相册中的原始文件。
        </p>
      </header>

      <div className="settings-layout">
        <section className="settings-section" aria-labelledby="quality-title">
          <div>
            <p className="settings-index">01</p>
            <h2 id="quality-title">显示与动态</h2>
          </div>
          <fieldset>
            <legend>显示质量</legend>
            {(
              [
                ['auto', '自动'],
                ['high', '高'],
                ['medium', '中'],
                ['low', '低'],
              ] as const
            ).map(([value, label]) => (
              <label key={value}>
                <input
                  type="radio"
                  name="quality"
                  value={value}
                  checked={settings.quality === value}
                  onChange={() => updateSettings({ quality: value as QualitySetting })}
                />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>动态</legend>
            <label>
              <input
                type="radio"
                name="motion"
                checked={settings.motion === 'full'}
                onChange={() => updateSettings({ motion: 'full' })}
              />
              <span>完整动态</span>
            </label>
            <label>
              <input
                type="radio"
                name="motion"
                checked={settings.motion === 'reduced'}
                onChange={() => updateSettings({ motion: 'reduced' })}
              />
              <span>减少动态</span>
            </label>
          </fieldset>
        </section>

        <section className="settings-section" aria-labelledby="backup-title">
          <div>
            <p className="settings-index">02</p>
            <h2 id="backup-title">导出与恢复</h2>
          </div>
          <div className="settings-copy">
            <p>备份只包含 personal 数据，不重复打包内置 Demo。每个文件都会写入 SHA-256 校验值。</p>
            <label className="settings-check">
              <input
                type="checkbox"
                checked={settings.includeOriginalsInBackup}
                onChange={(event) =>
                  updateSettings({ includeOriginalsInBackup: event.target.checked })
                }
              />
              <span>备份中包含导入时保留的原图（文件会明显增大）</span>
            </label>
            <div className="settings-actions">
              <button
                type="button"
                className="primary-action"
                onClick={exportBackup}
                disabled={exporting}
              >
                {exporting ? '正在导出…' : '导出记忆备份'}
              </button>
              {exporting && (
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => exportAbort.current?.abort()}
                >
                  取消导出
                </button>
              )}
            </div>
            <label className="restore-input secondary-action">
              选择备份文件
              <input
                className="sr-only"
                type="file"
                accept=".zip,application/zip"
                onChange={inspectRestoreFile}
              />
            </label>
            {restorePlan && (
              <div className="restore-preview">
                <strong>{restoreFileName}</strong>
                <p>
                  {restorePlan.manifest.sourceCounts.memories} 段记忆 ·{' '}
                  {restorePlan.manifest.assetCounts.previews} 张预览 ·{' '}
                  {restorePlan.manifest.sourceCounts.constellations} 个星座
                </p>
                <p>同 checksum 的记忆会跳过；同 id 但内容不同会生成新 id，不覆盖现有内容。</p>
                <button
                  type="button"
                  className="primary-action"
                  onClick={restore}
                  disabled={restoring}
                >
                  {restoring ? '正在恢复…' : '确认合并恢复'}
                </button>
              </div>
            )}
            {restoreSummary && (
              <p className="restore-summary">
                已恢复 {restoreSummary.importedMemories} 段，跳过 {restoreSummary.skippedDuplicates}{' '}
                个重复项。
              </p>
            )}
          </div>
        </section>

        <section className="settings-section" aria-labelledby="storage-title">
          <div>
            <p className="settings-index">03</p>
            <h2 id="storage-title">浏览器存储</h2>
          </div>
          <div className="settings-copy">
            <p>{storageInfo}</p>
            <button type="button" className="secondary-action" onClick={requestPersistence}>
              提高本地保留稳定性
            </button>
            {persistenceInfo && <p aria-live="polite">{persistenceInfo}</p>}
            <button type="button" className="danger-outline" onClick={() => setClearOpen(true)}>
              清除个人数据
            </button>
          </div>
        </section>

        <section className="settings-section" aria-labelledby="privacy-title">
          <div>
            <p className="settings-index">04</p>
            <h2 id="privacy-title">隐私边界</h2>
          </div>
          <div className="settings-copy settings-privacy-copy">
            <p>
              Memuniverse
              默认在浏览器中处理和保存你的照片。除非你主动导出文件，否则照片不会由本产品上传到服务器。
            </p>
            <p>
              浏览器数据可能因你清除站点数据、隐私模式结束或设备存储压力而丢失。定期导出备份更可靠。
            </p>
          </div>
        </section>
      </div>

      {(progress || operationStatus) && (
        <aside className="settings-operation" aria-live="polite">
          {progress && <progress max={Math.max(1, progress.total)} value={progress.completed} />}
          {progress && <span>{progressLabel(progress)}</span>}
          {operationStatus && <strong>{operationStatus}</strong>}
        </aside>
      )}

      {clearOpen && (
        <div className="delete-backdrop">
          <section
            className="delete-confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="clear-data-title"
          >
            <p className="eyebrow">IRREVERSIBLE ACTION</p>
            <h2 id="clear-data-title">清除当前浏览器中的个人记忆？</h2>
            <p>
              这会删除 personal 记忆、衍生图片、人物、地点与个人星座。内置 Demo
              和设备相册原文件不受影响。此操作无法从应用恢复。
            </p>
            <label className="clear-phrase">
              <span>输入“清除记忆”继续</span>
              <input
                autoFocus
                value={clearPhrase}
                onChange={(event) => setClearPhrase(event.target.value)}
              />
            </label>
            <div>
              <button
                type="button"
                className="secondary-action"
                onClick={() => {
                  setClearOpen(false);
                  setClearPhrase('');
                }}
              >
                取消
              </button>
              <button
                type="button"
                className="danger-action"
                disabled={clearPhrase !== '清除记忆'}
                onClick={clearData}
              >
                永久清除
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
