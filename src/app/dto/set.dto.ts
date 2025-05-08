import * as v from 'valibot';

// OpenAPIの ExerciseSetCreate スキーマに相当 (sessionIdはパスから、performedAtはサーバーで設定可能)
export const AddSetRequestSchema = v.objectAsync({
  exerciseId: v.pipe(v.string(), v.uuid("Exercise ID must be a valid UUID.")),
  // setNumber: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1)))), // setNumber はサーバーサイドで自動採番を推奨
  reps: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0)))),
  weight: v.optional(v.nullable(v.pipe(v.number(), v.minValue(0)))), // 単位はkgを想定
  // distance: v.optional(v.nullable(v.pipe(v.number(), v.minValue(0)))), // 削除
  // duration: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0)))), // 削除
  notes: v.optional(v.nullable(v.string())),
  performedAt: v.optional(v.nullable(v.pipe(v.string(), v.isoDateTime("PerformedAt must be a valid ISO 8601 date-time string.")))),
});

export type AddSetRequestDto = v.InferInput<typeof AddSetRequestSchema>;

// OpenAPIの ExerciseSet スキーマに相当
export interface WorkoutSetDto {
  id: string; // WorkoutSetIdVO
  exerciseId: string; // ExerciseIdVO
  setNumber: number;
  reps?: number | null;
  weight?: number | null;
  // distance?: number | null; // 削除
  // duration?: number | null; // 削除
  notes?: string | null;
  performedAt: string; // ISO 8601 date-time string
}

export interface AddSetResponseDto {
  addedSet: WorkoutSetDto;
  // sessionId: string; // 必要であればセッションIDも返す
  // totalSetsInSessionForExercise?: number; // このエクササイズの総セット数など、追加情報も検討可能
}
