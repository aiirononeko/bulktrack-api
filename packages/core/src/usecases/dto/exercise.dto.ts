export interface ExerciseDto {
  id: string;
  canonical_name: string;
  name: string;
  aliases: string[];
  default_muscle_id: number | null;
  is_compound: boolean;
  exercise_muscles: ExerciseMuscleDto[];
}

export interface ExerciseMuscleDto {
  muscle_id: number;
  relative_share: number;
  source_id?: string;
  source_details?: string;
}
