import {
  type Result,
  ValidationError,
  err,
  ok,
} from "@bulktrack/shared-kernel";

/**
 * Reps (repetitions) value object
 * Represents the number of repetitions in a training set
 */
export class Reps {
  private readonly _value: number;

  private constructor(value: number) {
    this._value = value;
  }

  public static create(value: number): Result<Reps, ValidationError> {
    if (!Number.isInteger(value)) {
      return err(new ValidationError("Reps must be an integer", "reps", value));
    }

    if (value < 0) {
      return err(new ValidationError("Reps cannot be negative", "reps", value));
    }

    if (value > 1000) {
      return err(new ValidationError("Reps cannot exceed 1000", "reps", value));
    }

    return ok(new Reps(value));
  }

  get value(): number {
    return this._value;
  }

  add(other: Reps): Reps {
    const result = Reps.create(this._value + other._value);
    if (result.isErr()) {
      throw new Error(result.error.message);
    }
    return result.unwrap();
  }

  equals(other: Reps): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return `${this._value} reps`;
  }
}
