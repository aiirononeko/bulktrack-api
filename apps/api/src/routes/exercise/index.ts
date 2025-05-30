import { vValidator } from "@hono/valibot-validator";
import { Hono } from "hono";
import * as v from "valibot";
import { createExerciseContainer } from "../../container/exercise.container";
import type { Variables, WorkerEnv } from "../../types/env";

const exerciseRoutes = new Hono<{
  Bindings: WorkerEnv;
  Variables: Variables;
}>();

const searchQuerySchema = v.object({
  q: v.optional(v.string()),
  limit: v.optional(v.string()),
  offset: v.optional(v.string()),
});

// GET /v1/exercises - Search exercises
exerciseRoutes.get("/", vValidator("query", searchQuerySchema), async (c) => {
  const { q, limit, offset } = c.req.valid("query");
  const container = createExerciseContainer(c.env);

  const acceptLanguage = c.req.header("Accept-Language");
  const locale = acceptLanguage
    ? acceptLanguage.split(",")[0].split(";")[0].trim()
    : "en";

  const searchResult = await container.searchExercisesUseCase.execute({
    query: q || null,
    locale,
    limit: limit ? Number.parseInt(limit, 10) : 20,
    offset: offset ? Number.parseInt(offset, 10) : 0,
  });

  if (searchResult.isErr()) {
    return c.json(
      {
        code: "INTERNAL_ERROR",
        message: searchResult.getError().message,
      },
      500,
    );
  }

  // Transform to OpenAPI Exercise schema
  const exercises = searchResult.unwrap().map((exercise) => ({
    id: exercise.id,
    name: exercise.name,
    isOfficial: true, // All exercises from the main table are official
    lastUsedAt: null, // This would need to be added from usage data
    useCount: null, // This would need to be added from usage data
  }));

  return c.json(exercises);
});

// POST /v1/exercises - Create custom exercise (TODO)
exerciseRoutes.post("/", async (c) => {
  return c.json(
    {
      code: "NOT_IMPLEMENTED",
      message: "Custom exercise creation is not yet implemented",
    },
    501,
  );
});

export { exerciseRoutes };
