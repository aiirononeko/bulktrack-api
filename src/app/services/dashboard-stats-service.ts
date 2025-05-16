import type { DrizzleD1Database } from "drizzle-orm/d1"; // Drizzleの型。プロジェクトに合わせて要調整
import * as schema from "../../infrastructure/db/schema"; // スキーマをインポート
import { eq, and, gte, inArray, sql, isNotNull } from "drizzle-orm"; // eq, and, gte, inArray, sql, isNotNull をインポート
import type { IAggregationService, AggregationResult } from "../../domain/aggregation/service";
import { MuscleIdVO } from "../../domain/shared/vo/identifier"; // MuscleIdVO は値として使用
import type { UserIdVO } from "../../domain/shared/vo/identifier"; // UserIdVO は型として使用
// WeeklyMuscleVolume, UserProgressMetric は直接使われなくなる可能性があるが、概念として残す場合はコメントアウト
// import { WeeklyMuscleVolume } from "../../domain/aggregation/entities/weekly-muscle-volume";
// import { UserProgressMetric } from "../../domain/aggregation/entities/user-progress-metric";
import { calculateEpley1RM } from "../../domain/formulas/strength-formulas";
import { getISOWeekIdentifier, getISOWeekMondayString } from "../utils/date-utils"; // getISOWeekIdentifier, getISOWeekMondayString をインポート
// 他に必要なドメインエンティティやバリューオブジェクトがあれば適宜インポート

// IAggregationService は router.ts で定義したインターフェースとは異なるため、
// このクラスが router.ts の StatsUpdateService を実装するように変更する
// export class AggregationService implements IAggregationService {
export class DashboardStatsService { // クラス名変更
  constructor(private readonly db: DrizzleD1Database<typeof schema>) {}

