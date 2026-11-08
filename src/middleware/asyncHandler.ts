import { NextFunction, Request, RequestHandler, Response } from "express";

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/**
 * Express 4 does not await async route handlers, so a rejected promise would
 * escape as an unhandled rejection and take the whole process down. This
 * forwards any rejection to next(), where the global error handler turns it
 * into a JSON response instead of a crash.
 */
export function asyncHandler(fn: AsyncRoute): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  };
}
