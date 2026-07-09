import { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Express 4 doesn't forward rejected promises from async handlers to the error
 * middleware on its own — without this, a thrown/rejected error in a route just
 * hangs the request forever instead of returning a 500.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
