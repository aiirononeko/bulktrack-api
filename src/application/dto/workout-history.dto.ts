export interface DailyWorkoutSummaryDTO {
  date: string;
  exercises: {
    exerciseId: string;
    exerciseName: string;
  }[];
  totalVolume: number;
  avgRM: number | null;
  setCount: number;
}

export interface ExerciseDetailDTO {
  exerciseId: string;
  exerciseName: string;
  sets: WorkoutSetDTO[];
  totalVolume: number;
  avgRM: number | null;
  muscleVolumeBreakdown: MuscleVolumeBreakdownDTO[];
}

export interface WorkoutSetDTO {
  id: string;
  exerciseId: string;
  setNumber: number;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  notes: string | null;
  performedAt: string;
}

export interface MuscleVolumeBreakdownDTO {
  muscleGroupId: number;
  muscleGroupName: string;
  effectiveVolume: number;
}

export interface DailyWorkoutDetailDTO {
  date: string;
  totalVolume: number;
  avgRM: number | null;
  exercises: ExerciseDetailDTO[];
}
