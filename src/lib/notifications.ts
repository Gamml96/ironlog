import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { db, auth, app } from "./firebase";
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
    const registration = await navigator.serviceWorker.register('/sw.js');

    try {
      await registration.update();
      console.log('Service worker checked for updates');
    } catch (e) {
      console.warn('Silent service worker update check caught error:', e);
    }

    // Wait for the service worker to be ready
    await navigator.serviceWorker.ready;

    const messaging = getMessaging(app);
    console.log('Attempting to get FCM token...');
    
    const customVapid = typeof window !== 'undefined' ? localStorage.getItem('custom_vapid_key') : null;
    const vapidKey = customVapid || (import.meta as any).env.VITE_VAPID_KEY || 'BPgNlV0Sq2JP_-hT0G6Y4lCT1J9ZOpfiWYyjhhsfmjFN9pjz2qAbkMPiLsu0xZAgOfoUGzOIPKWVZvt3CIGQ8HQ';
    const tokenOptions: any = {
      serviceWorkerRegistration: registration,
    };
    if (vapidKey) {
      tokenOptions.vapidKey = vapidKey;
    }
    const token = await getToken(messaging, tokenOptions);

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
      throw new Error('Usuário não autenticado ou token vazio.');
    }
  } catch (error) {
    console.error("Error registering FCM token:", error);
    if (error instanceof Error && error.message.includes('permission')) {
      console.error("Push permission denied by user or browser.");
    }
    throw error;
  }
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

export function subscribeToForegroundMessages(callback: (payload: any) => void) {
  try {
    const messaging = getMessaging(app);
    return onMessage(messaging, (payload) => {
      console.log("Foreground message received:", payload);
      callback(payload);
    });
  } catch (error) {
    console.error("Error subscribing to foreground messages:", error);
    return () => {};
  }
}

export function onMessageListener() {
  const messaging = getMessaging(app);
  return new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });
}
