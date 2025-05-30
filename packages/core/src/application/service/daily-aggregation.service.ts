// Schema will be injected from infrastructure layer
import { and, eq, sql, sum } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { calculateEpley1RM } from "../../domain/formulas/strength-formulas";
import type { UserIdVO } from "../../domain/shared/value-objects/identifier";

/**
 * 日別集計処理を行うアプリケーションサービス
 * セットの追加・更新・削除時に集計テーブルを更新
 */
export class DailyAggregationService {
  constructor(
    private readonly db: DrizzleD1Database<any>,
    private readonly schema: any,
  ) {}

  /**
   * 指定ユーザーの指定日の日別集計を更新
   * @param userId ユーザーID
   * @param date 日付 (YYYY-MM-DD)
   */
  async updateDailyAggregation(userId: UserIdVO, date: string): Promise<void> {
    // 集計処理を実行
    await this.updateDailyWorkoutSummary(this.db, userId, date);
    await this.updateDailyExerciseSummaries(this.db, userId, date);
    await this.updateDailyExerciseMuscleVolumes(this.db, userId, date);
  }

  /**
   * 日別ワークアウトサマリーを更新
   */
  private async updateDailyWorkoutSummary(
    db: DrizzleD1Database<any>,
    userId: UserIdVO,
    date: string,
  ): Promise<void> {
    // 指定日のセットデータを集計
    const dailySummary = (await db
      .select({
        totalVolume: sum(this.schema.workoutSets.volume),
        setCount: sql<string>`COUNT(*)`,
        exerciseCount: sql<string>`COUNT(DISTINCT ${this.schema.workoutSets.exerciseId})`,
        avgWeight: sql<string>`AVG(${this.schema.workoutSets.weight})`,
        avgReps: sql<string>`AVG(${this.schema.workoutSets.reps})`,
      })
      .from(this.schema.workoutSets)
      .where(
        and(
          eq(this.schema.workoutSets.userId, userId.value),
          sql`DATE(${this.schema.workoutSets.performedAt}) = ${date}`,
        ),
      )) as any[];

    const summary = dailySummary[0];
    if (!summary || Number(summary.setCount) === 0) {
      // データがない場合は既存の集計を削除
      await db
        .delete(this.schema.dailyWorkoutSummaries)
        .where(
          and(
            eq(this.schema.dailyWorkoutSummaries.userId, userId.value),
            eq(this.schema.dailyWorkoutSummaries.date, date),
          ),
        );
      return;
    }

    const avgRM = this.calculateAverageRM(
      Number(summary.avgWeight) || null,
      Number(summary.avgReps) || null,
    );

    // upsert: 既存データがあれば更新、なければ挿入
    await db
      .insert(this.schema.dailyWorkoutSummaries)
      .values({
        userId: userId.value,
        date,
        totalVolume: Number(summary.totalVolume) || 0,
        avgRM,
        setCount: Number(summary.setCount) || 0,
        exerciseCount: Number(summary.exerciseCount) || 0,
      })
      .onConflictDoUpdate({
        target: [
          this.schema.dailyWorkoutSummaries.userId,
          this.schema.dailyWorkoutSummaries.date,
        ],
        set: {
          totalVolume: Number(summary.totalVolume) || 0,
          avgRM,
          setCount: Number(summary.setCount) || 0,
          exerciseCount: Number(summary.exerciseCount) || 0,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      });
  }

  /**
   * 日別エクササイズサマリーを更新
   */
  private async updateDailyExerciseSummaries(
    db: DrizzleD1Database<any>,
    userId: UserIdVO,
    date: string,
  ): Promise<void> {
    // 既存の集計データを削除
    await db
      .delete(this.schema.dailyExerciseSummaries)
      .where(
        and(
          eq(this.schema.dailyExerciseSummaries.userId, userId.value),
          eq(this.schema.dailyExerciseSummaries.date, date),
        ),
      );

    // エクササイズ別に集計
    const exerciseSummaries = (await db
      .select({
        exerciseId: this.schema.workoutSets.exerciseId,
        totalVolume: sum(this.schema.workoutSets.volume),
        setCount: sql<string>`COUNT(*)`,
        avgWeight: sql<string>`AVG(${this.schema.workoutSets.weight})`,
        avgReps: sql<string>`AVG(${this.schema.workoutSets.reps})`,
        setIds: sql<string>`JSON_GROUP_ARRAY(${this.schema.workoutSets.id})`,
      })
      .from(this.schema.workoutSets)
      .where(
        and(
          eq(this.schema.workoutSets.userId, userId.value),
          sql`DATE(${this.schema.workoutSets.performedAt}) = ${date}`,
        ),
      )
      .groupBy(this.schema.workoutSets.exerciseId)) as any[];

    // 各エクササイズの集計データを挿入
    for (const exerciseSummary of exerciseSummaries) {
      const avgRM = this.calculateAverageRM(
        Number(exerciseSummary.avgWeight) || null,
        Number(exerciseSummary.avgReps) || null,
      );

      await db.insert(this.schema.dailyExerciseSummaries).values({
        userId: userId.value,
        date,
        exerciseId: exerciseSummary.exerciseId,
        totalVolume: Number(exerciseSummary.totalVolume) || 0,
        avgRM,
        setCount: Number(exerciseSummary.setCount) || 0,
        setIds: exerciseSummary.setIds || "[]",
      });
    }
  }

  /**
   * 日別エクササイズ筋群ボリュームを更新
   */
  private async updateDailyExerciseMuscleVolumes(
    db: DrizzleD1Database<any>,
    userId: UserIdVO,
    date: string,
  ): Promise<void> {
    // 既存の集計データを削除
    await db
      .delete(this.schema.dailyExerciseMuscleVolumes)
      .where(
        and(
          eq(this.schema.dailyExerciseMuscleVolumes.userId, userId.value),
          eq(this.schema.dailyExerciseMuscleVolumes.date, date),
        ),
      );

    // エクササイズ×筋群別に集計
    const muscleVolumes = (await db
      .select({
        exerciseId: this.schema.workoutSets.exerciseId,
        muscleId: this.schema.exerciseMuscles.muscleId,
        relativeShare: this.schema.exerciseMuscles.relativeShare,
        tensionFactor: this.schema.muscles.tensionFactor,
        totalVolume: sum(this.schema.workoutSets.volume),
      })
      .from(this.schema.workoutSets)
      .innerJoin(
        this.schema.exerciseMuscles,
        eq(
          this.schema.workoutSets.exerciseId,
          this.schema.exerciseMuscles.exerciseId,
        ),
      )
      .innerJoin(
        this.schema.muscles,
        eq(this.schema.exerciseMuscles.muscleId, this.schema.muscles.id),
      )
      .where(
        and(
          eq(this.schema.workoutSets.userId, userId.value),
          sql`DATE(${this.schema.workoutSets.performedAt}) = ${date}`,
        ),
      )
      .groupBy(
        this.schema.workoutSets.exerciseId,
        this.schema.exerciseMuscles.muscleId,
        this.schema.exerciseMuscles.relativeShare,
        this.schema.muscles.tensionFactor,
      )) as any[];

    // 各エクササイズ×筋群の有効ボリュームを挿入
    for (const muscleVolume of muscleVolumes) {
      const effectiveVolume =
        (Number(muscleVolume.totalVolume) || 0) *
        (muscleVolume.relativeShare / 1000) * // relativeShareは0-1000の整数
        muscleVolume.tensionFactor;

      await db.insert(this.schema.dailyExerciseMuscleVolumes).values({
        userId: userId.value,
        date,
        exerciseId: muscleVolume.exerciseId,
        muscleId: muscleVolume.muscleId,
        effectiveVolume,
      });
    }
  }

  /**
   * 平均RMを計算
   */
  private calculateAverageRM(
    avgWeight: number | null,
    avgReps: number | null,
  ): number | null {
    if (!avgWeight || !avgReps || avgReps <= 0) {
      return null;
    }

    // Epley公式を使用: 1RM = weight * (1 + reps/30)
    return calculateEpley1RM(avgWeight, avgReps);
  }

  /**
   * 指定ユーザーの指定日にセットがあるかチェック
   */
  async hasWorkoutSetsOnDate(userId: UserIdVO, date: string): Promise<boolean> {
    const result = (await this.db
      .select({ count: sql<string>`COUNT(*)` })
      .from(this.schema.workoutSets)
      .where(
        and(
          eq(this.schema.workoutSets.userId, userId.value),
          sql`DATE(${this.schema.workoutSets.performedAt}) = ${date}`,
        ),
      )) as any[];

    return Number(result[0]?.count) > 0;
  }
}
