import {
  DailyAggregationService,
  WeeklyAggregationService,
} from "@bulktrack/core";
import { dbSchema as schema } from "@bulktrack/infrastructure";
import { UserIdVO } from "@bulktrack/shared-kernel";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { Context } from "hono";
import type { WorkerEnv } from "@bulktrack/api/types/env";

/**
 * Debug endpoint to manually trigger aggregation for a user
 * This should only be used in development/testing
 */
export async function triggerAggregation(
  c: Context<{
    Bindings: WorkerEnv;
    Variables: {
      userId?: string;
    };
  }>,
) {
  try {
    const userId = c.get("userId") as string;
    if (!userId) {
      return c.json(
        {
          code: "UNAUTHORIZED",
          message: "User not authenticated",
        },
        401,
      );
    }

    const db = drizzle(c.env.DB);
    const userIdVO = new UserIdVO(userId);

    // Initialize services
    const dailyAggregationService = new DailyAggregationService(db, schema);
    const weeklyAggregationService = new WeeklyAggregationService(db, schema);

    // Get all workout dates for this user
    const workoutDates = await db
      .selectDistinct({
        date: sql<string>`DATE(${schema.workoutSets.performedAt})`,
      })
      .from(schema.workoutSets)
      .where(eq(schema.workoutSets.userId, userId))
      .orderBy(sql`DATE(${schema.workoutSets.performedAt}) DESC`)
      .limit(30); // Last 30 days

    console.log(`Found ${workoutDates.length} workout days for user ${userId}`);

    // Process daily aggregations
    for (const { date } of workoutDates) {
      console.log(`Processing daily aggregation for ${date}`);
      await dailyAggregationService.updateDailyAggregation(userIdVO, date);
    }

    // Get unique weeks and process weekly aggregations
    const weeks = new Set<string>();
    for (const { date } of workoutDates) {
      const weekStart = weeklyAggregationService.getWeekStart(new Date(date));
      weeks.add(weekStart);
    }

    console.log(`Processing ${weeks.size} weeks`);

    for (const weekStart of weeks) {
      console.log(`Processing weekly aggregation for week ${weekStart}`);
      await weeklyAggregationService.updateWeeklyAggregation(
        userIdVO,
        weekStart,
      );
    }

    return c.json({
      message: "Aggregation completed successfully",
      dailyCount: workoutDates.length,
      weeklyCount: weeks.size,
    });
  } catch (error) {
    console.error("Aggregation error:", error);
    return c.json(
      {
        code: "AGGREGATION_ERROR",
        message: "Failed to run aggregation",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
}
