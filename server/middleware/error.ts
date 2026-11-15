// Safe error responses (SEC-16 / V19).
//
// A 5xx never leaks the underlying message, a stack trace, a Mongo error or a
// provider secret to the client: it returns a generic message plus the
// request id. The full detail is written to the structured log, where the
// redactor strips anything secret-shaped.
//
// The response shape stays `{ success, message, code, requestId }` so the
// existing RTK Query error handling keeps working. The contract envelope of
// API_CONTRACT_AND_MODULES.md §1.2 arrives with the Phase 1 module migration.
import { Request, Response, NextFunction } from "express";
import ErrorHandler from "../utils/ErrorHandler";
import { logger } from "../utils/logger";

export const ErrorMiddleware = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (res.headersSent) return next(err);

  let statusCode = 500;
  let code = "INTERNAL";
  let message = "Something went wrong. Please try again.";
  let expose = false;

  if (err instanceof ErrorHandler) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.expose ? err.message : message;
    expose = err.expose;
  } else if (err?.name === "CastError") {
    statusCode = 404;
    code = "NOT_FOUND";
    message = "Resource not found";
    expose = true;
  } else if (err?.code === 11000) {
    statusCode = 409;
    code = "CONFLICT";
    message = "Resource already exists";
    expose = true;
  } else if (err?.name === "JsonWebTokenError" || err?.name === "TokenExpiredError") {
    statusCode = 401;
    code = "UNAUTHENTICATED";
    message = "Invalid or expired token";
    expose = true;
  } else if (err?.name === "ValidationError") {
    statusCode = 422;
    code = "VALIDATION_FAILED";
    message = "Request validation failed";
    expose = true;
  }

  const requestId = req.requestId || "unknown";

  if (statusCode >= 500) {
    logger.error("request_failed", {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode,
      errorName: err?.name,
      // The message itself is logged (redacted) but never returned to the client.
      errorMessage: err?.message,
    });
  }

  res.status(statusCode).json({
    success: false,
    message,
    code,
    requestId,
  });
};
