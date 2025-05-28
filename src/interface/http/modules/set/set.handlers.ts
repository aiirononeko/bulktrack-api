import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import * as v from "valibot";
import { AddSetRequestSchema } from "../../../../application/dto/set.dto";
import { ApplicationError } from "../../../../application/errors";
import type {
  AddWorkoutSetCommand,
  WorkoutService,
} from "../../../../application/services/workout.service";
import type { UpdateWorkoutSetCommand } from "../../../../application/services/workout.service"; // Added import
import {
  ExerciseIdVO,
  UserIdVO,
  WorkoutSetIdVO,
} from "../../../../domain/shared/vo/identifier";
import type { DashboardStatsService } from "../../../../infrastructure/service/dashboard-stats-service";
import type { AppEnv } from "../../main.router";

// Copied from original router.ts for Valibot error formatting
interface PathItem {
  type: string;
  origin: "key" | "value";
  input: unknown;
  key?: unknown;
  value: unknown;
}

// Handler factory for POST /v1/sets/
export function createAddSetHttpHandler() {
  return async (c: Context<AppEnv>) => {
    const workoutService = c.var.workoutService as WorkoutService | undefined;
    const statsUpdateService = c.var.statsUpdateService as
      | DashboardStatsService
      | undefined;

    if (!workoutService) {
      console.error("WorkoutService not found for POST /sets");
      throw new HTTPException(500, { message: "Service not configured" });
    }

    const jwtPayload = c.get("jwtPayload");
    if (!jwtPayload || typeof jwtPayload.sub !== "string") {
      throw new HTTPException(401, {
        message: "Unauthorized: Missing or invalid user identifier in token",
      });
    }
    const userIdString = jwtPayload.sub;

    try {
      const body = await c.req.json();
      const validatedBody = await v.parseAsync(AddSetRequestSchema, body);

      let performedAtDate: Date = new Date(); // Default to now
      if (validatedBody.performedAt) {
        const parsedDate = new Date(validatedBody.performedAt);
        if (!Number.isNaN(parsedDate.getTime())) {
          performedAtDate = parsedDate;
        }
      }

      const commandData: AddWorkoutSetCommand = {
        userId: new UserIdVO(userIdString),
        exerciseId: new ExerciseIdVO(validatedBody.exerciseId),
        reps: validatedBody.reps,
        weight: validatedBody.weight,
        notes: validatedBody.notes,
        performedAt: performedAtDate,
        rpe: validatedBody.rpe,
      };

      const resultDto = await workoutService.addWorkoutSet(commandData);

      // Stats update
      if (statsUpdateService) {
        try {
          await statsUpdateService.updateStatsForUser(
            new UserIdVO(userIdString),
            performedAtDate,
          );
        } catch (statsError) {
          console.error(
            "Error updating dashboard stats after adding set:",
            statsError,
          );
        }
      }

      // Exercise usage recording
      try {
        await workoutService.recordExerciseUsage(
          new UserIdVO(userIdString),
          new ExerciseIdVO(validatedBody.exerciseId),
          performedAtDate,
        );
      } catch (usageError) {
        console.error(
          "Error recording exercise usage after adding set:",
          usageError,
        );
      }

      return c.json(resultDto, 201);
    } catch (error) {
      if (error instanceof v.ValiError) {
        return c.json(
          {
            error: {
              message: "Validation failed",
              code: "VALIDATION_ERROR",
              details: error.issues.map((issue) => ({
                path: issue.path?.map((p: PathItem) => p.key).join("."),
                message: issue.message,
              })),
            },
          },
          400,
        );
      }
      if (error instanceof ApplicationError) {
        return c.json(
          {
            error: {
              message: error.message,
              code: error.code,
              details: error.details,
            },
          },
          error.statusCode as 400 | 401 | 403 | 404 | 409 | 500,
        );
      }
      console.error("Error in POST /sets:", error);
      throw new HTTPException(500, {
        message: "Internal server error while adding set.",
      });
    }
  };
}

import {
  type SetUpdateRequestDto,
  SetUpdateRequestSchema,
} from "../../../../application/dto/set.dto"; // For update handler
import {
  AuthorizationError,
  NotFoundError,
} from "../../../../application/errors"; // For update/delete handlers
import type { DeleteWorkoutSetCommand } from "../../../../application/services/workout.service"; // For delete handler

