import type { KVNamespace } from '@cloudflare/workers-types';
import type { ITokenRepository } from '../../domain/auth/repository';
import type { DeviceId } from '../../domain/auth/entity';

interface KvTokenStoreConstructorParams {
  kv: KVNamespace;
  // KVキーのプレフィックスなどを設定できるようにしても良い
  // keyPrefix?: string;
}

const DEFAULT_KEY_PREFIX = 'refreshtoken:';

export class KvTokenStoreImpl implements ITokenRepository {
  private readonly kv: KVNamespace;
  private readonly keyPrefix: string;

  constructor(params: KvTokenStoreConstructorParams) {
    if (!params.kv) {
      throw new Error('KVNamespace is required for KvTokenStoreImpl');
    }
    this.kv = params.kv;
    this.keyPrefix = DEFAULT_KEY_PREFIX; // params.keyPrefix || DEFAULT_KEY_PREFIX;
  }

  private getKey(deviceId: DeviceId): string {
    return `${this.keyPrefix}${deviceId}`;
  }

  async saveRefreshToken(deviceId: DeviceId, refreshToken: string, expiresInSeconds: number): Promise<void> {
    const key = this.getKey(deviceId);
    await this.kv.put(key, refreshToken, { expirationTtl: expiresInSeconds });
  }

  async findRefreshTokenByDeviceId(deviceId: DeviceId): Promise<string | null> {
    const key = this.getKey(deviceId);
    return this.kv.get(key);
  }

  async deleteRefreshTokenByDeviceId(deviceId: DeviceId): Promise<void> {
    const key = this.getKey(deviceId);
    await this.kv.delete(key);
  }
}
