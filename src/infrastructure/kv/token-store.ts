import type { KVNamespace } from "@cloudflare/workers-types";
import { StorageError } from "../../domain/auth/errors";
import type { ITokenRepository } from "../../domain/auth/repository";
import type { UserIdVO } from "../../domain/shared/vo/identifier";

interface KvTokenStoreConstructorParams {
  kv: KVNamespace;
}

const DEFAULT_KEY_PREFIX = "refreshtoken_user:";

export class KvTokenStoreImpl implements ITokenRepository {
  private readonly kv: KVNamespace;
  private readonly keyPrefix: string;

  constructor(params: KvTokenStoreConstructorParams) {
    if (!params.kv) {
      throw new Error("KVNamespace is required for KvTokenStoreImpl");
    }
    this.kv = params.kv;
    this.keyPrefix = DEFAULT_KEY_PREFIX;
  }

  private getKey(userId: UserIdVO): string {
    return `${this.keyPrefix}${userId.value}`;
  }

  async saveRefreshToken(
    userId: UserIdVO,
    refreshToken: string,
    expiresInSeconds: number,
  ): Promise<void> {
    const key = this.getKey(userId);
    try {
      await this.kv.put(key, refreshToken, { expirationTtl: expiresInSeconds });
    } catch (e: unknown) {
      const underlyingError = e instanceof Error ? e : new Error(String(e));
      console.error(
        `KV Error (saveRefreshToken for user ${userId.value}):`,
        underlyingError,
      );
      throw new StorageError(
        "Failed to save refresh token to KV store",
        "saveRefreshToken",
        underlyingError,
      );
    }
  }

  async findRefreshTokenByUserId(userId: UserIdVO): Promise<string | null> {
    const key = this.getKey(userId);
    try {
      return await this.kv.get(key);
    } catch (e: unknown) {
      const underlyingError = e instanceof Error ? e : new Error(String(e));
      console.error(
        `KV Error (findRefreshTokenByUserId for user ${userId.value}):`,
        underlyingError,
      );
      throw new StorageError(
        "Failed to find refresh token in KV store",
        "findRefreshTokenByUserId",
        underlyingError,
      );
    }
  }

  async deleteRefreshTokenByUserId(userId: UserIdVO): Promise<void> {
    const key = this.getKey(userId);
    try {
      await this.kv.delete(key);
    } catch (e: unknown) {
      const underlyingError = e instanceof Error ? e : new Error(String(e));
      console.error(
        `KV Error (deleteRefreshTokenByUserId for user ${userId.value}):`,
        underlyingError,
      );
      throw new StorageError(
        "Failed to delete refresh token from KV store",
        "deleteRefreshTokenByUserId",
        underlyingError,
      );
    }
  }
}
