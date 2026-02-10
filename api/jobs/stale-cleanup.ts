import type { Request, Response } from 'express';
import { staleContextCleanup } from '../../src/jobs/staleContextCleanup.js';

export default async function handler(req: Request, res: Response) {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await staleContextCleanup();
    return res.status(200).json({ success: true, job: 'stale-cleanup' });
  } catch (err) {
    console.error('[Cron: stale-cleanup] Failed:', err);
    return res.status(500).json({ error: 'Job failed', message: (err as Error).message });
  }
}
