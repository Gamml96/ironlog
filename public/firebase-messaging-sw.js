// Scripts for firebase messaging service worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  projectId: "ai-studio-applet-webapp-c2b85",
  appId: "1:507901355965:web:30d72c54e22b15d28a54d4",
  apiKey: "AIzaSyBk5LP89IDx1xIEEhxbkz-dU6fyZOFJEYk",
  authDomain: "ai-studio-applet-webapp-c2b85.firebaseapp.com",
  messagingSenderId: "507901355965"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title || 'Novo Alerta IronLog';
  const notificationOptions = {
    body: payload.notification.body || 'Alguém pontuou no grupo!',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
