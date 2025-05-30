/**
 * Base class for all domain-specific errors in the auth context.
 */
export class AuthDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    // Ensuring the prototype chain is correctly set for custom errors in ES6+
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Represents an error related to token generation, verification, or processing.
 */
export class TokenError extends AuthDomainError {
  constructor(message = "An issue occurred with token processing.") {
    super(message);
  }
}

/**
 * Represents an error when a token is found to be invalid (e.g., malformed, invalid signature).
 */
export class InvalidTokenError extends TokenError {
  constructor(message = "The provided token is invalid.") {
    super(message);
  }
}

/**
 * Represents an error when a token has expired.
 */
export class TokenExpiredError extends TokenError {
  constructor(message = "The provided token has expired.") {
    super(message);
  }
}

/**
 * Represents an error related to storage operations (e.g., KV store, database).
 */
export class StorageError extends AuthDomainError {
  public readonly operation?: string;
  public readonly underlyingError?: Error;

  constructor(
    message = "A storage operation failed.",
    operation?: string,
    underlyingError?: Error,
  ) {
    super(message);
    this.operation = operation;
    this.underlyingError = underlyingError;
  }
}
