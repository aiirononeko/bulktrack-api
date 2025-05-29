import type { DrizzleD1Database } from "drizzle-orm/d1";
import { GetWorkoutDetailQuery } from "../../../../application/query/workout-history/get-workout-detail";
import { GetWorkoutSummariesQuery } from "../../../../application/query/workout-history/get-workout-summaries";
import type * as schema from "../../../../infrastructure/db/schema";
import { WorkoutHandlers } from "../../modules/workout/workout.handlers";

export function createWorkoutContainer(
  db: DrizzleD1Database<any>,
  dbSchema: typeof schema,
) {
  // Query services
  const getWorkoutSummariesQuery = new GetWorkoutSummariesQuery(db, dbSchema);
  const getWorkoutDetailQuery = new GetWorkoutDetailQuery(db, dbSchema);

  // Handlers
  const handlers = new WorkoutHandlers(
    getWorkoutSummariesQuery,
    getWorkoutDetailQuery,
  );

  return {
    handlers,
  };
}
