import { Result } from "@bulktrack/shared-kernel";
import type { DeviceRepository } from "../../domain/device";
import { DeviceId, Platform, UserDevice } from "../../domain/device";
import type { UserRepository } from "../../domain/user";

export interface ActivateDeviceCommand {
  deviceId: string;
  platform: string;
}

export interface ActivateDeviceResult {
  userId: string;
  isNewUser: boolean;
}

export class ActivateDeviceUseCase {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(
    command: ActivateDeviceCommand,
  ): Promise<Result<ActivateDeviceResult, Error>> {
    try {
      const deviceId = DeviceId.create(command.deviceId);

      // Check if device already exists
      const existingDeviceResult =
        await this.deviceRepository.findByDeviceId(deviceId);
      if (existingDeviceResult.isFailure()) {
        return Result.fail(existingDeviceResult.getError());
      }

      const existingDevice = existingDeviceResult.getValue();

      if (existingDevice) {
        // Device already linked to a user
        return Result.ok({
          userId: existingDevice.getUserId().getValue(),
          isNewUser: false,
        });
      }

      // Create new anonymous user
      const createUserResult = await this.userRepository.createAnonymous(
        `User-${Date.now()}`,
      );
      if (createUserResult.isFailure()) {
        return Result.fail(createUserResult.getError());
      }

      const newUser = createUserResult.getValue();

      // Link device to new user
      const newDevice = UserDevice.create({
        deviceId: command.deviceId,
        userId: newUser.getId().getValue(),
        platform: command.platform,
      });

      const linkResult =
        await this.deviceRepository.linkDeviceToUser(newDevice);
      if (linkResult.isFailure()) {
        return Result.fail(linkResult.getError());
      }

      return Result.ok({
        userId: newUser.getId().getValue(),
        isNewUser: true,
      });
    } catch (error) {
      return Result.fail(
        new Error(`Failed to activate device: ${(error as Error).message}`),
      );
    }
  }
}
