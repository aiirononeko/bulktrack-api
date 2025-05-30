import type { DashboardRepository } from "@bulktrack/core";
import type {
  MuscleGroupSeries,
  MuscleGroupWeekPoint,
  WeekPoint,
} from "@bulktrack/core";
import { type Result, err, ok } from "@bulktrack/shared-kernel";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import {
  exerciseMuscles,
  exercises,
  muscleGroupTranslations,
  muscleGroups,
  muscles,
  weeklyUserMuscleVolumes,
  weeklyUserVolumes,
  workoutSets,
} from "../schema";

export class D1DashboardRepository implements DashboardRepository {
  private db: DrizzleD1Database;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  async getWeeklyVolume(
    userId: string,
    weekStart: Date,
    language: string,
  ): Promise<Result<WeekPoint | null, Error>> {
    try {
      const weekStartStr = weekStart.toISOString().split("T")[0];

      // Use aggregation table
      const results = await this.db
        .select({
          totalVolume: weeklyUserVolumes.totalVolume,
          avgSetVolume: weeklyUserVolumes.avgSetVolume,
          e1rmAvg: weeklyUserVolumes.e1rmAvg,
        })
        .from(weeklyUserVolumes)
        .where(
          and(
            eq(weeklyUserVolumes.userId, userId),
            eq(weeklyUserVolumes.weekStart, weekStartStr),
          ),
        );

      if (results.length === 0) {
        return ok(null);
      }

      const row = results[0];
      return ok({
        weekStart: weekStartStr,
        totalVolume: Number(row.totalVolume),
        avgSetVolume: Number(row.avgSetVolume),
        e1rmAvg: row.e1rmAvg ? Number(row.e1rmAvg) : null,
      });
    } catch (error) {
      return err(new Error(`Failed to get weekly volume: ${error}`));
    }
  }

  async getWeeklyVolumeTrend(
    userId: string,
    startDate: Date,
    endDate: Date,
    language: string,
  ): Promise<Result<WeekPoint[], Error>> {
    try {
      const startDateStr = startDate.toISOString().split("T")[0];
      const endDateStr = endDate.toISOString().split("T")[0];

      // Use aggregation table
      const results = await this.db
        .select({
          weekStart: weeklyUserVolumes.weekStart,
          totalVolume: weeklyUserVolumes.totalVolume,
          avgSetVolume: weeklyUserVolumes.avgSetVolume,
          e1rmAvg: weeklyUserVolumes.e1rmAvg,
        })
        .from(weeklyUserVolumes)
        .where(
          and(
            eq(weeklyUserVolumes.userId, userId),
            gte(weeklyUserVolumes.weekStart, startDateStr),
            lte(weeklyUserVolumes.weekStart, endDateStr),
          ),
        )
        .orderBy(weeklyUserVolumes.weekStart);

      console.log("Weekly volume trend query results:", results.length, "rows");
      console.log("Date range:", startDateStr, "to", endDateStr);

      const weekPoints: WeekPoint[] = results.map((row) => ({
        weekStart: row.weekStart,
        totalVolume: Number(row.totalVolume),
        avgSetVolume: Number(row.avgSetVolume),
        e1rmAvg: row.e1rmAvg ? Number(row.e1rmAvg) : null,
      }));

      return ok(weekPoints);
    } catch (error) {
      return err(new Error(`Failed to get weekly volume trend: ${error}`));
    }
  }

  async getMuscleGroupVolumes(
    userId: string,
    startDate: Date,
    endDate: Date,
    language: string,
  ): Promise<Result<MuscleGroupSeries[], Error>> {
    try {
      const startDateStr = startDate.toISOString().split("T")[0];
      const endDateStr = endDate.toISOString().split("T")[0];
      const locale = this.extractLocale(language);

      // Use aggregation table
      const results = await this.db
        .select({
          weekStart: weeklyUserMuscleVolumes.weekStart,
          muscleId: weeklyUserMuscleVolumes.muscleId,
          muscleGroupId: muscles.muscleGroupId,
          muscleGroupName: sql<string>`
            COALESCE(
              ${muscleGroupTranslations.name},
              ${muscleGroups.name}
            )
          `,
          volume: weeklyUserMuscleVolumes.volume,
          setCount: weeklyUserMuscleVolumes.setCount,
          avgE1rm: sql<number | null>`
            CASE 
              WHEN ${weeklyUserMuscleVolumes.e1rmCount} > 0 THEN
                ${weeklyUserMuscleVolumes.e1rmSum} / ${weeklyUserMuscleVolumes.e1rmCount}
              ELSE NULL
            END
          `,
        })
        .from(weeklyUserMuscleVolumes)
        .innerJoin(muscles, eq(weeklyUserMuscleVolumes.muscleId, muscles.id))
        .innerJoin(muscleGroups, eq(muscles.muscleGroupId, muscleGroups.id))
        .leftJoin(
          muscleGroupTranslations,
          and(
            eq(muscleGroupTranslations.muscleGroupId, muscleGroups.id),
            eq(muscleGroupTranslations.locale, locale),
          ),
        )
        .where(
          and(
            eq(weeklyUserMuscleVolumes.userId, userId),
            gte(weeklyUserMuscleVolumes.weekStart, startDateStr),
            lte(weeklyUserMuscleVolumes.weekStart, endDateStr),
          ),
        )
        .orderBy(weeklyUserMuscleVolumes.weekStart, muscles.muscleGroupId);

      // Convert results to MuscleGroupSeries format
      // First, we need to aggregate by muscle group since the table stores per muscle
      const groupMap = new Map<number, Map<string, MuscleGroupWeekPoint>>();

      for (const row of results) {
        if (!groupMap.has(row.muscleGroupId)) {
          groupMap.set(row.muscleGroupId, new Map());
        }

        const weekMap = groupMap.get(row.muscleGroupId)!;
        if (!weekMap.has(row.weekStart)) {
          weekMap.set(row.weekStart, {
            weekStart: row.weekStart,
            totalVolume: 0,
            setCount: 0,
            avgE1rm: null,
          });
        }

        const weekPoint = weekMap.get(row.weekStart)!;
        weekPoint.totalVolume += Number(row.volume);
        weekPoint.setCount += Number(row.setCount);

        // Average E1RM calculation
        if (row.avgE1rm !== null) {
          if (weekPoint.avgE1rm === null || weekPoint.avgE1rm === undefined) {
            weekPoint.avgE1rm = Number(row.avgE1rm);
          } else {
            // Simple average for now - could be weighted by set count
            weekPoint.avgE1rm = (weekPoint.avgE1rm + Number(row.avgE1rm)) / 2;
          }
        }
      }

      // Convert to final format
      const muscleGroupSeries: MuscleGroupSeries[] = [];
      for (const [muscleGroupId, weekMap] of groupMap) {
        // Get the group name from any row (they're all the same for a group)
        const groupName =
          results.find((r) => r.muscleGroupId === muscleGroupId)
            ?.muscleGroupName || "";

        muscleGroupSeries.push({
          muscleGroupId,
          groupName,
          points: Array.from(weekMap.values()),
        });
      }

      return ok(muscleGroupSeries);
    } catch (error) {
      return err(new Error(`Failed to get muscle group volumes: ${error}`));
    }
  }

  private extractLocale(acceptLanguage: string): string {
    // Extract primary language code (e.g., "ja" from "ja-JP")
    const primaryLang = acceptLanguage.split(",")[0]?.split("-")[0];
    return primaryLang || "en";
  }
}
