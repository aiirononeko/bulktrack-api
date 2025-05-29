import {
  type Result,
  ValidationError,
  err,
  ok,
} from "@bulktrack/shared-kernel";

/**
 * Weight value object
 * Represents training weight in kilograms
 */
export class Weight {
  private readonly _value: number;

  private constructor(value: number) {
    this._value = value;
  }

  public static create(value: number): Result<Weight, ValidationError> {
    if (!Number.isFinite(value)) {
      return err(
        new ValidationError("Weight must be a finite number", "weight", value),
      );
    }

    if (value < 0) {
      return err(
        new ValidationError("Weight cannot be negative", "weight", value),
      );
    }

    if (value > 1000) {
      return err(
        new ValidationError("Weight cannot exceed 1000kg", "weight", value),
      );
    }

    // Allow up to 2 decimal places
    if (Math.round(value * 100) / 100 !== value) {
      return err(
        new ValidationError(
          "Weight can have at most 2 decimal places",
          "weight",
          value,
        ),
      );
    }

    return ok(new Weight(value));
  }

  get value(): number {
    return this._value;
  }

  multiply(factor: number): Weight {
    const result = Weight.create(this._value * factor);
    if (result.isErr()) {
      throw new Error(result.error.message);
    }
    return result.unwrap();
  }

  equals(other: Weight): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return `${this._value}kg`;
  }
}
