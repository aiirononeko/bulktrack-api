import { and, eq, sql, sum } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { calculateEpley1RM } from "../../domain/formulas/strength-formulas";
import type { UserIdVO } from "../../domain/shared/value-objects/identifier";

/**
 * 週次集計処理を行うアプリケーションサービス
 * セットの追加・更新・削除時に週次集計テーブルを更新
 */
export class WeeklyAggregationService {
  constructor(
    private readonly db: DrizzleD1Database<any>,
    private readonly schema: any,
  ) {}

  /**
   * 指定ユーザーの指定週の週次集計を更新
   * @param userId ユーザーID
   * @param weekStart 週の開始日 (月曜日、YYYY-MM-DD format)
   */
  async updateWeeklyAggregation(
    userId: UserIdVO,
    weekStart: string,
  ): Promise<void> {
    // 週次集計処理を実行
    await this.updateWeeklyUserVolume(userId, weekStart);
    await this.updateWeeklyUserMuscleVolumes(userId, weekStart);
  }

  /**
   * 指定日付が属する週の開始日（月曜日）を取得
   */
  getWeekStart(date: Date): string {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 月曜日に調整
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split("T")[0];
  }

  /**
   * 週次ユーザーボリュームを更新
   */
  private async updateWeeklyUserVolume(
    userId: UserIdVO,
    weekStart: string,
  ): Promise<void> {
    // 週の終了日を計算（日曜日）
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndStr = weekEnd.toISOString().split("T")[0];

    // 指定週のセットデータを集計
    const weeklySummary = (await this.db
      .select({
        totalVolume: sum(this.schema.workoutSets.volume),
        setCount: sql<string>`COUNT(*)`,
        avgSetVolume: sql<string>`AVG(${this.schema.workoutSets.volume})`,
        avgWeight: sql<string>`AVG(${this.schema.workoutSets.weight})`,
        avgReps: sql<string>`AVG(${this.schema.workoutSets.reps})`,
      })
      .from(this.schema.workoutSets)
      .where(
        and(
          eq(this.schema.workoutSets.userId, userId.value),
          sql`DATE(${this.schema.workoutSets.performedAt}) >= ${weekStart}`,
          sql`DATE(${this.schema.workoutSets.performedAt}) <= ${weekEndStr}`,
        ),
      )) as any[];

    const summary = weeklySummary[0];
    if (!summary || Number(summary.setCount) === 0) {
      // データがない場合は既存の集計を削除
      await this.db
        .delete(this.schema.weeklyUserVolumes)
        .where(
          and(
            eq(this.schema.weeklyUserVolumes.userId, userId.value),
            eq(this.schema.weeklyUserVolumes.weekStart, weekStart),
          ),
        );
      return;
    }

    const e1rmAvg = this.calculateAverageRM(
      Number(summary.avgWeight) || null,
      Number(summary.avgReps) || null,
    );

    // upsert: 既存データがあれば更新、なければ挿入
    await this.db
      .insert(this.schema.weeklyUserVolumes)
      .values({
        userId: userId.value,
        weekStart,
        totalVolume: Number(summary.totalVolume) || 0,
        avgSetVolume: Number(summary.avgSetVolume) || 0,
        e1rmAvg,
      })
      .onConflictDoUpdate({
        target: [
          this.schema.weeklyUserVolumes.userId,
          this.schema.weeklyUserVolumes.weekStart,
        ],
        set: {
          totalVolume: Number(summary.totalVolume) || 0,
          avgSetVolume: Number(summary.avgSetVolume) || 0,
          e1rmAvg,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      });
  }

  /**
   * 週次ユーザー筋肉ボリュームを更新
   */
  private async updateWeeklyUserMuscleVolumes(
    userId: UserIdVO,
    weekStart: string,
  ): Promise<void> {
    // 週の終了日を計算（日曜日）
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndStr = weekEnd.toISOString().split("T")[0];

    // 既存の集計データを削除
    await this.db
      .delete(this.schema.weeklyUserMuscleVolumes)
      .where(
        and(
          eq(this.schema.weeklyUserMuscleVolumes.userId, userId.value),
          eq(this.schema.weeklyUserMuscleVolumes.weekStart, weekStart),
        ),
      );

    // 筋肉別に集計
    const muscleVolumes = (await this.db
      .select({
        muscleId: this.schema.exerciseMuscles.muscleId,
        relativeShare: this.schema.exerciseMuscles.relativeShare,
        tensionFactor: this.schema.muscles.tensionFactor,
        totalVolume: sum(this.schema.workoutSets.volume),
        setCount: sql<string>`COUNT(*)`,
        avgWeight: sql<string>`AVG(${this.schema.workoutSets.weight})`,
        avgReps: sql<string>`AVG(${this.schema.workoutSets.reps})`,
        e1rmSum: sql<string>`SUM(
          CASE 
            WHEN ${this.schema.workoutSets.weight} IS NOT NULL 
            AND ${this.schema.workoutSets.reps} IS NOT NULL 
            AND ${this.schema.workoutSets.reps} > 0
            THEN ${this.schema.workoutSets.weight} * (1.0 + ${this.schema.workoutSets.reps} / 30.0)
            ELSE 0
          END
        )`,
        e1rmCount: sql<string>`SUM(
          CASE 
            WHEN ${this.schema.workoutSets.weight} IS NOT NULL 
            AND ${this.schema.workoutSets.reps} IS NOT NULL 
            AND ${this.schema.workoutSets.reps} > 0
            THEN 1
            ELSE 0
          END
        )`,
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
          sql`DATE(${this.schema.workoutSets.performedAt}) >= ${weekStart}`,
          sql`DATE(${this.schema.workoutSets.performedAt}) <= ${weekEndStr}`,
        ),
      )
      .groupBy(
        this.schema.exerciseMuscles.muscleId,
        this.schema.exerciseMuscles.relativeShare,
        this.schema.muscles.tensionFactor,
      )) as any[];

    // 各筋肉の週次ボリュームを挿入
    for (const muscleVolume of muscleVolumes) {
      const volume =
        (Number(muscleVolume.totalVolume) || 0) *
        (muscleVolume.relativeShare / 1000) * // relativeShareは0-1000の整数
        muscleVolume.tensionFactor;

      await this.db.insert(this.schema.weeklyUserMuscleVolumes).values({
        userId: userId.value,
        weekStart,
        muscleId: muscleVolume.muscleId,
        volume,
        setCount: Number(muscleVolume.setCount) || 0,
        e1rmSum: Number(muscleVolume.e1rmSum) || 0,
        e1rmCount: Number(muscleVolume.e1rmCount) || 0,
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
}
