import { Request, Response, NextFunction } from "express";

// Last-resort safety net: any route that forwards an error via next(err)
// (or throws inside an async handler Express itself catches) lands here
// instead of Express's default HTML error page, keeping every API response
// consistently JSON. Must be registered last, after all routes.
// Express identifies error-handling middleware by arity (4 params) — _req
// and _next must stay in the signature even though unused.
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error("[unhandled error]", err);
  if (res.headersSent) return;
  res.status(500).json({ error: "Internal server error" });
}
