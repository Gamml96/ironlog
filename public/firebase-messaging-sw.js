// Scripts for firebase messaging service worker
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

self.addEventListener('install', (event) => {
  console.log('[firebase-messaging-sw.js] Service Worker installing.');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[firebase-messaging-sw.js] Service Worker activating.');
  event.waitUntil(clients.claim());
});

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification?.title || 'IronLog';
  const notificationOptions = {
    body: payload.notification?.body || 'Nova atividade no grupo!',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: payload.data,
    tag: 'workout-notification', // Group notifications together
    renotify: true
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click Received.');
  event.notification.close();

  const urlToOpen = event.notification.data?.link || '/groups';

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((windowClients) => {
      // If a window is already open, focus it
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
