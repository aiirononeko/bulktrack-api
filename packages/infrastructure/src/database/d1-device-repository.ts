import type {
  DeviceId,
  DeviceRepository,
  UserDevice,
  UserId,
} from "@bulktrack/core";
import { UserDevice as UserDeviceEntity } from "@bulktrack/core";
import { Result } from "@bulktrack/shared-kernel";
import type { D1Database } from "@cloudflare/workers-types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { userDevices } from "./schema";

export class D1DeviceRepository implements DeviceRepository {
  private db;

  constructor(private readonly d1: D1Database) {
    this.db = drizzle(d1);
  }

  async findByDeviceId(
    deviceId: DeviceId,
  ): Promise<Result<UserDevice | null, Error>> {
    try {
      const results = await this.db
        .select()
        .from(userDevices)
        .where(eq(userDevices.deviceId, deviceId.getValue()));

      if (results.length === 0) {
        return Result.ok(null);
      }

      const deviceData = results[0];
      const device = UserDeviceEntity.create({
        deviceId: deviceData.deviceId,
        userId: deviceData.userId,
        platform: deviceData.platform || "unknown",
        linkedAt: new Date(deviceData.linkedAt),
      });

      return Result.ok(device);
    } catch (error) {
      return Result.fail(
        new Error(`Failed to find device: ${(error as Error).message}`),
      );
    }
  }

  async linkDeviceToUser(device: UserDevice): Promise<Result<void, Error>> {
    try {
      await this.db.insert(userDevices).values({
        deviceId: device.getDeviceId().getValue(),
        userId: device.getUserId().getValue(),
        platform: device.getPlatform(),
        linkedAt: device.getLinkedAt().toISOString(),
      });

      return Result.ok(undefined);
    } catch (error) {
      return Result.fail(
        new Error(`Failed to link device: ${(error as Error).message}`),
      );
    }
  }

  async findDevicesByUserId(
    userId: UserId,
  ): Promise<Result<UserDevice[], Error>> {
    try {
      const results = await this.db
        .select()
        .from(userDevices)
        .where(eq(userDevices.userId, userId.getValue()));

      const devices = results.map((deviceData) =>
        UserDeviceEntity.create({
          deviceId: deviceData.deviceId,
          userId: deviceData.userId,
          platform: deviceData.platform || "unknown",
          linkedAt: new Date(deviceData.linkedAt),
        }),
      );

      return Result.ok(devices);
    } catch (error) {
      return Result.fail(
        new Error(
          `Failed to find devices by user: ${(error as Error).message}`,
        ),
      );
    }
  }
}
