import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { budgetGuard } from '../middleware/budgetGuard.js';
import * as handoffService from '../services/handoffService.js';

const router = Router();

const createHandoffSchema = z.object({
  contact_id: z.string().uuid(),
  from_agent: z.string(),
  to_agent: z.string().optional(),
  to_human_id: z.string().optional(),
  reason: z.string(),
  reason_detail: z.string().optional(),
  suggested_action: z.string().optional(),
  urgency: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  metadata: z.record(z.unknown()).optional(),
}).refine(
  (data) => data.to_agent || data.to_human_id,
  { message: 'Either to_agent or to_human_id must be provided' },
);

const updateHandoffSchema = z.object({
  status: z.enum(['accepted', 'completed', 'rejected']),
});

// POST /handoffs
router.post('/handoffs', budgetGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createHandoffSchema.parse(req.body);
    const result = await handoffService.createHandoff(req.tenantId, body);

    res.status(201).json({
      id: result.handoff.id,
      contact_id: result.handoff.contact_id,
      context_summary: result.handoff.context_summary,
      status: result.handoff.status,
      context_refreshed: result.context_refreshed,
    });
  } catch (err) {
    next(err);
  }
});

// GET /handoffs/pending
router.get('/handoffs/pending', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters: handoffService.PendingHandoffsFilters = {
      agent: req.query.agent as string | undefined,
      human_id: req.query.human_id as string | undefined,
      urgency: req.query.urgency as string | undefined,
    };

    const handoffs = await handoffService.getPendingHandoffs(req.tenantId, filters);
    res.json({ data: handoffs });
  } catch (err) {
    next(err);
  }
});

// PATCH /handoffs/:id
router.patch('/handoffs/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = updateHandoffSchema.parse(req.body);
    const id = req.params.id as string;
    const handoff = await handoffService.updateHandoff(req.tenantId, id, body);
    res.json({ data: handoff });
  } catch (err) {
    next(err);
  }
});

export default router;
