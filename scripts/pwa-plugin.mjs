import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative } from 'node:path';
export function offlinePlugin() {
  let directory;
  return { name: 'learning-offline', apply: 'build', configResolved(config) { directory = resolve(config.root, config.build.outDir); }, async closeBundle() {
    const paths = [];
    async function scan(dir) { for (const entry of await readdir(dir, { withFileTypes: true })) { const path = resolve(dir, entry.name); if (entry.isDirectory()) await scan(path); else if (!entry.name.endsWith('.map') && entry.name !== 'sw.js') paths.push(path); } }
    await scan(directory); paths.sort();
    const hash = createHash('sha256'); for (const path of paths) hash.update(await readFile(path));
    const version = hash.digest('hex').slice(0, 16);
    const urls = ['./', ...paths.map(path => `./${relative(directory, path).replaceAll('\\', '/')}`)];
    await writeFile(resolve(directory, 'sw.js'), `const PREFIX = 'learning-adventure-offline:' + self.registration.scope;
const CACHE = PREFIX + '${version}';
const ASSETS = ${JSON.stringify(urls)};
self.addEventListener('install', event => event.waitUntil((async () => { const cache = await caches.open(CACHE); await cache.addAll(ASSETS.map(url => new Request(new URL(url, self.location), { cache: 'reload' }))); })()));
self.addEventListener('activate', event => event.waitUntil((async () => { for (const name of await caches.keys()) if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name); await self.clients.claim(); })()));
self.addEventListener('message', event => { if (event.data === 'ACTIVATE_UPDATE') self.skipWaiting(); });
self.addEventListener('fetch', event => { const url = new URL(event.request.url); if (event.request.method !== 'GET' || !url.href.startsWith(self.registration.scope)) return; event.respondWith((async () => { const cache = await caches.open(CACHE); const cached = await cache.match(event.request, { ignoreVary: true, ignoreSearch: event.request.mode === 'navigate' }); if (cached) return cached; if (event.request.mode === 'navigate') return (await cache.match(new URL('./', self.location), { ignoreVary: true })) || fetch(event.request); return fetch(event.request); })()); });
`);
    console.log(`Offline precache ready: ${urls.length} resources, ${version}`);
  } };
}
