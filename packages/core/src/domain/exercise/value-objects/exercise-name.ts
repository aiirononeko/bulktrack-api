import {
  type Result,
  ValidationError,
  err,
  ok,
} from "@bulktrack/shared-kernel";

/**
 * Exercise name value object
 * Ensures exercise names are valid and consistent
 */
export class ExerciseName {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  public static create(value: string): Result<ExerciseName, ValidationError> {
    const trimmed = value.trim();

    if (!trimmed) {
      return err(
        new ValidationError(
          "Exercise name cannot be empty",
          "exerciseName",
          value,
        ),
      );
    }

    if (trimmed.length < 2) {
      return err(
        new ValidationError(
          "Exercise name must be at least 2 characters long",
          "exerciseName",
          value,
        ),
      );
    }

    if (trimmed.length > 100) {
      return err(
        new ValidationError(
          "Exercise name cannot exceed 100 characters",
          "exerciseName",
          value,
        ),
      );
    }

    // Basic validation - no special characters except common ones
    const validPattern = /^[a-zA-Z0-9\s\-_()&,']+$/;
    if (!validPattern.test(trimmed)) {
      return err(
        new ValidationError(
          "Exercise name contains invalid characters",
          "exerciseName",
          value,
        ),
      );
    }

    return ok(new ExerciseName(trimmed));
  }

  get value(): string {
    return this._value;
  }

  equals(other: ExerciseName): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
