import type { KVNamespace } from "@cloudflare/workers-types";
import type { DeviceId } from "../../domain/auth/entity";
import { StorageError } from "../../domain/auth/errors";
import type { ITokenRepository } from "../../domain/auth/repository";

interface KvTokenStoreConstructorParams {
  kv: KVNamespace;
  // KVキーのプレフィックスなどを設定できるようにしても良い
  // keyPrefix?: string;
}

const DEFAULT_KEY_PREFIX = "refreshtoken:";

export class KvTokenStoreImpl implements ITokenRepository {
  private readonly kv: KVNamespace;
  private readonly keyPrefix: string;

  constructor(params: KvTokenStoreConstructorParams) {
    if (!params.kv) {
      throw new Error("KVNamespace is required for KvTokenStoreImpl");
    }
    this.kv = params.kv;
    this.keyPrefix = DEFAULT_KEY_PREFIX; // params.keyPrefix || DEFAULT_KEY_PREFIX;
  }

  private getKey(deviceId: DeviceId): string {
    return `${this.keyPrefix}${deviceId}`;
  }

  async saveRefreshToken(
    deviceId: DeviceId,
    refreshToken: string,
    expiresInSeconds: number,
  ): Promise<void> {
    const key = this.getKey(deviceId);
    try {
      await this.kv.put(key, refreshToken, { expirationTtl: expiresInSeconds });
    } catch (e: unknown) {
      const underlyingError = e instanceof Error ? e : new Error(String(e));
      console.error(
        `KV Error (saveRefreshToken for device ${deviceId}):`,
        underlyingError,
      );
      throw new StorageError(
        "Failed to save refresh token to KV store",
        "saveRefreshToken",
        underlyingError,
      );
    }
  }

  async findRefreshTokenByDeviceId(deviceId: DeviceId): Promise<string | null> {
    const key = this.getKey(deviceId);
    try {
      return await this.kv.get(key);
    } catch (e: unknown) {
      const underlyingError = e instanceof Error ? e : new Error(String(e));
      console.error(
        `KV Error (findRefreshTokenByDeviceId for device ${deviceId}):`,
        underlyingError,
      );
      throw new StorageError(
        "Failed to find refresh token in KV store",
        "findRefreshTokenByDeviceId",
        underlyingError,
      );
    }
  }

  async deleteRefreshTokenByDeviceId(deviceId: DeviceId): Promise<void> {
    const key = this.getKey(deviceId);
    try {
      await this.kv.delete(key);
    } catch (e: unknown) {
      const underlyingError = e instanceof Error ? e : new Error(String(e));
      console.error(
        `KV Error (deleteRefreshTokenByDeviceId for device ${deviceId}):`,
        underlyingError,
      );
      throw new StorageError(
        "Failed to delete refresh token from KV store",
        "deleteRefreshTokenByDeviceId",
        underlyingError,
      );
    }
  }
}
