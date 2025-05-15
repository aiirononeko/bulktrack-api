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
  performedAt: v.optional(v.nullable(v.pipe(
    v.string(),
    v.isoTimestamp("PerformedAt must be a valid ISO 8601 timestamp string.")
  ))),
  setNo: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1)))),
  rpe: v.optional(v.nullable(v.pipe(v.number(), v.minValue(0), v.maxValue(10)))),
  restSec: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0)))),
  deviceId: v.optional(v.nullable(v.string())),
});

export type AddSetRequestDto = v.InferInput<typeof AddSetRequestSchema>;

// OpenAPIの ExerciseSet スキーマに相当
export interface WorkoutSetDto {
  id: string; // WorkoutSetIdVO
  exerciseId: string; // ExerciseIdVO
  setNumber: number;
  reps?: number | null;
  weight?: number | null;
  notes?: string | null;
  performedAt: string; // ISO 8601 date-time string
  volume?: number;
  createdAt?: string;
  rpe?: number | null;
  restSec?: number | null;
  deviceId?: string | null;
}

export const SetUpdateRequestSchema = v.objectAsync({
  exerciseId: v.optional(v.nullable(v.pipe(v.string(), v.uuid("Exercise ID must be a valid UUID if provided.")))),
  weight: v.optional(v.nullable(v.pipe(v.number(), v.minValue(0)))),
  reps: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0)))),
  notes: v.optional(v.nullable(v.string())),
  performedAt: v.optional(v.nullable(v.pipe(
    v.string(),
    v.isoTimestamp("PerformedAt must be a valid ISO 8601 timestamp string if provided.")
  ))),
  rpe: v.optional(v.nullable(v.pipe(v.number(), v.minValue(0), v.maxValue(10)))),
  // distance と duration は OpenAPI 定義にはあるが、現時点ではエンティティにないため除外
});

export type SetUpdateRequestDto = v.InferInput<typeof SetUpdateRequestSchema>;
