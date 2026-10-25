// Cache only the offline screen. Never cache authentication, reports, presence,
// transit responses, or a private copy of the app shell.
const OFFLINE_CACHE = 'studysignal-offline-v2';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(OFFLINE_CACHE).then(cache => cache.add('/offline.html')));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('studysignal-offline-') && key !== OFFLINE_CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(async () => (await caches.match('/offline.html')) || new Response('StudySignal is offline. Reconnect and try again.', { status: 503, headers: { 'Content-Type': 'text/plain' } })));
});
