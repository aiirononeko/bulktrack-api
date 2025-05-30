import type { MuscleId } from "../../muscle/muscle.vo";
import type { ExerciseIdVO } from "../../shared/value-objects/identifier";

// exercise_muscles.relative_share (INTEGER, 0-1000)
export type RelativeShare = number; // 千分率

// exercise_sources.id (TEXT, e.g., DOI)
export type ExerciseSourceId = string;

// exercise_sources.title (TEXT)
export type ExerciseSourceTitle = string;

// exercise_sources.url (TEXT)
export type ExerciseSourceUrl = string;

// exercise_muscles.source_details (TEXT)
export type SourceDetails = string;

/**
 * Represents an evidence source for an exercise.
 */
export interface ExerciseSource {
  id: ExerciseSourceId;
  title: ExerciseSourceTitle;
  url?: ExerciseSourceUrl; // URLはオプショナルかもしれない
}

/**
 * Represents the involvement of a muscle in an exercise.
 */
export interface ExerciseMuscle {
  exerciseId: ExerciseIdVO;
  muscleId: MuscleId;
  relativeShare: RelativeShare;
  sourceId?: ExerciseSourceId; // Optional FK
  sourceDetails?: SourceDetails; // Optional details
}