  // async aggregateWorkoutDataForUser(userId: UserIdVO): Promise<AggregationResult> { // メソッド名と戻り値変更
  async updateStatsForUser(userId: UserIdVO): Promise<void> {
    console.log(`Starting dashboard stats update for user: ${userId.value}.`);
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
        .orderBy(schema.workoutSets.performedAt);

      if (!userSets || userSets.length === 0) {
        console.log(`No workout sets found for user ${userId.value}.`);
        // return { success: true, message: "No workout data to aggregate for this user." };
        return; // voidなので何も返さない
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

      const weeklyVolumeByMuscle = new Map<string, Map<number, number>>(); // Key is weekStart (YYYY-MM-DD)
      const weeklyTotalVolumeByUser = new Map<string, { totalVolume: number, setCount: number, e1rmSum: number, e1rmCount: number }>(); // For weeklyUserVolumes
      // weeklyWorkoutSessions: weekStart -> Set of performed dates (YYYY-MM-DD) to count active days
      const weeklyActiveDays = new Map<string, Set<string>>(); 

      for (const set of userSets) {
        // if (!set.performed_at || set.volume === null || !set.exerciseId || !set.sessionId) continue; // sessionId チェック削除
        if (!set.performedAt || set.volume === null || !set.exerciseId) continue; // performed_at -> performedAt

        // const weekStart = getISOWeekMondayString(set.performed_at);
        const weekStart = getISOWeekMondayString(set.performedAt); // performed_at -> performedAt
        const exerciseDetails = exerciseDetailsMap.get(set.exerciseId);

        // For weeklyUserMuscleVolumes
        if (exerciseDetails) {
          for (const detail of exerciseDetails) {
            const effectiveVolume = set.volume * detail.tensionRatio * detail.tensionFactor;
            const weeklyMuscleMap = weeklyVolumeByMuscle.get(weekStart) || new Map<number, number>();
            const currentMuscleVolume = weeklyMuscleMap.get(detail.muscleId) || 0;
            weeklyMuscleMap.set(detail.muscleId, currentMuscleVolume + effectiveVolume);
            weeklyVolumeByMuscle.set(weekStart, weeklyMuscleMap);
          }
        }

        // For weeklyUserVolumes accumulation
        let userWeeklyTotals = weeklyTotalVolumeByUser.get(weekStart);
        if (!userWeeklyTotals) {
          userWeeklyTotals = { totalVolume: 0, setCount: 0, e1rmSum: 0, e1rmCount: 0 };
        }
        userWeeklyTotals.totalVolume += set.volume; // Raw volume for weeklyUserVolumes.totalVolume
        userWeeklyTotals.setCount += 1;
        if (set.weight !== null && set.reps !== null && set.weight > 0 && set.reps > 0) {
            const estimated1RM = calculateEpley1RM(set.weight, set.reps);
            userWeeklyTotals.e1rmSum += estimated1RM;
            userWeeklyTotals.e1rmCount +=1;
        }
        weeklyTotalVolumeByUser.set(weekStart, userWeeklyTotals);

        // For counting workouts per week (active days)
        const performedDate = set.performedAt.substring(0, 10); // YYYY-MM-DD
        const activeDaysInWeek = weeklyActiveDays.get(weekStart) || new Set<string>();
        activeDaysInWeek.add(performedDate);
        weeklyActiveDays.set(weekStart, activeDaysInWeek);
      }
      
      console.log("Weekly muscle volumes calculated (for weeklyUserMuscleVolumes):", weeklyVolumeByMuscle);
      console.log("Weekly user total volumes calculated (for weeklyUserVolumes):", weeklyTotalVolumeByUser);

      // 1. Upsert into weeklyUserMuscleVolumes
      if (weeklyVolumeByMuscle.size > 0) {
        const newWeeklyUserMuscleVolumesData = [];
        const now = new Date(); 
        for (const [weekStart, muscleMap] of weeklyVolumeByMuscle) {
          for (const [muscleIdNum, volume] of muscleMap) {
            // Domain entity creation removed for direct DTO construction for DB
            newWeeklyUserMuscleVolumesData.push({
              userId: userId.value,
              muscleId: muscleIdNum,
              weekStart: weekStart,
              volume: volume,
              updatedAt: now.toISOString(), // Use ISO string directly for DB
            });
          }
        }

        if (newWeeklyUserMuscleVolumesData.length > 0) {
          console.log(`Upserting ${newWeeklyUserMuscleVolumesData.length} weekly user muscle volume records for user ${userId.value}.`);
          await this.db.insert(schema.weeklyUserMuscleVolumes) // Changed table name
            .values(newWeeklyUserMuscleVolumesData)
            .onConflictDoUpdate({
              target: [
                schema.weeklyUserMuscleVolumes.userId,
                schema.weeklyUserMuscleVolumes.muscleId,
                schema.weeklyUserMuscleVolumes.weekStart // Changed field name
              ],
              set: {
                volume: sql`excluded.volume`,
                updatedAt: sql`excluded.updated_at`,
              }
            });
          console.log("Weekly user muscle volumes upserted successfully.");
        }
      } 
      // ... (else logs from original code) ...

      // 2. Upsert into weeklyUserVolumes
      if (weeklyTotalVolumeByUser.size > 0) {
        const newWeeklyUserVolumesData = [];
        const now = new Date();
        for (const [weekStart, totals] of weeklyTotalVolumeByUser) {
          // const totalWorkouts = weeklyWorkoutSessions.get(weekStart)?.size || 0; // weeklyWorkoutSessions -> weeklyActiveDays
          const totalActiveDays = weeklyActiveDays.get(weekStart)?.size || 0;
          newWeeklyUserVolumesData.push({
            userId: userId.value,
            weekStart: weekStart,
            totalVolume: totals.totalVolume,
            avgSetVolume: totals.setCount > 0 ? totals.totalVolume / totals.setCount : 0,
            e1rmAvg: totals.e1rmCount > 0 ? totals.e1rmSum / totals.e1rmCount : null, 
            // totalWorkouts: totalWorkouts, // This column needs to be added to weeklyUserVolumes schema if desired
            updatedAt: now.toISOString(),
          });
        }
        if (newWeeklyUserVolumesData.length > 0) {
          console.log(`Upserting ${newWeeklyUserVolumesData.length} weekly user volume records for user ${userId.value}.`);
          // Assuming weeklyUserVolumes schema is defined and imported
          await this.db.insert(schema.weeklyUserVolumes)
            .values(newWeeklyUserVolumesData)
            .onConflictDoUpdate({
                target: [schema.weeklyUserVolumes.userId, schema.weeklyUserVolumes.weekStart],
                set: {
                    totalVolume: sql`excluded.total_volume`,
                    avgSetVolume: sql`excluded.avg_set_volume`,
                    e1rmAvg: sql`excluded.e1rm_avg`,
                    // totalWorkouts: sql`excluded.total_workouts`, 
                    updatedAt: sql`excluded.updated_at`,
                }
            });
            console.log("Weekly user volumes upserted successfully.");
        }
      }

      // RM計算と保存 (改修 -> weeklyUserMetrics)
      const newUserProgressMetricsData = [];
      const nowForRM = new Date(); // Can reuse 'now' from previous blocks if scope allows
      for (const set of userSets) {
        // if (set.weight === null || set.reps === null || set.weight <= 0 || set.reps <= 0 || !set.exerciseId || !set.performed_at) {
        if (set.weight === null || set.reps === null || set.weight <= 0 || set.reps <= 0 || !set.exerciseId || !set.performedAt) { // performed_at -> performedAt
          continue; 
        }

        const estimated1RM = calculateEpley1RM(set.weight, set.reps);
        // const weekStart = getISOWeekMondayString(set.performed_at); // Use weekStart
        const weekStart = getISOWeekMondayString(set.performedAt); // Use weekStart // performed_at -> performedAt
        
        const metricKey = `exercise_${set.exerciseId}_1rm_epley`; 

        // Domain entity creation removed for direct DTO construction for DB
        newUserProgressMetricsData.push({
          userId: userId.value,
          weekStart: weekStart, // Changed from periodIdentifier
          metricKey: metricKey,
          metricValue: Number.parseFloat(estimated1RM.toFixed(2)), // Ensure number type
          metricUnit: "kg", // Changed from metricType
          updatedAt: nowForRM.toISOString(),
        });
      }

      if (newUserProgressMetricsData.length > 0) {
        console.log(`Upserting ${newUserProgressMetricsData.length} weekly user metric records (1RM) for user ${userId.value}.`);
        await this.db.insert(schema.weeklyUserMetrics) // Changed table name
          .values(newUserProgressMetricsData)
          .onConflictDoUpdate({
            target: [
              schema.weeklyUserMetrics.userId,
              schema.weeklyUserMetrics.metricKey,
              schema.weeklyUserMetrics.weekStart // Changed from periodIdentifier
            ],
            set: {
              metricValue: sql`excluded.metric_value`,
              metricUnit: sql`excluded.metric_unit`, // Changed from metricType
              updatedAt: sql`excluded.updated_at`,
            }
          });
        console.log("Weekly user metrics (1RM) upserted successfully.");
      }
      // ... (else logs from original code) ...
      
      // weeklyUserActivity の集計 (改修 -> totalWorkouts は weeklyUserMetrics へ)
      console.log(`Starting weekly total workouts aggregation for user ${userId.value} (to be stored in weeklyUserMetrics).`);
      // weeklyActiveDays Map (weekStart -> Set<performedDate>) is already populated

      const newWeeklyTotalWorkoutsData = [];
      const nowForActivity = new Date();

      // if (weeklyWorkoutSessions.size > 0) { // weeklyWorkoutSessions -> weeklyActiveDays
      if (weeklyActiveDays.size > 0) {
        // for (const [weekStart, sessionIdsInWeek] of weeklyWorkoutSessions) { // weeklyWorkoutSessions -> weeklyActiveDays
        for (const [weekStart, performedDatesInWeek] of weeklyActiveDays) {
          newWeeklyTotalWorkoutsData.push({
            userId: userId.value,
            weekStart: weekStart,
            metricKey: 'total_workouts_weekly', // New metric key for weekly workouts
            // metricValue: sessionIdsInWeek.size, // Number of unique sessions -> active days
            metricValue: performedDatesInWeek.size, // Number of unique active days
            metricUnit: 'count',
            updatedAt: nowForActivity.toISOString(),
          });
        }

        if (newWeeklyTotalWorkoutsData.length > 0) {
          console.log(`Upserting ${newWeeklyTotalWorkoutsData.length} weekly total workout records for user ${userId.value} into weeklyUserMetrics.`);
          await this.db.insert(schema.weeklyUserMetrics) // Insert into weeklyUserMetrics
            .values(newWeeklyTotalWorkoutsData)
            .onConflictDoUpdate({
              target: [
                schema.weeklyUserMetrics.userId,
                schema.weeklyUserMetrics.metricKey, // metricKey for 'total_workouts_weekly'
                schema.weeklyUserMetrics.weekStart
              ],
              set: {
                metricValue: sql`excluded.metric_value`,
                metricUnit: sql`excluded.metric_unit`,
                updatedAt: sql`excluded.updated_at`,
              }
            });
          console.log("Weekly total workouts (as metrics) upserted successfully.");
        }
      } else {
        console.log(`No weekly user activity data to process for user ${userId.value} based on sessions found.`);
      }
      
      console.log(`Dashboard stats update finished for user: ${userId.value}`);
      // return { success: true, message: "Aggregation complete. Volumes and metrics processed." };
      return; // void

    } catch (error) {
      console.error(`Dashboard stats update failed for user ${userId.value}:`, error);
      // エラーメッセージからトランザクション関連の文言を削除または一般化
      // const errorMessage = error instanceof Error ? error.message : "Unknown error during aggregation.";
      // return { success: false, message: errorMessage };
      // エラーを再スローして、呼び出し元で処理できるようにする
      throw error;
    }
  }

  // (オプション) aggregateWorkoutSession メソッドの実装
}
