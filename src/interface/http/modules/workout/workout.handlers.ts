import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { GetWorkoutDetailQuery } from "../../../../application/query/workout-history/get-workout-detail";
import type { GetWorkoutSummariesQuery } from "../../../../application/query/workout-history/get-workout-summaries";
import { parseIntWithDefault } from "../../../../application/utils/parse-utils";
import { UserIdVO } from "../../../../domain/shared/vo/identifier";

export class WorkoutHandlers {
  constructor(
    private readonly getWorkoutSummariesQuery: GetWorkoutSummariesQuery,
    private readonly getWorkoutDetailQuery: GetWorkoutDetailQuery,
  ) {}

  /**
   * GET /v1/me/workouts
   * 日別ワークアウトサマリーのリストを取得
   */
  getWorkoutSummaries = async (c: Context) => {
    const jwtPayload = c.get("jwtPayload");
    if (!jwtPayload || typeof jwtPayload.sub !== "string") {
      throw new HTTPException(401, {
        message: "Unauthorized: Missing or invalid user identifier in token",
      });
    }
    const userId = new UserIdVO(jwtPayload.sub);

    // クエリパラメータを取得
    const limit = parseIntWithDefault(c.req.query("limit"), 20);
    const offset = parseIntWithDefault(c.req.query("offset"), 0);
    const locale = c.req.header("Accept-Language") || "en";

    // バリデーション
    if (limit > 100) {
      return c.json(
        { code: "INVALID_PARAMETER", message: "Limit cannot exceed 100" },
        400,
      );
    }

    try {
      const summaries = await this.getWorkoutSummariesQuery.execute(
        userId,
        limit,
        offset,
        locale,
      );

      return c.json(summaries);
    } catch (error) {
      console.error("Error fetching workout summaries:", error);
      return c.json(
        {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch workout summaries",
        },
        500,
      );
    }
  };

  /**
   * GET /v1/me/workouts/{date}
   * 特定の日のワークアウト詳細を取得
   */
  getWorkoutDetail = async (c: Context) => {
    const jwtPayload = c.get("jwtPayload");
    if (!jwtPayload || typeof jwtPayload.sub !== "string") {
      throw new HTTPException(401, {
        message: "Unauthorized: Missing or invalid user identifier in token",
      });
    }
    const userId = new UserIdVO(jwtPayload.sub);
    const date = c.req.param("date");
    const locale = c.req.header("Accept-Language") || "en";

    // 日付フォーマットの簡易バリデーション (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return c.json(
        {
          code: "INVALID_DATE_FORMAT",
          message: "Date must be in YYYY-MM-DD format",
        },
        400,
      );
    }

    try {
      const workoutDetail = await this.getWorkoutDetailQuery.execute(
        userId,
        date,
        locale,
      );

      if (!workoutDetail) {
        return c.json(
          {
            code: "NOT_FOUND",
            message: "No workout data found for the specified date",
          },
          404,
        );
      }

      return c.json(workoutDetail);
    } catch (error) {
      console.error("Error fetching workout detail:", error);
      return c.json(
        { code: "INTERNAL_ERROR", message: "Failed to fetch workout detail" },
        500,
      );
    }
  };
}
