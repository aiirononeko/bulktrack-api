import type { StatusCode } from "hono/utils/http-status";

export class ApplicationError extends Error {
  public readonly statusCode: StatusCode;
  public readonly code?: string;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: StatusCode = 500,
    code?: string,
    details?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends ApplicationError {
  constructor(message = "Validation Failed", details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

export class NotFoundError extends ApplicationError {
  constructor(message = "Resource Not Found") {
    super(message, 404, "NOT_FOUND");
  }
}

export class AuthenticationError extends ApplicationError {
  constructor(message = "Authentication Failed") {
    super(message, 401, "AUTHENTICATION_ERROR");
  }
}

export class AuthorizationError extends ApplicationError {
  constructor(message = "Authorization Failed", details?: unknown) {
    super(message, 403, "AUTHORIZATION_ERROR", details);
  }
}

export class RepositoryError extends ApplicationError {
  constructor(message = "Database operation failed", details?: unknown) {
    super(message, 500, "REPOSITORY_ERROR", details);
  }
}
