export class EntityId {
  readonly value: string;

  constructor(value: string) {
    if (!value) {
      throw new Error("ID value cannot be empty.");
    }
    // ここでUUIDフォーマット検証などを追加可能
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

export class UserIdVO extends EntityId {}
export class WorkoutSessionIdVO extends EntityId {}
export class MenuIdVO extends EntityId {}
export class ExerciseIdVO extends EntityId {}
export class WorkoutSetIdVO extends EntityId {}

// New MuscleIdVO class for numeric IDs
export class MuscleIdVO {
  readonly value: number;

  constructor(value: number) { // Made constructor public for direct instantiation if needed, or keep private with static create only
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
 