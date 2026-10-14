// Service worker – díky němu aplikace funguje i bez internetu.
//
// Jak to funguje:
// 1. Při instalaci stáhne všechny soubory ze seznamu FILES do cache prohlížeče.
// 2. Každý další požadavek obslouží nejdřív z cache (cache-first), ze sítě jen to, co v cache není.
// 3. Při aktivaci nové verze smaže cache starých verzí.
//
// DŮLEŽITÉ: Při každé změně obsahu nebo kódu zvyš CACHE_VERSION. Prohlížeč pozná novou
// verzi jen podle toho, že se změnil tento soubor – jinak mobil dál ukazuje starou verzi.
// Nová verze se stáhne při otevření aplikace a zobrazí se po dalším obnovení stránky.
const CACHE_VERSION = 32;
const CACHE_NAME = `hypertrophica-v${CACHE_VERSION}`;

// Všechny soubory, které aplikace potřebuje. Nový soubor (modul, ikona, data) sem přidej.
const FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './js/backup.js',
  './js/bodymap.js',
  './js/favorites.js',
  './js/filters.js',
  './js/i18n.js',
  './js/log.js',
  './js/plan.js',
  './js/theme.js',
  './data/exercises.json',
  './data/muscles.json',
  './i18n/cs.json',
  './assets/body-map.svg',
  './assets/fonts/barlow-condensed-latin-600-normal.woff2',
  './assets/fonts/barlow-condensed-latin-ext-600-normal.woff2',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // cache: 'reload' = stáhni soubory vždy znovu ze serveru. Bez toho by je prohlížeč mohl
      // vzít ze své běžné HTTP cache (GitHub Pages povoluje soubory držet 10 minut)
      // a nová verze aplikace by se uložila se starými soubory.
      .then((cache) => cache.addAll(FILES.map((url) => new Request(url, { cache: 'reload' }))))
      // Nová verze se aktivuje hned, nečeká na zavření všech oken aplikace.
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((name) => name.startsWith('hypertrophica-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      ))
      // Převezme kontrolu i nad už otevřenými stránkami.
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Cachují se jen běžná čtení (GET) vlastních souborů, cizí adresy jdou rovnou na síť.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).catch((error) => {
        // Offline a stránka není v cache (např. adresa s parametry) → vrať hlavní stránku.
        if (request.mode === 'navigate') return caches.match('./index.html');
        throw error;
      });
    })
  );
});
