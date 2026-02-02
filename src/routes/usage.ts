import { Router, Request, Response, NextFunction } from 'express';
import * as usageService from '../services/usageService.js';

const router = Router();

// GET /usage/summary
router.get('/usage/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const period = (req.query.period as string) || 'day';
    if (!['day', 'week', 'month'].includes(period)) {
      res.status(400).json({ error: 'period must be day, week, or month' });
      return;
    }

    const agent = req.query.agent as string | undefined;
    const summary = await usageService.getUsageSummary(
      req.tenantId,
      period as 'day' | 'week' | 'month',
      agent,
    );

    res.json(summary);
  } catch (err) {
    next(err);
  }
});

// GET /usage/budget-check/:agent
router.get('/usage/budget-check/:agent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const estimatedTokens = req.query.estimated_tokens
      ? parseInt(req.query.estimated_tokens as string, 10)
      : undefined;

    const agent = req.params.agent as string;
    const result = await usageService.checkBudget(req.tenantId, agent, estimatedTokens);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
