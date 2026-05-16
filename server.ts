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
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const db = admin.firestore();
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
        return res.status(404).json({ error: "Group not found" });
      }

      const groupData = groupDoc.data();
      const memberIds = groupData?.memberIds || [];
      
      // Filter out the sender
      const recipientIds = memberIds.filter((id: string) => id !== userId);

      if (recipientIds.length === 0) {
        return res.json({ success: true, message: "No recipients" });
      }

      // 2. Get FCM tokens for recipients
      // We'll look for tokens in /users/{userId}/fcm_tokens/
      const tokens: string[] = [];
      const tokenPromises = recipientIds.map(async (uid: string) => {
        const tokensSnap = await db.collection("users").doc(uid).collection("fcm_tokens").get();
        tokensSnap.forEach(doc => {
          if (doc.data().token) {
            tokens.push(doc.data().token);
          }
        });
      });

      await Promise.all(tokenPromises);

      if (tokens.length === 0) {
        return res.json({ success: true, message: "No tokens found" });
      }

      // 3. Send notifications
      const message = {
        notification: {
          title: `Treino Registrado no ${groupData?.name || 'Grupo'}!`,
          body: `${userName} acabou de detonar um treino de ${workoutName} com ${volume.toLocaleString('pt-BR')}kg! 🔥`,
        },
        webpush: {
          headers: {
            Urgency: "high",
          },
          notification: {
            body: `${userName} acabou de detonar um treino de ${workoutName} com ${volume.toLocaleString('pt-BR')}kg! 🔥`,
            icon: "/favicon.ico",
            requireInteraction: true,
            actions: [
              {
                action: "view",
                title: "Ver Treino"
              }
            ]
          },
          fcmOptions: {
            link: "/groups"
          }
        },
        data: {
          groupId,
          type: "workout_alert"
        },
        tokens: Array.from(new Set(tokens)), // Unique tokens
      };

      const response = await fcm.sendEachForMulticast(message);
      
      console.log(`Successfully sent to ${response.successCount} tokens. ${response.failureCount} tokens failed.`);
      
      // Optional: Cleanup invalid tokens
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const error = resp.error;
            if (error?.code === 'messaging/registration-token-not-registered' ||
                error?.code === 'messaging/invalid-registration-token') {
              // Token is invalid, should be removed from DB
              const invalidToken = tokens[idx];
              console.log(`Cleaning up invalid token: ${invalidToken}`);
              // Note: We don't have the UID here easily without more lookups, 
              // but we can query by token if needed.
            }
          }
        });
      }
      
      res.json({ 
        success: true, 
        successCount: response.successCount, 
        failureCount: response.failureCount 
      });
    } catch (error) {
      console.error("Error sending notification:", error);
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
