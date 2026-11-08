// غيّر رقم الإصدار عند تعديل الملفات ليصل التحديث إلى الهاتف
const CACHE = 'rain-log-v5';

const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

const EXTERNAL = [
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // ملفات التطبيق: نتجاوز كاش المتصفح، ولا نحفظ إلا الاستجابات السليمة
    await Promise.all(CORE.map(async url => {
      try {
        const res = await fetch(new Request(url, { cache: 'reload' }));
        if (res.ok) await cache.put(url, res);
      } catch (e) {}
    }));
    // مكتبات CDN: لا نحفظ إلا الاستجابات السليمة (CORS)، فلا يدخل الكاش ردّ خاطئ
    await Promise.all(EXTERNAL.map(async url => {
      try {
        const res = await fetch(url, { mode: 'cors' });
        if (res.ok) await cache.put(url, res);
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

// ملفات الموقع نفسه: الشبكة أولًا (لتصل التحديثات فورًا)، والكاش عند انقطاع الإنترنت
async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    let res;
    if (req.mode === 'navigate') {
      res = await fetch(req.url, { cache: 'no-cache' });
      if (res.redirected) res = await fetch(req);
    } else {
      res = await fetch(req, { cache: 'no-cache' });
    }
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const page = await cache.match('./index.html');
      if (page) return page;
    }
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

// المكتبات الخارجية: الكاش أولًا، ولا يُحفظ إلا ما كان سليمًا
async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;
  const sameOrigin = new URL(req.url).origin === self.location.origin;
  event.respondWith(sameOrigin ? networkFirst(req) : cacheFirst(req));
});
