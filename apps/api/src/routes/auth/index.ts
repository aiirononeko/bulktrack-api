import { vValidator } from "@hono/valibot-validator";
import { Hono } from "hono";
import * as v from "valibot";
import { createAuthContainer } from "../../container/auth.container";
import type { Variables, WorkerEnv } from "../../types/env";
import { AuthHandlers } from "./handlers";

const authRoutes = new Hono<{ Bindings: WorkerEnv; Variables: Variables }>();

// Device activation schema
const deviceActivationSchema = v.object({
  platform: v.optional(v.string()),
});

authRoutes.post("/device", async (c) => {
  const container = createAuthContainer(c.env);
  const handlers = new AuthHandlers(
    container.activateDeviceUseCase,
    container.jwtService,
    container.tokenRepository,
  );
  return await handlers.activateDevice(c);
});

const refreshTokenSchema = v.object({
  refreshToken: v.string(),
});

authRoutes.post(
  "/refresh",
  vValidator("json", refreshTokenSchema),
  async (c) => {
    const container = createAuthContainer(c.env);
    const handlers = new AuthHandlers(
      container.activateDeviceUseCase,
      container.jwtService,
      container.tokenRepository,
    );
    return await handlers.refreshToken(c);
  },
);

export { authRoutes };
