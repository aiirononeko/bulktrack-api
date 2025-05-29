import type { Result } from "@bulktrack/shared-kernel";
import type { UserId } from "../user/user.entity";
import type { DeviceId, UserDevice } from "./device.entity";

export interface DeviceRepository {
  findByDeviceId(deviceId: DeviceId): Promise<Result<UserDevice | null, Error>>;

  linkDeviceToUser(device: UserDevice): Promise<Result<void, Error>>;

  findDevicesByUserId(userId: UserId): Promise<Result<UserDevice[], Error>>;
}
