import type { DrizzleD1Database } from "drizzle-orm/d1"; // Drizzleの型。プロジェクトに合わせて要調整
import * as schema from "../../infrastructure/db/schema"; // スキーマをインポート
import { eq, and, gte, inArray, sql, isNotNull } from "drizzle-orm"; // eq, and, gte, inArray, sql, isNotNull をインポート
import type { IAggregationService, AggregationResult } from "../../domain/aggregation/service";
import { MuscleIdVO } from "../../domain/shared/vo/identifier"; // MuscleIdVO は値として使用
import type { UserIdVO } from "../../domain/shared/vo/identifier"; // UserIdVO は型として使用
import { WeeklyMuscleVolume } from "../../domain/aggregation/entities/weekly-muscle-volume";
import { UserProgressMetric } from "../../domain/aggregation/entities/user-progress-metric";
import { calculateEpley1RM } from "../../domain/formulas/strength-formulas";
import { getISOWeekIdentifier } from "../utils/date-utils"; // getISOWeekIdentifierをインポート
// 他に必要なドメインエンティティやバリューオブジェクトがあれば適宜インポート

export class AggregationService implements IAggregationService {
  constructor(private readonly db: DrizzleD1Database<typeof schema>) {}

  async aggregateWorkoutDataForUser(userId: UserIdVO): Promise<AggregationResult> {
    console.log(`Starting aggregation for user: ${userId.value} (no explicit transaction).`);
    try {
      // トランザクションのラップを解除。this.db を直接使用する。
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoISO = sevenDaysAgo.toISOString();

      console.log(`Fetching workout sets for user ${userId.value} (all time for now, date filter pending).`);

      const userSets = await this.db // tx から this.db に戻す
        .select()
        .from(schema.workoutSets)
        .where(
          and(
            eq(schema.workoutSets.userId, userId.value),
          )
        )
        .orderBy(schema.workoutSets.performed_at);

      if (!userSets || userSets.length === 0) {
        console.log(`No workout sets found for user ${userId.value}.`);
        return { success: true, message: "No workout data to aggregate for this user." };
      }
      console.log(`Found ${userSets.length} workout sets for user ${userId.value}`);

      // 週間筋肉ボリュームの計算と保存
      const exerciseIds = [...new Set(userSets.map(set => set.exerciseId).filter(id => id !== null))] as string[];
      const exerciseMuscleMappings = exerciseIds.length > 0 ? await this.db // tx から this.db
        .select({
          exerciseId: schema.exerciseMuscles.exerciseId,
          muscleId: schema.exerciseMuscles.muscleId,
          tensionRatio: schema.exerciseMuscles.tensionRatio,
          tensionFactor: schema.muscles.tensionFactor,
        })
        .from(schema.exerciseMuscles)
        .innerJoin(schema.muscles, eq(schema.exerciseMuscles.muscleId, schema.muscles.id))
        .where(inArray(schema.exerciseMuscles.exerciseId, exerciseIds)) : [];
      
      const exerciseDetailsMap = new Map<string, { muscleId: number, tensionRatio: number, tensionFactor: number }[]>();
      for (const mapping of exerciseMuscleMappings) {
        if (!mapping.exerciseId || mapping.muscleId === null || mapping.tensionRatio === null || mapping.tensionFactor === null) continue;
        const details = exerciseDetailsMap.get(mapping.exerciseId) || [];
        details.push({
          muscleId: mapping.muscleId,
          tensionRatio: mapping.tensionRatio,
          tensionFactor: mapping.tensionFactor,
        });
        exerciseDetailsMap.set(mapping.exerciseId, details);
      }

      const weeklyVolumeByMuscle = new Map<string, Map<number, number>>();
      for (const set of userSets) {
        if (!set.performed_at || set.volume === null || !set.exerciseId) continue;

        const weekIdentifier = getISOWeekIdentifier(set.performed_at);
        const exerciseDetails = exerciseDetailsMap.get(set.exerciseId);

        if (exerciseDetails) {
          for (const detail of exerciseDetails) {
            // set.volume が null でないことは上でチェック済み
            const effectiveVolume = set.volume * detail.tensionRatio * detail.tensionFactor;

            const weeklyMap = weeklyVolumeByMuscle.get(weekIdentifier) || new Map<number, number>();
            const currentMuscleVolume = weeklyMap.get(detail.muscleId) || 0;
            weeklyMap.set(detail.muscleId, currentMuscleVolume + effectiveVolume);
            weeklyVolumeByMuscle.set(weekIdentifier, weeklyMap);
          }
        }
      }
      
      console.log("Weekly muscle volumes calculated:", weeklyVolumeByMuscle);

      if (weeklyVolumeByMuscle.size > 0) {
        const newWeeklyVolumesData = [];
        const now = new Date(); 
        for (const [weekIdentifier, muscleMap] of weeklyVolumeByMuscle) {
          for (const [muscleIdNum, volume] of muscleMap) {
            // MuscleIdVO はドメインエンティティのコンストラクタで使われるので、ここでは直接数値でよい場合もあるが、
            // ドメインエンティティとの一貫性のためインスタンス化する
            const muscleIdVo = new MuscleIdVO(muscleIdNum);

            // ドメインエンティティ作成 (バリデーションなどを行う)
            const weeklyVolumeEntity = new WeeklyMuscleVolume({
              userId,
              muscleId: muscleIdVo,
              weekIdentifier,
              volume,
              calculatedAt: now, // 事前に取得した現在時刻を使用
            });

            newWeeklyVolumesData.push({
              userId: weeklyVolumeEntity.userId.value,
              muscleId: weeklyVolumeEntity.muscleId.toNumber(),
              weekIdentifier: weeklyVolumeEntity.weekIdentifier,
              volume: weeklyVolumeEntity.volume,
              calculatedAt: weeklyVolumeEntity.calculatedAt.toISOString(),
            });
          }
        }

        if (newWeeklyVolumesData.length > 0) {
          console.log(`Upserting ${newWeeklyVolumesData.length} weekly muscle volume records for user ${userId.value}.`);
          await this.db.insert(schema.weeklyMuscleVolumes) // tx から this.db
            .values(newWeeklyVolumesData)
            .onConflictDoUpdate({
              target: [
                schema.weeklyMuscleVolumes.userId,
                schema.weeklyMuscleVolumes.muscleId,
                schema.weeklyMuscleVolumes.weekIdentifier
              ],
              set: {
                volume: sql`excluded.volume`,
                calculatedAt: sql`excluded.calculated_at`,
              }
            });
          console.log("Weekly muscle volumes upserted successfully.");
        } else {
          console.log("No new weekly muscle volume data to upsert.");
        }
      } else {
        console.log("No weekly muscle volumes calculated to save.");
      }

      // RM計算と保存
      const newUserProgressMetricsData = [];
      const nowForRM = new Date();
      for (const set of userSets) {
        if (set.weight === null || set.reps === null || set.weight <= 0 || set.reps <= 0 || !set.exerciseId || !set.performed_at) {
          continue; // RM計算に必要なデータが不足しているか無効な場合はスキップ
        }

        const estimated1RM = calculateEpley1RM(set.weight, set.reps);
        const weekIdentifier = getISOWeekIdentifier(set.performed_at);
        
        const metricKey = `exercise_${set.exerciseId}_1rm_epley`; 

        const progressMetricEntity = new UserProgressMetric({
          userId,
          metricKey,
          periodIdentifier: weekIdentifier,
          metricValue: estimated1RM.toFixed(2), 
          metricType: "kg", 
          calculatedAt: nowForRM,
        });

        newUserProgressMetricsData.push({
          userId: progressMetricEntity.userId.value,
          metricKey: progressMetricEntity.metricKey,
          periodIdentifier: progressMetricEntity.periodIdentifier,
          metricValue: progressMetricEntity.metricValue,
          metricType: progressMetricEntity.metricType,
          calculatedAt: progressMetricEntity.calculatedAt.toISOString(),
        });
      }

      if (newUserProgressMetricsData.length > 0) {
        console.log(`Upserting ${newUserProgressMetricsData.length} user progress metric records for user ${userId.value}.`);
        await this.db.insert(schema.userProgressMetrics) // tx から this.db
          .values(newUserProgressMetricsData)
          .onConflictDoUpdate({
            target: [
              schema.userProgressMetrics.userId,
              schema.userProgressMetrics.metricKey,
              schema.userProgressMetrics.periodIdentifier
            ],
            set: {
              metricValue: sql`excluded.metric_value`,
              metricType: sql`excluded.metric_type`,
              calculatedAt: sql`excluded.calculated_at`,
            }
          });
        console.log("User progress metrics upserted successfully.");
      } else {
        console.log("No new user progress metrics to upsert for this period/user.");
      }
      
      // weeklyUserActivity の集計
      console.log(`Starting weeklyUserActivity aggregation for user ${userId.value}.`);
      const userSessions = await this.db // tx から this.db
        .select({ finishedAt: schema.workoutSessions.finishedAt })
        .from(schema.workoutSessions)
        .where(and(eq(schema.workoutSessions.userId, userId.value), isNotNull(schema.workoutSessions.finishedAt)));
      
      const weeklyActivityCounter = new Map<string, number>();
      const nowForActivity = new Date();

      if (userSessions.length > 0) {
        for (const session of userSessions) {
          // finishedAt が null でないことはクエリで担保されているが、念のため型安全性を高める
          if (!session.finishedAt) {
            continue;
          }
          const weekIdentifier = getISOWeekIdentifier(session.finishedAt);
          weeklyActivityCounter.set(weekIdentifier, (weeklyActivityCounter.get(weekIdentifier) || 0) + 1);
        }
      }

      const newWeeklyActivityData = [];
      if (weeklyActivityCounter.size > 0) {
        for (const [weekIdentifier, totalWorkouts] of weeklyActivityCounter) {
          newWeeklyActivityData.push({
            userId: userId.value,
            weekIdentifier,
            totalWorkouts,
            currentStreak: 0, // streak は暫定的に0を設定 (スキーマにデフォルトがあればそれでも良い)
            calculatedAt: nowForActivity.toISOString(),
          });
        }

        if (newWeeklyActivityData.length > 0) {
          console.log(`Upserting ${newWeeklyActivityData.length} weekly user activity records for user ${userId.value}.`);
          await this.db.insert(schema.weeklyUserActivity) // tx から this.db
            .values(newWeeklyActivityData)
            .onConflictDoUpdate({
              target: [
                schema.weeklyUserActivity.userId,
                schema.weeklyUserActivity.weekIdentifier
              ],
              set: {
                totalWorkouts: sql`excluded.total_workouts`,
                // currentStreak: sql`excluded.current_streak`, // streak は別途
                calculatedAt: sql`excluded.calculated_at`,
              }
            });
          console.log("Weekly user activity upserted successfully.");
        }
      } else {
        console.log(`No weekly user activity data to process for user ${userId.value} based on sessions found.`);
      }
      
      console.log(`Aggregation fully finished for user: ${userId.value}`);
      return { success: true, message: "Aggregation complete. Volumes, metrics, and activity processed." };

    } catch (error) {
      console.error(`Aggregation failed for user ${userId.value}:`, error);
      // エラーメッセージからトランザクション関連の文言を削除または一般化
      const errorMessage = error instanceof Error ? error.message : "Unknown error during aggregation.";
      return { success: false, message: errorMessage };
    }
  }

  // (オプション) aggregateWorkoutSession メソッドの実装
}
