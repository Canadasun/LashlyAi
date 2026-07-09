import { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import { logger } from "../utils/logger";

const MULTER_ERROR_MESSAGES: Partial<Record<MulterError["code"], string>> = {
  LIMIT_FILE_SIZE: "Photo is too large. Maximum size is 10MB.",
  LIMIT_UNEXPECTED_FILE: 'Unexpected file field — expected a single file named "photo".',
};

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

  if (err instanceof MulterError) {
    res.status(400).json({ error: MULTER_ERROR_MESSAGES[err.code] ?? err.message });
    return;
  }

  res.status(500).json({ error: "Internal server error" });
}
