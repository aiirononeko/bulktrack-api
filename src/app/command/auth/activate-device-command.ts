import { parse, ValiError } from 'valibot';

import type { DeviceId, User, UserDevice } from '../../../domain/auth/entity';
import { DeviceIdSchema } from '../../../domain/auth/entity';
import { AuthService } from '../../../domain/auth/service';
import type { ITokenRepository, IUserRepository, IDeviceRepository } from '../../../domain/auth/repository';
import type { AuthTokensDTO } from '../../dto/auth-tokens-dto';
import { ValidationError, RepositoryError, ApplicationError } from '../../errors';

export interface ActivateDeviceCommandDeps {
  authService: AuthService;
  tokenRepository: ITokenRepository;
  userRepository: IUserRepository;
  deviceRepository: IDeviceRepository;
}

export interface ActivateDeviceCommandInput {
  deviceId: string; // バリデーション前の生のデバイスID
  platform?: string; // iOS, Androidなど。オプショナル。
}

export class ActivateDeviceCommand {
  private readonly authService: AuthService;
  private readonly tokenRepository: ITokenRepository;
  private readonly userRepository: IUserRepository;
  private readonly deviceRepository: IDeviceRepository;

  constructor(deps: ActivateDeviceCommandDeps) {
    this.authService = deps.authService;
    this.tokenRepository = deps.tokenRepository;
    this.userRepository = deps.userRepository;
    this.deviceRepository = deps.deviceRepository;
  }

  async execute(input: ActivateDeviceCommandInput): Promise<AuthTokensDTO> {
    const validatedDeviceId: DeviceId = (() => {
      try {
        return parse(DeviceIdSchema, input.deviceId);
      } catch (error) {
        if (error instanceof ValiError) {
          throw new ValidationError('Invalid device ID', error.issues);
        }
        throw error;
      }
    })();

    const user: User = await (async () => {
      try {
        return await this.userRepository.createAnonymousUser('anonymous'); // 匿名ユーザーを作成
      } catch (dbError) {
        throw new RepositoryError('Failed to initialize user profile.', dbError);
      }
    })();

    const userDeviceData: UserDevice = {
      deviceId: validatedDeviceId,
      userId: user.id,
      platform: input.platform || 'unknown',
      linkedAt: new Date().toISOString(),
    };
    try {
      await this.deviceRepository.save(userDeviceData);
    } catch (dbError) {
      throw new RepositoryError('Failed to register device.', dbError);
    }

    try {
      const newAuthTokens = await this.authService.issueAuthTokens(validatedDeviceId);
      await this.tokenRepository.saveRefreshToken(
        validatedDeviceId,
        newAuthTokens.refreshToken,
        AuthService.REFRESH_TOKEN_TTL_SECONDS
      );
      return {
        accessToken: newAuthTokens.accessToken,
        refreshToken: newAuthTokens.refreshToken,
        expiresIn: newAuthTokens.expiresIn,
      };
    } catch (error) {
      throw new ApplicationError('Failed to complete device activation process.', 500, 'TOKEN_SERVICE_ERROR', error);
    }
  }
}
