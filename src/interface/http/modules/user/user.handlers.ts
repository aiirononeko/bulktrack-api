import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type {
  ListRecentExercisesHandler,
  ListRecentExercisesQuery,
} from "../../../../application/query/exercise/list-recent-exercises";
import { UserIdVO } from "../../../../domain/shared/vo/identifier";
import type { AppEnv } from "../../main.router";

// Handler factory for listing recent exercises for the authenticated user
export function createListRecentExercisesHttpHandler() {
  return async (c: Context<AppEnv>) => {
    const handler = c.get("listRecentExercisesHandler") as
      | ListRecentExercisesHandler
      | undefined;
    if (!handler) {
      console.error(
        "ListRecentExercisesHandler not found for /v1/me/exercises/recent",
      );
      throw new HTTPException(500, {
        message: "Recent exercises handler not configured",
      });
    }

    const jwtPayload = c.get("jwtPayload");
    if (!jwtPayload || typeof jwtPayload.sub !== "string") {
      throw new HTTPException(401, {
        message: "Unauthorized: Missing or invalid user identifier",
      });
    }
    const userIdVO = new UserIdVO(jwtPayload.sub);

    // Extract locale and pagination params
    const acceptLanguageHeader = c.req.header("accept-language");
    // TODO: Implement proper Accept-Language parsing if multiple languages/q-factors are supported.
    // For now, take the first part if available, otherwise default.
    const locale = acceptLanguageHeader
      ? acceptLanguageHeader.split(",")[0].split(";")[0].trim()
      : "en";

    const limitParam = c.req.query("limit");
    const offsetParam = c.req.query("offset");

    const limit = limitParam ? Number.parseInt(limitParam, 10) : 10; // Default limit
    const offset = offsetParam ? Number.parseInt(offsetParam, 10) : 0; // Default offset

    if (
      Number.isNaN(limit) ||
      Number.isNaN(offset) ||
      limit <= 0 ||
      offset < 0
    ) {
      throw new HTTPException(400, {
        message: "Invalid limit or offset parameters.",
      });
    }

    const queryParams: ListRecentExercisesQuery = {
      userId: userIdVO,
      locale,
      limit,
      offset,
    };
    const results = await handler.execute(queryParams);
    return c.json(results);
  };
}
