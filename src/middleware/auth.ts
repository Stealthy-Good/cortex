import { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip auth for health endpoints
  if (req.path.startsWith('/health')) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  if (token !== config.cortexApiKey) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  // Extract agent name from header
  const agentName = req.headers['x-agent-name'] as string | undefined;
  if (agentName) {
    req.agentName = agentName.toLowerCase();
  }

  next();
}
