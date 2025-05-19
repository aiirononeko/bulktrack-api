import type { ExerciseIdVO } from "../shared/vo/identifier";
import type { MuscleId } from "../muscle/vo"; // MuscleId をインポート

// export type ExerciseName = string; // 旧定義をコメントアウト

export class ExerciseNameVO {
  readonly value: string;

  private constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error("Exercise name cannot be empty.");
    }
    this.value = value.trim(); // Trim whitespace
  }

  public static create(value: string): ExerciseNameVO {
    return new ExerciseNameVO(value);
  }

  public toString(): string {
    return this.value;
  }

  public equals(other?: ExerciseNameVO): boolean {
    if (other === null || other === undefined) {
      return false;
    }
    return this.value === other.value;
  }
}

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

// Exerciseエンティティなどで ExerciseIdVO と ExerciseNameVO を組み合わせる
// export interface ExerciseCoreInfo { // これは entity.ts で Exercise エンティティとして定義する方が適切
//   id: ExerciseIdVO;
//   name: ExerciseNameVO; // ExerciseNameVO を使用
//   // 他のExerciseのコアな情報 ...
// }
