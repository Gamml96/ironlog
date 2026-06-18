import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import admin from "firebase-admin";
import fs from "fs";

// Load firebase config for project ID
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));

// Initialize Firebase Admin
// In this environment, we might not have a service account file, but we can try initializing with just project ID
// or rely on ADC if available.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
db.settings({ databaseId: firebaseConfig.firestoreDatabaseId });
const fcm = admin.messaging();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/notify-group", async (req, res) => {
    const { groupId, userId, userName, workoutName, volume } = req.body;

    if (!groupId || !userId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      // 1. Get group members
      const groupDoc = await db.collection("groups").doc(groupId).get();
      if (!groupDoc.exists) {
        console.warn(`Notify Group: Group ${groupId} not found`);
        return res.status(404).json({ error: "Group not found" });
      }

      const groupData = groupDoc.data();
      const memberIds = groupData?.memberIds || [];
      
      // Filter out the sender
      const recipientIds = memberIds.filter((id: string) => id !== userId);
      console.log(`Group notification request for ${groupId}: ${memberIds.length} total members, ${recipientIds.length} recipients found.`);

      if (recipientIds.length === 0) {
        return res.json({ success: true, message: "No recipients to notify" });
      }

      // 2. Get FCM tokens for recipients
      const tokens: string[] = [];
      const tokenPromises = recipientIds.map(async (uid: string) => {
        try {
          const tokensSnapRef = db.collection("users").doc(uid).collection("fcm_tokens");
          console.log(`Fetching tokens for user ${uid} from path ${tokensSnapRef.path}`);
          const tokensSnap = await tokensSnapRef.get();
          tokensSnap.forEach(doc => {
            if (doc.data().token) {
              tokens.push(doc.data().token);
            }
          });
        } catch (e) {
          console.error(`Error fetching tokens for user ${uid}:`, e);
        }
      });

      await Promise.all(tokenPromises);
      console.log(`Found ${tokens.length} FCM tokens for recipients of group ${groupId}.`);

      if (tokens.length === 0) {
        console.warn(`No FCM tokens found for recipients in group ${groupId}. Directing recipients to register for push notifications.`);
        return res.json({ success: true, message: "No tokens found" });
      }

      // 3. Send notifications
      const uniqueTokens = Array.from(new Set(tokens));
      const host = req.headers['x-forwarded-host'] || req.get('host');
      const protocol = req.headers['x-forwarded-proto'] || (host?.includes('localhost') ? 'http' : 'https');
      const absoluteLink = `${protocol}://${host}/groups`;

      const message = {
        notification: {
          title: `Treino Registrado no ${groupData?.name || 'Grupo'}!`,
          body: `${userName} acabou de detonar um treino de ${workoutName}! 🔥`,
        },
        webpush: {
          headers: {
            Urgency: "high",
          },
          notification: {
            title: `Treino Registrado no ${groupData?.name || 'Grupo'}!`,
            body: `${userName} acabou de detonar um treino de ${workoutName}! 🔥`,
            icon: "/favicon.ico",
            badge: "/favicon.ico",
            requireInteraction: true,
            actions: [
              {
                action: "view",
                title: "Ver Treino"
              }
            ]
          },
          fcmOptions: {
            link: absoluteLink
          }
        },
        data: {
          groupId,
          type: "workout_alert",
          link: absoluteLink
        },
        tokens: uniqueTokens,
      };

      try {
        console.log(`Attempting to send FCM multicast to ${uniqueTokens.length} tokens.`);
        const response = await fcm.sendEachForMulticast(message);
        console.log(`FCM send success for group ${groupId}. Success: ${response.successCount}, Failure: ${response.failureCount}`);
        
        res.json({ 
          success: true, 
          successCount: response.successCount, 
          failureCount: response.failureCount 
        });
      } catch (fcmError) {
        console.error("Error sending FCM notification:", fcmError);
        throw fcmError;
      }
    } catch (error) {
      console.error("Critical error in /api/notify-group:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
