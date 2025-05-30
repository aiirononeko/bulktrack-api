import { WeeklyAggregationService } from "@bulktrack/core";
import * as schema from "@bulktrack/infrastructure/database/schema";
import { UserIdVO } from "@bulktrack/shared-kernel";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

/**
 * Script to populate aggregation tables from existing workout data
 * Run this after migrations to ensure dashboard data is available
 */

// This script should be run with wrangler or in a worker context
// Example: wrangler d1 execute bulktrack-db --file=scripts/populate_aggregations.sql

export async function populateAggregations(db: D1Database) {
  const drizzleDb = drizzle(db);
  const weeklyAggregationService = new WeeklyAggregationService(
    drizzleDb,
    schema,
  );

  try {
    // 1. Get all unique users who have workout data
    const users = await drizzleDb
      .selectDistinct({
        userId: schema.workoutSets.userId,
      })
      .from(schema.workoutSets);

    console.log(`Found ${users.length} users with workout data`);

    for (const user of users) {
      const userId = new UserIdVO(user.userId);

      // 2. Get all distinct weeks for this user
      const weeks = await drizzleDb
        .selectDistinct({
          weekStart: sql<string>`
            DATE(
              DATE(${schema.workoutSets.performedAt}, 
                'weekday 0', 
                '-6 days'
              )
            )
          `.as("weekStart"),
        })
        .from(schema.workoutSets)
        .where(sql`${schema.workoutSets.userId} = ${user.userId}`)
        .orderBy(sql`weekStart`);

      console.log(`User ${user.userId} has data for ${weeks.length} weeks`);

      // 3. Update aggregations for each week
      for (const week of weeks) {
        if (week.weekStart) {
          console.log(
            `Updating aggregations for user ${user.userId}, week ${week.weekStart}`,
          );
          await weeklyAggregationService.updateWeeklyAggregation(
            userId,
            week.weekStart,
          );
        }
      }
    }

    console.log("Aggregation population completed successfully");
  } catch (error) {
    console.error("Error populating aggregations:", error);
    throw error;
  }
}

// For running directly if needed
if (import.meta.main) {
  // This would need to be run in a worker context with access to D1
  console.log("This script needs to be run in a Cloudflare Worker context");
}
