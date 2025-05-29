import type { Reps } from "./reps";
import type { Weight } from "./weight";

/**
 * Volume value object
 * Represents the total training volume (weight × reps)
 */
export class Volume {
  private readonly _value: number;

  private constructor(value: number) {
    this._value = value;
  }

  public static calculate(weight: Weight, reps: Reps): Volume {
    const value = weight.value * reps.value;
    return new Volume(value);
  }

  public static fromValue(value: number): Volume {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error("Volume must be a non-negative finite number");
    }
    return new Volume(value);
  }

  get value(): number {
    return this._value;
  }

  add(other: Volume): Volume {
    return new Volume(this._value + other._value);
  }

  equals(other: Volume): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return `${this._value}kg`;
  }
}
