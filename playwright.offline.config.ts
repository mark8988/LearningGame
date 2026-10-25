import { defineConfig } from '@playwright/test';
import config from './playwright.config';
export default defineConfig({ ...config, testIgnore: [], testMatch: '**/offline.spec.ts', use: { ...config.use, baseURL: process.env.LEARNING_TEST_URL ?? 'http://127.0.0.1:4173' }, webServer: process.env.LEARNING_TEST_URL ? undefined : { command: 'npm run preview -- --port 4173 --strictPort', url: 'http://127.0.0.1:4173', reuseExistingServer: false, timeout: 30000 } });
