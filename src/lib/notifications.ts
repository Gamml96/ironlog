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
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    const messaging = getMessaging();
    const token = await getToken(messaging, {
      serviceWorkerRegistration: registration
      // If we had a VAPID key, we would put it here:
      // vapidKey: '...'
    });

    if (token && auth.currentUser) {
      const tokenRef = doc(collection(db, "users", auth.currentUser.uid, "fcm_tokens"), token);
      await setDoc(tokenRef, {
        token,
        updatedAt: Date.now(),
        device: navigator.userAgent
      });
      console.log("FCM Token registered:", token);
      return token;
    }
  } catch (error) {
    console.error("Error registering FCM token:", error);
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
