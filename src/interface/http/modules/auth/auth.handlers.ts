import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { ValiError } from "valibot";

import type { ActivateDeviceCommand } from "../../../../application/command/auth/activate-device-command";
import type {
  RefreshTokenCommand,
  RefreshTokenRequestInput,
} from "../../../../application/command/auth/refresh-token-command";
import {
  ApplicationError,
  AuthorizationError,
  ValidationError,
} from "../../../../application/errors";
import type { AppEnv } from "../../main.router";

export const activateDeviceHandler = async (c: Context<AppEnv>) => {
  const deviceId = c.req.header("x-device-id");
  const platform = c.req.header("x-platform"); // This might be undefined

  if (!deviceId) {
    console.error("X-Device-Id header is required");
    throw new HTTPException(400, { message: "X-Device-Id header is required" });
  }

  // --- Get command from context ---
  const command = c.var.activateDeviceCommand as ActivateDeviceCommand;
  if (!command) {
    console.error(
      "ActivateDeviceCommand not found in context. DI middleware might not have run.",
    );
    throw new HTTPException(500, {
      message: "Internal Server Configuration Error",
    });
  }
  // --- End Get command from context ---

  // Environment variable checks are now handled by the DI middleware in router.ts
  // or by the service constructors themselves.

  try {
    const tokens = await command.execute({
      deviceId,
      platform: platform || undefined,
    });
    return c.json(tokens, 200);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Invalid device ID:")
    ) {
      throw new HTTPException(400, { message: error.message });
    }
    throw new HTTPException(500, { message: "Failed to activate device" });
  }
};

export const refreshTokenHandler = async (c: Context<AppEnv>) => {
  let requestBody: RefreshTokenRequestInput;
  try {
    requestBody = (await c.req.json()) as RefreshTokenRequestInput;
  } catch (error) {
    throw new HTTPException(400, { message: "Invalid JSON in request body" });
  }

  // --- Get command from context ---
  const command = c.var.refreshTokenCommand as RefreshTokenCommand;
  if (!command) {
    console.error(
      "RefreshTokenCommand not found in context. DI middleware might not have run.",
    );
    throw new HTTPException(500, {
      message: "Internal Server Configuration Error",
    });
  }
  // --- End Get command from context ---

  // Environment variable checks are now handled by the DI middleware in router.ts
  // or by the service constructors themselves.

  try {
    const tokens = await command.execute(requestBody);
    return c.json(tokens, 200);
  } catch (error) {
    console.error("Error refreshing token:", error);
    if (error instanceof ValidationError) {
      throw new HTTPException(400, {
        message: error.message,
        cause: error.details,
      });
    }
    if (error instanceof AuthorizationError) {
      throw new HTTPException(401, { message: error.message });
    }
    if (error instanceof ApplicationError) {
      throw new HTTPException(500, { message: error.message });
    }
    if (error instanceof ValiError) {
      throw new HTTPException(400, {
        message: "Invalid request body",
        cause: error.issues,
      });
    }
    throw new HTTPException(500, { message: "Failed to refresh token" });
  }
};
