import express from 'express';
import { authMiddleware } from './middleware/auth.js';
import { tenantMiddleware } from './middleware/tenant.js';
import { errorHandler } from './middleware/errorHandler.js';

import healthRoutes from './routes/health.js';
import contactRoutes from './routes/contacts.js';
import interactionRoutes from './routes/interactions.js';
import contextRoutes from './routes/context.js';
import handoffRoutes from './routes/handoffs.js';
import usageRoutes from './routes/usage.js';

const app = express();

// CORS — allow dashboard and other authorized origins
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || [];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Tenant-ID, X-Agent-Name');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

// Body parsing
app.use(express.json({ limit: '1mb' }));

// Auth & tenant middleware (skipped for /health)
app.use(authMiddleware);
app.use(tenantMiddleware);

// Routes
app.use(healthRoutes);
app.use('/api/v1', contactRoutes);
app.use('/api/v1', interactionRoutes);
app.use('/api/v1', contextRoutes);
app.use('/api/v1', handoffRoutes);
app.use('/api/v1', usageRoutes);

// Error handling
app.use(errorHandler);

export default app;
