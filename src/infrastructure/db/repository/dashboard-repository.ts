import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type {
  IDashboardRepository,
  UserDashboardBaseStats,
  CurrentWeekUserActivity,
  CurrentWeekMuscleVolume,
  MuscleVolumeOverTime,
  ExerciseTotalVolume,
  UserProgressMetric,
  UnderstimulatedMuscle,
} from "../../../domain/dashboard/repository";
import type { UserIdVO } from "../../../domain/shared/vo/identifier";
import { MuscleIdVO } from "../../../domain/shared/vo/identifier"; // Import MuscleIdVO class
import type { DashboardPeriod } from "../../../domain/dashboard/vo";
import * as schema from "../schema"; // Drizzle schema
import { eq, and, sql, desc, gte, lte, sum, countDistinct } from "drizzle-orm"; // Drizzle functions
import { WorkoutSessionIdVO, ExerciseIdVO } from "../../../domain/shared/vo/identifier"; // Added for constructor usage
import { ExerciseNameVO } from "../../../domain/exercise/vo"; // Import ExerciseNameVO

// TODO: 実際のDBクライアント型に合わせる (例: d1: D1Database)
type DrizzleDb = LibSQLDatabase<typeof schema>;
// type DrizzleDb = D1Database; // Cloudflare D1の場合

export class DrizzleDashboardRepository implements IDashboardRepository {
  constructor(private readonly db: DrizzleDb) {}

  async findBaseStats(userId: UserIdVO): Promise<UserDashboardBaseStats | null> {
    const result = await this.db
      .select({
        lastSessionId: schema.userDashboardStats.lastSessionId,
        deloadWarningSignal: schema.userDashboardStats.deloadWarningSignal,
        lastCalculatedAt: schema.userDashboardStats.lastCalculatedAt,
      })
      .from(schema.userDashboardStats)
      .where(eq(schema.userDashboardStats.userId, userId.toString()))
      .get();

    if (!result) return null;

    return {
      lastSessionId: result.lastSessionId ? new WorkoutSessionIdVO(result.lastSessionId) : null,
      deloadWarningSignal: !!result.deloadWarningSignal,
      lastCalculatedAt: new Date(result.lastCalculatedAt),
    };
  }

  async findCurrentWeekActivity(userId: UserIdVO, currentWeekIdentifier: string): Promise<CurrentWeekUserActivity | null> {
    const result = await this.db
      .select({
        totalWorkouts: schema.weeklyUserActivity.totalWorkouts,
        currentStreak: schema.weeklyUserActivity.currentStreak,
      })
      .from(schema.weeklyUserActivity)
      .where(
        and(
          eq(schema.weeklyUserActivity.userId, userId.toString()),
          eq(schema.weeklyUserActivity.weekIdentifier, currentWeekIdentifier)
        )
      )
      .get();
    
    if (!result) return null;
    
    return {
        totalWorkouts: result.totalWorkouts,
        currentStreak: result.currentStreak,
    };
  }

  async findCurrentWeekMuscleVolumes(userId: UserIdVO, currentWeekIdentifier: string): Promise<CurrentWeekMuscleVolume[]> {
    const results = await this.db
      .select({
        muscleId: schema.weeklyMuscleVolumes.muscleId,
        muscleName: schema.muscles.name,
        volume: schema.weeklyMuscleVolumes.volume,
      })
      .from(schema.weeklyMuscleVolumes)
      .leftJoin(schema.muscles, eq(schema.weeklyMuscleVolumes.muscleId, schema.muscles.id))
      .where(
        and(
          eq(schema.weeklyMuscleVolumes.userId, userId.toString()),
          eq(schema.weeklyMuscleVolumes.weekIdentifier, currentWeekIdentifier)
        )
      )
      .all();

    return results.map(r => ({
      muscleId: MuscleIdVO.create(r.muscleId), // Use MuscleIdVO.create()
      muscleName: r.muscleName ?? "Unknown Muscle",
      volume: r.volume,
    }));
  }

  private getPeriodDateRange(period: DashboardPeriod): { startDate: Date, endDate: Date } {
      const endDate = new Date();
      let daysToSubtract = 0;
      switch (period.value) {
          case '1w': daysToSubtract = 7; break;
          case '4w': daysToSubtract = 28; break;
          case '12w': daysToSubtract = 84; break;
          case '24w': daysToSubtract = 168; break;
          default: throw new Error(`Invalid period value: ${period.value}`);
      }
      const startDate = new Date(endDate.getTime() - daysToSubtract * 24 * 60 * 60 * 1000);
      endDate.setHours(23, 59, 59, 999); // Ensure end of day
      startDate.setHours(0, 0, 0, 0); // Ensure start of day
      return { startDate, endDate };
  }
  
