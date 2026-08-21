import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vitest/config';

function mementoMusicConnectorPlugin(): Plugin {
  const host = process.env.MEMENTO_MUSIC_HOST ?? '127.0.0.1';
  const port = process.env.MEMENTO_MUSIC_PORT ?? '3000';
  const baseUrl = `http://${host}:${port}`;
  let child: ChildProcess | null = null;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;
  let healthTimer: ReturnType<typeof setInterval> | null = null;
  let checkInFlight = false;
  let restartAttempt = 0;
  let stopping = false;

  async function isHealthy(): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1_000);
    try {
      const response = await fetch(`${baseUrl}/api/health`, { signal: controller.signal });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  function scheduleRestart(): void {
    if (stopping || restartTimer) return;
    restartAttempt += 1;
    const delay = Math.min(5_000, 400 * 2 ** Math.min(restartAttempt - 1, 4));
    restartTimer = setTimeout(() => {
      restartTimer = null;
      void ensureRunning();
    }, delay);
  }

  function spawnConnector(): void {
    if (stopping || child) return;
    child = spawn(process.execPath, [resolve(process.cwd(), 'scripts/memento-music-connector.mjs')], {
      stdio: 'inherit',
      env: { ...process.env, MEMENTO_CONNECTOR_SUPERVISED: '1' },
    });
    const current = child;
    current.once('error', (error) => {
      if (!stopping) console.error(`MEMENTO Music Connector process error: ${error.message}`);
    });
    current.once('exit', (code, signal) => {
      if (child === current) child = null;
      if (stopping) return;
      void isHealthy().then((healthy) => {
        if (healthy) {
          restartAttempt = 0;
          return;
        }
        console.error(`MEMENTO Music Connector exited (${signal ?? String(code)}); retrying automatically.`);
        scheduleRestart();
      });
    });
  }

  async function ensureRunning(): Promise<void> {
    if (stopping || child || checkInFlight) return;
    checkInFlight = true;
    try {
      if (await isHealthy()) {
        restartAttempt = 0;
        return;
      }
      spawnConnector();
    } finally {
      checkInFlight = false;
    }
  }

  return {
    name: 'memento-music-connector',
    apply: 'serve',
    configureServer(server) {
      const stop = (): void => {
        stopping = true;
        if (restartTimer) clearTimeout(restartTimer);
        if (healthTimer) clearInterval(healthTimer);
        restartTimer = null;
        healthTimer = null;
        child?.kill('SIGTERM');
        child = null;
      };
      server.httpServer?.once('close', stop);
      void ensureRunning();
      healthTimer = setInterval(() => void ensureRunning(), 3_000);
    },
  } satisfies Plugin;
}

export default defineConfig({
  plugins: [react(), mementoMusicConnectorPlugin()],
  base: process.env.VITE_BASE_PATH ?? '/',
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          three: ['three'],
          threeRuntime: ['@react-three/fiber', '@react-three/drei', 'camera-controls'],
          data: ['idb', 'fflate'],
        },
      },
    },
  },
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    restoreMocks: true,
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});
