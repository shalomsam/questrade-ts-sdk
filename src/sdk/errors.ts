/**
 * Questrade API TypeScript SDK - Error Hierarchy & Diagnostics
 */

export enum QuestradeApiErrorCode {
  INVALID_ACCESS_TOKEN = 1001,
  ACCESS_TOKEN_EXPIRED = 1002,
  INVALID_REFRESH_TOKEN = 1003,
  ACCOUNT_NOT_FOUND = 1010,
  SYMBOL_NOT_FOUND = 1011,
  ORDER_NOT_FOUND = 1012,
  INVALID_ARGUMENT = 1015,
  RATE_LIMIT_EXCEEDED = 1020,
  INTERNAL_SERVER_ERROR = 1030,
  STREAM_PORT_UNAVAILABLE = 1040,
  STREAM_CONNECTION_FAILED = 1041,
  STREAM_AUTHENTICATION_FAILED = 1042,
  UNKNOWN = 9999,
}

export interface QuestradeErrorDetails {
  status?: number;
  code?: number | QuestradeApiErrorCode;
  message: string;
  endpoint?: string;
  requestId?: string;
  retryAfterSeconds?: number;
  rawResponse?: unknown;
}

/**
 * Base Error for all Questrade API SDK errors
 */
export class QuestradeError extends Error {
  public readonly status?: number;
  public readonly code: number | QuestradeApiErrorCode;
  public readonly endpoint?: string;
  public readonly requestId?: string;
  public readonly retryAfterSeconds?: number;
  public readonly rawResponse?: unknown;
  public readonly timestamp: Date;

  constructor(message: string, details: QuestradeErrorDetails = { message }) {
    super(message);
    this.name = 'QuestradeError';
    this.status = details.status;
    this.code = details.code ?? QuestradeApiErrorCode.UNKNOWN;
    this.endpoint = details.endpoint;
    this.requestId = details.requestId;
    this.retryAfterSeconds = details.retryAfterSeconds;
    this.rawResponse = details.rawResponse;
    this.timestamp = new Date();

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Helper to format a rich diagnostic summary
   */
  public toDiagnosticString(): string {
    const parts = [
      `[${this.name}] ${this.message}`,
      this.status ? `HTTP Status: ${this.status}` : null,
      this.code ? `Questrade Error Code: ${this.code}` : null,
      this.endpoint ? `Endpoint: ${this.endpoint}` : null,
      this.retryAfterSeconds ? `Retry After: ${this.retryAfterSeconds}s` : null,
    ].filter(Boolean);

    return parts.join(' | ');
  }
}

/**
 * Authentication or token related errors (e.g. 401 Unauthorized, Expired Refresh Token)
 */
export class QuestradeAuthError extends QuestradeError {
  public readonly isRefreshTokenExpired: boolean;

  constructor(message: string, details: QuestradeErrorDetails = { message }, isRefreshTokenExpired = false) {
    super(message, {
      ...details,
      code: details.code ?? QuestradeApiErrorCode.INVALID_ACCESS_TOKEN,
    });
    this.name = 'QuestradeAuthError';
    this.isRefreshTokenExpired = isRefreshTokenExpired;
  }
}

/**
 * Rate limit violation errors (HTTP 429 or Questrade burst limits)
 */
export class QuestradeRateLimitError extends QuestradeError {
  constructor(message: string, details: QuestradeErrorDetails = { message }) {
    super(message, {
      ...details,
      status: details.status ?? 429,
      code: details.code ?? QuestradeApiErrorCode.RATE_LIMIT_EXCEEDED,
    });
    this.name = 'QuestradeRateLimitError';
  }
}

/**
 * Streaming / WebSocket feed errors
 */
export class QuestradeStreamError extends QuestradeError {
  constructor(message: string, details: QuestradeErrorDetails = { message }) {
    super(message, {
      ...details,
      code: details.code ?? QuestradeApiErrorCode.STREAM_CONNECTION_FAILED,
    });
    this.name = 'QuestradeStreamError';
  }
}

/**
 * Resource not found (account, symbol, order)
 */
export class QuestradeNotFoundError extends QuestradeError {
  constructor(message: string, details: QuestradeErrorDetails = { message }) {
    super(message, {
      ...details,
      status: details.status ?? 404,
    });
    this.name = 'QuestradeNotFoundError';
  }
}

/**
 * Invalid inputs or options (e.g. bad date range, unrecognized interval)
 */
export class QuestradeValidationError extends QuestradeError {
  constructor(message: string, details: QuestradeErrorDetails = { message }) {
    super(message, {
      ...details,
      status: details.status ?? 400,
      code: details.code ?? QuestradeApiErrorCode.INVALID_ARGUMENT,
    });
    this.name = 'QuestradeValidationError';
  }
}
