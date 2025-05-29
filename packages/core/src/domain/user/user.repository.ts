import type { Result } from "@bulktrack/shared-kernel";
import type { User, UserId } from "./user.entity";

export interface UserRepository {
  findById(id: UserId): Promise<Result<User | null, Error>>;

  save(user: User): Promise<Result<void, Error>>;

  createAnonymous(displayName: string): Promise<Result<User, Error>>;
}
