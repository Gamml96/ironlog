importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  // These should be set based on your project configuration
  // The VAPID key is important for push notifications
  // Using placeholders as the actual values should be injected or hardcoded
});

const messaging = firebase.messaging();

// Esse listener é o que faz funcionar com app fechado
messaging.onBackgroundMessage((payload) => {
  console.log('Background message received: ', payload);
  self.registration.showNotification(
    payload.notification?.title ?? 'IronLog',
    {
      body: payload.notification?.body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: payload.data,
    }
  );
});
