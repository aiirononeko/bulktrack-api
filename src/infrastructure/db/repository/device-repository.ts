import { drizzle } from 'drizzle-orm/d1';
import type { IDeviceRepository } from '../../../domain/auth/repository';
import type { UserDevice, DeviceId } from '../../../domain/auth/entity';
import { userDevices } from '../schema';
import { eq } from 'drizzle-orm';

export class DeviceRepositoryImpl implements IDeviceRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  async save(device: UserDevice): Promise<void> {
    await this.db.insert(userDevices).values({
      deviceId: device.deviceId,
      userId: device.userId,
      platform: device.platform,
      // linkedAt はスキーマのデフォルトで設定される
    });
    // D1ではreturningがサポートされていないことが多いため、voidとする
  }

  async findByDeviceId(deviceId: DeviceId): Promise<UserDevice | null> {
    const result = await this.db
      .select()
      .from(userDevices)
      .where(eq(userDevices.deviceId, deviceId))
      .limit(1);

    if (result.length === 0) {
      return null;
    }
    // スキーマの型とドメインエンティティの型が一致しているか注意
    // 必要に応じてマッピング処理を行う
    return result[0] as UserDevice; //  Valibot型なのでキャストには注意が必要
  }
}
