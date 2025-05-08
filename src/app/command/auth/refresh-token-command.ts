import {
  type InferOutput,
  ValiError,
  minLength,
  object,
  parse,
  pipe,
  string,
} from "valibot";

import type {
  DeviceId,
  RefreshTokenPayload,
} from "../../../domain/auth/entity";
import {
  InvalidTokenError,
  StorageError,
  TokenError,
  TokenExpiredError,
} from "../../../domain/auth/errors"; // Import domain errors
import type { ITokenRepository } from "../../../domain/auth/repository";
import { AuthService, type IJwtService } from "../../../domain/auth/service";
import type { AuthTokensDTO } from "../../dto/auth-tokens-dto";
import {
  ApplicationError,
  AuthorizationError,
  ValidationError,
} from "../../errors";

// OpenAPI schema Ref: #/components/schemas/RefreshTokenRequest
export const RefreshTokenRequestSchema = object({
  refresh_token: pipe(string(), minLength(1, "Refresh token cannot be empty.")),
});
export type RefreshTokenRequestInput = InferOutput<
  typeof RefreshTokenRequestSchema
>;

export interface RefreshTokenCommandDeps {
  authService: AuthService;
  jwtService: IJwtService; // For verifying the incoming refresh token
  tokenRepository: ITokenRepository;
}

export class RefreshTokenCommand {
  private readonly authService: AuthService;
  private readonly jwtService: IJwtService;
  private readonly tokenRepository: ITokenRepository;

  constructor(deps: RefreshTokenCommandDeps) {
    this.authService = deps.authService;
    this.jwtService = deps.jwtService;
    this.tokenRepository = deps.tokenRepository;
  }

  async execute(input: RefreshTokenRequestInput): Promise<AuthTokensDTO> {
    const validatedInput = (() => {
      try {
        return parse(RefreshTokenRequestSchema, input);
      } catch (error) {
        if (error instanceof ValiError) {
          throw new ValidationError(
            "Invalid refresh token input.",
            error.issues,
          );
        }
        throw error;
      }
    })();

    const refreshToken = validatedInput.refresh_token;

    const verifiedTokenPayload: RefreshTokenPayload = await (async () => {
      try {
        return await this.jwtService.verifyRefreshToken(refreshToken);
      } catch (error) {
        console.error("Refresh token verification failed in command:", error);
        if (error instanceof TokenExpiredError) {
          throw new AuthorizationError("Refresh token has expired.", {
            cause: error,
          });
        }
        if (error instanceof InvalidTokenError) {
          throw new AuthorizationError(
            "Refresh token is invalid or malformed.",
            { cause: error },
          );
        }
        if (error instanceof TokenError) {
          throw new AuthorizationError("Refresh token verification failed.", {
            cause: error,
          });
        }
        throw new AuthorizationError(
          "Failed to verify refresh token due to an unexpected issue.",
          { cause: error instanceof Error ? error : new Error(String(error)) },
        );
      }
    })();

    const deviceId = verifiedTokenPayload.sub as DeviceId;

    const storedRefreshToken = await (async () => {
      try {
        return await this.tokenRepository.findRefreshTokenByDeviceId(deviceId);
      } catch (error) {
        console.error(
          `Failed to find refresh token for device ${deviceId}:`,
          error,
        );
        if (error instanceof StorageError) {
          throw new ApplicationError(
            "Storage error when retrieving refresh token.",
            500,
            "STORAGE_ERROR",
            error,
          );
        }
        throw new ApplicationError(
          "Failed to retrieve refresh token due to an unexpected storage issue.",
          500,
          "UNEXPECTED_STORAGE_ERROR",
          error instanceof Error ? error : undefined,
        );
      }
    })();

    if (!storedRefreshToken) {
      throw new AuthorizationError(
        "No refresh token found for this device. Please activate device again.",
      );
    }

    if (refreshToken !== storedRefreshToken) {
      try {
        await this.tokenRepository.deleteRefreshTokenByDeviceId(deviceId);
      } catch (error) {
        console.warn(
          `Failed to delete mismatched refresh token for device ${deviceId} as a security measure:`,
          error,
        );
      }
      throw new AuthorizationError(
        "Refresh token mismatch. Please activate device again.",
      );
    }

    const newAuthTokens: AuthTokensDTO = await (async () => {
      try {
        return await this.authService.issueAuthTokens(deviceId);
      } catch (error) {
        console.error("Failed to issue new tokens during refresh:", error);
        if (error instanceof TokenError) {
          // Assuming issueAuthTokens might throw TokenError via jwtService
          throw new ApplicationError(
            "Failed to generate new tokens.",
            500,
            "TOKEN_GENERATION_ERROR",
            error,
          );
        }
        throw new ApplicationError(
          "Failed to issue new tokens due to an unexpected error.",
          500,
          "UNEXPECTED_TOKEN_ERROR",
          error instanceof Error ? error : undefined,
        );
      }
    })();

    try {
      await this.tokenRepository.saveRefreshToken(
        deviceId,
        newAuthTokens.refreshToken,
        AuthService.REFRESH_TOKEN_TTL_SECONDS,
      );
    } catch (error) {
      console.error("Failed to save new refresh token:", error);
      if (error instanceof StorageError) {
        throw new ApplicationError(
          "Storage error when saving new refresh token.",
          500,
          "STORAGE_ERROR",
          error,
        );
      }
      // Even if saving the new refresh token fails, the client has received the tokens.
      // This is a critical state. For now, rethrow as a generic ApplicationError.
      // More sophisticated retry or cleanup might be needed depending on requirements.
      throw new ApplicationError(
        "Failed to save new refresh token after generation.",
        500,
        "POST_GENERATION_STORAGE_ERROR",
        error instanceof Error ? error : undefined,
      );
    }

    return newAuthTokens;
  }
}
