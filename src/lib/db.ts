export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  secondaryMuscles?: string[];
  isCustom?: boolean;
}

export interface SetLog {
  weight: number;
  reps: number;
  duration?: number; // in seconds, for cardio
  rpe?: number;
  completed: boolean;
  timestamp: number;
}

export interface ExerciseLog {
  exerciseId: string;
  exerciseName: string;
  restTimer: number; // copied from plan
  targetReps?: string; 
  targetDuration?: number; // in seconds
  isVariationPerSet?: boolean;
  sets: SetLog[];
  notes?: string;
}

export interface WorkoutSession {
  id: string;
  workoutPlanId: string;
  workoutPlanName: string;
  date: number;
  duration?: number; // in seconds
  exercises: ExerciseLog[];
  totalVolume: number;
  isCompleted: boolean;
}

export interface WorkoutPlanExercise {
  exerciseId: string;
  targetSets: number;
  targetReps: string; // e.g., "8-12" or "12,10,8"
  targetDuration?: number; // in seconds
  isVariationPerSet?: boolean;
  notes?: string;
  restTimer: number; // in seconds
}

export interface WorkoutPlan {
  id: string;
  name: string;
  exercises: WorkoutPlanExercise[];
  order: number;
}

export interface UserStats {
  id: string;
  bodyWeightRecords: { date: number; weight: number }[];
  streak: number;
  lastWorkoutDate?: number;
}

export interface PersonalRecord {
  exerciseId: string;
  exerciseName: string;
  weight: number;
  reps: number;
  date: number;
  sessionId: string;
}

export interface Group {
  id: string;
  name: string;
  inviteCode: string;
  creatorId: string;
  memberIds: string[];
  createdAt: number;
  startDate: number;
  endDate: number;
  rankingType: 'workouts' | 'frequency';
}

export interface GroupMemberStats {
  userId: string;
  displayName: string;
  photoURL?: string;
  totalVolume: number;
  workoutCount: number;
  lastWorkoutDate?: number;
}

export const DEFAULT_EXERCISES: Exercise[] = [
  // Peito
  { id: 'p1', name: 'Supino Reto com Barra', muscleGroup: 'Peito' },
  { id: 'p2', name: 'Supino Inclinado com Halteres', muscleGroup: 'Peito' },
  { id: 'p3', name: 'Crucifixo Máquina', muscleGroup: 'Peito' },
  { id: 'p4', name: 'Crossover Polia Alta', muscleGroup: 'Peito' },
  { id: 'p5', name: 'Flexão de Braços', muscleGroup: 'Peito' },
  // Costas
  { id: 'c1', name: 'Puxada Pulley Aberta', muscleGroup: 'Costas' },
  { id: 'c2', name: 'Remada Curvada com Barra', muscleGroup: 'Costas' },
  { id: 'c3', name: 'Remada Baixa Triângulo', muscleGroup: 'Costas' },
  { id: 'c4', name: 'Puxada Unilateral Halter (Serrote)', muscleGroup: 'Costas' },
  { id: 'c5', name: 'Levantamento Terra', muscleGroup: 'Costas' },
  // Pernas
  { id: 'l1', name: 'Agachamento Livre com Barra', muscleGroup: 'Pernas' },
  { id: 'l2', name: 'Leg Press 45°', muscleGroup: 'Pernas' },
  { id: 'l3', name: 'Cadeira Extensora', muscleGroup: 'Pernas' },
  { id: 'l4', name: 'Mesa Flexora', muscleGroup: 'Pernas' },
  { id: 'l5', name: 'Afundo com Halteres', muscleGroup: 'Pernas' },
  { id: 'l6', name: 'Elevação de Panturrilha em Pé', muscleGroup: 'Pernas' },
  // Ombros
  { id: 'o1', name: 'Desenvolvimento com Halteres', muscleGroup: 'Ombros' },
  { id: 'o2', name: 'Elevação Lateral', muscleGroup: 'Ombros' },
  { id: 'o3', name: 'Elevação Frontal', muscleGroup: 'Ombros' },
  { id: 'o4', name: 'Crucifixo Inverso', muscleGroup: 'Ombros' },
  // Braços
  { id: 'b1', name: 'Rosca Direta com Barra W', muscleGroup: 'Braços' },
  { id: 'b2', name: 'Rosca Martelo', muscleGroup: 'Braços' },
  { id: 'b3', name: 'Tríceps Corda', muscleGroup: 'Braços' },
  { id: 'b4', name: 'Tríceps Testa com Barra', muscleGroup: 'Braços' },
  { id: 'b5', name: 'Mergulho em Bancos', muscleGroup: 'Braços' },
  // Core
  { id: 'a1', name: 'Abdominal Supra', muscleGroup: 'Core' },
  { id: 'a2', name: 'Prancha Isométrica', muscleGroup: 'Core' },
  { id: 'a3', name: 'Elevação de Pernas', muscleGroup: 'Core' },
  // Cardio
  { id: 'cd1', name: 'Corrida na Esteira', muscleGroup: 'Cardio' },
  { id: 'cd2', name: 'Bicicleta Ergométrica', muscleGroup: 'Cardio' },
  { id: 'cd3', name: 'Elíptico', muscleGroup: 'Cardio' },
  { id: 'cd4', name: 'Pular Corda', muscleGroup: 'Cardio' },
  { id: 'cd5', name: 'Remo', muscleGroup: 'Cardio' },
];
