import type { Context } from "hono";
import { z } from "zod";
import { createContainer } from "@bulktrack/api/container";
import type { WorkerEnv } from "@bulktrack/api/types/env";

// Validation schemas
const getWorkoutSummariesSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

const getWorkoutDetailSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
});

export async function getWorkoutSummaries(
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
    const query = c.req.query();
    const validationResult = getWorkoutSummariesSchema.safeParse({
      limit: query.limit ? Number.parseInt(query.limit) : undefined,
      offset: query.offset ? Number.parseInt(query.offset) : undefined,
    });

    if (!validationResult.success) {
      return c.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid query parameters",
            details: validationResult.error.flatten(),
          },
        },
        400,
      );
    }

    const { limit, offset } = validationResult.data;
    const acceptLanguage = c.req.header("Accept-Language") || "en";

    const container = createContainer(c.env);

    // Execute query
    try {
      const { UserIdVO } = await import("@bulktrack/core");
      const result = await container.getWorkoutSummariesQuery.execute(
        new UserIdVO(userId),
        limit,
        offset,
        acceptLanguage,
      );

      // Return array directly for OpenAPI compliance
      return c.json(result);
    } catch (error: any) {
      console.error("Error in getWorkoutSummariesQuery:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: error.message || "Failed to get workout summaries",
            details: error.stack,
          },
        },
        500,
      );
    }
  } catch (error) {
    console.error("Unexpected error in getWorkoutSummaries:", error);
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

export async function getWorkoutDetail(
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

    // Validate date parameter
    const date = c.req.param("date");
    const validationResult = getWorkoutDetailSchema.safeParse({ date });

    if (!validationResult.success) {
      return c.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid date format",
            details: validationResult.error.flatten(),
          },
        },
        400,
      );
    }

    const acceptLanguage = c.req.header("Accept-Language") || "en";
    const container = createContainer(c.env);

    // Execute query
    try {
      const { UserIdVO } = await import("@bulktrack/core");
      const result = await container.getWorkoutDetailQuery.execute(
        new UserIdVO(userId),
        validationResult.data.date,
        acceptLanguage,
      );

      if (!result) {
        return c.json(
          {
            success: false,
            error: {
              code: "NOT_FOUND",
              message: "No workout data found for the specified date",
            },
          },
          404,
        );
      }

      return c.json(result);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return c.json(
          {
            success: false,
            error: {
              code: "NOT_FOUND",
              message: "No workout data found for the specified date",
            },
          },
          404,
        );
      }

      return c.json(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: error.message || "Failed to get workout detail",
          },
        },
        500,
      );
    }
  } catch (error) {
    console.error("Unexpected error in getWorkoutDetail:", error);
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
