import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { JWTPayload } from "hono/utils/jwt/types";

import type { ExerciseDto } from "../../../../application/dto/exercise";
import type { ListRecentExercisesHandler } from "../../../../application/query/exercise/list-recent-exercises";
import type { ListRecentExercisesQuery } from "../../../../application/query/exercise/list-recent-exercises";
import { UserIdVO } from "../../../../domain/shared/vo/identifier";
import type { AppEnv } from "../../router";

const DEFAULT_LOCALE = "ja";
const DEFAULT_LIMIT = 20;
const DEFAULT_OFFSET = 0;

/**
 * Factory for the Hono handler for the GET /v1/me/exercises/recent API endpoint.
 * @param listRecentHandler Instance of the application layer's ListRecentExercisesHandler.
 * @returns Hono request handler function.
 */
export const createListRecentExercisesHandler = (
  listRecentHandler: ListRecentExercisesHandler,
) => {
  return async (c: Context<AppEnv>): Promise<Response> => {
    try {
      const payload = c.get("jwtPayload");
      if (!payload || typeof payload.sub !== "string") {
        throw new HTTPException(401, {
          message: "Unauthorized: Missing or invalid token subject",
        });
      }
      const userId = new UserIdVO(payload.sub);

      const localeParam = c.req.query("locale");
      const limitParam = c.req.query("limit");
      const offsetParam = c.req.query("offset");

      const locale = localeParam || DEFAULT_LOCALE;
      const limit = limitParam
        ? Number.parseInt(limitParam, 10)
        : DEFAULT_LIMIT;
      const offset = offsetParam
        ? Number.parseInt(offsetParam, 10)
        : DEFAULT_OFFSET;

      if (typeof locale !== "string") {
        throw new HTTPException(400, { message: "Invalid locale parameter" });
      }
      if (Number.isNaN(limit) || limit <= 0) {
        throw new HTTPException(400, {
          message: "Invalid limit parameter, must be a number > 0",
        });
      }
      if (Number.isNaN(offset) || offset < 0) {
        throw new HTTPException(400, {
          message: "Invalid offset parameter, must be a number >= 0",
        });
      }

      const applicationQuery: ListRecentExercisesQuery = {
        userId,
        locale,
        limit,
        offset,
      };

      const exercisesDto: ExerciseDto[] =
        await listRecentHandler.execute(applicationQuery);

      return c.json(exercisesDto, 200);
    } catch (error) {
      console.error("Error in listRecentExercises handler:", error);
      if (error instanceof HTTPException) {
        throw error;
      }
      throw new HTTPException(500, { message: "Internal Server Error" });
    }
  };
};