export function createUpdateSetHttpHandler() {
  return async (c: Context<AppEnv>): Promise<Response> => {
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
            cause: error.issues.map((issue) => ({
              path: issue.path?.map((p: PathItem) => p.key).join("."),
              message: issue.message,
            })),
          });
        }
        throw new HTTPException(400, {
          message: "Invalid JSON in request body",
        });
      }

      const workoutService = c.var.workoutService as WorkoutService | undefined;
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
      if (requestBody.notes !== undefined)
        commandData.notes = requestBody.notes;
      if (requestBody.rpe !== undefined) commandData.rpe = requestBody.rpe;
      if (requestBody.performedAt !== undefined) {
        commandData.performedAt =
          requestBody.performedAt === null
            ? undefined
            : requestBody.performedAt;
      }
      // requestBody (SetUpdateRequestDto) does not have restSec.
      // If restSec needs to be updatable, SetUpdateRequestSchema should be modified.
      // For now, we assume it's not part of the update DTO.
      // if (requestBody.restSec !== undefined) commandData.restSec = requestBody.restSec;

      const command: UpdateWorkoutSetCommand = {
        setId: setIdParam,
        data: commandData,
        userId: new UserIdVO(userIdString),
      };

      const updatedSetDto = await workoutService.updateWorkoutSet(command);

      const statsUpdater = c.var.statsUpdateService as
        | DashboardStatsService
        | undefined;
      const currentUserId = new UserIdVO(userIdString);
      let performedAtForStats: Date;
      if (updatedSetDto.performedAt) {
        performedAtForStats = new Date(updatedSetDto.performedAt);
        if (Number.isNaN(performedAtForStats.getTime())) {
          console.warn(
            "Invalid performedAt from DTO, falling back to current time for stats.",
          );
          performedAtForStats = new Date();
        }
      } else {
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
        }
      }

      return c.json(updatedSetDto, 200);
    } catch (error: unknown) {
      if (error instanceof v.ValiError) {
        // This specific catch might be redundant if parseAsync above throws HTTPException directly
        throw new HTTPException(400, {
          message: "Validation failed",
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
      if (error instanceof ApplicationError) {
        // Catch other application errors
        throw new HTTPException(
          error.statusCode as 400 | 401 | 403 | 404 | 409 | 500,
          {
            message: error.message,
            cause: error.details,
          },
        );
      }
      if (error instanceof HTTPException) {
        throw error;
      }
      console.error("Error in updateSetHttpHandler:", error);
      throw new HTTPException(500, { message: "Internal server error" });
    }
  };
}

export function createDeleteSetHttpHandler() {
  return async (c: Context<AppEnv>) => {
    const { setId } = c.req.param();
    const payload = c.get("jwtPayload");

    if (!payload || typeof payload.sub !== "string") {
      throw new HTTPException(401, {
        message: "Unauthorized: Missing or invalid user ID in token",
      });
    }
    const userId = payload.sub;

    if (!setId) {
      throw new HTTPException(400, { message: "Set ID is required." });
    }

    const workoutService = c.var.workoutService as WorkoutService | undefined;
    if (!workoutService) {
      console.error(
        "WorkoutService not found in context. DI middleware might not have run.",
      );
      throw new HTTPException(500, {
        message: "Internal Server Configuration Error",
      });
    }

    const command: DeleteWorkoutSetCommand = {
      userId, // WorkoutService.deleteWorkoutSet expects userId as string
      setId,
    };

    try {
      await workoutService.deleteWorkoutSet(command);

      const statsUpdater = c.var.statsUpdateService as
        | DashboardStatsService
        | undefined;
      const currentUserId = new UserIdVO(userId);
      // For delete, the exact performedAt might not be readily available or relevant for re-aggregation.
      // Using current time for stats update might be a pragmatic choice, or skip if not meaningful.
      const performedAtDate = new Date();
      if (statsUpdater) {
        try {
          await statsUpdater.updateStatsForUser(currentUserId, performedAtDate);
        } catch (statsError) {
          console.error(
            `Error updating dashboard stats after deleting set ${setId}:`,
            statsError,
          );
        }
      }

      return c.body(null, 204);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new HTTPException(404, { message: error.message });
      }
      if (error instanceof AuthorizationError) {
        throw new HTTPException(403, { message: error.message });
      }
      console.error("Unexpected error in deleteSetHttpHandler:", error);
      throw new HTTPException(500, {
        message: "An unexpected error occurred.",
      });
    }
  };
}
