import { HTTPException } from "hono/http-exception";
import type { Context } from 'hono';
import type { AppEnv } from "../../router";
import type { DeleteWorkoutSetCommand } from "../../../../application/services/workout.service";
import { NotFoundError, AuthorizationError } from "../../../../app/errors";
import { UserIdVO } from "../../../../domain/shared/vo/identifier";

export const deleteSetHttpHandler = async (c: Context<AppEnv>) => {
  const { setId } = c.req.param();
  const payload = c.get("jwtPayload");

  if (!payload || typeof payload.sub !== 'string') {
    throw new HTTPException(401, { message: "Unauthorized: Missing or invalid user ID in token" });
  }
  const userId = payload.sub;

  if (!setId) {
    throw new HTTPException(400, { message: "Set ID is required." });
  }

  const workoutService = c.var.workoutService;
  if (!workoutService) {
    console.error("WorkoutService not found in context. DI middleware might not have run.");
    throw new HTTPException(500, { message: "Internal Server Configuration Error" });
  }

  const command: DeleteWorkoutSetCommand = {
    userId,
    setId,
  };

  try {
    await workoutService.deleteWorkoutSet(command);

    const statsUpdater = c.var.statsUpdateService;
    const currentUserId = new UserIdVO(userId);
    const performedAtDate = new Date();
    if (statsUpdater) {
      try {
        await statsUpdater.updateStatsForUser(currentUserId, performedAtDate);
      } catch (statsError) {
        console.error(`Error updating dashboard stats after deleting set ${setId}:`, statsError);
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
    // Log unexpected errors for debugging
    console.error("Unexpected error in deleteSetHttpHandler:", error);
    throw new HTTPException(500, { message: "An unexpected error occurred." });
  }
};
