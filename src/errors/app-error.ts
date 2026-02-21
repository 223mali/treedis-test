/**
 * Base application error with an HTTP status code.
 * Throw this (or a subclass) anywhere in the app and the router's
 * catch-all handler will map it to the correct HTTP response.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.details = details;
    // Restore prototype chain (required when extending built-ins in TS)
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ── Convenience subclasses ─────────────────────────────────────────────

export class BadRequestError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, message, details);
    this.name = "BadRequestError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(404, message);
    this.name = "NotFoundError";
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = "File exceeds maximum allowed size") {
    super(413, message);
    this.name = "PayloadTooLargeError";
  }
}

export class UnsupportedMediaTypeError extends AppError {
  constructor(message: string, allowedTypes?: string[]) {
    super(415, message, { allowedTypes });
    this.name = "UnsupportedMediaTypeError";
  }
}

export class InternalError extends AppError {
  constructor(message = "Internal server error") {
    super(500, message);
    this.name = "InternalError";
  }
}
