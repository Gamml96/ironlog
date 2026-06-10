import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { format } from 'date-fns';
import { 
  getFirestore, 
  initializeFirestore,
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  increment, 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot,
  getDocs,
  getDocFromServer,
  deleteDoc,
  writeBatch,
  where,
  arrayUnion,
  arrayRemove,
  writeBatch as firebaseWriteBatch
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

// Re-export Storage primitives
export { ref, uploadBytes, getDownloadURL, deleteObject };
import { DEFAULT_EXERCISES, Exercise, PersonalRecord, WorkoutSession, SetLog } from './db';

// Re-export Firestore primitives
export { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  increment, 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot,
  getDocs,
  getDocFromServer,
  deleteDoc,
  writeBatch,
  where,
  arrayUnion,
  arrayRemove
};

import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export { onAuthStateChanged, signOut };
export const storage = getStorage(app);

// Use getFirestore with the database ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export const googleProvider = new GoogleAuthProvider();

// Connection test as per integration guidelines
async function testConnection() {
  try {
    // Attempt to fetch a doc from the server to verify connectivity
    await getDocFromServer(doc(db, '_connection_test_', 'test'));
    console.log("Firestore connection verified.");
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    // "Missing or insufficient permissions" actually means we reached the server successfully
    if (errorMsg.includes('insufficient permissions')) {
      console.log("Firestore connection verified (via permission response).");
      return;
    }

    if (errorMsg.includes('the client is offline') || errorMsg.includes('unavailable')) {
      console.error("Firestore connectivity error: The client is offline or the backend is unavailable. Please check your Firebase configuration or internet connection.");
      console.error("Debug Info:", {
        projectId: firebaseConfig.projectId,
        databaseId: firebaseConfig.firestoreDatabaseId,
        error: errorMsg
      });
    } else {
      console.error("Firestore connectivity check failed:", error);
    }
  }
}
testConnection();

// Database Helper functions for user subcollections
export const getCollectionRef = (sub: string) => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Auth required");
  return collection(db, 'users', uid, sub);
};

export const getDocRef = (sub: string, id: string) => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Auth required");
  return doc(db, 'users', uid, sub, id);
};

export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Create/Update user in Firestore
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        displayName: user.displayName || 'Guerreiro IronLog',
        photoURL: user.photoURL || '',
        totalVolume: 0,
        totalWorkouts: 0,
        showInRanking: true,
        lastActive: Date.now()
      });
    } else {
      await updateDoc(userRef, {
        displayName: user.displayName || (userSnap.data() as any).displayName,
        photoURL: user.photoURL || (userSnap.data() as any).photoURL,
        lastActive: Date.now()
      });
    }

    // Ensure exercises are seeded if empty (for new or partial migrated users)
    const exercisesRef = collection(db, 'users', user.uid, 'exercises');
    const exercisesSnap = await getDocs(exercisesRef);
    if (exercisesSnap.empty) {
      const batch = firebaseWriteBatch(db);
      DEFAULT_EXERCISES.forEach(ex => {
        const exRef = doc(exercisesRef, ex.id);
        batch.set(exRef, { ...ex, uid: user.uid });
      });
      await batch.commit();
    }

    return user;
  } catch (error) {
    console.error("Error logging in with Google:", error);
    throw error;
  }
}

export async function updateUserStats(uid: string, volumeIncrement: number) {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  const data = snap.data();
  
  const now = new Date();
  const weekId = format(now, 'yyyy-ww'); 
  const monthId = format(now, 'yyyy-MM');
  const yearId = format(now, 'yyyy');

  const lastActiveDate = data?.lastActive ? new Date(data.lastActive).toDateString() : '';
  const isNewDay = lastActiveDate !== now.toDateString();

  const updates: any = {
    totalVolume: increment(volumeIncrement),
    totalWorkouts: increment(1),
    lastActive: Date.now()
  };

  if (isNewDay) {
    updates.totalFrequency = increment(1);
  }

  // Weekly Stats
  if (data?.weekly?.id === weekId) {
    updates['weekly.volume'] = increment(volumeIncrement);
    updates['weekly.workouts'] = increment(1);
    if (isNewDay) updates['weekly.frequency'] = increment(1);
  } else {
    updates.weekly = { id: weekId, volume: volumeIncrement, workouts: 1, frequency: 1 };
  }

  // Monthly Stats
  if (data?.monthly?.id === monthId) {
    updates['monthly.volume'] = increment(volumeIncrement);
    updates['monthly.workouts'] = increment(1);
    if (isNewDay) updates['monthly.frequency'] = increment(1);
  } else {
    updates.monthly = { id: monthId, volume: volumeIncrement, workouts: 1, frequency: 1 };
  }

  // Yearly Stats
  if (data?.yearly?.id === yearId) {
    updates['yearly.volume'] = increment(volumeIncrement);
    updates['yearly.workouts'] = increment(1);
    if (isNewDay) updates['yearly.frequency'] = increment(1);
  } else {
    updates.yearly = { id: yearId, volume: volumeIncrement, workouts: 1, frequency: 1 };
  }

  await updateDoc(userRef, updates);
}

export async function updateUserDisplayName(uid: string, newName: string) {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    displayName: newName,
    lastActive: Date.now()
  });
}

