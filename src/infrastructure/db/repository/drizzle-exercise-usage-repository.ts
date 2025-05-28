import { and, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { IExerciseUsageRepository } from "../../../domain/exercise/repository/exercise-usage-repository";
import type {
  ExerciseIdVO,
  UserIdVO,
} from "../../../domain/shared/vo/identifier"; // これらも .value を使うので値
import * as schemaMap from "../schema"; // スキーマを値としてインポート

// Linterの提案に基づき、スキーマ名を exerciseUsage に修正
const exerciseUsageTable = schemaMap.exerciseUsage;

export class DrizzleExerciseUsageRepository
  implements IExerciseUsageRepository
{
  constructor(private readonly db: DrizzleD1Database<typeof schemaMap>) {}

  async recordUsage(
    userId: UserIdVO,
    exerciseId: ExerciseIdVO,
    performedDate: Date,
  ): Promise<void> {
    // performedDate は WorkoutService でその日の開始時刻 (例: YYYY-MM-DDT00:00:00.000Z) に
    // なるように正規化された Date オブジェクトであると期待される。
    const lastUsedAtIsoString = performedDate.toISOString();

    if (!exerciseUsageTable) {
      console.error(
        "exerciseUsageTable (schemaMap.exerciseUsage) is not defined in the schema. Make sure it's exported from schema.ts",
      );
      throw new Error("Schema misconfiguration: exerciseUsageTable not found.");
    }

    try {
      await this.db
        .insert(exerciseUsageTable)
        .values({
          userId: userId.value,
          exerciseId: exerciseId.value,
          lastUsedAt: lastUsedAtIsoString, // 完全なISO文字列を保存
        })
        .onConflictDoNothing() // (userId, exerciseId, DATE(lastUsedAt)) 等のユニーク制約を期待
        .execute();
    } catch (error) {
      console.error(
        `Failed to record exercise usage for user ${userId.value}, exercise ${exerciseId.value} on ${lastUsedAtIsoString}:`,
        error,
      );
      throw new Error("Database error while recording exercise usage.");
    }
  }
}
