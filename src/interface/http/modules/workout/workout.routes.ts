import { Hono } from "hono";
import type { WorkoutHandlers } from "./workout.handlers";

export function createWorkoutRoutes(handlers: WorkoutHandlers): Hono {
  const router = new Hono();

  // GET /v1/me/workouts - 日別ワークアウトサマリーのリスト
  router.get("/", handlers.getWorkoutSummaries);

  // GET /v1/me/workouts/{date} - 特定の日のワークアウト詳細
  router.get("/:date", handlers.getWorkoutDetail);

  return router;
}
