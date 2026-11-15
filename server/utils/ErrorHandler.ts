// Operational error type.
//
// `expose` decides whether the message may be shown to the client: 4xx
// messages are written by us and safe; 5xx messages are not and are replaced
// by a generic string plus the request id (SEC-16 / V19).
const DEFAULT_CODE: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "VALIDATION_FAILED",
  429: "RATE_LIMITED",
  500: "INTERNAL",
  503: "SERVICE_UNAVAILABLE",
};

class ErrorHandler extends Error {
  statusCode: number;
  code: string;
  expose: boolean;

  constructor(statusCode: number, message: string, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || DEFAULT_CODE[statusCode] || "INTERNAL";
    this.expose = statusCode < 500;
    Error.captureStackTrace(this, this.constructor);
  }
}

export default ErrorHandler;
