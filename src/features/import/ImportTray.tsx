import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { requestPersistentStorage } from '../../data/quota';
import { IMAGE_INPUT_ACCEPT, MAX_IMPORT_FILES } from '../../engine/import/importLimits';
import type {
  ImportBatchResult,
  ImportProgress,
  ImportRequest,
} from '../../engine/import/importPipeline';
import {
  ImportValidationError,
  validateBatchSize,
  validateImage,
} from '../../engine/import/validateImage';
import { useUiStore } from '../../stores/uiStore';

type RowStatus = 'ready' | 'running' | 'done' | 'failed' | 'cancelled';

interface ImportRow {
  request: ImportRequest;
  status: RowStatus;
  progress: number;
  message: string;
  error?: string;
  warning?: string;
}

type PersistenceState = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported';

function fileFingerprint(file: File): string {
  return `${file.name}:${String(file.size)}:${String(file.lastModified)}`;
}

function newRequest(file: File): ImportRequest {
  return { id: `import-${crypto.randomUUID()}`, file };
}

function validationMessage(file: File): string | null {
  try {
    validateImage(file);
    return null;
  } catch (error) {
    return error instanceof ImportValidationError ? error.message : '这张照片无法加入导入队列。';
  }
}

function readyForRetry(row: ImportRow): ImportRow {
  return {
    request: row.request,
    status: 'ready',
    progress: 0,
    message: '等待重试',
  };
}

function summaryText(summary: ImportBatchResult): string {
  const parts = [`${String(summary.successCount)} 张完成`];
  if (summary.failureCount > 0) parts.push(`${String(summary.failureCount)} 张失败`);
  if (summary.cancelledCount > 0) parts.push(`${String(summary.cancelledCount)} 张取消`);
  return parts.join('，');
}

