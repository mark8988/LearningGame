import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';
export default defineConfig({
  testDir: './tests/factory', outputDir: '.local/factory-test-results', workers: 2, timeout: 180000,
  use: { baseURL: 'http://127.0.0.1:5089', channel: 'msedge', launchOptions: { args: ['--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader'] }, trace: 'retain-on-failure' },
  projects: [{ name: 'tablet', use: { ...devices['iPad (gen 7) landscape'], defaultBrowserType: 'chromium' } }, { name: 'phone', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } }],
  webServer: { command: `dotnet run --project factory/ContentFactory/ContentFactory.csproj --no-build --no-launch-profile -- --Factory:Url=http://127.0.0.1:5089 --Factory:DataDirectory="${resolve('.local/factory-e2e-data')}"`, url: 'http://127.0.0.1:5089/api/health', reuseExistingServer: !process.env.CI, timeout: 30000 },
});
