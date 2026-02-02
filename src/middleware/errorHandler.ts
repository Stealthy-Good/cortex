import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[Cortex Error]', err);

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation error',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  if ('statusCode' in err && typeof (err as any).statusCode === 'number') {
    res.status((err as any).statusCode).json({
      error: err.message,
    });
    return;
  }

  res.status(500).json({
    error: 'Internal server error',
  });
}
