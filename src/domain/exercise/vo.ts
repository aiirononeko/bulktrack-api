import type { ExerciseIdVO } from "../shared/vo/identifier";

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

// Exerciseエンティティなどで ExerciseIdVO と ExerciseNameVO を組み合わせる
export interface ExerciseCoreInfo {
  id: ExerciseIdVO;
  name: ExerciseNameVO; // ExerciseNameVO を使用
  // 他のExerciseのコアな情報 ...
}
