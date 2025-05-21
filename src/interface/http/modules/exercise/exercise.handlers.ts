import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv } from '../../main.router';
import type { SearchExercisesHandler, SearchExercisesQuery } from '../../../../app/query/exercise/search-exercise';
import type { ExerciseService, ExerciseMuscleInput } from '../../../../domain/exercise/service';
import { UserIdVO } from '../../../../domain/shared/vo/identifier';
import { toExerciseDto } from '../../../../app/dto/exercise';

// Based on src/interface/http/handlers/exercise/create.ts
interface ExerciseMuscleInputDto {
  muscle_id: number;
  relative_share: number;
  source_id?: string;
  source_details?: string;
}

export interface ExerciseCreateRequest {
  canonical_name: string;
  locale: string;
  name: string;
  aliases?: string[];
  default_muscle_id?: number;
  is_compound?: boolean;
  exercise_muscles?: ExerciseMuscleInputDto[];
}

// Handler factory for searching exercises
export function createSearchExercisesHttpHandler() {
  return async (c: Context<AppEnv>) => {
    const handler = c.get("searchExercisesHandler") as SearchExercisesHandler | undefined;
    if (!handler) {
      console.error("SearchExercisesHandler not found for GET /v1/exercises");
      throw new HTTPException(500, { message: "Search handler not configured" });
    }

    const queryParam = c.req.query('q');
    // TODO: Locale should ideally be determined from request (e.g., header, query param)
    const locale = c.req.query('locale') || 'en'; // Default to 'en' if not provided

    const jwtPayload = c.get('jwtPayload');
    if (!jwtPayload || typeof jwtPayload.sub !== 'string') {
      // For public search, this might be optional. For user-specific search, it's required.
      // Assuming search is authenticated for now as per original logic.
      throw new HTTPException(401, { message: "Unauthorized: Missing or invalid user identifier for search" });
    }
    // const userId = jwtPayload.sub; // userId is not directly part of SearchExercisesQuery

    const searchParams: SearchExercisesQuery = { q: queryParam || null, locale };
    const results = await handler.execute(searchParams);
    return c.json(results);
  };
}

// Handler factory for creating an exercise
export function createCreateExerciseHttpHandler() {
  return async (c: Context<AppEnv>) => {
    const exerciseService = c.get('exerciseService') as ExerciseService | undefined;
    const jwtPayload = c.get('jwtPayload');

    if (!exerciseService) {
      console.error("ExerciseService not found for POST /v1/exercises");
      throw new HTTPException(500, { message: "Exercise service not configured" });
    }
    if (!jwtPayload || typeof jwtPayload.sub !== 'string') {
      throw new HTTPException(401, { message: "Unauthorized: Missing or invalid user identifier" });
    }
    const authorUserId = jwtPayload.sub;

    try {
      const body = await c.req.json<ExerciseCreateRequest>();
      // TODO: Add Valibot validation for 'body' here for robustness

      const exerciseMusclesDomain: ExerciseMuscleInput[] | undefined = body.exercise_muscles?.map(dto => ({
        muscleId: dto.muscle_id, // Assuming MuscleId is number
        relativeShare: dto.relative_share,
        sourceId: dto.source_id,
        sourceDetails: dto.source_details,
      }));

      const newExercise = await exerciseService.createCustomExercise(
        body.canonical_name,
        body.locale,
        body.name,
        body.aliases,
        authorUserId,
        body.default_muscle_id,
        body.is_compound ?? false,
        exerciseMusclesDomain
      );
      
      // Convert domain entity to DTO for the response
      const exerciseDto = toExerciseDto(newExercise, body.locale);
      return c.json(exerciseDto, 201);
    } catch (error) {
      if (error instanceof HTTPException) throw error;
      // Add more specific error handling (e.g., validation errors from Valibot)
      console.error("Error creating exercise:", error);
      // Consider if error is a ValibotError and format it accordingly
      throw new HTTPException(500, { message: "Failed to create exercise" });
    }
  };
}
