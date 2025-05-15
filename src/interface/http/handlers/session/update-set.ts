import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import * as v from 'valibot';
import type { AppEnv } from '../../router'; // Assuming AppEnv is exported from router.ts
import { WorkoutService, type UpdateWorkoutSetCommand, type WorkoutSetDto } from '../../../../application/services/workout.service'; // WorkoutSetDto is type
import { SetUpdateRequestSchema, type SetUpdateRequestDto } from '../../../../app/dto/set.dto'; // SetUpdateRequestDto is type
import { WorkoutSessionIdVO, WorkoutSetIdVO, UserIdVO } from '../../../../domain/shared/vo/identifier';
import { ApplicationError, NotFoundError, AuthorizationError } from '../../../../app/errors';

export async function updateSetHttpHandler(
  c: Context<AppEnv>
): Promise<Response> {
  try {
    const jwtPayload = c.get('jwtPayload');
    if (!jwtPayload || typeof jwtPayload.sub !== 'string') {
      throw new HTTPException(401, { message: 'Unauthorized: Missing or invalid user ID in token' });
    }
    const userIdString = jwtPayload.sub;

    const sessionIdParam = c.req.param('sessionId');
    const setIdParam = c.req.param('setId');

    let requestBody: SetUpdateRequestDto;
    try {
      const rawBody = await c.req.json();
      requestBody = await v.parseAsync(SetUpdateRequestSchema, rawBody);
    } catch (error) {
      if (error instanceof v.ValiError) {
        throw new HTTPException(400, {
          message: 'Validation failed',
          cause: error.issues.map(issue => ({ 
            path: issue.path?.map((p: { key: string | number | symbol }) => p.key).join('.'), 
            message: issue.message 
          })),
        });
      }
      throw new HTTPException(400, { message: 'Invalid JSON in request body' });
    }

    const workoutService = c.var.workoutService;
    if (!workoutService) {
      console.error('WorkoutService not found in context. DI middleware might not have run.');
      throw new HTTPException(500, { message: 'Internal Server Configuration Error' });
    }

    const commandData: UpdateWorkoutSetCommand['data'] = {};
    if (requestBody.reps !== undefined) commandData.reps = requestBody.reps;
    if (requestBody.weight !== undefined) commandData.weight = requestBody.weight;
    if (requestBody.notes !== undefined) commandData.notes = requestBody.notes;
    if (requestBody.rpe !== undefined) commandData.rpe = requestBody.rpe;
    // executedAt (from DTO) to performedAt (for command)
    if (requestBody.performedAt !== undefined) {
        commandData.performedAt = requestBody.performedAt === null ? undefined : requestBody.performedAt; // Handle null
    }
    // exerciseId is in SetUpdateRequestDto but not used by UpdateWorkoutSetCommand['data'] as per current design
    // restSec is not in SetUpdateRequestDto for now (can be added if needed, and to domain/service layers)

    const command: UpdateWorkoutSetCommand = {
      setId: setIdParam,
      data: commandData,
      // userId: new UserIdVO(userIdString), // Pass userId if service needs it for auth check for this specific set
    };

    const updatedSetDto = await workoutService.updateWorkoutSet(command);
    return c.json(updatedSetDto, 200);

  } catch (error: unknown) {
    if (error instanceof v.ValiError) { // Should be caught above, but as a safeguard
      throw new HTTPException(400, {
        message: 'Validation failed',
        cause: error.issues.map(issue => ({ 
          path: issue.path?.map((p: { key: string | number | symbol }) => p.key).join('.'), 
          message: issue.message 
        })),
      });
    }
    if (error instanceof NotFoundError) {
      throw new HTTPException(404, { message: error.message });
    }
    if (error instanceof AuthorizationError) {
      throw new HTTPException(403, { message: error.message });
    }
    // if (error instanceof ApplicationError) { // Catch other app-specific errors
    //   throw new HTTPException(error.statusCode, { message: error.message, cause: error.details });
    // }
    if (error instanceof HTTPException) {
      throw error;
    }
    console.error('Error in updateSetHttpHandler:', error);
    throw new HTTPException(500, { message: 'Internal server error' });
  }
} 