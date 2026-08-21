import { spawn } from 'node:child_process';

const viteArgs = process.argv.slice(2);
const connectorUrl = `http://${process.env.MEMENTO_MUSIC_HOST ?? '127.0.0.1'}:${process.env.MEMENTO_MUSIC_PORT ?? '3000'}`;
const children = new Set();
let viteChild = null;
let connectorChild = null;
let connectorRestartTimer = null;
let connectorHealthTimer = null;
let connectorCheckInFlight = false;
let connectorRestartAttempt = 0;
let stopping = false;

async function connectorIsHealthy() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1_200);
  try {
    const response = await fetch(`${connectorUrl}/api/health`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function scheduleConnectorRestart() {
  if (stopping || connectorRestartTimer) return;
  connectorRestartAttempt += 1;
  const delay = Math.min(5_000, 400 * 2 ** Math.min(connectorRestartAttempt - 1, 4));
  console.error(`MEMENTO Music Connector stopped; retrying in ${String(delay)}ms (attempt ${String(connectorRestartAttempt)}).`);
  connectorRestartTimer = setTimeout(() => {
    connectorRestartTimer = null;
    void ensureConnector();
  }, delay);
}

function spawnConnector() {
  if (stopping || connectorChild) return;
  const child = spawn(process.execPath, ['scripts/memento-music-connector.mjs'], {
    stdio: 'inherit',
    env: { ...process.env, MEMENTO_CONNECTOR_SUPERVISED: '1' },
  });
  connectorChild = child;
  children.add(child);
  child.once('error', (error) => {
    if (!stopping) console.error(`MEMENTO Music Connector process error: ${error.message}`);
  });
  child.once('exit', (code, signal) => {
    children.delete(child);
    if (connectorChild === child) connectorChild = null;
    if (stopping) return;
    void connectorIsHealthy().then((healthy) => {
      if (healthy) {
        connectorRestartAttempt = 0;
        console.warn(`Using an existing healthy MEMENTO Music Connector at ${connectorUrl}.`);
        return;
      }
      console.error(`MEMENTO Music Connector exited (${signal ?? String(code)}).`);
      scheduleConnectorRestart();
    });
  });
}

async function ensureConnector() {
  if (stopping || connectorChild || connectorCheckInFlight) return;
  connectorCheckInFlight = true;
  try {
    if (await connectorIsHealthy()) {
      connectorRestartAttempt = 0;
      return;
    }
    spawnConnector();
  } finally {
    connectorCheckInFlight = false;
  }
}

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  if (connectorRestartTimer) clearTimeout(connectorRestartTimer);
  if (connectorHealthTimer) clearInterval(connectorHealthTimer);
  connectorRestartTimer = null;
  connectorHealthTimer = null;
  for (const child of children) child.kill('SIGTERM');
  if (viteChild && !children.has(viteChild)) viteChild.kill('SIGTERM');
  process.exitCode = exitCode;
}

viteChild = spawn(process.execPath, ['node_modules/vite/bin/vite.js', ...viteArgs], { stdio: 'inherit' });
children.add(viteChild);
viteChild.once('error', (error) => {
  console.error(`Vite process error: ${error.message}`);
  stop(1);
});
viteChild.once('exit', (code, signal) => {
  children.delete(viteChild);
  if (!stopping) {
    console.error(`Development process stopped (${signal ?? String(code)}).`);
    stop(code ?? 1);
  }
});

void ensureConnector();
connectorHealthTimer = setInterval(() => void ensureConnector(), 3_000);
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
