import { Router, Request, Response } from 'express';
import { supabase } from '../db.js';
import { config } from '../config.js';

const router = Router();

// Basic liveness
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// DB connectivity check
router.get('/health/ready', async (_req: Request, res: Response) => {
  try {
    const { error } = await supabase.from('tenants').select('id').limit(1);
    if (error) throw error;
    res.json({ status: 'ready', database: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({
      status: 'not_ready',
      database: 'disconnected',
      error: err instanceof Error ? err.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// Deep check: DB + Anthropic API
router.get('/health/deep', async (_req: Request, res: Response) => {
  const checks: Record<string, string> = {};

  // Check Supabase
  try {
    const { error } = await supabase.from('tenants').select('id').limit(1);
    checks.database = error ? `error: ${error.message}` : 'connected';
  } catch (err) {
    checks.database = `error: ${err instanceof Error ? err.message : 'Unknown'}`;
  }

  // Check Anthropic API key is configured
  checks.anthropic = config.anthropic.apiKey ? 'configured' : 'not_configured';

  const allOk = checks.database === 'connected' && checks.anthropic === 'configured';

  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
});

export default router;
