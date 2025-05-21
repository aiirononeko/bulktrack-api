import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv } from '../../main.router'; // Adjust if AppEnv is moved

import { ActivateDeviceCommand } from '../../../../app/command/auth/activate-device-command';
import { RefreshTokenCommand } from '../../../../app/command/auth/refresh-token-command';
import { AuthService as DomainAuthService } from '../../../../domain/auth/service';
import { JwtServiceImpl } from '../../../../infrastructure/auth/jwt-service';
import { DeviceRepositoryImpl } from '../../../../infrastructure/db/repository/device-repository';
import { UserRepositoryImpl } from '../../../../infrastructure/db/repository/user-repository';
import { KvTokenStoreImpl } from '../../../../infrastructure/kv/token-store';

export function setupAuthDependencies(env: AppEnv['Bindings'], c: Context<AppEnv>) {
  if (!env.JWT_SECRET || !env.REFRESH_TOKENS_KV || !env.DB) {
    console.error(
      "CRITICAL: Missing one or more environment bindings (JWT_SECRET, REFRESH_TOKENS_KV, DB) for auth services.",
    );
    // In a real setup, you might throw HTTPException or a specific error
    // For now, let's throw a generic error to halt execution if bindings are missing.
    throw new HTTPException(500, {
      message: "Internal Server Configuration Error for Auth",
    });
  }

  const jwtService = new JwtServiceImpl({ jwtSecret: env.JWT_SECRET });
  const tokenRepository = new KvTokenStoreImpl({ kv: env.REFRESH_TOKENS_KV });
  const authService = new DomainAuthService(jwtService);
  const userRepository = new UserRepositoryImpl(env.DB);
  const deviceRepository = new DeviceRepositoryImpl(env.DB);

  const activateDeviceCommand = new ActivateDeviceCommand({
    authService,
    tokenRepository,
    userRepository,
    deviceRepository,
  });
  const refreshTokenCommand = new RefreshTokenCommand({
    authService,
    jwtService, // RefreshTokenCommand needs jwtService directly for verification
    tokenRepository,
  });

  c.set("activateDeviceCommand", activateDeviceCommand);
  c.set("refreshTokenCommand", refreshTokenCommand);
}