export async function logWeight(uid: string, weight: number) {
  const ref = collection(db, 'users', uid, 'weight_history');
  const id = format(new Date(), 'yyyy-MM-dd');
  await setDoc(doc(ref, id), {
    id,
    weight,
    date: Date.now()
  });
}

export async function deleteSession(uid: string, sessionId: string, volume: number, date: number) {
  const sessionRef = doc(db, 'users', uid, 'sessions', sessionId);
  await deleteDoc(sessionRef);
  
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  const data = snap.data();

  const sessionDate = new Date(date);
  const weekId = format(sessionDate, 'yyyy-ww');
  const monthId = format(sessionDate, 'yyyy-MM');
  const yearId = format(sessionDate, 'yyyy');

  const updates: any = {
    totalVolume: increment(-volume),
    totalWorkouts: increment(-1)
  };

  if (data?.weekly?.id === weekId) {
    updates['weekly.volume'] = increment(-volume);
    updates['weekly.workouts'] = increment(-1);
  }
  if (data?.monthly?.id === monthId) {
    updates['monthly.volume'] = increment(-volume);
    updates['monthly.workouts'] = increment(-1);
  }
  if (data?.yearly?.id === yearId) {
    updates['yearly.volume'] = increment(-volume);
    updates['yearly.workouts'] = increment(-1);
  }

  await updateDoc(userRef, updates);
}
// Data Methods
export async function saveToCloud(collectionName: string, data: any) {
  const ref = getDocRef(collectionName, data.id || 'default');
  await setDoc(ref, data, { merge: true });
}

export async function deleteFromCloud(collectionName: string, id: string) {
  const ref = getDocRef(collectionName, id);
  await deleteDoc(ref);
}

export async function getAllFromCloud(collectionName: string) {
  const ref = getCollectionRef(collectionName);
  const snap = await getDocs(ref);
  return snap.docs.map(d => d.data());
}

export async function updatePersonalRecords(uid: string, session: WorkoutSession) {
  const recordsRef = collection(db, 'users', uid, 'personal_records');
  const batch = firebaseWriteBatch(db);
  let hasUpdates = false;

  // Fetch all exercises to resolve names and muscle groups
  const exercisesSnap = await getDocs(collection(db, 'users', uid, 'exercises'));
  const exercisesDict: Record<string, { name: string, muscleGroup: string }> = {};
  
  // Seed with defaults first
  DEFAULT_EXERCISES.forEach(ex => {
    exercisesDict[ex.id] = { name: ex.name, muscleGroup: ex.muscleGroup };
  });
  
  // Overwrite with user-specific data (custom or edited)
  exercisesSnap.docs.forEach(d => {
    const data = d.data();
    exercisesDict[d.id] = { name: data.name, muscleGroup: data.muscleGroup || 'Extra' };
  });

  // Group best sets by exerciseId across the whole session
  const bestSetsByExercise: Record<string, SetLog> = {};

  for (const exLog of session.exercises) {
    const completedSets = exLog.sets.filter(s => s.completed);
    if (completedSets.length === 0) continue;

    const currentBest = completedSets.reduce((prev, curr) => {
      if (curr.weight > prev.weight) return curr;
      if (curr.weight === prev.weight && curr.reps > prev.reps) return curr;
      return prev;
    }, completedSets[0]);

    const existingBest = bestSetsByExercise[exLog.exerciseId];
    if (!existingBest || 
        currentBest.weight > existingBest.weight || 
        (currentBest.weight === existingBest.weight && currentBest.reps > existingBest.reps)) {
      bestSetsByExercise[exLog.exerciseId] = currentBest;
    }
  }

  for (const [exerciseId, bestSet] of Object.entries(bestSetsByExercise)) {
    // Treat bodyweight exercises (0kg) as valid if reps > 0
    if (bestSet.weight > 0 || bestSet.reps > 0) {
      const recordRef = doc(recordsRef, exerciseId);
      const recordSnap = await getDoc(recordRef);
      
      const info = exercisesDict[exerciseId];
      // Try to find name in session first if provided
      const sessionEx = session.exercises.find(e => e.exerciseId === exerciseId);
      const exerciseName = sessionEx?.exerciseName || info?.name || 'Exercício';
      const muscleGroup = info?.muscleGroup || 'Extra';
      
      let shouldUpdate = false;
      if (!recordSnap.exists()) {
        shouldUpdate = true;
      } else {
        const currentPR = recordSnap.data() as PersonalRecord;
        const currentWeight = Number(currentPR.weight || 0);
        const currentReps = Number(currentPR.reps || 0);

        if (Number(bestSet.weight) > currentWeight) {
          shouldUpdate = true;
        } else if (Math.abs(Number(bestSet.weight) - currentWeight) < 0.01 && Number(bestSet.reps) > currentReps) {
          shouldUpdate = true;
        }
      }

      if (shouldUpdate) {
        batch.set(recordRef, {
          exerciseId,
          exerciseName,
          muscleGroup,
          weight: Number(bestSet.weight),
          reps: Number(bestSet.reps || 0),
          date: session.date,
          sessionId: session.id
        });
        hasUpdates = true;
      }
    }
  }

  if (hasUpdates) {
    await batch.commit();
  }
}

export async function deletePersonalRecord(uid: string, exerciseId: string) {
  const ref = doc(db, 'users', uid, 'personal_records', exerciseId);
  await deleteDoc(ref);
}
