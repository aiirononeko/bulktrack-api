import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { jwt } from "hono/jwt";
import type { AppEnv } from "../main.router"; // Adjust if AppEnv is moved

// This middleware factory creates a JWT authentication middleware.
// It checks for JWT_SECRET and then uses hono/jwt to verify the token.
// The payload is then available via c.get('jwtPayload').
export const jwtAuthMiddleware = (c: Context<AppEnv>, next: Next) => {
  if (!c.env.JWT_SECRET) {
    console.error("CRITICAL: Missing JWT_SECRET for token verification.");
    // It's important to stop the request flow here if the secret is missing.
    throw new HTTPException(500, { message: "JWT secret not configured." });
  }

  // jwt() is a middleware factory, so we call it to get the actual middleware function.
  const verifyJwt = jwt({ secret: c.env.JWT_SECRET });

  // Execute the generated JWT middleware.
  // This will verify the token and, if valid, place the payload in c.var.jwtPayload (or c.get('jwtPayload')).
  // If invalid or missing, it will throw an error, which should be caught by Hono's error handler.
  return verifyJwt(c, next);
};
