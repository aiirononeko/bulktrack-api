import { Result } from "@bulktrack/shared-kernel";
import * as jose from "jose";

export interface TokenPayload {
  userId: string;
  deviceId: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface JwtConfig {
  secret: string;
  accessTokenTtl: number; // seconds
  refreshTokenTtl: number; // seconds
}

export class JwtService {
  private secret: Uint8Array;

  constructor(private readonly config: JwtConfig) {
    this.secret = new TextEncoder().encode(config.secret);
  }

  async generateTokenPair(
    payload: TokenPayload,
  ): Promise<Result<TokenPair, Error>> {
    try {
      const accessToken = await new jose.SignJWT({
        userId: payload.userId,
        deviceId: payload.deviceId,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(`${this.config.accessTokenTtl}s`)
        .sign(this.secret);

      const refreshToken = await new jose.SignJWT({
        userId: payload.userId,
        deviceId: payload.deviceId,
        type: "refresh",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(`${this.config.refreshTokenTtl}s`)
        .sign(this.secret);

      return Result.ok({ accessToken, refreshToken });
    } catch (error) {
      return Result.fail(
        new Error(`Failed to generate tokens: ${(error as Error).message}`),
      );
    }
  }

  async verifyAccessToken(token: string): Promise<Result<TokenPayload, Error>> {
    try {
      const { payload } = await jose.jwtVerify(token, this.secret);

      if (!payload.userId || !payload.deviceId) {
        return Result.fail(new Error("Invalid token payload"));
      }

      return Result.ok({
        userId: payload.userId as string,
        deviceId: payload.deviceId as string,
      });
    } catch (error) {
      return Result.fail(
        new Error(`Failed to verify token: ${(error as Error).message}`),
      );
    }
  }

  async verifyRefreshToken(
    token: string,
  ): Promise<Result<TokenPayload, Error>> {
    try {
      const { payload } = await jose.jwtVerify(token, this.secret);

      if (!payload.userId || !payload.deviceId || payload.type !== "refresh") {
        return Result.fail(new Error("Invalid refresh token"));
      }

      return Result.ok({
        userId: payload.userId as string,
        deviceId: payload.deviceId as string,
      });
    } catch (error) {
      return Result.fail(
        new Error(
          `Failed to verify refresh token: ${(error as Error).message}`,
        ),
      );
    }
  }
}
