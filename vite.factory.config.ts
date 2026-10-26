import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { renameSync } from 'node:fs';
export default defineConfig({ base: './', publicDir: false, plugins: [react(), { name: 'factory-index', closeBundle() { renameSync(resolve('factory/ContentFactory/wwwroot/factory.html'), resolve('factory/ContentFactory/wwwroot/index.html')); } }], build: { outDir: 'factory/ContentFactory/wwwroot', emptyOutDir: true, rollupOptions: { input: resolve('factory.html') } } });
