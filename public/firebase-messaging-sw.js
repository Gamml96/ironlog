// Scripts for firebase messaging service worker
importScripts('https://www.gstatic.com/firebasejs/11.4.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.4.1/firebase-messaging-compat.js');

firebase.initializeApp({
  projectId: "ai-studio-applet-webapp-c2b85",
  appId: "1:507901355965:web:30d72c54e22b15d28a54d4",
  apiKey: "AIzaSyBk5LP89IDx1xIEEhxbkz-dU6fyZOFJEYk",
  authDomain: "ai-studio-applet-webapp-c2b85.firebaseapp.com",
  messagingSenderId: "507901355965"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  if (payload.notification) {
    const notificationTitle = payload.notification.title || 'IronLog';
    const notificationOptions = {
      body: payload.notification.body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: payload.data
    };
    return self.registration.showNotification(notificationTitle, notificationOptions);
  }
});

// Fallback push listener for some browsers
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    console.log('Push event received:', data);
    
    // Only show if it's not handled by onBackgroundMessage
    // (onBackgroundMessage is usually preferred for FCM)
    if (data.notification) {
      const title = data.notification.title;
      const options = {
        body: data.notification.body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        data: data.data
      };
      event.waitUntil(self.registration.showNotification(title, options));
    }
  }
});
