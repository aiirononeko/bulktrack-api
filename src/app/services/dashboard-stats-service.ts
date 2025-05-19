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
            gte(schema.workoutSets.performedAt, targetWeekMonday),
            lte(schema.workoutSets.performedAt, targetWeekSundayEnd.toISOString())
          )
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

      for (const set of userSets) {
        if (!set.performedAt || set.volume === null || !set.exerciseId || !set.id) continue;
        const weekStart = targetWeekMonday;
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
            userWeeklyTotals.e1rmCount +=1;
        }
        weeklyTotalVolumeByUser.set(weekStart, userWeeklyTotals);

        const performedDate = set.performedAt.substring(0, 10);
        const activeDaysInWeek = weeklyActiveDays.get(weekStart) || new Set<string>();
        activeDaysInWeek.add(performedDate);
        weeklyActiveDays.set(weekStart, activeDaysInWeek);
      }
      
      console.log(`Weekly muscle volumes for ${targetWeekMonday} (for weeklyUserMuscleVolumes):`, weeklyVolumeByMuscle);
      console.log(`Weekly user total volumes for ${targetWeekMonday} (for weeklyUserVolumes):`, weeklyTotalVolumeByUser);

      const now = new Date().toISOString();
      if (weeklyVolumeByMuscle.has(targetWeekMonday)) {
        const newWeeklyUserMuscleVolumesData = [];
        const muscleMap = weeklyVolumeByMuscle.get(targetWeekMonday);
        if (muscleMap) {
          for (const [muscleIdNum, stats] of muscleMap) {
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
                setCount: sql`excluded.set_count`,
                e1rmSum: sql`excluded.e1rm_sum`,
                e1rmCount: sql`excluded.e1rm_count`,
                updatedAt: sql`excluded.updated_at`,
              }
            });
          console.log("Weekly user muscle volumes upserted successfully.");
        }
      } else {
        console.log(`No muscle volume data for user ${userId.value} for week ${targetWeekMonday}. Clearing existing entries if any.`);
        await this.db.delete(schema.weeklyUserMuscleVolumes)
          .where(and(
            eq(schema.weeklyUserMuscleVolumes.userId, userId.value),
            eq(schema.weeklyUserMuscleVolumes.weekStart, targetWeekMonday)
          ));
      }

      if (weeklyTotalVolumeByUser.has(targetWeekMonday)) {
        const newWeeklyUserVolumesData = [];
        const totals = weeklyTotalVolumeByUser.get(targetWeekMonday);
        if (totals) {
          newWeeklyUserVolumesData.push({
            userId: userId.value,
            weekStart: targetWeekMonday,
            totalVolume: totals.totalVolume,
            avgSetVolume: totals.setCount > 0 ? totals.totalVolume / totals.setCount : 0,
            e1rmAvg: totals.e1rmCount > 0 ? totals.e1rmSum / totals.e1rmCount : null,
            updatedAt: now,
          });
        }
        
        if (newWeeklyUserVolumesData.length > 0) {
          console.log(`Upserting weekly user volume record for user ${userId.value} for week ${targetWeekMonday}.`);
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

      const newUserProgressMetricsData1RM = [];
      for (const set of userSets) {
        if (set.weight === null || set.reps === null || set.weight <= 0 || set.reps <= 0 || !set.exerciseId || !set.performedAt) {
          continue;
        }
        const estimated1RM = calculateEpley1RM(set.weight, set.reps);
        const metricKey = `exercise_${set.exerciseId}_1rm_epley`;
        newUserProgressMetricsData1RM.push({
          userId: userId.value,
          weekStart: targetWeekMonday,
          metricKey: metricKey,
          metricValue: Number.parseFloat(estimated1RM.toFixed(2)),
          metricUnit: "kg",
          updatedAt: now,
        });
      }
      
      console.log(`Clearing existing 1RM metrics for user ${userId.value} for week ${targetWeekMonday} before upserting new ones.`);
      await this.db.delete(schema.weeklyUserMetrics)
        .where(and(
          eq(schema.weeklyUserMetrics.userId, userId.value),
          eq(schema.weeklyUserMetrics.weekStart, targetWeekMonday),
          like(schema.weeklyUserMetrics.metricKey, 'exercise_%_1rm_epley')
        ));

      if (newUserProgressMetricsData1RM.length > 0) {
        console.log(`Upserting ${newUserProgressMetricsData1RM.length} weekly user metric records (1RM) for user ${userId.value} for week ${targetWeekMonday}.`);
        await this.db.insert(schema.weeklyUserMetrics)
          .values(newUserProgressMetricsData1RM)
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
        console.log("Weekly user metrics (1RM) upserted successfully.");
      }
      
      const newWeeklyActiveDaysData = [];
      const activeDaysMetricKey = "active_days";

      if (weeklyActiveDays.has(targetWeekMonday)) {
        const performedDatesInWeek = weeklyActiveDays.get(targetWeekMonday);
        if (performedDatesInWeek) {
          const totalActiveDays = performedDatesInWeek.size;

          newWeeklyActiveDaysData.push({
            userId: userId.value,
            weekStart: targetWeekMonday,
            metricKey: activeDaysMetricKey,
            metricValue: totalActiveDays,
            metricUnit: "days",
            updatedAt: now,
          });
        }
        
        if (newWeeklyActiveDaysData.length > 0) {
          console.log(`Upserting ${activeDaysMetricKey} metric for user ${userId.value} for week ${targetWeekMonday}.`);
          await this.db.delete(schema.weeklyUserMetrics)
            .where(and(
              eq(schema.weeklyUserMetrics.userId, userId.value),
              eq(schema.weeklyUserMetrics.weekStart, targetWeekMonday),
              eq(schema.weeklyUserMetrics.metricKey, 'total_workouts')
            ));

          await this.db.insert(schema.weeklyUserMetrics)
            .values(newWeeklyActiveDaysData)
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
          console.log(`${activeDaysMetricKey} metric upserted successfully.`);
        }
      } else {
        console.log(`No active days for user ${userId.value} for week ${targetWeekMonday}. Clearing ${activeDaysMetricKey} and 'total_workouts' metrics.`);
        await this.db.delete(schema.weeklyUserMetrics)
          .where(and(
            eq(schema.weeklyUserMetrics.userId, userId.value),
            eq(schema.weeklyUserMetrics.weekStart, targetWeekMonday),
            inArray(schema.weeklyUserMetrics.metricKey, [activeDaysMetricKey, 'total_workouts'])
          ));
      }

      console.log(`Dashboard stats update completed for user: ${userId.value} for week ${targetWeekMonday}.`);

    } catch (error) {
      console.error(`Error updating dashboard stats for user ${userId.value} for week of ${targetDate.toISOString()}:`, error);
      throw error; 
    }
  }
}
