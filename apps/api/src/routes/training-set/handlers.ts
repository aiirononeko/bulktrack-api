import type { Context } from "hono";
import { z } from "zod";
import { createContainer } from "../../container";
import type { WorkerEnv } from "../../types/env";

// Validation schemas
const recordTrainingSetSchema = z.object({
  exerciseId: z.string().uuid(),
  weight: z.number().positive(),
  reps: z.number().int().positive(),
  rpe: z.number().min(1).max(10).optional(),
  restSeconds: z.number().int().nonnegative().optional(),
  notes: z.string().max(500).optional(),
  performedAt: z.string().datetime().optional(),
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
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request data",
            details: validationResult.error.flatten(),
          },
        },
        400,
      );
    }

    // Get user ID from auth context (assuming auth middleware sets this)
    const userId = c.get("userId") as string;
    if (!userId) {
      return c.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "User not authenticated",
          },
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
      restSeconds: validationResult.data.restSeconds,
      notes: validationResult.data.notes,
      performedAt: validationResult.data.performedAt
        ? new Date(validationResult.data.performedAt)
        : undefined,
    });

    if (result.isFailure()) {
      return c.json(
        {
          success: false,
          error: {
            code: result.getError().code,
            message: result.getError().message,
            details: result.getError().details,
          },
        },
        422,
      );
    }

    const { setId, volume } = result.getValue();

    return c.json(
      {
        success: true,
        data: {
          setId,
          volume,
        },
      },
      201,
    );
  } catch (error) {
    console.error("Unexpected error in recordTrainingSet:", error);
    return c.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
        },
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
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "User not authenticated",
          },
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
          success: false,
          error: {
            code: "DATABASE_ERROR",
            message: "Failed to fetch training sets",
          },
        },
        500,
      );
    }

    const sets = result.getValue();

    return c.json({
      success: true,
      data: {
        sets: sets.map((set) => ({
          id: set.id.value,
          exerciseId: set.exerciseId.value,
          weight: set.weight.value,
          reps: set.reps.value,
          rpe: set.rpe?.value,
          restSeconds: set.restSeconds,
          notes: set.notes,
          performedAt: set.performedAt.toISOString(),
          volume: set.calculateVolume().value,
        })),
        pagination: {
          limit,
          offset,
          total: sets.length, // This would ideally come from a count query
        },
      },
    });
  } catch (error) {
    console.error("Unexpected error in getTrainingSets:", error);
    return c.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
        },
      },
      500,
    );
  }
}
