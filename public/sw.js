importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

const firebaseConfig = {
  projectId: "ai-studio-applet-webapp-c2b85",
  appId: "1:507901355965:web:30d72c54e22b15d28a54d4",
  apiKey: "AIzaSyBk5LP89IDx1xIEEhxbkz-dU6fyZOFJEYk",
  authDomain: "ai-studio-applet-webapp-c2b85.firebaseapp.com",
  messagingSenderId: "507901355965"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

const CACHE_NAME = 'ironlog-v12';

self.addEventListener('install', (event) => {
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

// Native fallback 'push' listener for maximum reliability (works when closed or asleep)
self.addEventListener('push', (event) => {
  console.log('[sw.js] Native push event received:', event);
  
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      console.warn("[sw.js] Failed to parse push data as JSON:", e);
      try {
        payload = { data: { body: event.data.text() } };
      } catch (_) {}
    }
  }

  console.log('[sw.js] Decoded push payload:', payload);

  // PREVENT DUPLICATES: If this is a standard FCM push payload containing a notification block,
  // the Firebase Messaging compat SDK is initialized above and will handle displaying it
  // automatically. We must NOT call registration.showNotification here to prevent duplicate popups.
  if (payload.notification) {
    console.log('[sw.js] Notification block detected, letting Firebase Messaging SDK handle display.');
    return;
  }

  // Extract fields from standard FCM or fallback data payload
  const title = payload.data?.title || 'IronLog';
  const body = payload.data?.body || 'Nova atividade no grupo!';
  const link = payload.data?.link || '/groups';

  const notificationOptions = {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'workout-notification',
    renotify: true,
    data: {
      ...payload.data,
      link
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, notificationOptions)
  );
});

// Handle background messages via Firebase SDK as well (if triggered)
messaging.onBackgroundMessage((payload) => {
  console.log('[sw.js] messaging.onBackgroundMessage triggered:', payload);
  
  const title = payload.notification?.title || payload.data?.title || 'IronLog';
  const link = payload.data?.link || payload.notification?.click_action || '/groups';
  const options = {
    body: payload.notification?.body || payload.data?.body || 'Nova atividade no grupo!',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'workout-notification',
    renotify: true,
    data: {
      ...payload.data,
      link
    }
  };

  return self.registration.showNotification(title, options);
});

// Intercept fetch requests for assets
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  // Do not cache API calls or Firebase/FCM calls
  if (
    request.url.includes('/api/') || 
    request.url.includes('googleapis.com') ||
    request.url.includes('firebase')
  ) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            return caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, networkResponse.clone());
              return networkResponse;
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// Handle clicking on notifications
self.addEventListener('notificationclick', (event) => {
  console.log('[sw.js] Notification click received.');
  event.notification.close();

  // Safeguard: parse the link relative to current origin to form an absolute URL
  const linkToOpen = event.notification.data?.link || '/groups';
  const absoluteUrl = new URL(linkToOpen, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((windowClients) => {
      // 1. If we have an existing open window under the target link, focus on it
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === absoluteUrl && 'focus' in client) {
          return client.focus();
        }
      }
      
      // 2. Otherwise open a new tab/window for the link
      if (clients.openWindow) {
        return clients.openWindow(absoluteUrl);
      }
    })
  );
});
