import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { db, auth } from "./firebase";
import { doc, setDoc, collection } from "firebase/firestore";

export async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    console.log("This browser does not support notifications.");
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    return registerFCMToken();
  }
  return null;
}

export async function registerFCMToken() {
  try {
    if (!('serviceWorker' in navigator)) {
      console.log('Service Worker not supported');
      return null;
    }

    // Register service worker explicitly
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });

    try {
      await registration.update();
      console.log('Service worker checked for updates');
    } catch (e) {
      console.warn('Silent service worker update check caught error:', e);
    }

    // Wait for the service worker to be ready
    await navigator.serviceWorker.ready;

    const messaging = getMessaging();
    console.log('Attempting to get FCM token...');
    
    const vapidKey = (import.meta as any).env.VITE_VAPID_KEY;
    const token = await getToken(messaging, {
      serviceWorkerRegistration: registration,
      vapidKey: vapidKey || undefined
    });

    if (token && auth.currentUser) {
      console.log('FCM Token received:', token);
      const tokenRef = doc(collection(db, "users", auth.currentUser.uid, "fcm_tokens"), token);
      await setDoc(tokenRef, {
        token,
        updatedAt: Date.now(),
        device: navigator.userAgent
      });
      return token;
    } else {
      console.warn('No FCM token received or user not logged in.');
    }
  } catch (error) {
    console.error("Error registering FCM token:", error);
    if (error instanceof Error && error.message.includes('permission')) {
      console.error("Push permission denied by user or browser.");
    }
  }
  return null;
}

export async function notifyGroup(groupId: string, userId: string, userName: string, workoutName: string, volume: number) {
  try {
    const response = await fetch("/api/notify-group", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        groupId,
        userId,
        userName,
        workoutName,
        volume
      }),
    });
    return await response.json();
  } catch (error) {
    console.error("Error calling notify-group API:", error);
    return { error: "Failed to notify group" };
  }
}

export function onMessageListener() {
  const messaging = getMessaging();
  return new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });
}
