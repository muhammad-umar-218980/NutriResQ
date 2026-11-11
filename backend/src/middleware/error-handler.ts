import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/app-error';
import { isProduction } from '../config/env';

interface BodyParserError extends Error {
  type?: string;
  status?: number;
}

/** The single response shape every failure uses. */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (res.headersSent) return;

  const requestId = req.requestId;

  if (error instanceof AppError) {
    res.status(error.status).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
        requestId,
      },
    });
    return;
  }

  const parserError = error as BodyParserError;
  if (parserError?.type === 'entity.parse.failed') {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'The request body is not valid JSON.', requestId },
    });
    return;
  }

  console.error(`[api] unhandled error (request ${requestId}):`, error);

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'The server could not complete the request.',
      ...(isProduction
        ? {}
        : { details: error instanceof Error ? error.message : String(error) }),
      requestId,
    },
  });
}

/** Unknown route: a JSON 404 rather than Express' HTML page. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `No API route matches ${req.method} ${req.path}.`,
      requestId: req.requestId,
    },
  });
}
