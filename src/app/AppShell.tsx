import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { PersistentSceneShell } from '../scene/PersistentSceneShell';
import { MusicExperience } from '../features/music/MusicExperience';
import { MusicLibraryPopover } from '../features/music/MusicLibraryPopover';
import { ImportTray } from '../features/import/ImportTray';
import { SettingsController } from '../features/settings/SettingsController';
import { ToastRegion } from '../features/shared/ToastRegion';
import { SceneNavigationBridge } from '../features/universe/SceneNavigationBridge';
import { UniverseDataController } from '../features/universe/UniverseDataController';
import { useSceneStore } from '../stores/sceneStore';
import { useUiStore } from '../stores/uiStore';
import { RouteOverlays } from './router';

export function AppShell(): ReactNode {
  const location = useLocation();
  const [homeEntryId, setHomeEntryId] = useState(0);
  const syncRoute = useSceneStore((state) => state.syncRoute);
  const openImport = useUiStore((state) => state.openImport);
  const announcement = useUiStore((state) => state.announcement);
  const edgeDestination =
    location.pathname === '/settings'
      ? '/archive'
      : location.pathname === '/archive'
        ? '/settings'
        : location.pathname === '/'
          ? '/settings'
          : '/archive';
  const edgeLabel = edgeDestination === '/settings' ? '本地与隐私' : '记忆档案';
  const showEdgeAction = location.pathname === '/' || location.pathname.startsWith('/universe');
  const isDemoArchive =
    location.pathname === '/archive' &&
    new URLSearchParams(location.search).get('source') === 'demo';
  const showMusicLibrary = location.pathname !== '/' && !isDemoArchive;

  useEffect(() => {
    syncRoute(location.pathname, location.search);
  }, [location.pathname, location.search, syncRoute]);

  useEffect(() => {
    if (new URLSearchParams(location.search).get('import') === '1') openImport();
  }, [location.search, openImport]);

  return (
    <div className="app-shell" data-route={location.pathname}>
      <PersistentSceneShell />
      {location.pathname === '/' && (
        <div
          key={`${location.key}-${String(homeEntryId)}`}
          className="home-entry-flare"
          aria-hidden="true"
        />
      )}
      <header className="edge-nav" aria-label="主要导航">
        <Link
          className="wordmark"
          to="/"
          aria-label="Memuniverse 首页"
          onClick={() => {
            if (location.pathname === '/') setHomeEntryId((entryId) => entryId + 1);
          }}
        >
          Memuniverse
        </Link>
        <div className="edge-nav__actions">
          {showMusicLibrary && <MusicLibraryPopover />}
          {showEdgeAction && (
            <Link className="edge-action" to={edgeDestination}>
              {edgeLabel}
            </Link>
          )}
        </div>
      </header>
      <div className="route-layer">
        <RouteOverlays />
      </div>
      {location.pathname !== '/' && !isDemoArchive && <MusicExperience />}
      <UniverseDataController />
      <SettingsController />
      <SceneNavigationBridge />
      <ImportTray />
      <ToastRegion />
      <div className="sr-only" aria-live="polite" aria-atomic="true" id="memento-live-region">
        {announcement}
      </div>
    </div>
  );
}
