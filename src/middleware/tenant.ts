import { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';
import { supabase } from '../db.js';

// Simple in-memory cache for tenant validation (5 min TTL)
const tenantCache = new Map<string, { valid: boolean; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export function tenantMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip for health endpoints
  if (req.path.startsWith('/health')) {
    next();
    return;
  }

  const tenantId = (req.headers['x-tenant-id'] as string) || config.defaultTenantId;

  if (!tenantId) {
    res.status(400).json({ error: 'Missing X-Tenant-ID header and no default tenant configured' });
    return;
  }

  // Check cache
  const cached = tenantCache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) {
    if (cached.valid) {
      req.tenantId = tenantId;
      next();
      return;
    }
    res.status(400).json({ error: 'Invalid tenant ID' });
    return;
  }

  // Validate against DB
  validateTenant(tenantId)
    .then((valid) => {
      tenantCache.set(tenantId, { valid, expiresAt: Date.now() + CACHE_TTL_MS });
      if (!valid) {
        res.status(400).json({ error: 'Invalid tenant ID' });
        return;
      }
      req.tenantId = tenantId;
      next();
    })
    .catch((err) => {
      next(err);
    });
}

async function validateTenant(tenantId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('tenants')
    .select('id')
    .eq('id', tenantId)
    .single();

  if (error || !data) return false;
  return true;
}
