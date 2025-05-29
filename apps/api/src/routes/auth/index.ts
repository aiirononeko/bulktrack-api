import { vValidator } from "@hono/valibot-validator";
import { Hono } from "hono";
import * as v from "valibot";
import { createAuthContainer } from "../../container/auth.container";
import type { Variables, WorkerEnv } from "../../types/env";

const authRoutes = new Hono<{ Bindings: WorkerEnv; Variables: Variables }>();

const activateDeviceSchema = v.object({
  platform: v.optional(v.string(), "unknown"),
});

authRoutes.post(
  "/device",
  vValidator("json", activateDeviceSchema),
  async (c) => {
    const deviceId = c.req.header("X-Device-Id");
    if (!deviceId) {
      return c.json({ error: "Device ID is required" }, 400);
    }

    const { platform } = c.req.valid("json");
    const container = createAuthContainer(c.env);

    // Activate device
    const result = await container.activateDeviceUseCase.execute({
      deviceId,
      platform,
    });

    if (result.isFailure()) {
      return c.json({ error: result.getError().message }, 500);
    }

    const { userId, isNewUser } = result.getValue();

    // Generate tokens
    const tokenResult = await container.jwtService.generateTokenPair({
      userId,
      deviceId,
    });

    if (tokenResult.isFailure()) {
      return c.json({ error: tokenResult.getError().message }, 500);
    }

    const { accessToken, refreshToken } = tokenResult.getValue();

    // Save refresh token
    const saveResult = await container.tokenRepository.saveRefreshToken(
      `refresh:${userId}:${deviceId}`,
      refreshToken,
      7 * 24 * 60 * 60, // 7 days
    );

    if (saveResult.isFailure()) {
      return c.json({ error: saveResult.getError().message }, 500);
    }

    return c.json({
      accessToken,
      refreshToken,
      userId,
      isNewUser,
    });
  },
);

const refreshTokenSchema = v.object({
  refreshToken: v.string(),
});

authRoutes.post(
  "/refresh",
  vValidator("json", refreshTokenSchema),
  async (c) => {
    const { refreshToken } = c.req.valid("json");
    const container = createAuthContainer(c.env);

    // Verify refresh token
    const verifyResult =
      await container.jwtService.verifyRefreshToken(refreshToken);
    if (verifyResult.isFailure()) {
      return c.json({ error: "Invalid refresh token" }, 401);
    }

    const { userId, deviceId } = verifyResult.getValue();

    // Check if refresh token exists in KV
    const storedTokenResult = await container.tokenRepository.getRefreshToken(
      `refresh:${userId}:${deviceId}`,
    );

    if (
      storedTokenResult.isFailure() ||
      storedTokenResult.getValue() !== refreshToken
    ) {
      return c.json({ error: "Invalid refresh token" }, 401);
    }

    // Generate new token pair
    const tokenResult = await container.jwtService.generateTokenPair({
      userId,
      deviceId,
    });

    if (tokenResult.isFailure()) {
      return c.json({ error: tokenResult.getError().message }, 500);
    }

    const { accessToken, refreshToken: newRefreshToken } =
      tokenResult.getValue();

    // Update refresh token in KV
    const saveResult = await container.tokenRepository.saveRefreshToken(
      `refresh:${userId}:${deviceId}`,
      newRefreshToken,
      7 * 24 * 60 * 60, // 7 days
    );

    if (saveResult.isFailure()) {
      return c.json({ error: saveResult.getError().message }, 500);
    }

    return c.json({
      accessToken,
      refreshToken: newRefreshToken,
    });
  },
);

export { authRoutes };
