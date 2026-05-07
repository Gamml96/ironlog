import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { WorkoutSession } from "./db";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const calculateSessionVolume = (session: WorkoutSession) => {
  return session.exercises.reduce((total, ex) => {
    const exVol = ex.sets.reduce((sum, set) => {
      if (!set.completed) return sum;
      return sum + (set.weight * set.reps);
    }, 0);
    return total + exVol;
  }, 0);
};

export const formatTime = (s: number) => {
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};
