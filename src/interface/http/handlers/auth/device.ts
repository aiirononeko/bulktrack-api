import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import type { ActivateDeviceCommand } from "../../../../app/command/auth/activate-device-command";

type DeviceHandlerEnv = {
  Variables: {
    activateDeviceCommand: ActivateDeviceCommand;
  };
  Bindings: CloudflareBindings;
};

const app = new Hono<DeviceHandlerEnv>();

app.post("/device", async (c) => {
  const deviceId = c.req.header("x-device-id");
  const platform = c.req.header("x-platform"); // This might be undefined

  if (!deviceId) {
    console.error("X-Device-Id header is required");
    throw new HTTPException(400, { message: "X-Device-Id header is required" });
  }

  // --- Get command from context ---
  const command = c.var.activateDeviceCommand;
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
});

export default app;
