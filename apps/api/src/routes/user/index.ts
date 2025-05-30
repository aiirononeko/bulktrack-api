import { UserIdVO } from "@bulktrack/core";
import { vValidator } from "@hono/valibot-validator";
import { Hono } from "hono";
import * as v from "valibot";
import { createUserContainer } from "@bulktrack/api/container/user.container";
import type { Variables, WorkerEnv } from "@bulktrack/api/types/env";

const userRoutes = new Hono<{ Bindings: WorkerEnv; Variables: Variables }>();

const recentExercisesSchema = v.object({
  limit: v.optional(v.string()),
  offset: v.optional(v.string()),
});

// Sub-routes for /me
import { workoutRoutes } from "@bulktrack/api/routes/workouts";

// Mount workout routes under /me/workouts
userRoutes.route("/workouts", workoutRoutes);

// GET /v1/me/exercises/recent - List recent exercises
userRoutes.get(
  "/exercises/recent",
  vValidator("query", recentExercisesSchema),
  async (c) => {
    const userId = c.get("userId");
    if (!userId) {
      return c.json(
        {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
        401,
      );
    }

    const { limit, offset } = c.req.valid("query");
    const container = createUserContainer(c.env);

    const acceptLanguage = c.req.header("Accept-Language");
    const locale = acceptLanguage
      ? acceptLanguage.split(",")[0].split(";")[0].trim()
      : "en";

    const result = await container.listRecentExercisesUseCase.execute({
      userId: new UserIdVO(userId),
      locale,
      limit: limit ? Number.parseInt(limit, 10) : 20, // Default changed to match OpenAPI spec
      offset: offset ? Number.parseInt(offset, 10) : 0,
    });

    if (result.isErr()) {
      return c.json(
        {
          code: "INTERNAL_ERROR",
          message: result.getError().message,
        },
        500,
      );
    }

    // Transform to OpenAPI Exercise schema
    const exercises = result.unwrap().map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      isOfficial: true, // All exercises from the main table are official
      lastUsedAt: null, // This would need to be added from usage data
      useCount: null, // This would need to be added from usage data
    }));

    return c.json(exercises);
  },
);

export { userRoutes };
