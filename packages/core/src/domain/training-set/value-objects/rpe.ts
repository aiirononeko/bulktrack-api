import {
  type Result,
  ValidationError,
  err,
  ok,
} from "@bulktrack/shared-kernel";

/**
 * RPE (Rate of Perceived Exertion) value object
 * Represents the subjective intensity of an exercise on a scale of 1-10
 */
export class RPE {
  private readonly _value: number;

  private constructor(value: number) {
    this._value = value;
  }

  public static create(value: number): Result<RPE, ValidationError> {
    if (!Number.isFinite(value)) {
      return err(
        new ValidationError("RPE must be a finite number", "rpe", value),
      );
    }

    if (value < 1) {
      return err(new ValidationError("RPE must be at least 1", "rpe", value));
    }

    if (value > 10) {
      return err(new ValidationError("RPE cannot exceed 10", "rpe", value));
    }

    // Allow up to 1 decimal place
    if (Math.round(value * 10) / 10 !== value) {
      return err(
        new ValidationError(
          "RPE can have at most 1 decimal place",
          "rpe",
          value,
        ),
      );
    }

    return ok(new RPE(value));
  }

  get value(): number {
    return this._value;
  }

  /**
   * Calculate the percentage of 1RM based on RPE
   * This is a simplified version - actual calculations may be more complex
   */
  toIntensityPercentage(): number {
    // RPE 10 = 100%, RPE 9 = ~95%, etc.
    return 100 - (10 - this._value) * 5;
  }

  equals(other: RPE): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return `RPE ${this._value}`;
  }
}
