import type { DeviceRepository, UserRepository } from "@bulktrack/core";
import { ActivateDeviceUseCase } from "@bulktrack/core";
import {
  D1DeviceRepository,
  D1UserRepository,
  JwtService,
  KvTokenRepository,
  type TokenRepository,
} from "@bulktrack/infrastructure";
import type { WorkerEnv } from "../types/env";

export interface AuthContainer {
  userRepository: UserRepository;
  deviceRepository: DeviceRepository;
  tokenRepository: TokenRepository;
  jwtService: JwtService;
  activateDeviceUseCase: ActivateDeviceUseCase;
}

export function createAuthContainer(env: WorkerEnv): AuthContainer {
  const userRepository = new D1UserRepository(env.DB);
  const deviceRepository = new D1DeviceRepository(env.DB);
  const tokenRepository = new KvTokenRepository(env.KV);
  const jwtService = new JwtService({
    secret: env.JWT_SECRET,
    accessTokenTtl: 15 * 60, // 15 minutes
    refreshTokenTtl: 7 * 24 * 60 * 60, // 7 days
  });

  const activateDeviceUseCase = new ActivateDeviceUseCase(
    deviceRepository,
    userRepository,
  );

  return {
    userRepository,
    deviceRepository,
    tokenRepository,
    jwtService,
    activateDeviceUseCase,
  };
}
