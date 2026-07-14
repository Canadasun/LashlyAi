import { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import OpenAI from "openai";
import { logger } from "../utils/logger";
import { ImageValidationError } from "../services/storage.service";
import { createErrorLog } from "../models/ErrorLog";

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

// Best-effort persistence for the admin dashboard's error monitoring — deliberately
// fire-and-forget so a DB hiccup while logging an error never masks or delays the
// actual error response to the client.
function persistErrorLog(err: unknown, req: Request, statusCode: number) {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  createErrorLog({
    method: req.method,
    path: req.originalUrl,
    statusCode,
    message,
    stack,
    userId: req.currentUser?.id,
  }).catch((logErr) => {
    logger.error("Failed to persist error log", logErr);
  });
}

// Express identifies error-handling middleware by arity — the unused params must
// stay so this keeps its 4-argument signature.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  logger.error(`Unhandled error on ${req.method} ${req.originalUrl}`, err);

  if (res.headersSent) {
    return;
  }

  if (err instanceof MulterError) {
    persistErrorLog(err, req, 400);
    res.status(400).json({ error: MULTER_ERROR_MESSAGES[err.code] ?? err.message });
    return;
  }

  if (err instanceof ImageValidationError) {
    persistErrorLog(err, req, 400);
    res.status(400).json({ error: err.message });
    return;
  }

  // Distinguish "OpenAI had a bad moment" from a real bug — the SDK already retries
  // transient errors internally (see the client's maxRetries in ai.service.ts), so
  // reaching here means retries were exhausted or it was a non-retryable failure.
  // A 502 with a specific, retry-friendly message reads very differently to a salon
  // user than a generic 500 would.
  if (err instanceof OpenAI.APIError) {
    persistErrorLog(err, req, 502);
    res.status(502).json({
      error: "The AI provider is temporarily unavailable. Please try again in a moment.",
    });
    return;
  }

  persistErrorLog(err, req, 500);
  res.status(500).json({ error: "Internal server error" });
}
