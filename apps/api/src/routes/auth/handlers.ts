import type { ActivateDeviceUseCase } from "@bulktrack/core";
import type { JwtService, TokenRepository } from "@bulktrack/infrastructure";
import type { Context } from "hono";
import type { AppEnv } from "../../index";

export class AuthHandlers {
  constructor(
    private readonly activateDeviceUseCase: ActivateDeviceUseCase,
    private readonly jwtService: JwtService,
    private readonly tokenRepository: TokenRepository,
  ) {}

  async activateDevice(c: Context<AppEnv>) {
    const deviceId = c.req.header("X-Device-Id");
    if (!deviceId) {
      return c.json({ error: "Device ID is required" }, 400);
    }

    // Handle body parsing gracefully
    let platform = "unknown";
    try {
      const contentType = c.req.header("Content-Type");
      const contentLength = c.req.header("Content-Length");

      if (contentType?.includes("application/json") && contentLength !== "0") {
        const body = await c.req.json<{ platform?: string }>();
        platform = body?.platform || "unknown";
      }
    } catch (error) {
      // If JSON parsing fails, use default platform
      console.warn("Failed to parse request body:", error);
    }

    // Activate device
    const result = await this.activateDeviceUseCase.execute({
      deviceId,
      platform,
    });

    if (result.isFailure()) {
      return c.json({ error: result.getError().message }, 500);
    }

    const { userId, isNewUser } = result.getValue();

    // Generate tokens
    const tokenResult = await this.jwtService.generateTokenPair({
      userId,
      deviceId,
    });

    if (tokenResult.isFailure()) {
      return c.json({ error: tokenResult.getError().message }, 500);
    }

    const { accessToken, refreshToken } = tokenResult.getValue();

    // Save refresh token
    const saveResult = await this.tokenRepository.saveRefreshToken(
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
      expiresIn: 15 * 60, // 15 minutes in seconds
    });
  }

  async refreshToken(c: Context<AppEnv>) {
    const body = await c.req.json<{ refreshToken: string }>();
    const { refreshToken } = body;

    // Verify refresh token
    const verifyResult = await this.jwtService.verifyRefreshToken(refreshToken);
    if (verifyResult.isFailure()) {
      return c.json({ error: "Invalid refresh token" }, 401);
    }

    const { userId, deviceId } = verifyResult.getValue();

    // Check if refresh token exists in KV
    const storedTokenResult = await this.tokenRepository.getRefreshToken(
      `refresh:${userId}:${deviceId}`,
    );

    if (
      storedTokenResult.isFailure() ||
      storedTokenResult.getValue() !== refreshToken
    ) {
      return c.json({ error: "Invalid refresh token" }, 401);
    }

    // Generate new token pair
    const tokenResult = await this.jwtService.generateTokenPair({
      userId,
      deviceId,
    });

    if (tokenResult.isFailure()) {
      return c.json({ error: tokenResult.getError().message }, 500);
    }

    const { accessToken, refreshToken: newRefreshToken } =
      tokenResult.getValue();

    // Update refresh token in KV
    const saveResult = await this.tokenRepository.saveRefreshToken(
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
      expiresIn: 15 * 60, // 15 minutes in seconds
    });
  }
}
