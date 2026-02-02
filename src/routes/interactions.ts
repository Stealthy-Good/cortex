import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { budgetGuard } from '../middleware/budgetGuard.js';
import * as interactionService from '../services/interactionService.js';

const router = Router();

const createInteractionSchema = z.object({
  contact_id: z.string().uuid(),
  agent: z.string(),
  human_id: z.string().optional(),
  type: z.string(),
  direction: z.enum(['inbound', 'outbound']).optional(),
  subject: z.string().optional(),
  raw_content: z.string().optional(),
  summary: z.string().optional(),
  sentiment: z.string().optional(),
  key_points: z.array(z.string()).optional(),
  intent: z.string().optional(),
  external_id: z.string().optional(),
  campaign_id: z.string().optional(),
  thread_id: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// POST /interactions
router.post('/interactions', budgetGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createInteractionSchema.parse(req.body);
    const result = await interactionService.createInteraction(req.tenantId, body);

    res.status(201).json({
      id: result.interaction.id,
      contact_id: result.interaction.contact_id,
      summary: result.interaction.summary,
      sentiment: result.interaction.sentiment,
      key_points: result.interaction.key_points,
      intent: result.interaction.intent,
      token_usage: result.token_usage
        ? {
            model: result.token_usage.model,
            input_tokens: result.token_usage.input_tokens,
            output_tokens: result.token_usage.output_tokens,
            cost_usd: result.token_usage.cost_usd,
          }
        : undefined,
      context_refresh_triggered: result.context_refresh_triggered,
    });
  } catch (err) {
    next(err);
  }
});

// GET /interactions
router.get('/interactions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contactId = req.query.contact_id as string;
    if (!contactId) {
      res.status(400).json({ error: 'contact_id query parameter is required' });
      return;
    }

    const filters: interactionService.ListInteractionsFilters = {
      contact_id: contactId,
      agent: req.query.agent as string | undefined,
      type: req.query.type as string | undefined,
      since: req.query.since as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      include_raw: req.query.include_raw === 'true',
    };

    const interactions = await interactionService.listInteractions(req.tenantId, filters);
    res.json({ data: interactions });
  } catch (err) {
    next(err);
  }
});

export default router;