export function ImportTray(): ReactNode {
  const open = useUiStore((state) => state.importOpen);
  const closeImport = useUiStore((state) => state.closeImport);
  const announce = useUiStore((state) => state.announce);
  const pushToast = useUiStore((state) => state.pushToast);
  const markDataChanged = useUiStore((state) => state.markDataChanged);
  const navigate = useNavigate();
  const location = useLocation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [running, setRunning] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [summary, setSummary] = useState<ImportBatchResult | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [persistence, setPersistence] = useState<PersistenceState>('idle');

  const removeImportQuery = useCallback(() => {
    const parameters = new URLSearchParams(location.search);
    if (!parameters.has('import')) return;
    parameters.delete('import');
    const search = parameters.toString();
    void navigate(
      { pathname: location.pathname, ...(search ? { search: `?${search}` } : {}) },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate]);

  const close = useCallback(() => {
    if (running) return;
    closeImport();
    removeImportQuery();
  }, [closeImport, removeImportQuery, running]);

  useEffect(() => {
    if (!open) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    queueMicrotask(() => closeButtonRef.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !running) close();
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [
        ...dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
        ),
      ];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [close, open, running]);

  const addFiles = useCallback((files: readonly File[]) => {
    setSelectionError(null);
    setSummary(null);
    setPersistence('idle');
    setRows((current) => {
      const existing = new Set(current.map((row) => fileFingerprint(row.request.file)));
      const uniqueFiles = files.filter((file) => !existing.has(fileFingerprint(file)));
      const completedRemoved = current.filter((row) => row.status !== 'done');
      const nextBase =
        current.length + uniqueFiles.length > MAX_IMPORT_FILES &&
        completedRemoved.length + uniqueFiles.length <= MAX_IMPORT_FILES
          ? completedRemoved
          : current;
      try {
        validateBatchSize(nextBase.length + uniqueFiles.length);
      } catch (error) {
        setSelectionError(
          error instanceof ImportValidationError
            ? error.message
            : `一次最多导入 ${String(MAX_IMPORT_FILES)} 张照片。`,
        );
        return current;
      }
      const incoming = uniqueFiles.map((file): ImportRow => {
        const error = validationMessage(file);
        return {
          request: newRequest(file),
          status: error ? 'failed' : 'ready',
          progress: error ? 1 : 0,
          message: error ? '无法加入' : '等待处理',
          ...(error ? { error } : {}),
        };
      });
      return [...nextBase, ...incoming];
    });
  }, []);

  const onInput = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles([...(event.target.files ?? [])]);
    event.target.value = '';
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    if (!running) addFiles([...event.dataTransfer.files]);
  };

  const updateProgress = useCallback((progress: ImportProgress) => {
    setRows((current) =>
      current.map((row) =>
        row.request.id === progress.requestId
          ? {
              ...row,
              status:
                progress.stage === 'done'
                  ? 'done'
                  : progress.stage === 'failed'
                    ? 'failed'
                    : progress.stage === 'cancelled'
                      ? 'cancelled'
                      : 'running',
              progress: progress.progress,
              message: progress.message,
            }
          : row,
      ),
    );
  }, []);

  const startImport = async () => {
    const requests = rows.filter((row) => row.status === 'ready').map((row) => row.request);
    if (requests.length === 0 || running) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setRunning(true);
    setSummary(null);
    try {
      const { runImportBatch } = await import('../../engine/import/importPipeline');
      const result = await runImportBatch(requests, {
        signal: controller.signal,
        onProgress: updateProgress,
      });
      setSummary(result);
      setRows((current) =>
        current.map((row) => {
          const outcome = result.results.find((item) => item.requestId === row.request.id);
          if (!outcome) return row;
          if (outcome.status === 'done') {
            return {
              ...row,
              status: 'done',
              progress: 1,
              message: '已保存在当前浏览器',
              ...(outcome.warnings[0] ? { warning: outcome.warnings[0].message } : {}),
            };
          }
          return {
            ...row,
            status: outcome.status,
            progress: 1,
            message: outcome.status === 'cancelled' ? '已取消' : '导入失败',
            error: outcome.error.message,
            ...(outcome.warnings[0] ? { warning: outcome.warnings[0].message } : {}),
          };
        }),
      );
      const summaryMessage = summaryText(result);
      if (result.successCount > 0) markDataChanged();
      announce(summaryMessage);
      pushToast(summaryMessage, result.failureCount > 0 ? 'neutral' : 'success');
    } catch {
      const message = '导入模块未能启动，本地照片没有被写入。请重新载入后再试。';
      setSelectionError(message);
      pushToast(message, 'danger');
    } finally {
      abortControllerRef.current = null;
      setRunning(false);
    }
  };

  const cancelImport = () => {
    abortControllerRef.current?.abort();
    announce('正在取消未完成的照片处理。');
  };

  const clearCompleted = useCallback(() => {
    setRows((current) => current.filter((row) => row.status !== 'done'));
    setSummary(null);
    setSelectionError(null);
    setPersistence('idle');
    announce('已清除本批次完成项，可以继续导入照片。');
  }, [announce]);

  const requestPersistence = async () => {
    setPersistence('requesting');
    const granted = await requestPersistentStorage();
    setPersistence(granted === null ? 'unsupported' : granted ? 'granted' : 'denied');
  };

  const enterPersonalUniverse = () => {
    closeImport();
    removeImportQuery();
    void navigate('/universe?source=personal');
  };

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && event.target === dialogRef.current) inputRef.current?.click();
  };

  if (!open) return null;

  const readyCount = rows.filter((row) => row.status === 'ready').length;
  const successful = summary?.successCount ?? 0;

  return (
    <div className="import-backdrop">
      <div
        aria-describedby="import-description"
        aria-labelledby="import-title"
        aria-modal="true"
        className="import-tray"
        data-empty={rows.length === 0 ? 'true' : 'false'}
        onKeyDown={handleDialogKeyDown}
        ref={dialogRef}
        role="dialog"
      >
        <div className="import-intro">
          <header className="import-header">
            <div>
              <p className="eyebrow">LOCAL IMPORT · 本地导入</p>
              <h2 id="import-title">把照片带入记忆宇宙</h2>
            </div>
            <button
              className="text-button"
              disabled={running}
              onClick={close}
              ref={closeButtonRef}
              type="button"
            >
              关闭
            </button>
          </header>

          <p className="import-privacy" id="import-description">
            照片会在当前浏览器内解析、缩放并保存，不上传服务器。GPS
            与相机信息只保存在本地；清除浏览器数据可能删除这些记忆。
          </p>
        </div>

        <div
          className="import-dropzone"
          data-active={dragActive ? 'true' : 'false'}
          onDragEnter={(event) => {
            event.preventDefault();
            if (!running) setDragActive(true);
          }}
          onDragLeave={(event) => {
            if (event.currentTarget === event.target) setDragActive(false);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDrop}
        >
          <input
            accept={IMAGE_INPUT_ACCEPT}
            className="sr-only"
            disabled={running}
            id="local-photo-input"
            multiple
            onChange={onInput}
            ref={inputRef}
            type="file"
          />
          <label htmlFor="local-photo-input">
            <span>拖入照片，或从设备选择</span>
            <small>JPEG、PNG、WebP、AVIF；HEIC 取决于当前浏览器解码能力</small>
          </label>
        </div>

        {selectionError ? (
          <p className="inline-error" role="alert">
            {selectionError}
          </p>
        ) : null}

        {rows.length > 0 ? (
          <div className="import-queue" aria-label="待导入照片">
            {rows.map((row) => (
              <article className="import-row" data-status={row.status} key={row.request.id}>
                <div className="import-row__identity">
                  <strong>{row.request.file.name}</strong>
                  <span>{(row.request.file.size / 1024 / 1024).toFixed(1)} MB</span>
                </div>
                <div className="import-row__status">
                  <span>{row.message}</span>
                  <span data-tabular="true">{String(Math.round(row.progress * 100))}%</span>
                </div>
                <progress
                  max={1}
                  value={row.progress}
                  aria-label={`${row.request.file.name} 导入进度`}
                />
                {row.warning ? <p className="row-note">{row.warning}</p> : null}
                {row.error ? <p className="row-error">{row.error}</p> : null}
                {!running && row.status !== 'done' ? (
                  <div className="import-row__actions">
                    {row.status !== 'ready' && !validationMessage(row.request.file) ? (
                      <button
                        className="text-button"
                        onClick={() =>
                          setRows((current) =>
                            current.map((item) =>
                              item.request.id === row.request.id ? readyForRetry(item) : item,
                            ),
                          )
                        }
                        type="button"
                      >
                        重试
                      </button>
                    ) : null}
                    <button
                      className="text-button"
                      onClick={() =>
                        setRows((current) =>
                          current.filter((item) => item.request.id !== row.request.id),
                        )
                      }
                      type="button"
                    >
                      移除
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}

        {summary ? (
          <section className="import-summary" aria-label="导入结果">
            <strong>{summaryText(summary)}</strong>
            <p>完成的照片已经写入 IndexedDB（浏览器本地数据库），刷新后仍可看到。</p>
          </section>
        ) : null}

        {successful > 0 ? (
          <div className="persistence-note">
            <p>
              你可以请求浏览器尽量保留这些本地数据；浏览器仍可能在存储压力下清理它们，定期导出备份更可靠。
            </p>
            {persistence === 'idle' ? (
              <button
                className="text-button"
                onClick={() => void requestPersistence()}
                type="button"
              >
                提高本地保留稳定性
              </button>
            ) : (
              <span role="status">
                {persistence === 'requesting'
                  ? '正在请求…'
                  : persistence === 'granted'
                    ? '浏览器已允许持久存储。'
                    : persistence === 'denied'
                      ? '浏览器未授予持久存储；不影响继续使用。'
                      : '当前浏览器不提供此能力。'}
              </span>
            )}
          </div>
        ) : null}

        <footer className="import-footer">
          <span>{rows.length === 0 ? '尚未选择照片' : `${String(rows.length)} 张在队列中`}</span>
          <div>
            {running ? (
              <button className="secondary-action" onClick={cancelImport} type="button">
                取消未完成项
              </button>
            ) : null}
            {successful > 0 && !running ? (
              <button
                className="secondary-action"
                data-testid="clear-completed-imports"
                onClick={clearCompleted}
                type="button"
              >
                清除已完成
              </button>
            ) : null}
            {successful > 0 && !running ? (
              <button className="primary-action" onClick={enterPersonalUniverse} type="button">
                进入我的记忆宇宙
              </button>
            ) : (
              <button
                className="primary-action"
                disabled={running || readyCount === 0}
                onClick={() => void startImport()}
                type="button"
              >
                {running ? '正在本地处理' : `开始处理 ${String(readyCount)} 张`}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
