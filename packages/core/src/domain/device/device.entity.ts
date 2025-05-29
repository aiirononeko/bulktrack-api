import { Identifier } from "@bulktrack/shared-kernel";
import { UserId } from "../user/user.entity";

export class DeviceId extends Identifier {
  static create(value: string): DeviceId {
    return new DeviceId(value);
  }
}

export enum Platform {
  IOS = "ios",
  ANDROID = "android",
  WEB = "web",
  UNKNOWN = "unknown",
}

export class UserDevice {
  constructor(
    private readonly deviceId: DeviceId,
    private readonly userId: UserId,
    private readonly platform: Platform,
    private readonly linkedAt: Date,
  ) {}

  getDeviceId(): DeviceId {
    return this.deviceId;
  }

  getUserId(): UserId {
    return this.userId;
  }

  getPlatform(): Platform {
    return this.platform;
  }

  getLinkedAt(): Date {
    return this.linkedAt;
  }

  static create(params: {
    deviceId: string;
    userId: string;
    platform: string;
    linkedAt?: Date;
  }): UserDevice {
    const platformValue = UserDevice.parsePlatform(params.platform);

    return new UserDevice(
      DeviceId.create(params.deviceId),
      UserId.create(params.userId),
      platformValue,
      params.linkedAt || new Date(),
    );
  }

  private static parsePlatform(platform: string): Platform {
    const normalized = platform.toLowerCase();
    switch (normalized) {
      case "ios":
        return Platform.IOS;
      case "android":
        return Platform.ANDROID;
      case "web":
        return Platform.WEB;
      default:
        return Platform.UNKNOWN;
    }
  }
}
