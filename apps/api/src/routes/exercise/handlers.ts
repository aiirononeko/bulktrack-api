import type {
  ListRecentExercisesUseCase,
  SearchExercisesUseCase,
} from "@bulktrack/core";
import { UserIdVO } from "@bulktrack/shared-kernel";
import type { Context } from "hono";
import type { AppEnv } from "@bulktrack/api/index";

export class ExerciseHandlers {
  constructor(
    private readonly searchExercisesUseCase: SearchExercisesUseCase,
    private readonly listRecentExercisesUseCase: ListRecentExercisesUseCase,
  ) {}

  async searchExercises(c: Context<AppEnv>) {
    const query = c.req.query("q");
    const limit = Number.parseInt(c.req.query("limit") || "20", 10);
    const offset = Number.parseInt(c.req.query("offset") || "0", 10);

    const acceptLanguage = c.req.header("Accept-Language");
    const locale = acceptLanguage
      ? acceptLanguage.split(",")[0].split(";")[0].trim()
      : "en";

    const result = await this.searchExercisesUseCase.execute({
      query: query || null,
      locale,
      limit,
      offset,
    });

    if (result.isErr()) {
      return c.json({ error: result.getError().message }, 500);
    }

    return c.json(result.unwrap());
  }

  async listRecentExercises(c: Context<AppEnv>) {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const limit = Number.parseInt(c.req.query("limit") || "10", 10);
    const offset = Number.parseInt(c.req.query("offset") || "0", 10);

    const acceptLanguage = c.req.header("Accept-Language");
    const locale = acceptLanguage
      ? acceptLanguage.split(",")[0].split(";")[0].trim()
      : "en";

    const result = await this.listRecentExercisesUseCase.execute({
      userId: new UserIdVO(userId),
      locale,
      limit,
      offset,
    });

    if (result.isErr()) {
      return c.json({ error: result.getError().message }, 500);
    }

    return c.json(result.unwrap());
  }
}
