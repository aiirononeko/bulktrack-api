import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import * as v from "valibot";
import {
  type SetUpdateRequestDto,
  SetUpdateRequestSchema,
} from "../../../../application/dto/set.dto";
import {
  ApplicationError,
  AuthorizationError,
  NotFoundError,
} from "../../../../application/errors";
import {
  type UpdateWorkoutSetCommand,
  WorkoutService,
} from "../../../../application/services/workout.service"; // WorkoutSetDto を削除 (未使用のため)
import {
  UserIdVO,
  WorkoutSetIdVO,
} from "../../../../domain/shared/vo/identifier"; // WorkoutSessionIdVO を削除
import type { AppEnv } from "../../router"; // AppEnvのPathItem定義を期待

// ValibotのIssuePathの要素の型定義 (valibotから直接エクスポートされていないためローカルで定義)
interface PathItem {
  type: string;
  origin: "key" | "value";
  input: unknown;
  key?: unknown;
  value: unknown;
}

// router.ts で定義された PathItem を利用することを想定
// もし router.ts 以外でこのファイルが単独で利用される場合は、ここでも PathItem を定義する必要がある
// interface PathItem { key?: string | number | symbol | undefined; /* ... more specific type ... */ }

export async function updateSetHttpHandler(
  c: Context<AppEnv>,
): Promise<Response> {
  try {
    const jwtPayload = c.get("jwtPayload");
    if (!jwtPayload || typeof jwtPayload.sub !== "string") {
      throw new HTTPException(401, {
        message: "Unauthorized: Missing or invalid user ID in token",
      });
    }
    const userIdString = jwtPayload.sub;

    const setIdParam = c.req.param("setId");

    let requestBody: SetUpdateRequestDto;
    try {
      const rawBody = await c.req.json();
      requestBody = await v.parseAsync(SetUpdateRequestSchema, rawBody);
    } catch (error) {
      if (error instanceof v.ValiError) {
        throw new HTTPException(400, {
          message: "Validation failed",
          // router.tsのPathItem型を参照することを期待
          cause: error.issues.map((issue) => ({
            path: issue.path?.map((p: PathItem) => p.key).join("."),
            message: issue.message,
          })),
        });
      }
      throw new HTTPException(400, { message: "Invalid JSON in request body" });
    }

    const workoutService = c.var.workoutService;
    if (!workoutService) {
      console.error(
        "WorkoutService not found in context. DI middleware might not have run.",
      );
      throw new HTTPException(500, {
        message: "Internal Server Configuration Error",
      });
    }

    const commandData: UpdateWorkoutSetCommand["data"] = {};
    if (requestBody.reps !== undefined) commandData.reps = requestBody.reps;
    if (requestBody.weight !== undefined)
      commandData.weight = requestBody.weight;
    if (requestBody.notes !== undefined) commandData.notes = requestBody.notes;
    if (requestBody.rpe !== undefined) commandData.rpe = requestBody.rpe;
    if (requestBody.performedAt !== undefined) {
      commandData.performedAt =
        requestBody.performedAt === null ? undefined : requestBody.performedAt;
    }

    const command: UpdateWorkoutSetCommand = {
      setId: setIdParam,
      data: commandData,
      userId: new UserIdVO(userIdString), // userId を設定
    };

    const updatedSetDto = await workoutService.updateWorkoutSet(command);

    // 統計更新処理の呼び出し
    const statsUpdater = c.var.statsUpdateService;
    const currentUserId = new UserIdVO(userIdString);
    let performedAtForStats: Date;
    if (updatedSetDto.performedAt) {
      performedAtForStats = new Date(updatedSetDto.performedAt);
      if (Number.isNaN(performedAtForStats.getTime())) {
        // 不正な日付の場合は現在時刻でフォールバック
        console.warn(
          "Invalid performedAt from DTO, falling back to current time for stats.",
        );
        performedAtForStats = new Date();
      }
    } else {
      // performedAt が DTO にない場合は現在時刻でフォールバック
      console.warn(
        "performedAt not found in DTO, falling back to current time for stats.",
      );
      performedAtForStats = new Date();
    }

    if (statsUpdater) {
      try {
        await statsUpdater.updateStatsForUser(
          currentUserId,
          performedAtForStats,
        );
      } catch (statsError) {
        console.error(
          `Error updating dashboard stats after updating set ${setIdParam}:`,
          statsError,
        );
        // ここでのエラーはメインのレスポンスに影響させない
      }
    } else {
      // console.warn(`StatsUpdateService not found, skipping stats update for user ${userIdString} after updating set ${setIdParam}`);
    }

    return c.json(updatedSetDto, 200);
  } catch (error: unknown) {
    if (error instanceof v.ValiError) {
      throw new HTTPException(400, {
        message: "Validation failed",
        // router.tsのPathItem型を参照することを期待
        cause: error.issues.map((issue) => ({
          path: issue.path?.map((p: PathItem) => p.key).join("."),
          message: issue.message,
        })),
      });
    }
    if (error instanceof NotFoundError) {
      throw new HTTPException(404, { message: error.message });
    }
    if (error instanceof AuthorizationError) {
      throw new HTTPException(403, { message: error.message });
    }
    if (error instanceof HTTPException) {
      throw error;
    }
    console.error("Error in updateSetHttpHandler:", error);
    throw new HTTPException(500, { message: "Internal server error" });
  }
}
