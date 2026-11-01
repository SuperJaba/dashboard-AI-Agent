// Service Worker for AI Agents Command Center PWA & Web Push
const CACHE_NAME = 'agents-hub-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Network first for APIs, cache fallback for assets
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const cloned = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Push notification listener
self.addEventListener('push', (event) => {
  let data = { title: 'AI Agents Hub', body: 'Nowe zdarzenie w systemie!' };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch {
    data = { title: 'AI Agents Hub', body: event.data ? event.data.text() : '' };
  }

  const options = {
    body: data.body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    vibrate: [200, 100, 200],
    data: data.data || {},
    actions: [
      { action: 'approve', title: '✅ Zatwierdź' },
      { action: 'reject', title: '❌ Odrzuć' }
    ]
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification click listener
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  if (event.action === 'approve' && event.notification.data?.approvalId) {
    event.waitUntil(
      fetch(`/api/approvals/${event.notification.data.approvalId}/approve`, { method: 'POST' })
    );
    return;
  }

  if (event.action === 'reject' && event.notification.data?.approvalId) {
    event.waitUntil(
      fetch(`/api/approvals/${event.notification.data.approvalId}/reject`, { method: 'POST' })
    );
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
