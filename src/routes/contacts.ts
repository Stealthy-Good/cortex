import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as contactService from '../services/contactService.js';

const router = Router();

const upsertContactSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  company_name: z.string().optional(),
  phone: z.string().optional(),
  stage: z.string().optional(),
  source: z.string().optional(),
  owner_agent: z.string().optional(),
  owner_human_id: z.string().optional(),
  tags: z.array(z.string()).optional(),
  custom_fields: z.record(z.unknown()).optional(),
});

const updateContactSchema = z.object({
  name: z.string().optional(),
  company_name: z.string().optional(),
  phone: z.string().optional(),
  stage: z.string().optional(),
  source: z.string().optional(),
  owner_agent: z.string().optional(),
  owner_human_id: z.string().optional(),
  tags: z.array(z.string()).optional(),
  custom_fields: z.record(z.unknown()).optional(),
});

// POST /contacts — upsert by email
router.post('/contacts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = upsertContactSchema.parse(req.body);
    const contact = await contactService.upsertContact(req.tenantId, body);
    res.status(201).json({ data: contact });
  } catch (err) {
    next(err);
  }
});

// GET /contacts/:id
router.get('/contacts/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const contact = await contactService.getContact(req.tenantId, id);
    if (!contact) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }
    res.json({ data: contact });
  } catch (err) {
    next(err);
  }
});

// PATCH /contacts/:id
router.patch('/contacts/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = updateContactSchema.parse(req.body);
    const id = req.params.id as string;
    const contact = await contactService.updateContact(req.tenantId, id, body);
    res.json({ data: contact });
  } catch (err) {
    next(err);
  }
});

// GET /contacts — list/search
router.get('/contacts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters: contactService.ListContactsFilters = {
      stage: req.query.stage as string | undefined,
      owner_agent: req.query.owner_agent as string | undefined,
      owner_human_id: req.query.owner_human_id as string | undefined,
      tag: req.query.tag as string | undefined,
      search: req.query.search as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
    };

    const { contacts, count } = await contactService.listContacts(req.tenantId, filters);
    res.json({
      data: contacts,
      count,
      limit: filters.limit || 20,
      offset: filters.offset || 0,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
