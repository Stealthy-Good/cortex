import { Router, Request, Response, NextFunction } from 'express';
import * as errorService from '../services/errorService.js';

const router = Router();

// GET /errors/summary — Error summary for the dashboard
router.get('/errors/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hours = req.query.hours ? parseInt(req.query.hours as string, 10) : 24;
    const summary = await errorService.getErrorSummary(hours);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

// GET /errors/recent — Recent errors list
router.get('/errors/recent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hours = req.query.hours ? parseInt(req.query.hours as string, 10) : 4;
    const errors = await errorService.getRecentErrors(hours);
    res.json({ data: errors, count: errors.length });
  } catch (err) {
    next(err);
  }
});

// GET /errors/patterns — Recurring error patterns
router.get('/errors/patterns', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hours = req.query.hours ? parseInt(req.query.hours as string, 10) : 24;
    const patterns = await errorService.getErrorPatterns(hours);
    res.json({ data: patterns, count: patterns.length });
  } catch (err) {
    next(err);
  }
});

// PATCH /errors/resolve — Resolve errors by pattern or ID
router.patch('/errors/resolve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pattern_id, error_ids, resolution } = req.body;

    if (!resolution) {
      res.status(400).json({ error: 'resolution is required' });
      return;
    }

    const resolved = await errorService.resolveErrors({
      pattern_id,
      error_ids,
      resolution,
    });

    res.json({ resolved_count: resolved });
  } catch (err) {
    next(err);
  }
});

export default router;
