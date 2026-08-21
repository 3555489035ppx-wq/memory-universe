import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';

import { listMemories } from '../data/repositories/memoryRepository';

const MemoryDiveOverlay = lazy(() =>
  import('../features/memory/MemoryDiveOverlay').then(({ MemoryDiveOverlay: component }) => ({
    default: component,
  })),
);
const ConstellationDetail = lazy(() =>
  import('../features/constellation/ConstellationDetail').then(
    ({ ConstellationDetail: component }) => ({
      default: component,
    }),
  ),
);
const ArchivePage = lazy(() =>
  import('../features/archive/ArchivePage').then(({ ArchivePage: component }) => ({
    default: component,
  })),
);
const SettingsPage = lazy(() =>
  import('../features/settings/SettingsPage').then(({ SettingsPage: component }) => ({
    default: component,
  })),
);
const UniverseHUD = lazy(() =>
  import('../features/universe/UniverseHUD').then(({ UniverseHUD: component }) => ({
    default: component,
  })),
);
const InfoPage = lazy(() =>
  import('../features/info/InfoPage').then(({ InfoPage: component }) => ({ default: component })),
);
const GlassLab = lazy(() =>
  import('../features/dev/GlassLab').then(({ GlassLab: component }) => ({ default: component })),
);

function EntryOverlay(): ReactNode {
  const [personalCount, setPersonalCount] = useState(0);
  useEffect(() => {
    let active = true;
    void listMemories('personal')
      .then((memories) => {
        if (active) setPersonalCount(memories.length);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  const entryDestination =
    personalCount > 0 ? '/universe?source=personal' : '/universe?source=demo';
  return (
    <main className="entry-overlay entry-overlay--launch">
      <section
        className="entry-content entry-content--launch reveal home-entry-reveal"
        aria-labelledby="entry-title"
      >
        <div className="entry-launch" aria-label="Memuniverse 启动画面">
          <div className="entry-launch__ambient" aria-hidden="true" />
          <div className="entry-launch__scanlines" aria-hidden="true" />
          <div className="entry-launch__brand-wrap">
            <h1 id="entry-title" className="entry-launch__brand" aria-label="Memuniverse">
              Memuniverse
            </h1>
            <p className="entry-launch__cn">记忆宇宙</p>
            <div className="entry-launch__actions">
              <Link className="entry-launch__enter" to={entryDestination}>
                点击进入
              </Link>
            </div>
          </div>
          <span className="entry-launch__rule" aria-hidden="true" />
        </div>
      </section>
    </main>
  );
}

function NotFound(): ReactNode {
  return (
    <main className="page-overlay">
      <section className="page-panel">
        <h1>这里没有这段记忆</h1>
        <p>链接可能已经改变，或这段本地数据已被删除。</p>
        <Link className="primary-action" to="/universe">
          返回记忆宇宙
        </Link>
      </section>
    </main>
  );
}

export function RouteOverlays(): ReactNode {
  return (
    <Suspense
      fallback={
        <div className="route-loading" role="status">
          正在打开 Memuniverse…
        </div>
      }
    >
      <Routes>
        <Route path="/" element={<EntryOverlay />} />
        <Route path="/universe" element={<UniverseHUD />} />
        <Route path="/memory/:id" element={<MemoryDiveOverlay />} />
        <Route path="/constellation/:id" element={<ConstellationDetail />} />
        <Route path="/archive" element={<ArchivePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/about" element={<InfoPage />} />
        <Route path="/privacy" element={<InfoPage />} />
        {import.meta.env.DEV && <Route path="/dev/glass" element={<GlassLab />} />}
        <Route path="/home" element={<Navigate replace to="/" />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
