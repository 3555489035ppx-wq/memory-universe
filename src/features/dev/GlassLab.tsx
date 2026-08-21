import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

import { GlassButton } from '../../components/ui/glass-button';

function ZapIcon({ size = 18 }: { size?: number }): ReactNode {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M13 2 3.5 13.5h8L11 22l9.5-12h-8L13 2Z" />
    </svg>
  );
}

function InfoIcon(): ReactNode {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  );
}

export function GlassLab(): ReactNode {
  return (
    <main className="glass-lab" aria-labelledby="glass-lab-title">
      <section className="glass-lab__panel">
        <Link className="glass-lab__back" to="/">
          返回 Memuniverse
        </Link>
        <header className="glass-lab__header">
          <p className="eyebrow">LIQUID GLASS · DEVELOPMENT LAB</p>
          <h1 id="glass-lab-title">让照片穿过按钮。</h1>
          <p>
            玻璃只承担控制，不遮住记忆。移动鼠标观察环境高光，按下按钮感受轻微压缩。
          </p>
        </header>
        <div className="glass-lab__grid">
          <div className="glass-lab__row">
            <span className="glass-lab__label">Strong</span>
            <GlassButton strength="strong" size="sm">
              开始回忆
            </GlassButton>
            <GlassButton strength="strong" size="default" contentClassName="glass-lab__button-content">
              <span>播放这段记忆</span>
              <ZapIcon />
            </GlassButton>
            <GlassButton strength="strong" size="lg">
              确认选择
            </GlassButton>
          </div>
          <div className="glass-lab__row">
            <span className="glass-lab__label">Medium</span>
            <GlassButton strength="medium" size="sm">
              选择音乐
            </GlassButton>
            <GlassButton strength="medium" size="default">
              探索演示宇宙
            </GlassButton>
            <GlassButton strength="medium" size="icon" aria-label="查看说明">
              <InfoIcon />
            </GlassButton>
          </div>
          <div className="glass-lab__row">
            <span className="glass-lab__label">Subtle</span>
            <GlassButton strength="subtle" size="sm">
              返回
            </GlassButton>
            <GlassButton strength="subtle" size="default">
              记忆档案
            </GlassButton>
            <GlassButton strength="subtle" size="icon" disabled aria-label="不可用">
              <ZapIcon />
            </GlassButton>
          </div>
        </div>
      </section>
    </main>
  );
}
