import { 
  updateDoc, 
  getDocs, 
  query, 
  orderBy,
  doc
} from 'firebase/firestore';
import { 
  WorkoutPlan, 
  WorkoutSession, 
  ExerciseLog 
} from './db';
import { getCollectionRef, saveToCloud } from './firebase';

export const calculateEstimatedDuration = (plan: WorkoutPlan) => {
  const restTime = plan.exercises.reduce((acc, ex) => {
    const sets = ex.targetSets || 3;
    const rest = parseInt(String(ex.restTimer).split(',')[0]) || 60;
    return acc + (sets * rest);
  }, 0);
  const workTime = plan.exercises.length * 5 * 60; // 5 mins per exercise
  return Math.ceil((restTime + workTime) / 60);
};

export const startEmptyWorkoutHelper = (plan: WorkoutPlan): WorkoutSession => {
  const exercises: ExerciseLog[] = plan.exercises.map(pe => ({
    exerciseId: pe.exerciseId,
    exerciseName: '', // Will be filled by ActiveWorkoutOverlay
    restTimer: pe.restTimer,
    targetReps: pe.targetReps,
    isVariationPerSet: pe.isVariationPerSet,
    targetDuration: pe.targetDuration,
    sets: Array.from({ length: pe.targetSets }, () => ({
      weight: 0,
      reps: 0,
      completed: false,
      timestamp: Date.now()
    }))
  }));

  return {
    id: crypto.randomUUID(),
    workoutPlanId: plan.id,
    workoutPlanName: plan.name,
    date: Date.now(),
    duration: 0,
    exercises,
    totalVolume: 0,
    isCompleted: false
  };
};

export const rotateWorkoutPlans = async (planId: string) => {
  try {
    const plansSnap = await getDocs(query(getCollectionRef('plans'), orderBy('order')));
    const allPlans = plansSnap.docs.map(d => ({ ...d.data(), firebaseId: d.id } as any));
    
    // Find next order
    const maxOrder = Math.max(...allPlans.map((p: any) => p.order));
    
    const targetPlan = allPlans.find((p: any) => p.id === planId);
    if (targetPlan) {
      const planRef = getCollectionRef('plans');
      // Set target to maxOrder + 1
      await updateDoc(doc(planRef, targetPlan.firebaseId), {
        order: maxOrder + 1,
        lastPerformed: Date.now()
      });
      
      // Re-normalize all orders to 0...N
      const updatedSnap = await getDocs(query(getCollectionRef('plans'), orderBy('order')));
      const sortedPlans = updatedSnap.docs.map(d => ({ firebaseId: d.id }));
      for (let i = 0; i < sortedPlans.length; i++) {
        await updateDoc(doc(planRef, sortedPlans[i].firebaseId), {
          order: i
        });
      }
    }
  } catch (err) {
    console.error("Error rotating plans:", err);
  }
};

