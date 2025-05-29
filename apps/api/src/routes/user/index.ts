import { vValidator } from "@hono/valibot-validator";
import { Hono } from "hono";
import * as v from "valibot";
import { UserIdVO } from "../../../../src/domain/shared/vo/identifier";
import { createUserContainer } from "../../container/user.container";
import type { Variables, WorkerEnv } from "../../types/env";

const userRoutes = new Hono<{ Bindings: WorkerEnv; Variables: Variables }>();

const recentExercisesSchema = v.object({
  limit: v.optional(v.string()),
  offset: v.optional(v.string()),
});

// GET /v1/me/exercises/recent - List recent exercises
userRoutes.get(
  "/exercises/recent",
  vValidator("query", recentExercisesSchema),
  async (c) => {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { limit, offset } = c.req.valid("query");
    const container = createUserContainer(c.env);

    const acceptLanguage = c.req.header("Accept-Language");
    const locale = acceptLanguage
      ? acceptLanguage.split(",")[0].split(";")[0].trim()
      : "en";

    const result = await container.listRecentExercisesHandler.execute({
      userId: new UserIdVO(userId),
      locale,
      limit: limit ? Number.parseInt(limit, 10) : 10,
      offset: offset ? Number.parseInt(offset, 10) : 0,
    });

    return c.json(result);
  },
);

export { userRoutes };
