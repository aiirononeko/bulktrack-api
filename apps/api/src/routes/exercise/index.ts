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

  const searchResult = await container.searchExercisesHandler.execute({
    q: q || null,
    locale,
    limit: limit ? Number.parseInt(limit, 10) : 20,
    offset: offset ? Number.parseInt(offset, 10) : 0,
  });

  return c.json(searchResult);
});

// POST /v1/exercises - Create custom exercise (TODO)
exerciseRoutes.post("/", async (c) => {
  return c.json({ error: "Not implemented" }, 501);
});

export { exerciseRoutes };
