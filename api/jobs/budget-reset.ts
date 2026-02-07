import type { Request, Response } from 'express';
import { tokenBudgetReset } from '../../src/jobs/tokenBudgetReset.js';

export default async function handler(req: Request, res: Response) {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await tokenBudgetReset();
    return res.status(200).json({ success: true, job: 'budget-reset' });
  } catch (err) {
    console.error('[Cron: budget-reset] Failed:', err);
    return res.status(500).json({ error: 'Job failed', message: (err as Error).message });
  }
}
