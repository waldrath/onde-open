// Minimal offline shell for Onde: navigations are network-first (fresh HTML
// whenever online, last cached page when offline) and static assets are
// cache-first. API calls and range requests are never cached.
const CACHE = 'onde-shell-v2';

const put = (request, response) => {
  if (!response || !response.ok) return;
  const copy = response.clone();
  caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {});
};
const isAsset = path => path.startsWith('/_next/static/') || path.startsWith('/images/') || path.startsWith('/themes/') || path === '/manifest.webmanifest' || path === '/favicon.svg' || path === '/app-icon.svg' || path === '/icon-192.png' || path === '/icon-512.png' || path === '/apple-touch-icon.png';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Network first. The page is personal (account, skin, catalogue snapshot), so a
// cached copy is only served when the network actually fails, never because a
// response is slow: a sign-in or sign-out must always land on fresh HTML.
async function navigation(request) {
  try {
    const response = await fetch(request);
    put(request, response);
    return response;
  } catch {
    const cache = await caches.open(CACHE);
    const cached = (await cache.match(request)) || (await cache.match('/'));
    return cached || new Response('<!doctype html><meta charset="utf-8"><title>Onde hors ligne</title><p>Onde est hors ligne. Reconnectez-vous puis rechargez la page.</p>', {status: 503, headers: {'Content-Type': 'text/html; charset=utf-8'}});
  }
}

// Hashed build output never changes under a given URL; other public files are
// revalidated in the background after the cached copy is returned.
async function asset(request, revalidate) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) {
    if (revalidate) fetch(request).then(response => put(request, response)).catch(() => {});
    return cached;
  }
  try {
    return await fetch(request).then(response => { put(request, response); return response; });
  } catch {
    return Response.error();
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || request.headers.has('range')) return;

  if (request.mode === 'navigate') {
    event.respondWith(navigation(request));
    return;
  }

  if (isAsset(url.pathname)) event.respondWith(asset(request, !url.pathname.startsWith('/_next/static/')));
});

// Programme reminders (app/television.tsx shows them through this worker):
// a tap focuses Onde and plays the channel, or opens Onde when it is closed.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const channelId = event.notification.data && event.notification.data.channelId;
  if (typeof channelId !== 'string' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(channelId)) return;
  event.waitUntil(
    self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(clients => {
      const client = clients.find(item => new URL(item.url).origin === self.location.origin);
      if (client) {
        client.postMessage({type: 'onde-reminder-open', channelId});
        return client.focus();
      }
      return self.clients.openWindow('/?regarder=' + encodeURIComponent(channelId));
    }),
  );
});
