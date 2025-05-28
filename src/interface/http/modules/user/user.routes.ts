import { Hono } from "hono";
import type { AppEnv } from "../../main.router";
import { jwtAuthMiddleware } from "../../middleware/auth.middleware";
import { setupUserDependencies } from "../../middleware/di/user.container";
import { createListRecentExercisesHttpHandler } from "./user.handlers";

const userApp = new Hono<AppEnv>();

// Apply DI middleware for all routes in this user module
userApp.use("*", async (c, next) => {
  setupUserDependencies(c.env, c);
  await next();
});

// Apply JWT authentication for all /v1/me routes
userApp.use("*", jwtAuthMiddleware);

// GET /v1/me/exercises/recent - List recent exercises for the authenticated user
userApp.get("/exercises/recent", createListRecentExercisesHttpHandler());

// Add other /v1/me routes here in the future

export default userApp;
