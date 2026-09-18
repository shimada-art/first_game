import type { NextFunction, Request, RequestHandler, Response } from "express";

/** Express 4 doesn't forward a rejected async handler's error to next() on its own. */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
