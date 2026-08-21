import { defineConfig, devices } from '@playwright/test';

const e2ePort = process.env['E2E_PORT'] ?? '4173';
const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`;
const nodeExecutable = `"${process.execPath}"`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: e2eBaseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
  webServer: {
    command: `${nodeExecutable} ./node_modules/typescript/bin/tsc -b --pretty false && ${nodeExecutable} ./node_modules/vite/bin/vite.js build && ${nodeExecutable} ./node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ${e2ePort}`,
    url: e2eBaseUrl,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
