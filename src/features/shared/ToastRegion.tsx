import { useEffect, type ReactNode } from 'react';

import { useUiStore } from '../../stores/uiStore';

export function ToastRegion(): ReactNode {
  const toasts = useUiStore((state) => state.toasts);
  const removeToast = useUiStore((state) => state.removeToast);
  const importOpen = useUiStore((state) => state.importOpen);

  useEffect(() => {
    const timers = toasts.map((toast) =>
      window.setTimeout(() => removeToast(toast.id), toast.tone === 'danger' ? 7000 : 4500),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [removeToast, toasts]);

  if (importOpen) return null;

  return (
    <div className="toast-region" aria-label="状态通知">
      {toasts.map((toast) => (
        <div
          className="toast-message"
          data-tone={toast.tone}
          key={toast.id}
          role={toast.tone === 'danger' ? 'alert' : 'status'}
        >
          <span>{toast.message}</span>
          <button type="button" onClick={() => removeToast(toast.id)} aria-label="关闭通知">
            关闭
          </button>
        </div>
      ))}
    </div>
  );
}
