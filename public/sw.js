// PontoApp Service Worker
const CACHE_NAME = 'pontoapp-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
];

// Instala e faz cache dos assets estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Ativa e remove caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Estratégia: Network first, fallback para cache (para o app shell)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignora requisições ao Firestore/Firebase (sempre online)
  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis.com')) {
    return;
  }

  // Para navegação (HTML), retorna index.html do cache se offline
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match('/index.html').then((r) => r ?? fetch(event.request))
      )
    );
    return;
  }

  // Para outros assets: cache first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

// Recebe mensagens push (quando vier de Cloud Functions no futuro)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { title: 'PontoApp', body: event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(data.title || 'PontoApp', {
      body: data.body || '',
      icon: '/icons/icon-192x192.svg',
      badge: '/icons/icon-32x32.svg',
      data: data,
    })
  );
});

// Clique na notificação — abre o app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow('/');
    })
  );
});
