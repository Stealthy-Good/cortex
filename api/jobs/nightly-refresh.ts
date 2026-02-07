import type { Request, Response } from 'express';
import { nightlyContextRefresh } from '../../src/jobs/nightlyContextRefresh.js';

export default async function handler(req: Request, res: Response) {
  // Verify cron secret (Vercel sends this header for cron invocations)
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await nightlyContextRefresh();
    return res.status(200).json({ success: true, job: 'nightly-refresh' });
  } catch (err) {
    console.error('[Cron: nightly-refresh] Failed:', err);
    return res.status(500).json({ error: 'Job failed', message: (err as Error).message });
  }
}
