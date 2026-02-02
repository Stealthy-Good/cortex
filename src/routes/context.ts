import { Router, Request, Response, NextFunction } from 'express';
import { budgetGuard } from '../middleware/budgetGuard.js';
import * as contextService from '../services/contextService.js';

const router = Router();

// GET /context/:contact_id
router.get('/context/:contact_id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const level = req.query.level ? parseInt(req.query.level as string, 10) : 1;
    if (level < 0 || level > 3) {
      res.status(400).json({ error: 'level must be 0, 1, 2, or 3' });
      return;
    }

    const forceRefresh = req.query.refresh === 'true';
    const contactId = req.params.contact_id as string;
    const context = await contextService.getContext(req.tenantId, contactId, level, forceRefresh);
    res.json(context);
  } catch (err) {
    next(err);
  }
});

// POST /context/:contact_id/refresh
router.post(
  '/context/:contact_id/refresh',
  budgetGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const contactId = req.params.contact_id as string;
      const result = await contextService.refreshContext(req.tenantId, contactId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
