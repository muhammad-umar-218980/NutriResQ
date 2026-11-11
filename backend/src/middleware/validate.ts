import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { ValidationError } from '../errors/app-error';

type Source = 'body' | 'query' | 'params';
type Schemas = Partial<Record<Source, z.ZodType>>;

/**
 * Parses the selected request parts and exposes them on `req.validated`.
 * Raw values are left untouched on purpose: Express 5 defines `req.query`
 * as a getter, so overwriting it is unsafe.
 */
export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const fields: Record<string, string> = {};

    for (const source of ['body', 'query', 'params'] as const) {
      const schema = schemas[source];
      if (!schema) continue;

      const result = schema.safeParse(req[source]);
      if (!result.success) {
        for (const issue of result.error.issues) {
          const path = issue.path.length ? issue.path.join('.') : source;
          fields[`${source}.${path}`] = issue.message;
        }
        continue;
      }

      req.validated[source] = result.data;
    }

    if (Object.keys(fields).length > 0) {
      next(new ValidationError('Check the highlighted fields and try again.', { fields }));
      return;
    }

    next();
  };
}
