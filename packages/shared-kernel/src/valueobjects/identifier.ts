import { v4 as uuidv4, v7 as uuidv7 } from "uuid";

/**
 * Base class for all identifiers in the system
 * Ensures type safety and provides common ID operations
 */
export abstract class Identifier {
  constructor(private readonly value: string) {
    if (!value || value.trim() === "") {
      throw new Error("ID value cannot be empty.");
    }
  }

  getValue(): string {
    return this.value;
  }

  equals(other?: Identifier): boolean {
    if (other === null || other === undefined) {
      return false;
    }
    return this.value === other.getValue();
  }

  toString(): string {
    return this.value;
  }
}

/**
 * Base class for all entity IDs in the system
 * Ensures type safety and provides common ID operations
 */
export abstract class EntityId {
  readonly value: string;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("ID value cannot be empty.");
    }
    this.value = value;
  }

  equals(other?: EntityId): boolean {
    if (other === null || other === undefined) {
      return false;
    }
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

/**
 * User ID Value Object
 */
export class UserIdVO extends EntityId {
  public static generate(): UserIdVO {
    return new UserIdVO(uuidv7());
  }
}

/**
 * Exercise ID Value Object
 */
export class ExerciseIdVO extends EntityId {
  public static generate(): ExerciseIdVO {
    return new ExerciseIdVO(uuidv7());
  }
}

/**
 * Workout Set ID Value Object
 */
export class WorkoutSetIdVO extends EntityId {
  public static generate(): WorkoutSetIdVO {
    return new WorkoutSetIdVO(uuidv7());
  }
}

/**
 * Menu ID Value Object
 */
export class MenuIdVO extends EntityId {
  public static generate(): MenuIdVO {
    return new MenuIdVO(uuidv7());
  }
}

/**
 * Muscle ID Value Object for numeric IDs
 */
export class MuscleIdVO {
  readonly value: number;

  constructor(value: number) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error("Muscle ID must be a positive integer.");
    }
    this.value = value;
  }

  public static create(value: number): MuscleIdVO {
    return new MuscleIdVO(value);
  }

  public toNumber(): number {
    return this.value;
  }

  public equals(other?: MuscleIdVO): boolean {
    if (other === null || other === undefined) {
      return false;
    }
    return this.value === other.value;
  }

  toString(): string {
    return String(this.value);
  }
}

/**
 * Device ID Value Object
 */
export class DeviceIdVO extends EntityId {
  public static generate(): DeviceIdVO {
    return new DeviceIdVO(uuidv7());
  }
}
