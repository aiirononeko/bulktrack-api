import { Identifier } from "@bulktrack/shared-kernel";

export class UserId extends Identifier {
  static create(value: string): UserId {
    return new UserId(value);
  }
}

export class DisplayName {
  constructor(private readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error("Display name cannot be empty");
    }
    if (value.length > 50) {
      throw new Error("Display name must be 50 characters or less");
    }
  }

  getValue(): string {
    return this.value;
  }
}

export interface UserGoal {
  targetMuscles?: string[];
  weeklyTrainingDays?: number;
  injuries?: string[];
}

export class User {
  constructor(
    private readonly id: UserId,
    private readonly displayName: DisplayName,
    private readonly goal?: UserGoal,
    private readonly createdAt?: Date,
  ) {}

  getId(): UserId {
    return this.id;
  }

  getDisplayName(): string {
    return this.displayName.getValue();
  }

  getGoal(): UserGoal | undefined {
    return this.goal;
  }

  getCreatedAt(): Date | undefined {
    return this.createdAt;
  }

  updateDisplayName(newName: string): User {
    return new User(
      this.id,
      new DisplayName(newName),
      this.goal,
      this.createdAt,
    );
  }

  updateGoal(newGoal: UserGoal): User {
    return new User(this.id, this.displayName, newGoal, this.createdAt);
  }

  static createAnonymous(id: string, displayName: string): User {
    return new User(
      UserId.create(id),
      new DisplayName(displayName),
      undefined,
      new Date(),
    );
  }

  static create(params: {
    id: string;
    displayName: string;
    goal?: UserGoal;
    createdAt?: Date;
  }): User {
    return new User(
      UserId.create(params.id),
      new DisplayName(params.displayName),
      params.goal,
      params.createdAt,
    );
  }
}
