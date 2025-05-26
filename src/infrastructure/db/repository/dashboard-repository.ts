import { eq, and, gte, lte, inArray, desc, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1"; 
import type { IDashboardRepository, DashboardFilters } from "../../../domain/dashboard/repository";
import type {
  WeeklyUserVolume,
  WeeklyUserMuscleVolume,
  WeeklyUserMetric,
} from "../../../domain/dashboard/entity";
import { UserIdVO, MuscleIdVO } from "../../../domain/shared/vo/identifier";

import * as schema from "../schema";

export class DashboardRepository implements IDashboardRepository {
  constructor(private readonly db: DrizzleD1Database<typeof schema>) {}

  async findWeeklyUserVolumes(filters: DashboardFilters): Promise<WeeklyUserVolume[]> {
    const conditions = [eq(schema.weeklyUserVolumes.userId, filters.userId.value)];
    if (filters.startDate) {
      conditions.push(gte(schema.weeklyUserVolumes.weekStart, filters.startDate));
    }
    if (filters.endDate) {
      conditions.push(lte(schema.weeklyUserVolumes.weekStart, filters.endDate));
    }

    const results = await this.db
      .select()
      .from(schema.weeklyUserVolumes)
      .where(and(...conditions))
      .orderBy(desc(schema.weeklyUserVolumes.weekStart));

    return results.map((r) => ({
      userId: new UserIdVO(r.userId),
      weekStart: r.weekStart,
      totalVolume: r.totalVolume,
      avgSetVolume: r.avgSetVolume,
      e1rmAvg: r.e1rmAvg,
      updatedAt: new Date(r.updatedAt),
    }));
  }

  async findWeeklyUserMuscleVolumes(filters: DashboardFilters): Promise<WeeklyUserMuscleVolume[]> {
    const conditions = [eq(schema.weeklyUserMuscleVolumes.userId, filters.userId.value)];
    if (filters.startDate) {
      conditions.push(gte(schema.weeklyUserMuscleVolumes.weekStart, filters.startDate));
    }
    if (filters.endDate) {
      conditions.push(lte(schema.weeklyUserMuscleVolumes.weekStart, filters.endDate));
    }

    // Determine the locale to use for muscle group translations
    const locale = filters.preferredLocale || 'en';

    const results = await this.db
      .select({
        userId: schema.weeklyUserMuscleVolumes.userId,
        weekStart: schema.weeklyUserMuscleVolumes.weekStart,
        muscleId: schema.weeklyUserMuscleVolumes.muscleId,
        muscleName: schema.muscles.name,
        muscleGroupId: schema.muscles.muscleGroupId,
        muscleGroupName: sql<string>`COALESCE(${schema.muscleGroupTranslations.name}, ${schema.muscleGroups.name})`.as('muscleGroupName'),
        volume: schema.weeklyUserMuscleVolumes.volume,
        setCount: schema.weeklyUserMuscleVolumes.setCount,
        e1rmSum: schema.weeklyUserMuscleVolumes.e1rmSum,
        e1rmCount: schema.weeklyUserMuscleVolumes.e1rmCount,
        updatedAt: schema.weeklyUserMuscleVolumes.updatedAt,
      })
      .from(schema.weeklyUserMuscleVolumes)
      .leftJoin(schema.muscles, eq(schema.weeklyUserMuscleVolumes.muscleId, schema.muscles.id))
      .leftJoin(schema.muscleGroups, eq(schema.muscles.muscleGroupId, schema.muscleGroups.id))
      .leftJoin(
        schema.muscleGroupTranslations,
        and(
          eq(schema.muscleGroups.id, schema.muscleGroupTranslations.muscleGroupId),
          eq(schema.muscleGroupTranslations.locale, locale)
        )
      )
      .where(and(...conditions))
      .orderBy(desc(schema.weeklyUserMuscleVolumes.weekStart), sql`COALESCE(${schema.muscleGroupTranslations.name}, ${schema.muscleGroups.name})`, schema.muscles.name);

    return results.map((r) => {
      if (r.userId === null || r.weekStart === null || r.muscleId === null || r.volume === null || r.updatedAt === null || r.setCount === null || r.e1rmSum === null || r.e1rmCount === null) {
        throw new Error("Unexpected null value in weeklyUserMuscleVolumes join result");
      }
      return {
        userId: new UserIdVO(r.userId),
        weekStart: r.weekStart,
        muscleId: MuscleIdVO.create(r.muscleId),
        muscleName: r.muscleName || undefined,
        muscleGroupId: r.muscleGroupId || undefined,
        muscleGroupName: r.muscleGroupName || undefined,
        volume: r.volume,
        setCount: r.setCount,
        e1rmSum: r.e1rmSum,
        e1rmCount: r.e1rmCount,
        updatedAt: new Date(r.updatedAt),
      };
    });
  }

  async findWeeklyUserMetrics(filters: DashboardFilters): Promise<WeeklyUserMetric[]> {
    const conditions = [eq(schema.weeklyUserMetrics.userId, filters.userId.value)];
    if (filters.startDate) {
      conditions.push(gte(schema.weeklyUserMetrics.weekStart, filters.startDate));
    }
    if (filters.endDate) {
      conditions.push(lte(schema.weeklyUserMetrics.weekStart, filters.endDate));
    }
    if (filters.metricKeys && filters.metricKeys.length > 0) {
      conditions.push(inArray(schema.weeklyUserMetrics.metricKey, filters.metricKeys));
    }

    const results = await this.db
      .select()
      .from(schema.weeklyUserMetrics)
      .where(and(...conditions))
      .orderBy(desc(schema.weeklyUserMetrics.weekStart), schema.weeklyUserMetrics.metricKey);

    return results.map((r) => ({
      userId: new UserIdVO(r.userId),
      weekStart: r.weekStart,
      metricKey: r.metricKey,
      metricValue: r.metricValue,
      metricUnit: r.metricUnit,
      updatedAt: new Date(r.updatedAt),
    }));
  }

  async findCurrentWeeklyUserVolume(
    userId: UserIdVO,
    currentWeekStart: string,
  ): Promise<WeeklyUserVolume | null> {
    const result = await this.db
      .select()
      .from(schema.weeklyUserVolumes)
      .where(and(eq(schema.weeklyUserVolumes.userId, userId.value), eq(schema.weeklyUserVolumes.weekStart, currentWeekStart)))
      .limit(1);

    if (result.length === 0) {
      return null;
    }
    const r = result[0];
    return {
      userId: new UserIdVO(r.userId),
      weekStart: r.weekStart,
      totalVolume: r.totalVolume,
      avgSetVolume: r.avgSetVolume,
      e1rmAvg: r.e1rmAvg,
      updatedAt: new Date(r.updatedAt),
    };
  }

  async findCurrentWeeklyUserMuscleVolumes(
    userId: UserIdVO,
    currentWeekStart: string,
    preferredLocale?: string,
  ): Promise<WeeklyUserMuscleVolume[]> {
    // Determine the locale to use for muscle group translations
    const locale = preferredLocale || 'en';

    const results = await this.db
      .select({
        userId: schema.weeklyUserMuscleVolumes.userId,
        weekStart: schema.weeklyUserMuscleVolumes.weekStart,
        muscleId: schema.weeklyUserMuscleVolumes.muscleId,
        muscleName: schema.muscles.name,
        muscleGroupId: schema.muscles.muscleGroupId,
        muscleGroupName: sql<string>`COALESCE(${schema.muscleGroupTranslations.name}, ${schema.muscleGroups.name})`.as('muscleGroupName'),
        volume: schema.weeklyUserMuscleVolumes.volume,
        setCount: schema.weeklyUserMuscleVolumes.setCount,
        e1rmSum: schema.weeklyUserMuscleVolumes.e1rmSum,
        e1rmCount: schema.weeklyUserMuscleVolumes.e1rmCount,
        updatedAt: schema.weeklyUserMuscleVolumes.updatedAt,
      })
      .from(schema.weeklyUserMuscleVolumes)
      .leftJoin(schema.muscles, eq(schema.weeklyUserMuscleVolumes.muscleId, schema.muscles.id))
      .leftJoin(schema.muscleGroups, eq(schema.muscles.muscleGroupId, schema.muscleGroups.id))
      .leftJoin(
        schema.muscleGroupTranslations,
        and(
          eq(schema.muscleGroups.id, schema.muscleGroupTranslations.muscleGroupId),
          eq(schema.muscleGroupTranslations.locale, locale)
        )
      )
      .where(and(eq(schema.weeklyUserMuscleVolumes.userId, userId.value), eq(schema.weeklyUserMuscleVolumes.weekStart, currentWeekStart)))
      .orderBy(sql`COALESCE(${schema.muscleGroupTranslations.name}, ${schema.muscleGroups.name})`, schema.muscles.name);

    return results.map((r) => {
      if (r.userId === null || r.weekStart === null || r.muscleId === null || r.volume === null || r.updatedAt === null || r.setCount === null || r.e1rmSum === null || r.e1rmCount === null) {
        throw new Error("Unexpected null value in currentWeeklyUserMuscleVolumes join result");
      }
      return {
        userId: new UserIdVO(r.userId),
        weekStart: r.weekStart,
        muscleId: MuscleIdVO.create(r.muscleId),
        muscleName: r.muscleName || undefined,
        muscleGroupId: r.muscleGroupId || undefined,
        muscleGroupName: r.muscleGroupName || undefined,
        volume: r.volume,
        setCount: r.setCount,
        e1rmSum: r.e1rmSum,
        e1rmCount: r.e1rmCount,
        updatedAt: new Date(r.updatedAt),
      };
    });
  }
}
