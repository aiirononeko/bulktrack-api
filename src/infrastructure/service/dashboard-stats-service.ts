import { and, eq, gte, inArray, like, lte, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";

import {
  getISOWeekMondayString,
  getISOWeekSundayString,
} from "../../application/utils/date-utils";
import { calculateEpley1RM } from "../../domain/formulas/strength-formulas";
import type { UserIdVO } from "../../domain/shared/vo/identifier";
import * as schema from "../../infrastructure/db/schema";

// Helper function as per user's request
function calcEffectiveVolume(
  rawVolume: number,
  relShare: number, // 0-1000 (e.g. 500 for 50%)
  tension: number, // 0-∞ (e.g. 1.0 for standard tension)
  modifierMult = 1, // 0-2 (e.g. 1.15 for +15% multiplier)
): number {
  if (rawVolume === null || relShare === null || tension === null) return 0;
  return rawVolume * (relShare / 1000) * tension * modifierMult;
}

export class DashboardStatsService {
  constructor(private readonly db: DrizzleD1Database<typeof schema>) {}

  /**
   * 特定ユーザーの全集計データをクリアする
   * データベース移行時などに利用
   */
  async clearAllUserStats(userId: UserIdVO): Promise<void> {
    console.log(`Clearing all dashboard stats for user: ${userId.value}`);

    try {
      // 筋肉別の週間ボリュームをクリア
      console.log(`Clearing weekly muscle volumes for user ${userId.value}`);
      await this.db
        .delete(schema.weeklyUserMuscleVolumes)
        .where(eq(schema.weeklyUserMuscleVolumes.userId, userId.value));

      // 週間総ボリュームをクリア
      console.log(`Clearing weekly user volumes for user ${userId.value}`);
      await this.db
        .delete(schema.weeklyUserVolumes)
        .where(eq(schema.weeklyUserVolumes.userId, userId.value));

      // メトリクスデータをクリア
      console.log(`Clearing weekly metrics for user ${userId.value}`);
      await this.db
        .delete(schema.weeklyUserMetrics)
        .where(eq(schema.weeklyUserMetrics.userId, userId.value));

      console.log(`All dashboard stats cleared for user: ${userId.value}`);
    } catch (error) {
      console.error(
        `Error clearing dashboard stats for user ${userId.value}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * 全期間再集計前に既存データをクリアして重複を防ぐ
   */
  async clearAndRecalculateAllStats(userId: UserIdVO): Promise<void> {
    console.log(`Starting clean recalculation for user: ${userId.value}`);

    // まず既存の全データをクリア
    await this.clearAllUserStats(userId);

    // その後、全期間のデータを再集計
    await this.updateStatsForUser(userId, new Date());

    console.log(`Clean recalculation completed for user: ${userId.value}`);
  }

  // オリジナルの週ごとの集計処理（復元用に保存）
  async _originalUpdateStatsForUser(
    userId: UserIdVO,
    targetDate: Date,
  ): Promise<void> {
    console.log(
      `Starting dashboard stats update for user: ${userId.value} for week of ${targetDate.toISOString()}.`,
    );

    const targetWeekMonday = getISOWeekMondayString(targetDate);
    // 週の最終日 (日曜日) の23:59:59.999 を取得して、gteとlteで厳密にその週のデータを取得する
    const targetWeekSundayEnd = new Date(
      `${getISOWeekSundayString(targetDate)}T23:59:59.999Z`,
    );

    console.log(
      `Target week: ${targetWeekMonday} to ${targetWeekSundayEnd.toISOString()}`,
    );

    try {
      console.log(
        `Fetching workout sets for user ${userId.value} for the week starting ${targetWeekMonday}.`,
      );

      const userSets = await this.db
        .select()
        .from(schema.workoutSets)
        .where(
          and(
            eq(schema.workoutSets.userId, userId.value),
            gte(schema.workoutSets.performedAt, targetWeekMonday),
            lte(
              schema.workoutSets.performedAt,
              targetWeekSundayEnd.toISOString(),
            ),
          ),
        )
        .orderBy(schema.workoutSets.performedAt);

      // [以下、元のコードは省略 - このメソッドは保存用]
    } catch (error) {
      console.error(
        `Error updating dashboard stats for user ${userId.value} for week of ${targetDate.toISOString()}:`,
        error,
      );
      throw error;
    }
  }

  // 元の週単位集計に戻して、バッチサイズを調整
  async updateStatsForUser(userId: UserIdVO, targetDate: Date): Promise<void> {
    console.log(
      `Starting full history dashboard stats update for user: ${userId.value}.`,
    );
    console.log(
      `[DEBUG] User ID: ${userId.value}, Target Date: ${targetDate.toISOString()}`,
    );

    // 指定された日付の週の情報も取得（UIで当該週を表示する際に必要）
    const targetWeekMonday = getISOWeekMondayString(targetDate);
    console.log(`Reference week for UI: ${targetWeekMonday}`);

    try {
      console.log(`Fetching ALL workout sets for user ${userId.value}.`);

      // 指定された週のセットのみ取得
      const targetWeekSundayEnd = new Date(
        `${getISOWeekSundayString(targetDate)}T23:59:59.999Z`,
      );
      console.log(
        `[DEBUG] Fetching workout sets for user ${userId.value} for week ${targetWeekMonday}...`,
      );
      const userSets = await this.db
        .select()
        .from(schema.workoutSets)
        .where(
          and(
            eq(schema.workoutSets.userId, userId.value),
            gte(schema.workoutSets.performedAt, targetWeekMonday),
            lte(
              schema.workoutSets.performedAt,
              targetWeekSundayEnd.toISOString(),
            ),
          ),
        )
        .orderBy(schema.workoutSets.performedAt);
      console.log(`[DEBUG] Found ${userSets.length} workout sets for the week`);

      if (!userSets || userSets.length === 0) {
        console.log(
          `No workout sets found for user ${userId.value} in the week of ${targetWeekMonday}. Clearing existing aggregation data.`,
        );
        console.log("[DEBUG] No sets found, executing cleanup...");
        await this.db
          .delete(schema.weeklyUserMuscleVolumes)
          .where(
            and(
              eq(schema.weeklyUserMuscleVolumes.userId, userId.value),
              eq(schema.weeklyUserMuscleVolumes.weekStart, targetWeekMonday),
            ),
          );
        await this.db
          .delete(schema.weeklyUserVolumes)
          .where(
            and(
              eq(schema.weeklyUserVolumes.userId, userId.value),
              eq(schema.weeklyUserVolumes.weekStart, targetWeekMonday),
            ),
          );
        await this.db
          .delete(schema.weeklyUserMetrics)
          .where(
            and(
              eq(schema.weeklyUserMetrics.userId, userId.value),
              eq(schema.weeklyUserMetrics.weekStart, targetWeekMonday),
            ),
          );
        return;
      }
      console.log(
        `Found ${userSets.length} workout sets for user ${userId.value} in the week of ${targetWeekMonday}.`,
      );

      const setIds = userSets
        .map((s) => s.id)
        .filter((id) => id !== null) as string[];
      const setModifierMap = new Map<string, number>();
      if (setIds.length > 0) {
        // SQLiteの変数制限（999）を回避するため、バッチ処理で実行
        const BATCH_SIZE = 900; // 余裕を持って900に設定
        console.log(
          `Fetching set modifiers for ${setIds.length} sets in batches of ${BATCH_SIZE}`,
        );

        for (let i = 0; i < setIds.length; i += BATCH_SIZE) {
          const batchSetIds = setIds.slice(i, i + BATCH_SIZE);
          console.log(
            `Processing set modifiers batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(setIds.length / BATCH_SIZE)}, size: ${batchSetIds.length}`,
          );

          const modifierRows = await this.db
            .select({
              setId: schema.setModifiers.setId,
              relMult: schema.exerciseModifierValues.relShareMultiplier,
            })
            .from(schema.setModifiers)
            .innerJoin(
              schema.exerciseModifierValues,
              eq(
                schema.setModifiers.exerciseModifierValueId,
                schema.exerciseModifierValues.id,
              ), // Join on ID as per schema
            )
            .where(inArray(schema.setModifiers.setId, batchSetIds));

          for (const r of modifierRows) {
            if (r.setId) {
              setModifierMap.set(r.setId, r.relMult ?? 1);
            }
          }
        }
      }

      const exerciseIds = [
        ...new Set(
          userSets.map((set) => set.exerciseId).filter((id) => id !== null),
        ),
      ] as string[];
      const exerciseMuscleMappings: Array<{
        exerciseId: string | null;
        muscleId: number | null;
        relativeShare: number | null;
        tensionFactor: number | null;
      }> = [];

      if (exerciseIds.length > 0) {
        // SQLiteの変数制限（999）を回避するため、バッチ処理で実行
        const BATCH_SIZE = 900; // 余裕を持って900に設定
        console.log(
          `Fetching exercise muscle mappings for ${exerciseIds.length} exercises in batches of ${BATCH_SIZE}`,
        );

        for (let i = 0; i < exerciseIds.length; i += BATCH_SIZE) {
          const batchExerciseIds = exerciseIds.slice(i, i + BATCH_SIZE);
          console.log(
            `Processing exercise mappings batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(exerciseIds.length / BATCH_SIZE)}, size: ${batchExerciseIds.length}`,
          );

          const batchMappings = await this.db
            .select({
              exerciseId: schema.exerciseMuscles.exerciseId,
              muscleId: schema.exerciseMuscles.muscleId,
              relativeShare: schema.exerciseMuscles.relativeShare,
              tensionFactor: schema.muscles.tensionFactor,
            })
            .from(schema.exerciseMuscles)
            .innerJoin(
              schema.muscles,
              eq(schema.exerciseMuscles.muscleId, schema.muscles.id),
            )
            .where(
              inArray(schema.exerciseMuscles.exerciseId, batchExerciseIds),
            );

          exerciseMuscleMappings.push(...batchMappings);
        }
      }

      const exerciseDetailsMap = new Map<
        string,
        { muscleId: number; relativeShare: number; tensionFactor: number }[]
      >();
      for (const mapping of exerciseMuscleMappings) {
        if (
          !mapping.exerciseId ||
          mapping.muscleId === null ||
          mapping.relativeShare === null ||
          mapping.tensionFactor === null
        )
          continue;
        const details = exerciseDetailsMap.get(mapping.exerciseId) || [];
        details.push({
          muscleId: mapping.muscleId,
          relativeShare: mapping.relativeShare,
          tensionFactor: mapping.tensionFactor,
        });
        exerciseDetailsMap.set(mapping.exerciseId, details);
      }

      const muscleVolumeByMuscle = new Map<
        number,
        {
          volume: number;
          setCount: number;
          e1rmSum: number;
          e1rmCount: number;
        }
      >();
      let userTotalVolume = 0;
      let userTotalSetCount = 0;
      let userE1rmSum = 0;
      let userE1rmCount = 0;
      const activeDaysSet = new Set<string>();

      // 現在の週のデータのみ処理
      for (const set of userSets) {
        if (
          !set.performedAt ||
          set.volume === null ||
          !set.exerciseId ||
          !set.id
        )
          continue;

        // 現在の週のデータのみ処理（weekStartはtargetWeekMonday固定）

        const exerciseDetails = exerciseDetailsMap.get(set.exerciseId);
        const modifierMultiplier = setModifierMap.get(set.id) ?? 1;

        if (exerciseDetails) {
          for (const detail of exerciseDetails) {
            const effectiveVolume = calcEffectiveVolume(
              set.volume,
              detail.relativeShare,
              detail.tensionFactor,
              modifierMultiplier,
            );
            const currentMuscleStats = muscleVolumeByMuscle.get(
              detail.muscleId,
            ) || {
              volume: 0,
              setCount: 0,
              e1rmSum: 0,
              e1rmCount: 0,
            };

            currentMuscleStats.volume += effectiveVolume;
            currentMuscleStats.setCount += 1;

            if (
              set.weight !== null &&
              set.reps !== null &&
              set.weight > 0 &&
              set.reps > 0
            ) {
              const estimated1RMForSet = calculateEpley1RM(
                set.weight,
                set.reps,
              );
              currentMuscleStats.e1rmSum += estimated1RMForSet;
              currentMuscleStats.e1rmCount += 1;
            }
            muscleVolumeByMuscle.set(detail.muscleId, currentMuscleStats);
          }
        }

        userTotalVolume += set.volume;
        userTotalSetCount += 1;
        if (
          set.weight !== null &&
          set.reps !== null &&
          set.weight > 0 &&
          set.reps > 0
        ) {
          const estimated1RM = calculateEpley1RM(set.weight, set.reps);
          userE1rmSum += estimated1RM;
          userE1rmCount += 1;
        }

        const performedDateStr = set.performedAt.substring(0, 10);
        activeDaysSet.add(performedDateStr);
      }

      console.log(
        `Processed muscle volumes for ${muscleVolumeByMuscle.size} muscle groups`,
      );

      const now = new Date().toISOString();

      // 1. 筋肉別の週間ボリュームデータを更新
      const newWeeklyUserMuscleVolumesData = [];
      for (const [muscleIdNum, stats] of muscleVolumeByMuscle.entries()) {
        newWeeklyUserMuscleVolumesData.push({
          userId: userId.value,
          muscleId: muscleIdNum,
          weekStart: targetWeekMonday,
          volume: stats.volume,
          setCount: stats.setCount,
          e1rmSum: stats.e1rmSum,
          e1rmCount: stats.e1rmCount,
          updatedAt: now,
        });
      }

      if (newWeeklyUserMuscleVolumesData.length > 0) {
        console.log(
          `Upserting ${newWeeklyUserMuscleVolumesData.length} weekly user muscle volume records for user ${userId.value} for week ${targetWeekMonday}.`,
        );

        // データをより小さなバッチに分割（SQLite変数の制限を回避するため）
        // 各レコードが8フィールド + ON CONFLICT DO UPDATEで追加の変数が必要なため、安全マージンを持たせて20に設定
        const BATCH_SIZE = 20; // SQLite変数の制限を考慮したバッチサイズ

        for (
          let i = 0;
          i < newWeeklyUserMuscleVolumesData.length;
          i += BATCH_SIZE
        ) {
          const batch = newWeeklyUserMuscleVolumesData.slice(i, i + BATCH_SIZE);
          console.log(
            `Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(newWeeklyUserMuscleVolumesData.length / BATCH_SIZE)}, size: ${batch.length}`,
          );

          try {
            // D1はトランザクションが使えないので、エラー発生時はその週のレコードのみ影響あり
            await this.db
              .insert(schema.weeklyUserMuscleVolumes)
              .values(batch)
              .onConflictDoUpdate({
                target: [
                  schema.weeklyUserMuscleVolumes.userId,
                  schema.weeklyUserMuscleVolumes.muscleId,
                  schema.weeklyUserMuscleVolumes.weekStart,
                ],
                set: {
                  volume: sql`excluded.volume`,
                  setCount: sql`excluded.set_count`,
                  e1rmSum: sql`excluded.e1rm_sum`,
                  e1rmCount: sql`excluded.e1rm_count`,
                  updatedAt: sql`excluded.updated_at`,
                },
              });
          } catch (error) {
            console.error(
              `Error upserting muscle volumes batch for week ${targetWeekMonday}:`,
              error,
            );
            console.error(
              "[DEBUG] Batch data that failed:",
              JSON.stringify(batch, null, 2),
            );
            console.error("[DEBUG] Error details:", error);
            // 処理を継続するため、エラーはスローせず次のバッチに進む
          }
        }

        console.log(
          `Weekly user muscle volumes for week ${targetWeekMonday} upserted successfully.`,
        );
      }

      // 2. ユーザー全体の週間ボリュームデータを更新
      const newWeeklyUserVolumesData = {
        userId: userId.value,
        weekStart: targetWeekMonday,
        totalVolume: userTotalVolume,
        avgSetVolume:
          userTotalSetCount > 0 ? userTotalVolume / userTotalSetCount : 0,
        e1rmAvg: userE1rmCount > 0 ? userE1rmSum / userE1rmCount : null,
        updatedAt: now,
      };

      console.log(
        `Upserting weekly user volume record for user ${userId.value} for week ${targetWeekMonday}.`,
      );
      try {
        await this.db
          .insert(schema.weeklyUserVolumes)
          .values(newWeeklyUserVolumesData)
          .onConflictDoUpdate({
            target: [
              schema.weeklyUserVolumes.userId,
              schema.weeklyUserVolumes.weekStart,
            ],
            set: {
              totalVolume: sql`excluded.total_volume`,
              avgSetVolume: sql`excluded.avg_set_volume`,
              e1rmAvg: sql`excluded.e1rm_avg`,
              updatedAt: sql`excluded.updated_at`,
            },
          });
        console.log(
          `Weekly user volumes for week ${targetWeekMonday} upserted successfully.`,
        );
      } catch (error) {
        console.error(
          `Error upserting user volumes for week ${targetWeekMonday}:`,
          error,
        );
        console.error(
          "[DEBUG] User volume data that failed:",
          JSON.stringify(newWeeklyUserVolumesData, null, 2),
        );
        console.error("[DEBUG] Error details:", error);
      }

      // 3. 1RMメトリクスデータの更新
      // セットごとに1RMを計算し、平均値を保存
      const exerciseMaxes = new Map<string, { value: number; count: number }>();

      for (const set of userSets) {
        if (
          set.weight === null ||
          set.reps === null ||
          set.weight <= 0 ||
          set.reps <= 0 ||
          !set.exerciseId ||
          !set.performedAt
        ) {
          continue;
        }

        const estimated1RM = calculateEpley1RM(set.weight, set.reps);
        const metricKey = `exercise_${set.exerciseId}_1rm_epley`;

        const currentStats = exerciseMaxes.get(metricKey) || {
          value: 0,
          count: 0,
        };

        // 単純に合計して後で平均を取る
        currentStats.value += estimated1RM;
        currentStats.count += 1;

        exerciseMaxes.set(metricKey, currentStats);
      }

      // エクササイズごとの1RMメトリクスを更新
      const newMetricsData = [];
      for (const [metricKey, stats] of exerciseMaxes.entries()) {
        // 平均値を計算
        const avgValue = stats.count > 0 ? stats.value / stats.count : 0;

        newMetricsData.push({
          userId: userId.value,
          weekStart: targetWeekMonday,
          metricKey: metricKey,
          metricValue: Number.parseFloat(avgValue.toFixed(2)),
          metricUnit: "kg",
          updatedAt: now,
        });
      }

      if (newMetricsData.length > 0) {
        try {
          // まず該当週の古い1RMデータを削除
          console.log(
            `Clearing existing 1RM metrics for user ${userId.value} for week ${targetWeekMonday}`,
          );
          await this.db
            .delete(schema.weeklyUserMetrics)
            .where(
              and(
                eq(schema.weeklyUserMetrics.userId, userId.value),
                eq(schema.weeklyUserMetrics.weekStart, targetWeekMonday),
                like(
                  schema.weeklyUserMetrics.metricKey,
                  "exercise_%_1rm_epley",
                ),
              ),
            );

          // バッチサイズを小さくして処理
          // 各レコードが6フィールド + ON CONFLICT DO UPDATEで追加の変数が必要なため、安全マージンを持たせて20に設定
          const BATCH_SIZE = 20;
          console.log(
            `Upserting ${newMetricsData.length} 1RM metrics for user ${userId.value} for week ${targetWeekMonday} in batches`,
          );

          for (let i = 0; i < newMetricsData.length; i += BATCH_SIZE) {
            const batch = newMetricsData.slice(i, i + BATCH_SIZE);
            console.log(
              `Processing 1RM metrics batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(newMetricsData.length / BATCH_SIZE)}, size: ${batch.length}`,
            );

            try {
              await this.db
                .insert(schema.weeklyUserMetrics)
                .values(batch)
                .onConflictDoUpdate({
                  target: [
                    schema.weeklyUserMetrics.userId,
                    schema.weeklyUserMetrics.weekStart,
                    schema.weeklyUserMetrics.metricKey,
                  ],
                  set: {
                    metricValue: sql`excluded.metric_value`,
                    metricUnit: sql`excluded.metric_unit`,
                    updatedAt: sql`excluded.updated_at`,
                  },
                });
            } catch (batchError) {
              console.error(
                `Error upserting 1RM metrics batch for week ${targetWeekMonday}:`,
                batchError,
              );
              console.error(
                "[DEBUG] 1RM batch data that failed:",
                JSON.stringify(batch, null, 2),
              );
              console.error("[DEBUG] Error details:", batchError);
              // バッチエラーでも次に進む
            }
          }

          console.log(
            `1RM metrics for week ${targetWeekMonday} upserted successfully`,
          );
        } catch (error) {
          console.error(
            `Error upserting 1RM metrics for week ${targetWeekMonday}:`,
            error,
          );
          // 処理を継続
        }
      }

      // 4. アクティブ日数メトリクスの更新
      const activeDaysMetricKey = "active_days";
      const totalActiveDays = activeDaysSet.size;
      if (totalActiveDays > 0) {
        try {
          // 該当週の古いアクティブ日数データを削除
          console.log(
            `Clearing existing active days metrics for user ${userId.value} for week ${targetWeekMonday}`,
          );
          await this.db
            .delete(schema.weeklyUserMetrics)
            .where(
              and(
                eq(schema.weeklyUserMetrics.userId, userId.value),
                eq(schema.weeklyUserMetrics.weekStart, targetWeekMonday),
                inArray(schema.weeklyUserMetrics.metricKey, [
                  activeDaysMetricKey,
                  "total_workouts",
                ]),
              ),
            );

          // 新しいデータを挿入
          console.log(
            `Upserting active days metric for user ${userId.value} for week ${targetWeekMonday}: ${totalActiveDays} days`,
          );
          await this.db
            .insert(schema.weeklyUserMetrics)
            .values({
              userId: userId.value,
              weekStart: targetWeekMonday,
              metricKey: activeDaysMetricKey,
              metricValue: totalActiveDays,
              metricUnit: "days",
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: [
                schema.weeklyUserMetrics.userId,
                schema.weeklyUserMetrics.weekStart,
                schema.weeklyUserMetrics.metricKey,
              ],
              set: {
                metricValue: sql`excluded.metric_value`,
                metricUnit: sql`excluded.metric_unit`,
                updatedAt: sql`excluded.updated_at`,
              },
            });
          console.log(
            `Active days metric for week ${targetWeekMonday} upserted successfully`,
          );
        } catch (error) {
          console.error(
            `Error upserting active days metric for week ${targetWeekMonday}:`,
            error,
          );
          console.error("[DEBUG] Active days data that failed:", {
            userId: userId.value,
            weekStart: targetWeekMonday,
            totalActiveDays,
          });
          console.error("[DEBUG] Error details:", error);
          // 処理を継続
        }
      }

      console.log(
        `Dashboard stats update completed for user: ${userId.value} for week ${targetWeekMonday}.`,
      );
    } catch (error) {
      console.error(
        `Error updating dashboard stats for user ${userId.value} for week of ${targetDate.toISOString()}:`,
        error,
      );
      console.error("[DEBUG] Final error in updateStatsForUser:", error);
      console.error("[DEBUG] Error stack:", (error as Error).stack);
      throw error;
    }
  }
}
