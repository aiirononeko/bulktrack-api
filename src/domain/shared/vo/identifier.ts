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
 