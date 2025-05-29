import { Result } from "@bulktrack/shared-kernel";
import type { KVNamespace } from "@cloudflare/workers-types";

export interface TokenRepository {
  saveRefreshToken(
    key: string,
    token: string,
    ttl: number,
  ): Promise<Result<void, Error>>;

  getRefreshToken(key: string): Promise<Result<string | null, Error>>;

  deleteRefreshToken(key: string): Promise<Result<void, Error>>;
}

export class KvTokenRepository implements TokenRepository {
  constructor(private readonly kv: KVNamespace) {}

  async saveRefreshToken(
    key: string,
    token: string,
    ttl: number,
  ): Promise<Result<void, Error>> {
    try {
      await this.kv.put(key, token, {
        expirationTtl: ttl,
      });
      return Result.ok(undefined);
    } catch (error) {
      return Result.fail(
        new Error(`Failed to save refresh token: ${(error as Error).message}`),
      );
    }
  }

  async getRefreshToken(key: string): Promise<Result<string | null, Error>> {
    try {
      const token = await this.kv.get(key);
      return Result.ok(token);
    } catch (error) {
      return Result.fail(
        new Error(`Failed to get refresh token: ${(error as Error).message}`),
      );
    }
  }

  async deleteRefreshToken(key: string): Promise<Result<void, Error>> {
    try {
      await this.kv.delete(key);
      return Result.ok(undefined);
    } catch (error) {
      return Result.fail(
        new Error(
          `Failed to delete refresh token: ${(error as Error).message}`,
        ),
      );
    }
  }
}
