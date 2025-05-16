import type { DrizzleD1Database } from "drizzle-orm/d1";
import { eq, and, gte, lte, inArray, sql, like } from "drizzle-orm";

import * as schema from "../../infrastructure/db/schema";
import type { UserIdVO } from "../../domain/shared/vo/identifier";
import { calculateEpley1RM } from "../../domain/formulas/strength-formulas";
import { getISOWeekMondayString, getISOWeekSundayString } from "../utils/date-utils";

export class DashboardStatsService {
  constructor(private readonly db: DrizzleD1Database<typeof schema>) {}

  async updateStatsForUser(userId: UserIdVO, targetDate: Date): Promise<void> {
    console.log(`Starting dashboard stats update for user: ${userId.value} for week of ${targetDate.toISOString()}.`);
    
    const targetWeekMonday = getISOWeekMondayString(targetDate);
    // 週の最終日 (日曜日) の23:59:59.999 を取得して、gteとlteで厳密にその週のデータを取得する
    const targetWeekSundayEnd = new Date(`${getISOWeekSundayString(targetDate)}T23:59:59.999Z`);


    console.log(`Target week: ${targetWeekMonday} to ${targetWeekSundayEnd.toISOString()}`);

    try {
      console.log(`Fetching workout sets for user ${userId.value} for the week starting ${targetWeekMonday}.`);


      const userSets = await this.db
        .select()
        .from(schema.workoutSets)
        .where(
          and(
            eq(schema.workoutSets.userId, userId.value),
            // performedAt が targetWeekMonday (含む) から targetWeekSundayEnd (含む) の間
            gte(schema.workoutSets.performedAt, targetWeekMonday), 
            lte(schema.workoutSets.performedAt, targetWeekSundayEnd.toISOString())
          )
        )
        .orderBy(schema.workoutSets.performedAt);

      if (!userSets || userSets.length === 0) {
        console.log(`No workout sets found for user ${userId.value} in the week of ${targetWeekMonday}.`);
        // この週のデータがない場合、既存の集計データを削除またはゼロクリアすることも検討できるが、
        // まずは単純に何もしない（UPSERTなので影響なし、または古いデータが残る）
        // もし該当週のデータが0件になった場合に明示的にクリアしたい場合は別途処理追加が必要
        
        // 該当週のデータが0件になった場合、関連する集計テーブルからこの週のデータを削除する
        console.log(`Clearing existing aggregation data for user ${userId.value} for week ${targetWeekMonday} as no sets were found.`);
        await this.db.delete(schema.weeklyUserMuscleVolumes)
          .where(and(
            eq(schema.weeklyUserMuscleVolumes.userId, userId.value),
            eq(schema.weeklyUserMuscleVolumes.weekStart, targetWeekMonday)
          ));
        await this.db.delete(schema.weeklyUserVolumes)
          .where(and(
            eq(schema.weeklyUserVolumes.userId, userId.value),
            eq(schema.weeklyUserVolumes.weekStart, targetWeekMonday)
          ));
        await this.db.delete(schema.weeklyUserMetrics)
          .where(and(
            eq(schema.weeklyUserMetrics.userId, userId.value),
            eq(schema.weeklyUserMetrics.weekStart, targetWeekMonday)
          ));
        return; 
      }
      console.log(`Found ${userSets.length} workout sets for user ${userId.value} in the week of ${targetWeekMonday}.`);

      // 週間筋肉ボリュームの計算と保存
      // exerciseIdsの取得は、取得したuserSetsから行うので、その週のデータに限定される
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

      // weeklyVolumeByMuscle, weeklyTotalVolumeByUser, weeklyActiveDays は
      // この関数のスコープ内で、対象週のデータのみで計算されるので、
      // `targetWeekMonday` をキーとして値が設定されることになる。
      const weeklyVolumeByMuscle = new Map<string, Map<number, number>>(); 
      const weeklyTotalVolumeByUser = new Map<string, { totalVolume: number, setCount: number, e1rmSum: number, e1rmCount: number }>(); 
      const weeklyActiveDays = new Map<string, Set<string>>(); 

      for (const set of userSets) {
        if (!set.performedAt || set.volume === null || !set.exerciseId) continue; 

        // const weekStart = getISOWeekMondayString(set.performedAt);
        // userSetsは既にtargetWeekMondayの週でフィルタリングされているので、
        // ここで再度getISOWeekMondayStringを呼び出しても結果は targetWeekMonday になるはず。
        // weekStart は targetWeekMonday を使う。
        const weekStart = targetWeekMonday; 
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
        userWeeklyTotals.totalVolume += set.volume; 
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
      
      // UPSERT処理は、計算された週のデータ（targetWeekMondayをキーとするMapに入っている）のみが対象となる。
      // 既存のUPSERTロジックで問題ない。
      console.log(`Weekly muscle volumes for ${targetWeekMonday} (for weeklyUserMuscleVolumes):`, weeklyVolumeByMuscle);
      console.log(`Weekly user total volumes for ${targetWeekMonday} (for weeklyUserVolumes):`, weeklyTotalVolumeByUser);

      // 1. Upsert into weeklyUserMuscleVolumes
      // weeklyVolumeByMuscle Map には targetWeekMonday のデータのみが含まれるはず
      if (weeklyVolumeByMuscle.has(targetWeekMonday)) {
        const newWeeklyUserMuscleVolumesData = [];
        const now = new Date(); 
        const muscleMap = weeklyVolumeByMuscle.get(targetWeekMonday); // targetWeekMonday のデータがあることは確認済み
        if (!muscleMap) {
          console.error(`No muscle volume data for user ${userId.value} for week ${targetWeekMonday}.`);
          return;
        }
        for (const [muscleIdNum, volume] of muscleMap) {
          newWeeklyUserMuscleVolumesData.push({
            userId: userId.value,
            muscleId: muscleIdNum,
            weekStart: targetWeekMonday, // weekStart は targetWeekMonday
            volume: volume,
            updatedAt: now.toISOString(), 
          });
        }

        if (newWeeklyUserMuscleVolumesData.length > 0) {
          console.log(`Upserting ${newWeeklyUserMuscleVolumesData.length} weekly user muscle volume records for user ${userId.value} for week ${targetWeekMonday}.`);
          await this.db.insert(schema.weeklyUserMuscleVolumes) 
            .values(newWeeklyUserMuscleVolumesData)
            .onConflictDoUpdate({
              target: [
                schema.weeklyUserMuscleVolumes.userId,
                schema.weeklyUserMuscleVolumes.muscleId,
                schema.weeklyUserMuscleVolumes.weekStart 
              ],
              set: {
                volume: sql`excluded.volume`,
                updatedAt: sql`excluded.updated_at`,
              }
            });
          console.log("Weekly user muscle volumes upserted successfully.");
        }
      } else {
        // この週に該当する筋肉部位のボリュームデータがない場合、
        // 既存のデータを削除するか、ボリュームを0としてUPSERTするなどの対応が考えられる。
        // ここでは、該当する週のデータをクリアする処理を追加する。
        console.log(`No muscle volume data for user ${userId.value} for week ${targetWeekMonday}. Clearing existing entries if any.`);
        await this.db.delete(schema.weeklyUserMuscleVolumes)
          .where(and(
            eq(schema.weeklyUserMuscleVolumes.userId, userId.value),
            eq(schema.weeklyUserMuscleVolumes.weekStart, targetWeekMonday)
          ));
      }

      // 2. Upsert into weeklyUserVolumes
      // weeklyTotalVolumeByUser Map には targetWeekMonday のデータのみが含まれるはず
      if (weeklyTotalVolumeByUser.has(targetWeekMonday)) {
        const newWeeklyUserVolumesData = [];
        const now = new Date();
        const totals = weeklyTotalVolumeByUser.get(targetWeekMonday);
        if (!totals) {
          console.error(`No total volume data for user ${userId.value} for week ${targetWeekMonday}.`);
          return;
        }
        const totalActiveDays = weeklyActiveDays.get(targetWeekMonday)?.size || 0;
        newWeeklyUserVolumesData.push({
          userId: userId.value,
          weekStart: targetWeekMonday, // weekStart は targetWeekMonday
          totalVolume: totals.totalVolume,
          avgSetVolume: totals.setCount > 0 ? totals.totalVolume / totals.setCount : 0,
          e1rmAvg: totals.e1rmCount > 0 ? totals.e1rmSum / totals.e1rmCount : null, 
          // totalWorkouts: totalActiveDays, // スキーマに totalWorkouts があれば
          updatedAt: now.toISOString(),
        });
        
        if (newWeeklyUserVolumesData.length > 0) { // 実際には1件のはず
          console.log(`Upserting weekly user volume record for user ${userId.value} for week ${targetWeekMonday}.`);
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
      } else {
        console.log(`No total volume data for user ${userId.value} for week ${targetWeekMonday}. Clearing existing entry if any.`);
        await this.db.delete(schema.weeklyUserVolumes)
          .where(and(
            eq(schema.weeklyUserVolumes.userId, userId.value),
            eq(schema.weeklyUserVolumes.weekStart, targetWeekMonday)
          ));
      }

      // RM計算と保存 (改修 -> weeklyUserMetrics)
      // userSets は既に targetWeekMonday の週のデータにフィルタリングされている。
      // そのため、生成される newUserProgressMetricsData も targetWeekMonday の週のデータのみとなる。
      const newUserProgressMetricsData = [];
      const nowForRM = new Date(); 
      for (const set of userSets) { // この userSets はフィルタリング済み
        if (set.weight === null || set.reps === null || set.weight <= 0 || set.reps <= 0 || !set.exerciseId || !set.performedAt) { 
          continue; 
        }

        const estimated1RM = calculateEpley1RM(set.weight, set.reps);
        // const weekStart = getISOWeekMondayString(set.performedAt); 
        // weekStart は targetWeekMonday を使用
        const weekStart = targetWeekMonday; 
        
        const metricKey = `exercise_${set.exerciseId}_1rm_epley`; 

        newUserProgressMetricsData.push({
          userId: userId.value,
          weekStart: weekStart, 
          metricKey: metricKey,
          metricValue: Number.parseFloat(estimated1RM.toFixed(2)), 
          metricUnit: "kg", 
          updatedAt: nowForRM.toISOString(),
        });
      }
      
      // この週の、"exercise_..._1rm_epley" というキーパターンに一致する既存のメトリクスを一度すべて削除する。
      // その後、今計算された1RMメトリクスを挿入(UPSERT)する。
      // これにより、「今週行わなかったエクササイズの古い1RMデータ」が残ることを防ぐ。
      console.log(`Clearing existing 1RM metrics for user ${userId.value} for week ${targetWeekMonday} before upserting new ones.`);
      await this.db.delete(schema.weeklyUserMetrics)
        .where(and(
          eq(schema.weeklyUserMetrics.userId, userId.value),
          eq(schema.weeklyUserMetrics.weekStart, targetWeekMonday),
          like(schema.weeklyUserMetrics.metricKey, 'exercise_%_1rm_epley') 
        ));

      if (newUserProgressMetricsData.length > 0) {
        console.log(`Upserting ${newUserProgressMetricsData.length} weekly user metric records (1RM) for user ${userId.value} for week ${targetWeekMonday}.`);
        // onConflictDoUpdateのtargetにmetricKeyが含まれているので、実質的にUPSERTとなる
        await this.db.insert(schema.weeklyUserMetrics) 
          .values(newUserProgressMetricsData)
          .onConflictDoUpdate({ // 実際には上記のdeleteでクリアしているので、ここは実質insertになることが多い
            target: [
              schema.weeklyUserMetrics.userId,
              schema.weeklyUserMetrics.weekStart, 
              schema.weeklyUserMetrics.metricKey 
            ],
            set: {
              metricValue: sql`excluded.metric_value`,
              metricUnit: sql`excluded.metric_unit`, 
              updatedAt: sql`excluded.updated_at`,
            }
          });
        console.log("Weekly user metrics (1RM) upserted successfully.");
      }
      // 1RMを計算するセットがなかった場合 (newUserProgressMetricsDataが空) でも、
      // 事前のdelete処理でその週の1RMデータはクリアされているので、追加のelse処理は不要。
      
      // weeklyUserActivity の集計 (改修 -> totalWorkouts は weeklyUserMetrics へ)
      // weeklyActiveDays Map (weekStart -> Set<performedDate>) は targetWeekMonday のデータのみを含む
      console.log(`Starting weekly total workouts aggregation for user ${userId.value} for week ${targetWeekMonday} (to be stored in weeklyUserMetrics).`);
      
      const newWeeklyTotalWorkoutsData = [];
      const nowForActivity = new Date();
      const totalWorkoutsMetricKey = "total_workouts";

      if (weeklyActiveDays.has(targetWeekMonday)) {
        const performedDatesInWeek = weeklyActiveDays.get(targetWeekMonday);
        if (!performedDatesInWeek) {
          console.error(`No active days data for user ${userId.value} for week ${targetWeekMonday}.`);
          return;
        }
        const totalWorkouts = performedDatesInWeek.size;

        newWeeklyTotalWorkoutsData.push({
          userId: userId.value,
          weekStart: targetWeekMonday, 
          metricKey: totalWorkoutsMetricKey,
          metricValue: totalWorkouts, 
          metricUnit: "days", 
          updatedAt: nowForActivity.toISOString(),
        });
        
        if (newWeeklyTotalWorkoutsData.length > 0) { // 実際には1件のはず
          console.log(`Upserting total workouts metric for user ${userId.value} for week ${targetWeekMonday}.`);
          await this.db.insert(schema.weeklyUserMetrics)
            .values(newWeeklyTotalWorkoutsData)
            .onConflictDoUpdate({
              target: [
                schema.weeklyUserMetrics.userId,
                schema.weeklyUserMetrics.weekStart,
                schema.weeklyUserMetrics.metricKey 
              ],
              set: {
                metricValue: sql`excluded.metric_value`,
                metricUnit: sql`excluded.metric_unit`,
                updatedAt: sql`excluded.updated_at`,
              }
            });
          console.log("Total workouts metric upserted successfully.");
        }
      } else {
        // この週にアクティブな日がなかった場合、total_workouts メトリックをクリア (または0でUPSERT)
        console.log(`No active days for user ${userId.value} for week ${targetWeekMonday}. Setting total_workouts to 0 or clearing.`);
        // 0でUPSERTする方が、データが存在しない状態と区別できて良い場合もある。
        // ここでは clear する。
        await this.db.delete(schema.weeklyUserMetrics)
          .where(and(
            eq(schema.weeklyUserMetrics.userId, userId.value),
            eq(schema.weeklyUserMetrics.weekStart, targetWeekMonday),
            eq(schema.weeklyUserMetrics.metricKey, totalWorkoutsMetricKey)
          ));
      }

      console.log(`Dashboard stats update completed for user: ${userId.value} for week ${targetWeekMonday}.`);

    } catch (error) {
      console.error(`Error updating dashboard stats for user ${userId.value} for week of ${targetDate.toISOString()}:`, error);
      // ここでエラーを再スローするかどうかは呼び出し元のエラーハンドリングに依存
      // throw error; 
    }
  }

  // (オプション) aggregateWorkoutSession メソッドの実装
}
