export enum RankingType {
  VOLUME = 'volume',
  SESSIONS = 'sessions',
  FREQUENCY = 'frequency',
  WORKOUTS = 'workouts'
}

export interface SetLog {
  weight: number;
  reps: number;
  completed: boolean;
  timestamp: number;
  duration?: number; // In seconds, for cardio
}

export interface ExerciseLog {
  exerciseId: string;
  exerciseName?: string;
  sets: SetLog[];
  restTimer?: string; // seconds, can be comma separated
  targetReps?: string; // target reps string
  isVariationPerSet?: boolean;
  targetDuration?: number; // for cardio
}

export interface WorkoutSession {
  id: string;
  workoutPlanId: string;
  workoutPlanName: string;
  date: number;
  duration: number; // seconds
  exercises: ExerciseLog[];
  totalVolume: number;
  isCompleted: boolean;
  notes?: string;
  image?: string; // URL for the workout photo
  lastUpdated?: number;
}

export interface WorkoutPlan {
  id: string;
  name: string;
  exercises: {
    exerciseId: string;
    targetSets: number;
    targetReps: string;
    restTimer: string;
    isVariationPerSet?: boolean;
    targetDuration?: number;
  }[];
  order: number;
  lastPerformed?: number;
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  isCustom?: boolean;
}

export interface PersonalRecord {
  exerciseId: string;
  exerciseName: string;
  weight: number;
  reps: number;
  date: number;
  muscleGroup?: string;
}

export interface GroupMember {
  uid: string;
  displayName: string;
  photoURL: string;
  joinedAt: number;
  role: 'admin' | 'member';
  stats?: {
    totalVolume: number;
    sessionsCount: number;
    lastActive: number;
  };
}

export interface GroupPost {
  id: string;
  groupId: string;
  userId: string;
  userName: string;
  userPhoto: string;
  type: 'text' | 'workout' | 'image';
  content: string;
  workoutData?: {
    workoutPlanName: string;
    totalVolume: number;
    duration: number;
    exercises: {
      exerciseName: string;
      setsCount: number;
    }[];
  };
  imageUrl?: string;
  likes: string[];
  comments: GroupComment[];
  createdAt: number;
  lastUpdated?: number;
}

export interface GroupComment {
  userId: string;
  userName: string;
  userPhoto: string;
  text: string;
  createdAt: number;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  inviteCode: string;
  members: Record<string, GroupMember>;
  memberIds: string[]; // For querying
  createdAt: number;
  createdBy: string;
  creatorId?: string; // Legacy support
  challengeActive: boolean;
  challengeStart?: number;
  challengeEnd?: number;
  startDate?: number; // Legacy support
  endDate?: number; // Legacy support
  challengeRankingType?: RankingType;
  rankingType?: RankingType; // Legacy support
}

export interface UserStats {
  id: string;
  totalVolume: number;
  sessionsCount: number;
  lastActive: number;
  weeklyGoalProgress?: number;
  streakDays?: number;
}
