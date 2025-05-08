import { parse, ValiError } from 'valibot';
import type { DeviceId } from '../../../domain/auth/entity';
import { DeviceIdSchema } from '../../../domain/auth/entity';
import { AuthService } from '../../../domain/auth/service';
import type { ITokenRepository } from '../../../domain/auth/repository';
import type { AuthTokensDTO } from '../../dto/auth-tokens-dto';

export interface ActivateDeviceCommandDeps {
  authService: AuthService;
  tokenRepository: ITokenRepository;
}

export interface ActivateDeviceCommandInput {
  deviceId: string; // バリデーション前の生のデバイスID
}

export class ActivateDeviceCommand {
  private readonly authService: AuthService;
  private readonly tokenRepository: ITokenRepository;

  constructor(deps: ActivateDeviceCommandDeps) {
    this.authService = deps.authService;
    this.tokenRepository = deps.tokenRepository;
  }

  async execute(input: ActivateDeviceCommandInput): Promise<AuthTokensDTO> {
    let validatedDeviceId: DeviceId;
    try {
      validatedDeviceId = parse(DeviceIdSchema, input.deviceId);
    } catch (error) {
      if (error instanceof ValiError) {
        // TODO: Replace with a proper logger or application-specific error
        // console.error('Device ID validation failed:', error.issues);
        throw new Error(`Invalid device ID: ${error.issues.map(i => i.message).join(', ')}`);
      }
      throw error; // その他の予期せぬエラー
    }

    const newAuthTokens = await this.authService.issueAuthTokens(validatedDeviceId);

    // リフレッシュトークンを永続化
    await this.tokenRepository.saveRefreshToken(
      validatedDeviceId,
      newAuthTokens.refreshToken,
      AuthService.REFRESH_TOKEN_TTL_SECONDS // Access public static property
    );

    return {
      accessToken: newAuthTokens.accessToken,
      refreshToken: newAuthTokens.refreshToken,
      expiresIn: newAuthTokens.expiresIn, // This is for the access token
    };
  }
}
