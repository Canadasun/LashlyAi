import { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on("finish", () => {
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode}`, {
      durationMs: Date.now() - start,
    });
  });
  next();
}

// Express identifies error-handling middleware by arity — the unused params must
// stay so this keeps its 4-argument signature.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  logger.error(`Unhandled error on ${req.method} ${req.originalUrl}`, err);

  if (res.headersSent) {
    return;
  }
  res.status(500).json({ error: "Internal server error" });
}
