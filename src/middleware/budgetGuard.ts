import { Request, Response, NextFunction } from 'express';
import { checkBudget } from '../services/usageService.js';
import * as errorService from '../services/errorService.js';

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
        errorService.logError({
          tenant_id: req.tenantId,
          error_type: 'budget_exceeded',
          service: 'budgetGuard',
          operation: `${req.method} ${req.path}`,
          error_message: `Agent ${agent} exceeded daily token budget (${result.budget_percentage_used}% used)`,
          pattern_id: 'budget_exceeded',
          context: { agent, budget_status: result as unknown as Record<string, unknown> },
        });

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
