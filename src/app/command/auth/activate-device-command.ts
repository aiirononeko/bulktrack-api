import { ValiError, parse } from "valibot";

import type { DeviceId, User, UserDevice } from "../../../domain/auth/entity";
import { DeviceIdSchema } from "../../../domain/auth/entity";
import { UserIdVO } from "../../../domain/shared/vo/identifier";
import { StorageError, TokenError } from "../../../domain/auth/errors";
import type {
  IDeviceRepository,
  ITokenRepository,
  IUserRepository,
} from "../../../domain/auth/repository";
import { AuthService } from "../../../domain/auth/service";
import type { AuthTokensDTO } from "../../dto/auth-tokens-dto";
import {
  ApplicationError,
  RepositoryError,
  ValidationError,
} from "../../errors";

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
          throw new ValidationError("Invalid device ID", error.issues);
        }
        throw error;
      }
    })();

    const userIdVO: UserIdVO = await (async (): Promise<UserIdVO> => {
      const existingDevice: UserDevice | null = await (async () => {
        try {
          return await this.deviceRepository.findByDeviceId(validatedDeviceId);
        } catch (dbError) {
          console.error(`Error finding device by ID ${validatedDeviceId}:`, dbError);
          throw new RepositoryError(
            "Failed to query device information.",
            dbError instanceof Error ? dbError : undefined,
          );
        }
      })();

      if (existingDevice) {
        console.log(`Existing device found for deviceId ${validatedDeviceId}, using userId ${existingDevice.userId}`);
        return new UserIdVO(existingDevice.userId); 
      }

      console.log(`No existing device found for deviceId ${validatedDeviceId}. Creating new user and device.`);
      const newUser: User = await (async () => {
      try {
        return await this.userRepository.createAnonymousUser("anonymous");
      } catch (dbError) {
        if (dbError instanceof StorageError) {
          throw new RepositoryError(
            `User creation failed: ${dbError.message}`,
            dbError,
          );
        }
        throw new RepositoryError(
          "Failed to initialize user profile.",
          dbError instanceof Error ? dbError : undefined,
        );
      }
    })();

      const newUserId = newUser.id;

      const newUserDeviceData: UserDevice = {
      deviceId: validatedDeviceId,
        userId: newUserId,
      platform: input.platform || "unknown",
      linkedAt: new Date().toISOString(),
    };
    try {
        await this.deviceRepository.save(newUserDeviceData);
    } catch (dbError) {
      if (dbError instanceof StorageError) {
        throw new RepositoryError(
          `Device registration failed: ${dbError.message}`,
          dbError,
        );
      }
      throw new RepositoryError(
        "Failed to register device.",
        dbError instanceof Error ? dbError : undefined,
      );
    }
      console.log(`New user created with userId ${newUserId} and device ${validatedDeviceId} registered.`);
      return new UserIdVO(newUserId);
    })();

    const finalAuthTokens: AuthTokensDTO = await (async () => {
      try {
        const newAuthTokens =
          await this.authService.issueAuthTokens(userIdVO);
        
        await this.tokenRepository.saveRefreshToken(
          userIdVO, 
          newAuthTokens.refreshToken,
          AuthService.REFRESH_TOKEN_TTL_SECONDS,
        );
        return {
          accessToken: newAuthTokens.accessToken,
          refreshToken: newAuthTokens.refreshToken,
          expiresIn: newAuthTokens.expiresIn,
        };
      } catch (error) {
        console.error(
          `Token issuance or saving failed for user ${userIdVO.value}:`,
          error,
        );
        if (error instanceof TokenError) {
          throw new ApplicationError(
            "Token generation failed during activation.",
            500,
            "ACTIVATION_TOKEN_GENERATION_ERROR",
            error,
          );
        }
        if (error instanceof StorageError) {
          throw new ApplicationError(
            "Token storage failed during activation.",
            500,
            "ACTIVATION_TOKEN_STORAGE_ERROR",
            error,
          );
        }
        throw new ApplicationError(
          "Failed to complete device activation token process.",
          500,
          "ACTIVATION_TOKEN_SERVICE_ERROR",
          error instanceof Error ? error : undefined,
        );
      }
    })();

    return finalAuthTokens;
  }
}
