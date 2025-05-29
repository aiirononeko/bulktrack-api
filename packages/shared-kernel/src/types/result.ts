/**
 * Result type for explicit error handling
 * Inspired by functional programming patterns
 */
export type Result<T, E> = Ok<T> | Err<E>;

export class Ok<T> {
  readonly kind = "ok" as const;
  constructor(readonly value: T) {}

  isOk(): this is Ok<T> {
    return true;
  }

  isErr(): this is Err<never> {
    return false;
  }

  isSuccess(): this is Ok<T> {
    return true;
  }

  isFailure(): this is Err<never> {
    return false;
  }

  getValue(): T {
    return this.value;
  }

  getError(): never {
    throw new Error("Cannot get error from Ok result");
  }

  unwrap(): T {
    return this.value;
  }

  unwrapOr<U>(defaultValue: U): T | U {
    return this.value;
  }

  map<U>(fn: (value: T) => U): Result<U, never> {
    return new Ok(fn(this.value));
  }

  mapErr<F>(_fn: (error: never) => F): Result<T, F> {
    return this as Result<T, F>;
  }

  andThen<U, E>(fn: (value: T) => Result<U, E>): Result<U, E> {
    return fn(this.value);
  }
}

export class Err<E> {
  readonly kind = "err" as const;
  constructor(readonly error: E) {}

  isOk(): this is Ok<never> {
    return false;
  }

  isErr(): this is Err<E> {
    return true;
  }

  isSuccess(): this is Ok<never> {
    return false;
  }

  isFailure(): this is Err<E> {
    return true;
  }

  getValue(): never {
    throw new Error("Cannot get value from Err result");
  }

  getError(): E {
    return this.error;
  }

  unwrap(): never {
    throw new Error(`Called unwrap on an Err value: ${this.error}`);
  }

  unwrapOr<U>(defaultValue: U): U {
    return defaultValue;
  }

  map<U>(_fn: (value: never) => U): Result<U, E> {
    return this as Result<U, E>;
  }

  mapErr<F>(fn: (error: E) => F): Result<never, F> {
    return new Err(fn(this.error));
  }

  andThen<U, F>(_fn: (value: never) => Result<U, F>): Result<U, E | F> {
    return this as Result<U, E | F>;
  }
}

// Helper functions
export const ok = <T, E = never>(value: T): Result<T, E> => new Ok(value);
export const err = <E, T = never>(error: E): Result<T, E> => new Err(error);

// Type guards
export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> =>
  result.isOk();
export const isErr = <T, E>(result: Result<T, E>): result is Err<E> =>
  result.isErr();

// Result namespace for static methods
export const Result = {
  ok: <T, E = never>(value: T): Result<T, E> => ok(value),
  fail: <E, T = never>(error: E): Result<T, E> => err(error),
};
