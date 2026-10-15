/* ==========================================================================
   sw.js — çevrimdışı çalışma için basit service worker
   - Kurulumda uygulama kabuğu önbelleğe alınır.
   - Sayfa istekleri: önce ağ, ağ yoksa önbellekteki sayfa.
   - Diğer dosyalar: önbellekten hemen, arka planda güncellenir
     (stale-while-revalidate). Böylece yeni sürüm bir sonraki açılışta gelir.
   VERSION değişince eski önbellekler silinir.
   ========================================================================== */

const VERSION = 'nobetci-v2';
const SHELL = [
  '/',
  '/css/style.css',
  '/js/app.js',
  '/js/calc.js',
  '/js/planner.js',
  '/js/storage.js',
  '/js/i18n.js',
  '/js/ics.js',
  '/js/share.js',
  '/manifest.webmanifest',
  '/assets/icon.svg',
  '/assets/icon-192.png'
];
const GSAP = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(SHELL);
    // GSAP olmadan da uygulama çalışır; alınamazsa kurulum bozulmasın
    try { await cache.add(new Request(GSAP, { mode: 'cors' })); } catch (e) { /* çevrimdışı */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && req.url !== GSAP) return;

  // Sayfa: önce ağ
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(VERSION);
        if (res.ok && !res.redirected) cache.put('/', res.clone());
        return res;
      } catch (e) {
        return (await caches.match('/')) || Response.error();
      }
    })());
    return;
  }

  // Dosyalar: önbellekten hemen, arka planda tazele
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req).then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    return cached || (await network) || Response.error();
  })());
});