  private formatDateForSql(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  async findPeriodMuscleVolumesOverTime(userId: UserIdVO, period: DashboardPeriod): Promise<MuscleVolumeOverTime[]> {
    const { startDate, endDate } = this.getPeriodDateRange(period);
    
    const rawWeeklyVolumes = await this.db
      .select({
        muscleId: schema.weeklyMuscleVolumes.muscleId,
        muscleName: schema.muscles.name,
        weekIdentifier: schema.weeklyMuscleVolumes.weekIdentifier,
        volume: schema.weeklyMuscleVolumes.volume,
        calculatedAt: schema.weeklyMuscleVolumes.calculatedAt, 
      })
      .from(schema.weeklyMuscleVolumes)
      .leftJoin(schema.muscles, eq(schema.weeklyMuscleVolumes.muscleId, schema.muscles.id))
      .where(
        and(
          eq(schema.weeklyMuscleVolumes.userId, userId.toString()),
          gte(schema.weeklyMuscleVolumes.calculatedAt, startDate.toISOString()), 
          lte(schema.weeklyMuscleVolumes.calculatedAt, endDate.toISOString())
        )
      )
      .orderBy(schema.weeklyMuscleVolumes.muscleId, schema.weeklyMuscleVolumes.weekIdentifier)
      .all();

    const groupedByMuscle: Record<number, { muscleName: string; weeks: { week: string; volume: number }[] }> = {};

    for (const row of rawWeeklyVolumes) {
      if (!row.muscleId || !row.weekIdentifier) continue;
      // Group by the numeric value of MuscleIdVO for the Record key
      const muscleIdValue = MuscleIdVO.create(row.muscleId).toNumber(); 
      if (!groupedByMuscle[muscleIdValue]) {
        groupedByMuscle[muscleIdValue] = { muscleName: row.muscleName ?? "Unknown", weeks: [] };
      }
      groupedByMuscle[muscleIdValue].weeks.push({ week: row.weekIdentifier, volume: row.volume });
    }

    return Object.entries(groupedByMuscle).map(([muscleIdNumStr, data]) => ({
      muscleId: MuscleIdVO.create(Number(muscleIdNumStr)),
      muscleName: data.muscleName,
      weeks: data.weeks.sort((a,b) => a.week.localeCompare(b.week)),
    }));
  }

  async findPeriodTopExercisesByVolume(userId: UserIdVO, period: DashboardPeriod): Promise<ExerciseTotalVolume[]> {
    const { startDate, endDate } = this.getPeriodDateRange(period);
    const results = await this.db
      .select({
        exerciseId: schema.workoutSets.exerciseId,
        exerciseName: schema.exercises.canonicalName,
        totalVolume: sum(schema.workoutSets.volume).mapWith(Number),
      })
      .from(schema.workoutSets)
      .leftJoin(schema.exercises, eq(schema.workoutSets.exerciseId, schema.exercises.id))
      .where(
        and(
          eq(schema.workoutSets.userId, userId.toString()),
          gte(schema.workoutSets.performed_at, startDate.toISOString()),
          lte(schema.workoutSets.performed_at, endDate.toISOString())
        )
      )
      .groupBy(schema.workoutSets.exerciseId, schema.exercises.canonicalName)
      .orderBy(desc(sum(schema.workoutSets.volume)))
      .limit(5)
      .all();

    return results.map(r => ({
      exerciseId: new ExerciseIdVO(r.exerciseId),
      exerciseName: ExerciseNameVO.create(r.exerciseName ?? "Unknown Exercise"), // Create ExerciseNameVO instance
      totalVolume: r.totalVolume || 0,
    }));
  }

  async findUserProgressMetrics(userId: UserIdVO, period: DashboardPeriod): Promise<UserProgressMetric[]> {
     const { startDate, endDate } = this.getPeriodDateRange(period);
    const results = await this.db
        .select({
            metricKey: schema.userProgressMetrics.metricKey,
            value: schema.userProgressMetrics.metricValue,
            unit: schema.userProgressMetrics.metricType,
            recordedAt: schema.userProgressMetrics.calculatedAt,
        })
        .from(schema.userProgressMetrics)
        .where(
            and(
                eq(schema.userProgressMetrics.userId, userId.toString()),
                gte(schema.userProgressMetrics.calculatedAt, startDate.toISOString()),
                lte(schema.userProgressMetrics.calculatedAt, endDate.toISOString())
            )
        )
        .orderBy(desc(schema.userProgressMetrics.calculatedAt))
        .all();

    return results.map(r => ({
        metricKey: r.metricKey,
        value: r.value ?? "",
        unit: r.unit,
        recordedAt: new Date(r.recordedAt),
    }));
  }

  async findUnderstimulatedMuscles(userId: UserIdVO, periodIdentifier: string): Promise<UnderstimulatedMuscle[]> {
    const results = await this.db
      .select({
        muscleId: schema.userUnderstimulatedMuscles.muscleId,
        muscleName: schema.muscles.name, 
      })
      .from(schema.userUnderstimulatedMuscles)
      .leftJoin(schema.muscles, eq(schema.userUnderstimulatedMuscles.muscleId, schema.muscles.id))
      .where(
        and(
          eq(schema.userUnderstimulatedMuscles.userId, userId.toString()),
          eq(schema.userUnderstimulatedMuscles.periodIdentifier, periodIdentifier)
        )
      )
      .all();
      
    return results.map(r => ({
      muscleId: MuscleIdVO.create(r.muscleId), // Use MuscleIdVO.create()
      muscleName: r.muscleName ?? "Unknown Muscle",
      lastTrained: null, 
    }));
  }
} 