import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import * as errorService from '../services/errorService.js';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
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

  // Log unhandled errors to the error journal for self-annealing
  errorService.logError({
    tenant_id: req.tenantId || undefined,
    error_type: 'api_error',
    service: 'middleware',
    operation: `${req.method} ${req.path}`,
    error_message: err.message,
    stack_trace: err.stack,
    context: {
      agent: req.agentName,
      method: req.method,
      path: req.path,
    },
  });

  res.status(500).json({
    error: 'Internal server error',
  });
}
