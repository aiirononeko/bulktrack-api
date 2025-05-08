import { ValiError, parse, object, string, minLength, pipe, type InferOutput } from 'valibot';

import type { DeviceId, RefreshTokenPayload } from '../../../domain/auth/entity';
import { AuthService, type IJwtService } from '../../../domain/auth/service';
import type { ITokenRepository } from '../../../domain/auth/repository';
import type { AuthTokensDTO } from '../../dto/auth-tokens-dto';
import { ApplicationError, ValidationError, AuthorizationError } from '../../errors';

// OpenAPI schema Ref: #/components/schemas/RefreshTokenRequest
export const RefreshTokenRequestSchema = object({
  refresh_token: pipe(string(), minLength(1, 'Refresh token cannot be empty.')),
});
export type RefreshTokenRequestInput = InferOutput<typeof RefreshTokenRequestSchema>;

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
          throw new ValidationError('Invalid refresh token input.', error.issues);
        }
        throw error; // Rethrow other errors
      }
    })();

    const refreshToken = validatedInput.refresh_token;

    const verifiedTokenPayload: RefreshTokenPayload = await (async () => {
      try {
        // verifyRefreshToken from jwtService is expected to return a valid RefreshTokenPayload
        // or throw an AuthorizationError if verification fails (e.g., invalid signature, expired, malformed).
        return await this.jwtService.verifyRefreshToken(refreshToken);
      } catch (error) {
        // Assuming jwtService.verifyRefreshToken wraps its errors into AuthorizationError
        // or throws errors that should be treated as such at this stage.
        console.error('Refresh token verification failed:', error);
        if (error instanceof AuthorizationError) {
          throw error; // Rethrow if it's already the correct type
        }
        // Fallback for unexpected error types from verifyRefreshToken
        throw new AuthorizationError('Refresh token is invalid or expired due to an unexpected issue.');
      }
    })();

    const deviceId = verifiedTokenPayload.sub as DeviceId;

    // 2. Retrieve stored refresh token from KV
    const storedRefreshToken = await this.tokenRepository.findRefreshTokenByDeviceId(deviceId);
    if (!storedRefreshToken) {
      throw new AuthorizationError('No refresh token found for this device. Please activate device again.');
    }

    // 3. Compare the incoming token with the stored one
    if (refreshToken !== storedRefreshToken) {
      // Security measure: If a compromised refresh token is used, invalidate all tokens for the device.
      await this.tokenRepository.deleteRefreshTokenByDeviceId(deviceId);
      throw new AuthorizationError('Refresh token mismatch. Please activate device again.');
    }

    // 4. Issue new set of tokens
    const newAuthTokens: AuthTokensDTO = await (async () => {
      try {
        return await this.authService.issueAuthTokens(deviceId);
      } catch (error) {
        console.error('Failed to issue new tokens during refresh:', error);
        throw new ApplicationError(
          'Failed to issue new tokens.',
          500,
          'TOKEN_GENERATION_ERROR',
          error instanceof Error ? { cause: error.message } : { cause: 'Unknown error' }
        );
      }
    })();
    
    // 5. Store the new refresh token
    try {
      await this.tokenRepository.saveRefreshToken(
        deviceId,
        newAuthTokens.refreshToken,
        AuthService.REFRESH_TOKEN_TTL_SECONDS
      );
    } catch (error) {
      console.error('Failed to save new refresh token:', error);
      // Potentially roll back or log, but the client already has the new tokens.
      // This could lead to an inconsistent state if saving fails.
      // For now, we'll let the error propagate.
      throw new ApplicationError('Failed to save new refresh token.');
    }

    return newAuthTokens;
  }
}
