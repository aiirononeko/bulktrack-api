import type { User, UserGoal, UserId, UserRepository } from "@bulktrack/core";
import { User as UserEntity } from "@bulktrack/core";
import { Result } from "@bulktrack/shared-kernel";
import type { D1Database } from "@cloudflare/workers-types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { uuidv7 } from "uuidv7";
import { users } from "./schema";

export class D1UserRepository implements UserRepository {
  private db;

  constructor(private readonly d1: D1Database) {
    this.db = drizzle(d1);
  }

  async findById(id: UserId): Promise<Result<User | null, Error>> {
    try {
      const results = await this.db
        .select()
        .from(users)
        .where(eq(users.id, id.getValue()));

      if (results.length === 0) {
        return Result.ok(null);
      }

      const userData = results[0];
      const user = UserEntity.create({
        id: userData.id,
        displayName: userData.displayName,
        goal: userData.goalJson ? this.parseGoal(userData.goalJson) : undefined,
        createdAt: new Date(userData.createdAt),
      });

      return Result.ok(user);
    } catch (error) {
      return Result.fail(
        new Error(`Failed to find user: ${(error as Error).message}`),
      );
    }
  }

  async save(user: User): Promise<Result<void, Error>> {
    try {
      const goal = user.getGoal();
      const goalJson = goal ? JSON.stringify(goal) : null;

      await this.db
        .insert(users)
        .values({
          id: user.getId().getValue(),
          displayName: user.getDisplayName(),
          goalJson,
          createdAt:
            user.getCreatedAt()?.toISOString() || new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: users.id,
          set: {
            displayName: user.getDisplayName(),
            goalJson,
          },
        });

      return Result.ok(undefined);
    } catch (error) {
      return Result.fail(
        new Error(`Failed to save user: ${(error as Error).message}`),
      );
    }
  }

  async createAnonymous(displayName: string): Promise<Result<User, Error>> {
    try {
      const id = uuidv7();
      const user = UserEntity.createAnonymous(id, displayName);

      const saveResult = await this.save(user);
      if (saveResult.isFailure()) {
        return Result.fail(saveResult.getError());
      }

      return Result.ok(user);
    } catch (error) {
      return Result.fail(
        new Error(
          `Failed to create anonymous user: ${(error as Error).message}`,
        ),
      );
    }
  }

  private parseGoal(goalJson: string): UserGoal | undefined {
    try {
      return JSON.parse(goalJson) as UserGoal;
    } catch {
      return undefined;
    }
  }
}
