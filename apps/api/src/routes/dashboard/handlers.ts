import type { Context } from "hono";
import { z } from "zod";
import { createContainer } from "../../container";
import type { WorkerEnv } from "../../types/env";

// Validation schema
const getDashboardSchema = z.object({
  span: z.enum(["1w", "4w", "8w", "12w", "24w"]).optional().default("1w"),
});

export async function getDashboard(
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
    const validationResult = getDashboardSchema.safeParse({
      span: query.span,
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

    const { span } = validationResult.data;
    const acceptLanguage = c.req.header("Accept-Language") || "en";

    const container = createContainer(c.env);

    // Execute dashboard query
    const result = await container.getDashboardQuery.execute({
      userId,
      span,
      language: acceptLanguage,
    });

    if (result.isErr()) {
      return c.json(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: result.error.message,
          },
        },
        500,
      );
    }

    const dashboardData = result.unwrap();

    // Transform to OpenAPI response format
    return c.json({
      thisWeek: dashboardData.thisWeek,
      lastWeek: dashboardData.lastWeek,
      trend: dashboardData.trend,
      muscleGroups: dashboardData.muscleGroups,
      metrics: dashboardData.metrics || [],
    });
  } catch (error) {
    console.error("Unexpected error in getDashboard:", error);
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
