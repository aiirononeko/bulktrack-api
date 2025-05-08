// src/domain/muscle/vo.ts

// muscles.id (INTEGER) に対応
// export type MuscleId = number; // 旧定義をコメントアウト

// MuscleIdVO class definition was here, now moved to shared/vo/identifier.ts

// muscles.name (TEXT) に対応
export type MuscleName = string;

// 必要であれば、より具体的なバリデーションを持つクラスとして定義することも可能です。
// 例:
// export class MuscleNameVO {
//   readonly value: string;
//   private constructor(value: string) {
//     if (!value || value.trim().length === 0) {
//       throw new Error("Muscle name cannot be empty.");
//     }
//     this.value = value;
//   }
//   public static create(value: string): MuscleNameVO {
//     return new MuscleNameVO(value);
//   }
//   public toString(): string {
//     return this.value;
//   }
// } 