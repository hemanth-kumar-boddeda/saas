// Request id + access log (SEC-16).
//
// Every request gets an id that is echoed in the `X-Request-Id` header and in
// every error response, so a user-visible failure can be traced to one log
// line. The id is taken from the client when present (bounded, printable) so
// a trace can span services.
import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { logger } from "../utils/logger";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,64}$/;

export const requestContext = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const incoming = req.headers["x-request-id"];
  const requestId =
    typeof incoming === "string" && REQUEST_ID_PATTERN.test(incoming)
      ? incoming
      : `req_${crypto.randomBytes(12).toString("hex")}`;

  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  const startedAt = Date.now();
  res.on("finish", () => {
    logger.info("http_request", {
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });

  next();
};
