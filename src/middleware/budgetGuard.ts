import { Request, Response, NextFunction } from 'express';
import { checkBudget } from '../services/usageService.js';

export function budgetGuard(req: Request, res: Response, next: NextFunction): void {
  const agent = req.agentName;
  if (!agent) {
    // No agent name means no budget to check
    next();
    return;
  }

  checkBudget(req.tenantId, agent)
    .then((result) => {
      if (!result.within_budget) {
        res.status(429).json({
          error: 'Token budget exceeded',
          budget_status: result,
        });
        return;
      }
      next();
    })
    .catch((err) => {
      // Don't block on budget check failures — log and proceed
      console.error('[Budget Guard] Error checking budget:', err);
      next();
    });
}
