import { Request, Response, NextFunction } from 'express';
import { trackRequest } from '../lib/helios.js';

/**
 * Express middleware that tracks request latency and error status for Helios reporting.
 * Attach before route handlers so it captures all API requests.
 */
export function heliosTracker(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const latency = Date.now() - start;
    const isError = res.statusCode >= 400;
    trackRequest(latency, isError);
  });

  next();
}
