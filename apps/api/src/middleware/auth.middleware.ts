import type { MiddlewareHandler } from "hono";
import { createAuthContainer } from "../container/auth.container";
import type { Variables, WorkerEnv } from "../types/env";

export const authMiddleware: MiddlewareHandler<{
  Bindings: WorkerEnv;
  Variables: Variables;
}> = async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.substring(7);
  const container = createAuthContainer(c.env);

  const verifyResult = await container.jwtService.verifyAccessToken(token);
  if (verifyResult.isFailure()) {
    return c.json({ error: "Invalid token" }, 401);
  }

  const { userId } = verifyResult.getValue();
  c.set("userId", userId);

  await next();
};
