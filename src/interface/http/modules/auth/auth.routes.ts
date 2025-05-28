import { Hono } from "hono";
import type { AppEnv } from "../../main.router";
import { setupAuthDependencies } from "../../middleware/di/auth.container";
import { activateDeviceHandler, refreshTokenHandler } from "./auth.handlers";

const authApp = new Hono<AppEnv>();

// Apply DI middleware for all routes in this auth module
authApp.use("*", async (c, next) => {
  setupAuthDependencies(c.env, c);
  await next();
});

// Define auth routes
authApp.post("/device", activateDeviceHandler);
authApp.post("/refresh", refreshTokenHandler);

export default authApp;
