import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testIgnore: '**/offline.spec.ts', fullyParallel: false, workers: 2, timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:4173', channel: 'msedge', launchOptions: { args: ['--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader'] }, trace: 'retain-on-failure' },
  projects: [{ name: 'tablet', use: { ...devices['iPad (gen 7) landscape'], defaultBrowserType: 'chromium' } }, { name: 'phone', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } }],
  webServer: { command: 'npm run dev -- --port 4173 --strictPort', url: 'http://127.0.0.1:4173', reuseExistingServer: false, timeout: 30000 },
});
