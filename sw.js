// غيّر رقم الإصدار عند تعديل index.html ليصل التحديث إلى الهاتف
const CACHE = 'rain-log-v2';

const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

const EXTERNAL = [
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE);
    // الموارد الخارجية: إن فشل أحدها لا يفشل التثبيت
    await Promise.all(EXTERNAL.map(async url => {
      try {
        const req = new Request(url, { mode: 'no-cors' });
        await cache.put(req, await fetch(req));
      } catch (e) {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);

    const network = fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    }).catch(() => null);

    if (cached) { event.waitUntil(network); return cached; }

    const res = await network;
    if (res) return res;
    if (req.mode === 'navigate') {
      const page = await cache.match('./index.html');
      if (page) return page;
    }
    return new Response('', { status: 503, statusText: 'Offline' });
  })());
});
