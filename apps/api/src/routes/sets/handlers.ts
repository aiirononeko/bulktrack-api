import type { Context } from "hono";
import { z } from "zod";
import { createContainer } from "@bulktrack/api/container";
import type { WorkerEnv } from "@bulktrack/api/types/env";

// Validation schemas
const recordTrainingSetSchema = z.object({
  exerciseId: z.string().uuid(),
  weight: z.number().positive(),
  reps: z.number().int().positive(),
  rpe: z.number().min(1).max(10).optional(),
  notes: z.string().max(500).optional(),
  performedAt: z.string().datetime(), // Required according to OpenAPI spec
});

const updateSetSchema = z.object({
  exerciseId: z.string().uuid().optional(),
  weight: z.number().positive().optional(),
  reps: z.number().int().positive().optional(),
  rpe: z.number().min(1).max(10).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  performedAt: z.string().datetime().nullable().optional(),
});

export async function recordTrainingSet(
  c: Context<{
    Bindings: WorkerEnv;
    Variables: {
      userId?: string;
    };
  }>,
) {
  try {
    // Parse and validate request body
    const body = await c.req.json();
    const validationResult = recordTrainingSetSchema.safeParse(body);

    if (!validationResult.success) {
      return c.json(
        {
          code: "VALIDATION_ERROR",
          message: "Invalid request data",
          details: validationResult.error.flatten(),
        },
        400,
      );
    }

    // Get user ID from auth context (assuming auth middleware sets this)
    const userId = c.get("userId") as string;
    if (!userId) {
      return c.json(
        {
          code: "UNAUTHORIZED",
          message: "User not authenticated",
        },
        401,
      );
    }

    // Create container with env bindings
    const container = createContainer(c.env);

    // Execute use case
    const result = await container.recordTrainingSetUseCase.execute({
      userId,
      exerciseId: validationResult.data.exerciseId,
      weight: validationResult.data.weight,
      reps: validationResult.data.reps,
      rpe: validationResult.data.rpe,
      notes: validationResult.data.notes,
      performedAt: new Date(validationResult.data.performedAt), // Always required now
    });

    if (result.isFailure()) {
      const error = result.getError();
      // Safe error handling without type assertions
      const errorCode =
        error instanceof Error && "code" in error
          ? String(error.code)
          : "RECORD_FAILED";

      return c.json(
        {
          code: errorCode,
          message: error.message,
        },
        422,
      );
    }

    const createdSet = result.getValue();

    // Fetch the full set details to return
    const setResult = await container.trainingSetRepository.findById(
      createdSet.setId,
    );

    if (setResult.isFailure()) {
      throw new Error("Failed to fetch created set");
    }

    const set = setResult.getValue();

    // Return WorkoutSet format as per OpenAPI spec
    return c.json(
      {
        id: set.id.value,
        exerciseId: set.exerciseId.value,
        setNumber: 1, // TODO: Implement proper set numbering from database
        weight: set.weight.value,
        reps: set.reps.value,
        rpe: set.rpe?.value || null,
        notes: set.notes || null,
        performedAt: set.performedAt.toISOString(),
      },
      201,
    );
  } catch (error) {
    console.error("Unexpected error in recordTrainingSet:", error);
    return c.json(
      {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
      500,
    );
  }
}

export async function getTrainingSets(
  c: Context<{
    Bindings: WorkerEnv;
    Variables: {
      userId?: string;
    };
  }>,
) {
  try {
    const userId = c.get("userId") as string;
    if (!userId) {
      return c.json(
        {
          code: "UNAUTHORIZED",
          message: "User not authenticated",
        },
        401,
      );
    }

    // Parse query parameters
    const limit = Number.parseInt(c.req.query("limit") || "50");
    const offset = Number.parseInt(c.req.query("offset") || "0");
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");

    const container = createContainer(c.env);

    // Fetch training sets
    const result = await container.trainingSetRepository.findByUserId(userId, {
      limit,
      offset,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    if (result.isFailure()) {
      return c.json(
        {
          code: "DATABASE_ERROR",
          message: "Failed to fetch training sets",
        },
        500,
      );
    }

    const sets = result.getValue();

    // Return array of WorkoutSet objects as per OpenAPI spec
    return c.json(
      sets.map((set, index) => ({
        id: set.id.value,
        exerciseId: set.exerciseId.value,
        setNumber: index + 1, // TODO: Implement proper set numbering from database
        weight: set.weight.value,
        reps: set.reps.value,
        rpe: set.rpe?.value || null,
        notes: set.notes || null,
        performedAt: set.performedAt.toISOString(),
      })),
    );
  } catch (error) {
    console.error("Unexpected error in getTrainingSets:", error);
    return c.json(
      {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
      500,
    );
  }
}

export async function updateSet(
  c: Context<{
    Bindings: WorkerEnv;
    Variables: {
      userId?: string;
    };
  }>,
) {
  try {
    const userId = c.get("userId") as string;
    if (!userId) {
      return c.json(
        {
          code: "UNAUTHORIZED",
          message: "User not authenticated",
        },
        401,
      );
    }

    const setId = c.req.param("setId");
    if (!setId) {
      return c.json(
        {
          code: "INVALID_REQUEST",
          message: "Set ID is required",
        },
        400,
      );
    }

    const body = await c.req.json();
    const validationResult = updateSetSchema.safeParse(body);

    if (!validationResult.success) {
      return c.json(
        {
          code: "VALIDATION_ERROR",
          message: "Invalid request data",
          details: validationResult.error.flatten(),
        },
        400,
      );
    }

    const container = createContainer(c.env);

    // First, check if set exists and belongs to user
    const existingSetResult =
      await container.trainingSetRepository.findById(setId);
    if (existingSetResult.isFailure()) {
      return c.json(
        {
          code: "NOT_FOUND",
          message: "Set not found",
        },
        404,
      );
    }

    const existingSet = existingSetResult.getValue();
    if (existingSet.userId.value !== userId) {
      return c.json(
        {
          code: "FORBIDDEN",
          message: "You don't have permission to update this set",
        },
        403,
      );
    }

    // Update the set
    const updateResult = await container.updateTrainingSetUseCase.execute({
      setId,
      userId,
      ...validationResult.data,
      performedAt: validationResult.data.performedAt
        ? new Date(validationResult.data.performedAt)
        : undefined,
    });

    if (updateResult.isFailure()) {
      const error = updateResult.getError();
      // Safe error handling without type assertions
      const errorCode =
        error instanceof Error && "code" in error
          ? String(error.code)
          : "UPDATE_FAILED";

      return c.json(
        {
          code: errorCode,
          message: error.message,
        },
        422,
      );
    }

    const updatedSet = updateResult.getValue();

    // Return WorkoutSet format as per OpenAPI spec
    return c.json({
      id: updatedSet.id.value,
      exerciseId: updatedSet.exerciseId.value,
      setNumber: 1, // TODO: Implement proper set numbering from database
      weight: updatedSet.weight.value,
      reps: updatedSet.reps.value,
      rpe: updatedSet.rpe?.value || null,
      notes: updatedSet.notes || null,
      performedAt: updatedSet.performedAt.toISOString(),
    });
  } catch (error) {
    console.error("Unexpected error in updateSet:", error);
    return c.json(
      {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
      500,
    );
  }
}

export async function deleteSet(
  c: Context<{
    Bindings: WorkerEnv;
    Variables: {
      userId?: string;
    };
  }>,
) {
  try {
    const userId = c.get("userId") as string;
    if (!userId) {
      return c.json(
        {
          code: "UNAUTHORIZED",
          message: "User not authenticated",
        },
        401,
      );
    }

    const setId = c.req.param("setId");
    if (!setId) {
      return c.json(
        {
          code: "INVALID_REQUEST",
          message: "Set ID is required",
        },
        400,
      );
    }

    const container = createContainer(c.env);

    // First, check if set exists and belongs to user
    const existingSetResult =
      await container.trainingSetRepository.findById(setId);
    if (existingSetResult.isFailure()) {
      return c.json(
        {
          code: "NOT_FOUND",
          message: "Set not found",
        },
        404,
      );
    }

    const existingSet = existingSetResult.getValue();
    if (existingSet.userId.value !== userId) {
      return c.json(
        {
          code: "FORBIDDEN",
          message: "You don't have permission to delete this set",
        },
        403,
      );
    }

    // Delete the set
    const deleteResult = await container.deleteTrainingSetUseCase.execute({
      setId,
      userId,
    });

    if (deleteResult.isFailure()) {
      const error = deleteResult.getError();
      // Safe error handling without type assertions
      const errorCode =
        error instanceof Error && "code" in error
          ? String(error.code)
          : "DELETE_FAILED";

      return c.json(
        {
          code: errorCode,
          message: error.message,
        },
        422,
      );
    }

    return c.body(null, 204);
  } catch (error) {
    console.error("Unexpected error in deleteSet:", error);
    return c.json(
      {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
      500,
    );
  }
}
