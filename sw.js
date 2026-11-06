'use strict';

// Change this revision when changing any app-shell file so existing installs update.
const CACHE_NAME = 'marshall-shell-v2';
const CACHE_PREFIX = 'marshall-shell-';
const SHELL_PATHS = [
    './', './index.html', './pwa.js', './pwa.css', './manifest.webmanifest',
    './ROYAL_OBIDOS_Logo.png', './course.jpg', './favicon.png',
    './icons/icon-192.png', './icons/icon-512.png',
    './icons/icon-maskable-512.png', './icons/apple-touch-icon.png'
];
const SHELL_URLS = SHELL_PATHS.map(path => new URL(path, self.location).href);
const HOME_URL = new URL('./', self.location).href;
const INDEX_URL = new URL('./index.html', self.location).href;

self.addEventListener('install', event => {
    // All local assets must be cached before installation can succeed.
    // Updates wait for explicit confirmation instead of reloading a live calculation.
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(
        SHELL_URLS.map(url => new Request(url, { cache: 'reload' }))
    )));
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
            .map(name => caches.delete(name)));
        await self.clients.claim();
    })());
});

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;
    // Cache only this app's known public files, never arbitrary requests or APIs.
    const key = url.origin + url.pathname;
    if (!SHELL_URLS.includes(key)) return;

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        try {
            const response = await fetch(event.request, { signal: controller.signal });
            if (response.ok && response.type === 'basic') {
                const keys = key === HOME_URL || key === INDEX_URL ? [HOME_URL, INDEX_URL] : [key];
                await Promise.all(keys.map(cacheKey => cache.put(cacheKey, response.clone())));
            }
            return response;
        } catch (error) {
            const cached = await cache.match(key);
            if (cached) return cached;
            throw error;
        } finally {
            clearTimeout(timeout);
        }
    })());
});
