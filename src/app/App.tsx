import { Component, type ErrorInfo, type ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';

import { AppShell } from './AppShell';

interface ErrorBoundaryState {
  hasError: boolean;
}

class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error('Memuniverse 渲染失败', error, info);
    }
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main className="page-overlay">
          <section className="page-panel" aria-labelledby="app-error-title">
            <h1 id="app-error-title">Memuniverse 暂时无法打开</h1>
            <p>请刷新页面重试。你的本地记忆数据不会因为这个界面错误被主动清除。</p>
            <button
              className="primary-action"
              type="button"
              onClick={() => window.location.reload()}
            >
              刷新页面
            </button>
            <a className="secondary-action" href="/">
              返回首页
            </a>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

export function App(): ReactNode {
  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </AppErrorBoundary>
  );
}
