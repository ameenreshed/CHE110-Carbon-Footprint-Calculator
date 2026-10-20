/* ==========================================================================
   Carbotrack — sw.js
   Minimal service worker. Handles notification clicks and push payloads.
   ========================================================================== */
'use strict';

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

/* Click handler — open or focus challenge.html */
self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const targetUrl = new URL('challenge.html', self.registration.scope).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (clientList) {
        for (let i = 0; i < clientList.length; i++) {
          const c = clientList[i];
          if (c.url.indexOf('challenge.html') !== -1 && 'focus' in c) {
            return c.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return null;
      })
  );
});

/* Push payload (if you ever add a backend) */
self.addEventListener('push', function (event) {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { /* ignore */ }

  const title = data.title || '🌿 Carbotrack Eco Challenge';
  const body  = data.body  || 'Time to mark today\'s eco action!';
  const url   = data.url   || 'challenge.html';

  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      tag: 'carbotrack-daily',
      renotify: true,
      data: { url: url }
    })
  );
});