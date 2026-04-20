import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { format } from 'date-fns';
import { 
  getFirestore, 
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
  deleteDoc,
  writeBatch,
  where,
  arrayUnion,
  arrayRemove,
  getDocFromServer,
  writeBatch as firebaseWriteBatch
} from 'firebase/firestore';
import { DEFAULT_EXERCISES, Exercise, PersonalRecord, WorkoutSession } from './db';

export { 
  getFirestore, 
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
  deleteDoc,
  writeBatch,
  where,
  arrayUnion,
  arrayRemove,
  getDocFromServer
};
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// CRITICAL: Test Firestore connection on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection successful");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. Firestore is offline.");
    } else {
      console.error("Firestore connection error:", error);
    }
  }
}
testConnection();

export const googleProvider = new GoogleAuthProvider();

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
  const today = format(now, 'yyyy-MM-dd');
  const lastWorkout = data?.lastWorkoutDate ? format(new Date(data.lastWorkoutDate), 'yyyy-MM-dd') : null;

  let newStreak = data?.streak || 0;
  if (!lastWorkout) {
    newStreak = 1;
  } else if (lastWorkout !== today) {
    const d1 = new Date(lastWorkout);
    const d2 = new Date(today);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      newStreak += 1;
    } else if (diffDays > 1) {
      newStreak = 1;
    }
  }

  const updates: any = {
    totalVolume: increment(volumeIncrement),
    totalWorkouts: lastWorkout !== today ? increment(1) : increment(0),
    lastActive: Date.now(),
    lastWorkoutDate: Date.now(),
    streak: newStreak
  };

  // Weekly Stats
  if (data?.weekly?.id === weekId) {
    updates['weekly.volume'] = increment(volumeIncrement);
    updates['weekly.workouts'] = increment(1);
  } else {
    updates.weekly = { id: weekId, volume: volumeIncrement, workouts: 1 };
  }

  // Monthly Stats
  if (data?.monthly?.id === monthId) {
    updates['monthly.volume'] = increment(volumeIncrement);
    updates['monthly.workouts'] = increment(1);
  } else {
    updates.monthly = { id: monthId, volume: volumeIncrement, workouts: 1 };
  }

  // Yearly Stats
  if (data?.yearly?.id === yearId) {
    updates['yearly.volume'] = increment(volumeIncrement);
    updates['yearly.workouts'] = increment(1);
  } else {
    updates.yearly = { id: yearId, volume: volumeIncrement, workouts: 1 };
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
  await setDoc(ref, data);
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

  // Fetch all exercises to resolve names if session has empty names
  const exercisesSnap = await getDocs(collection(db, 'users', uid, 'exercises'));
  const exercisesDict: Record<string, string> = {};
  exercisesSnap.docs.forEach(d => exercisesDict[d.id] = d.data().name);

  for (const exLog of session.exercises) {
    const completedSets = exLog.sets.filter(s => s.completed);
    if (completedSets.length === 0) continue;

    const bestSet = completedSets.reduce((prev, curr) => {
      if (curr.weight > prev.weight) return curr;
      if (curr.weight === prev.weight && curr.reps > prev.reps) return curr;
      return prev;
    }, completedSets[0]);

    if (bestSet.weight > 0) {
      const recordRef = doc(recordsRef, exLog.exerciseId);
      const recordSnap = await getDoc(recordRef);
      const exerciseName = exLog.exerciseName || exercisesDict[exLog.exerciseId] || 'Exercício';
      
      let shouldUpdate = false;
      if (!recordSnap.exists()) {
        shouldUpdate = true;
      } else {
        const currentPR = recordSnap.data() as PersonalRecord;
        if (bestSet.weight > currentPR.weight) {
          shouldUpdate = true;
        } else if (bestSet.weight === currentPR.weight && bestSet.reps > currentPR.reps) {
          shouldUpdate = true;
        }
      }

      if (shouldUpdate) {
        batch.set(recordRef, {
          exerciseId: exLog.exerciseId,
          exerciseName: exerciseName,
          weight: bestSet.weight,
          reps: bestSet.reps,
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

export async function recalculateUserStats(uid: string) {
  try {
    const sessionsRef = collection(db, 'users', uid, 'sessions');
    const sessionsSnap = await getDocs(sessionsRef);
    let totalVolume = 0;
    const workoutDays = new Set<string>();

    sessionsSnap.docs.forEach(doc => {
      const session = doc.data() as WorkoutSession;
      if (!session.isCompleted) return;
      totalVolume += session.totalVolume || 0;
      workoutDays.add(format(new Date(session.date), 'yyyy-MM-dd'));
    });

    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      totalVolume,
      totalWorkouts: workoutDays.size
    });
    console.log("Stats recalculated for", uid);
  } catch (err) {
    console.error("Error recalculating stats:", err);
    throw err;
  }
}

export async function syncAllUserStats() {
  const usersSnap = await getDocs(collection(db, 'users'));
  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    await recalculateUserStats(uid);
  }
}

export async function deleteAllWorkoutsGlobal() {
  const usersSnap = await getDocs(collection(db, 'users'));
  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const sessionsRef = collection(db, 'users', uid, 'sessions');
    const sessionsSnap = await getDocs(sessionsRef);
    const batch = firebaseWriteBatch(db);
    sessionsSnap.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    batch.update(doc(db, 'users', uid), {
      totalVolume: 0,
      totalWorkouts: 0,
      streak: 0
    });
    await batch.commit();
  }
}
