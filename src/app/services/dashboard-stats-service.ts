import type { DrizzleD1Database } from "drizzle-orm/d1";
import { eq, and, gte, lte, inArray, sql, like } from "drizzle-orm";

import * as schema from "../../infrastructure/db/schema";
import type { UserIdVO } from "../../domain/shared/vo/identifier";
import { calculateEpley1RM } from "../../domain/formulas/strength-formulas";
import { getISOWeekMondayString, getISOWeekSundayString } from "../utils/date-utils";

// Helper function as per user's request
function calcEffectiveVolume(
  rawVolume: number,
  relShare: number,      // 0-1000 (e.g. 500 for 50%)
  tension: number,       // 0-∞ (e.g. 1.0 for standard tension)
  modifierMult = 1       // 0-2 (e.g. 1.15 for +15% multiplier)
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
      await this.db.delete(schema.weeklyUserMuscleVolumes)
        .where(eq(schema.weeklyUserMuscleVolumes.userId, userId.value));
      
      // 週間総ボリュームをクリア
      console.log(`Clearing weekly user volumes for user ${userId.value}`);
      await this.db.delete(schema.weeklyUserVolumes)
        .where(eq(schema.weeklyUserVolumes.userId, userId.value));
      
      // メトリクスデータをクリア
      console.log(`Clearing weekly metrics for user ${userId.value}`);
      await this.db.delete(schema.weeklyUserMetrics)
        .where(eq(schema.weeklyUserMetrics.userId, userId.value));
      
      console.log(`All dashboard stats cleared for user: ${userId.value}`);
    } catch (error) {
      console.error(`Error clearing dashboard stats for user ${userId.value}:`, error);
      throw error;
    }
  }

  // オリジナルの週ごとの集計処理（復元用に保存）
  async _originalUpdateStatsForUser(userId: UserIdVO, targetDate: Date): Promise<void> {
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
            gte(schema.workoutSets.performedAt, targetWeekMonday),
            lte(schema.workoutSets.performedAt, targetWeekSundayEnd.toISOString())
          )
        )
        .orderBy(schema.workoutSets.performedAt);
      
      // [以下、元のコードは省略 - このメソッドは保存用]
    } catch (error) {
      console.error(`Error updating dashboard stats for user ${userId.value} for week of ${targetDate.toISOString()}:`, error);
      throw error; 
    }
  }

  // 一時的に全期間のデータを集計するように変更したメソッド
  async updateStatsForUser(userId: UserIdVO, targetDate: Date): Promise<void> {
    console.log(`Starting full history dashboard stats update for user: ${userId.value}.`);
    
    // 指定された日付の週の情報も取得（UIで当該週を表示する際に必要）
    const targetWeekMonday = getISOWeekMondayString(targetDate);
    console.log(`Reference week for UI: ${targetWeekMonday}`);

    try {
      console.log(`Fetching ALL workout sets for user ${userId.value}.`);

      // 日付フィルターを削除して全てのセットを取得
      const userSets = await this.db
        .select()
        .from(schema.workoutSets)
        .where(
          eq(schema.workoutSets.userId, userId.value)
        )
        .orderBy(schema.workoutSets.performedAt);

      if (!userSets || userSets.length === 0) {
        console.log(`No workout sets found for user ${userId.value} in the week of ${targetWeekMonday}. Clearing existing aggregation data.`);
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

      const setIds = userSets.map(s => s.id).filter(id => id !== null) as string[];
      const setModifierMap = new Map<string, number>();
      if (setIds.length > 0) {
        const modifierRows = await this.db
          .select({
            setId: schema.setModifiers.setId,
            relMult: schema.exerciseModifierValues.relShareMultiplier,
          })
          .from(schema.setModifiers)
          .innerJoin(
            schema.exerciseModifierValues,
            eq(schema.setModifiers.exerciseModifierValueId, schema.exerciseModifierValues.id) // Join on ID as per schema
          )
          .where(inArray(schema.setModifiers.setId, setIds));
        
        for (const r of modifierRows) {
          if(r.setId) {
            setModifierMap.set(r.setId, r.relMult ?? 1); 
          }
        }
      }

      const exerciseIds = [...new Set(userSets.map(set => set.exerciseId).filter(id => id !== null))] as string[];
      const exerciseMuscleMappings = exerciseIds.length > 0 ? await this.db
        .select({
          exerciseId: schema.exerciseMuscles.exerciseId,
          muscleId: schema.exerciseMuscles.muscleId,
          relativeShare: schema.exerciseMuscles.relativeShare,
          tensionFactor: schema.muscles.tensionFactor,
        })
        .from(schema.exerciseMuscles)
        .innerJoin(schema.muscles, eq(schema.exerciseMuscles.muscleId, schema.muscles.id))
        .where(inArray(schema.exerciseMuscles.exerciseId, exerciseIds)) : [];
      
      const exerciseDetailsMap = new Map<string, { muscleId: number, relativeShare: number, tensionFactor: number }[]>();
      for (const mapping of exerciseMuscleMappings) {
        if (!mapping.exerciseId || mapping.muscleId === null || mapping.relativeShare === null || mapping.tensionFactor === null) continue;
        const details = exerciseDetailsMap.get(mapping.exerciseId) || [];
        details.push({
          muscleId: mapping.muscleId,
          relativeShare: mapping.relativeShare,
          tensionFactor: mapping.tensionFactor,
        });
        exerciseDetailsMap.set(mapping.exerciseId, details);
      }

      const weeklyVolumeByMuscle = new Map<string, Map<number, { volume: number; setCount: number; e1rmSum: number; e1rmCount: number }>>();
      const weeklyTotalVolumeByUser = new Map<string, { totalVolume: number, setCount: number, e1rmSum: number, e1rmCount: number }>();
      const weeklyActiveDays = new Map<string, Set<string>>();

      // データを週ごとにグループ化する
      for (const set of userSets) {
        if (!set.performedAt || set.volume === null || !set.exerciseId || !set.id) continue;
        
        // 各セットの実施日から週の開始日（月曜日）を計算
        const performedDate = new Date(set.performedAt);
        const weekStart = getISOWeekMondayString(performedDate);
        
        const exerciseDetails = exerciseDetailsMap.get(set.exerciseId);
        const modifierMultiplier = setModifierMap.get(set.id) ?? 1;

        if (exerciseDetails) {
          for (const detail of exerciseDetails) {
            const effectiveVolume = calcEffectiveVolume(
              set.volume, 
              detail.relativeShare, 
              detail.tensionFactor, 
              modifierMultiplier
            );
            const weeklyMuscleMap = weeklyVolumeByMuscle.get(weekStart) || new Map<number, { volume: number; setCount: number; e1rmSum: number; e1rmCount: number }>();
            const currentMuscleStats = weeklyMuscleMap.get(detail.muscleId) || { volume: 0, setCount: 0, e1rmSum: 0, e1rmCount: 0 };
            
            currentMuscleStats.volume += effectiveVolume;
            currentMuscleStats.setCount += 1;

            if (set.weight !== null && set.reps !== null && set.weight > 0 && set.reps > 0) {
              const estimated1RMForSet = calculateEpley1RM(set.weight, set.reps);
              currentMuscleStats.e1rmSum += estimated1RMForSet;
              currentMuscleStats.e1rmCount += 1;
            }
            weeklyMuscleMap.set(detail.muscleId, currentMuscleStats);
            weeklyVolumeByMuscle.set(weekStart, weeklyMuscleMap);
          }
        }

        let userWeeklyTotals = weeklyTotalVolumeByUser.get(weekStart);
        if (!userWeeklyTotals) {
          userWeeklyTotals = { totalVolume: 0, setCount: 0, e1rmSum: 0, e1rmCount: 0 };
        }
        userWeeklyTotals.totalVolume += set.volume; 
        userWeeklyTotals.setCount += 1;
        if (set.weight !== null && set.reps !== null && set.weight > 0 && set.reps > 0) {
            const estimated1RM = calculateEpley1RM(set.weight, set.reps);
            userWeeklyTotals.e1rmSum += estimated1RM;
            userWeeklyTotals.e1rmCount += 1;
        }
        weeklyTotalVolumeByUser.set(weekStart, userWeeklyTotals);

        const performedDateStr = set.performedAt.substring(0, 10);
        const activeDaysInWeek = weeklyActiveDays.get(weekStart) || new Set<string>();
        activeDaysInWeek.add(performedDateStr);
        weeklyActiveDays.set(weekStart, activeDaysInWeek);
      }
      
      console.log(`Processed weekly muscle volumes for ${weeklyVolumeByMuscle.size} weeks`);
      console.log(`Processed weekly user total volumes for ${weeklyTotalVolumeByUser.size} weeks`);

      const now = new Date().toISOString();
      
      // 1. 筋肉別の週間ボリュームデータを更新
      for (const [weekStart, muscleMap] of weeklyVolumeByMuscle.entries()) {
        const newWeeklyUserMuscleVolumesData = [];
        
        for (const [muscleIdNum, stats] of muscleMap.entries()) {
          newWeeklyUserMuscleVolumesData.push({
            userId: userId.value,
            muscleId: muscleIdNum,
            weekStart: weekStart,
            volume: stats.volume,
            setCount: stats.setCount,
            e1rmSum: stats.e1rmSum,
            e1rmCount: stats.e1rmCount,
            updatedAt: now,
          });
        }

        if (newWeeklyUserMuscleVolumesData.length > 0) {
          console.log(`Upserting ${newWeeklyUserMuscleVolumesData.length} weekly user muscle volume records for user ${userId.value} for week ${weekStart}.`);
          
          // データをより小さなバッチに分割（SQLite変数の制限を回避するため）
          const BATCH_SIZE = 50; // SQLite変数の制限を考慮したバッチサイズ
          
          for (let i = 0; i < newWeeklyUserMuscleVolumesData.length; i += BATCH_SIZE) {
            const batch = newWeeklyUserMuscleVolumesData.slice(i, i + BATCH_SIZE);
            console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(newWeeklyUserMuscleVolumesData.length / BATCH_SIZE)}, size: ${batch.length}`);
            
            try {
              // D1はトランザクションが使えないので、エラー発生時はその週のレコードのみ影響あり
              await this.db.insert(schema.weeklyUserMuscleVolumes)
                .values(batch)
                .onConflictDoUpdate({
                  target: [
                    schema.weeklyUserMuscleVolumes.userId,
                    schema.weeklyUserMuscleVolumes.muscleId,
                    schema.weeklyUserMuscleVolumes.weekStart
                  ],
                  set: {
                    volume: sql`excluded.volume`,
                    setCount: sql`excluded.set_count`,
                    e1rmSum: sql`excluded.e1rm_sum`,
                    e1rmCount: sql`excluded.e1rm_count`,
                    updatedAt: sql`excluded.updated_at`,
                  }
                });
            } catch (error) {
              console.error(`Error upserting muscle volumes batch for week ${weekStart}:`, error);
              // 処理を継続するため、エラーはスローせず次のバッチに進む
            }
          }
          
          console.log(`Weekly user muscle volumes for week ${weekStart} upserted successfully.`);
        }
      }

      // 2. ユーザー全体の週間ボリュームデータを更新
      for (const [weekStart, totals] of weeklyTotalVolumeByUser.entries()) {
        const newWeeklyUserVolumesData = {
          userId: userId.value,
          weekStart: weekStart,
          totalVolume: totals.totalVolume,
          avgSetVolume: totals.setCount > 0 ? totals.totalVolume / totals.setCount : 0,
          e1rmAvg: totals.e1rmCount > 0 ? totals.e1rmSum / totals.e1rmCount : null,
          updatedAt: now,
        };
        
        console.log(`Upserting weekly user volume record for user ${userId.value} for week ${weekStart}.`);
        try {
          await this.db.insert(schema.weeklyUserVolumes)
            .values(newWeeklyUserVolumesData)
            .onConflictDoUpdate({
              target: [schema.weeklyUserVolumes.userId, schema.weeklyUserVolumes.weekStart],
              set: {
                totalVolume: sql`excluded.total_volume`,
                avgSetVolume: sql`excluded.avg_set_volume`,
                e1rmAvg: sql`excluded.e1rm_avg`,
                updatedAt: sql`excluded.updated_at`,
              }
            });
          console.log(`Weekly user volumes for week ${weekStart} upserted successfully.`);
        } catch (error) {
          console.error(`Error upserting user volumes for week ${weekStart}:`, error);
          // 処理を継続するため、エラーはスローせず次の週に進む
        }
      }

      // 3. 1RMメトリクスデータの更新
      // セットごとに1RMを計算し、週ごとに最新のデータで上書き
      const weeklyExerciseMaxes = new Map<string, Map<string, { value: number, count: number }>>();
      
      for (const set of userSets) {
        if (set.weight === null || set.reps === null || set.weight <= 0 || set.reps <= 0 || !set.exerciseId || !set.performedAt) {
          continue;
        }
        const performedDate = new Date(set.performedAt);
        const weekStart = getISOWeekMondayString(performedDate);
        
        const estimated1RM = calculateEpley1RM(set.weight, set.reps);
        const metricKey = `exercise_${set.exerciseId}_1rm_epley`;
        
        const weeklyExerciseMap = weeklyExerciseMaxes.get(weekStart) || new Map<string, { value: number, count: number }>();
        const currentStats = weeklyExerciseMap.get(metricKey) || { value: 0, count: 0 };
        
        // 単純に合計して後で平均を取る
        currentStats.value += estimated1RM;
        currentStats.count += 1;
        
        weeklyExerciseMap.set(metricKey, currentStats);
        weeklyExerciseMaxes.set(weekStart, weeklyExerciseMap);
      }
      
      // 各週のエクササイズごとの1RMメトリクスを更新
      for (const [weekStart, exerciseMap] of weeklyExerciseMaxes.entries()) {
        const newMetricsData = [];
        
        for (const [metricKey, stats] of exerciseMap.entries()) {
          // 平均値を計算
          const avgValue = stats.count > 0 ? stats.value / stats.count : 0;
          
          newMetricsData.push({
            userId: userId.value,
            weekStart: weekStart,
            metricKey: metricKey,
            metricValue: Number.parseFloat(avgValue.toFixed(2)),
            metricUnit: "kg",
            updatedAt: now,
          });
        }
        
        if (newMetricsData.length > 0) {
          try {
            // まず該当週の古い1RMデータを削除
            console.log(`Clearing existing 1RM metrics for user ${userId.value} for week ${weekStart}`);
            await this.db.delete(schema.weeklyUserMetrics)
              .where(and(
                eq(schema.weeklyUserMetrics.userId, userId.value),
                eq(schema.weeklyUserMetrics.weekStart, weekStart),
                like(schema.weeklyUserMetrics.metricKey, 'exercise_%_1rm_epley')
              ));
            
            // バッチサイズを小さくして処理
            const BATCH_SIZE = 50;
            console.log(`Upserting ${newMetricsData.length} 1RM metrics for user ${userId.value} for week ${weekStart} in batches`);
            
            for (let i = 0; i < newMetricsData.length; i += BATCH_SIZE) {
              const batch = newMetricsData.slice(i, i + BATCH_SIZE);
              console.log(`Processing 1RM metrics batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(newMetricsData.length / BATCH_SIZE)}, size: ${batch.length}`);
              
              try {
                await this.db.insert(schema.weeklyUserMetrics)
                  .values(batch)
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
              } catch (batchError) {
                console.error(`Error upserting 1RM metrics batch for week ${weekStart}:`, batchError);
                // バッチエラーでも次に進む
              }
            }
            
            console.log(`1RM metrics for week ${weekStart} upserted successfully`);
          } catch (error) {
            console.error(`Error upserting 1RM metrics for week ${weekStart}:`, error);
            // 処理を継続
          }
        }
      }
      
      // 4. アクティブ日数メトリクスの更新
      const activeDaysMetricKey = "active_days";
      
      for (const [weekStart, activeDaysSet] of weeklyActiveDays.entries()) {
        if (activeDaysSet && activeDaysSet.size > 0) {
          const totalActiveDays = activeDaysSet.size;
          
          try {
            // 該当週の古いアクティブ日数データを削除
            console.log(`Clearing existing active days metrics for user ${userId.value} for week ${weekStart}`);
            await this.db.delete(schema.weeklyUserMetrics)
              .where(and(
                eq(schema.weeklyUserMetrics.userId, userId.value),
                eq(schema.weeklyUserMetrics.weekStart, weekStart),
                inArray(schema.weeklyUserMetrics.metricKey, [activeDaysMetricKey, 'total_workouts'])
              ));
            
            // 新しいデータを挿入
            console.log(`Upserting active days metric for user ${userId.value} for week ${weekStart}: ${totalActiveDays} days`);
            await this.db.insert(schema.weeklyUserMetrics)
              .values({
                userId: userId.value,
                weekStart: weekStart,
                metricKey: activeDaysMetricKey,
                metricValue: totalActiveDays,
                metricUnit: "days",
                updatedAt: now,
              })
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
            console.log(`Active days metric for week ${weekStart} upserted successfully`);
          } catch (error) {
            console.error(`Error upserting active days metric for week ${weekStart}:`, error);
            // 処理を継続
          }
        }
      }

      console.log(`[一時的な全期間再集計] Dashboard stats update completed for user: ${userId.value}, processed ${weeklyVolumeByMuscle.size} weeks of data.`);
      console.log('注意: 元の週単位の集計に戻す場合は、_originalUpdateStatsForUser メソッドを updateStatsForUser にリネームしてください。');

    } catch (error) {
      console.error(`Error updating dashboard stats for user ${userId.value} for week of ${targetDate.toISOString()}:`, error);
      throw error; 
    }
  }
}
