import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/** Attaches a request id used in logs and in the error envelope. */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  const id = incoming && /^[\w.-]{1,128}$/.test(incoming) ? incoming : randomUUID();
  req.requestId = id;
  // Every route can assume this container exists; validate() fills it in.
  req.validated = {};
  res.setHeader('x-request-id', id);
  next();
}
