/**
 * Base class for all domain errors
 * Provides structured error handling across the domain layer
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;
  readonly timestamp: Date;

  constructor(
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
    };
  }
}

/**
 * Thrown when a validation rule is violated
 */
export class ValidationError extends DomainError {
  readonly code = "VALIDATION_ERROR";

  constructor(message: string, field?: string, value?: unknown) {
    super(message, { field, value });
  }
}

/**
 * Thrown when an entity is not found
 */
export class NotFoundError extends DomainError {
  readonly code = "NOT_FOUND";

  constructor(entityName: string, id: string) {
    super(`${entityName} with id ${id} not found`, { entityName, id });
  }
}

/**
 * Thrown when a business rule is violated
 */
export class BusinessRuleViolationError extends DomainError {
  readonly code = "BUSINESS_RULE_VIOLATION";

  constructor(rule: string, context?: Record<string, unknown>) {
    super(`Business rule violation: ${rule}`, context);
  }
}

/**
 * Thrown when an operation conflicts with current state
 */
export class ConflictError extends DomainError {
  readonly code = "CONFLICT";

  constructor(message: string, conflictingResource?: string) {
    super(message, { conflictingResource });
  }
}

/**
 * Thrown when authorization fails
 */
export class UnauthorizedError extends DomainError {
  readonly code = "UNAUTHORIZED";

  constructor(action: string, resource?: string) {
    super(`Unauthorized to perform ${action}`, { action, resource });
  }
}

/**
 * Repository-specific errors
 */
export class RepositoryError extends DomainError {
  readonly code = "REPOSITORY_ERROR";

  constructor(operation: string, cause?: Error) {
    super(`Repository operation failed: ${operation}`, {
      operation,
      cause: cause?.message,
    });
  }
}

/**
 * Use case execution errors
 */
export class UseCaseError extends DomainError {
  readonly code = "USE_CASE_ERROR";

  constructor(
    useCase: string,
    reason: string,
    context?: Record<string, unknown>,
  ) {
    super(`Use case ${useCase} failed: ${reason}`, { useCase, ...context });
  }
}
