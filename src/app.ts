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
import errorRoutes from './routes/errors.js';

const app = express();

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
app.use('/api/v1', errorRoutes);

// Error handling
app.use(errorHandler);

export default app;
