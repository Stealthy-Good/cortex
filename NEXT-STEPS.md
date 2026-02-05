# Cortex: Production Roadmap

> Last updated: 2026-02-02
> Status: Core API complete, pre-production

---

## Current State

Cortex is fully built as a Node.js/TypeScript Express API with:
- 16 REST endpoints (contacts, interactions, context, handoffs, usage, health)
- 8 Supabase migrations (7 tables + seed data)
- Claude Haiku integration for AI summarization (3 prompt templates)
- Token budget enforcement per agent
- 4 background cron jobs
- Multi-tenant support
- Zod request validation, strict TypeScript

**What's NOT done yet:** Supabase credentials, migrations run, git repo, deployment, UI, tests, monitoring.

---

## Phase 1: Get It Running (This Week)

### 1.1 Supabase Setup
- [ ] Create Supabase project (or use existing one)
- [ ] Run migrations 001-008 in SQL Editor (in order)
- [ ] Copy default tenant UUID from `tenants` table
- [ ] Fill in `.env`: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `DEFAULT_TENANT_ID`
- [ ] Add `ANTHROPIC_API_KEY` to `.env`
- [ ] Change `CORTEX_API_KEY` from the default to something real

### 1.2 Smoke Test
```bash
npm run dev
# Then:
curl http://localhost:3000/health/deep
# Should show database: "connected", anthropic: "configured"
```

Run the full write-read flow:
```bash
# 1. Create a contact
curl -X POST http://localhost:3000/api/v1/contacts \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "X-Tenant-ID: YOUR_TENANT_ID" \
  -H "X-Agent-Name: anna" \
  -H "Content-Type: application/json" \
  -d '{"email":"john@acme.com","name":"John Smith","company_name":"Acme Corp","stage":"prospect","source":"anna_outbound"}'

# 2. Log an interaction (triggers Claude summarization)
curl -X POST http://localhost:3000/api/v1/interactions \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "X-Tenant-ID: YOUR_TENANT_ID" \
  -H "X-Agent-Name: anna" \
  -H "Content-Type: application/json" \
  -d '{"contact_id":"CONTACT_UUID","agent":"anna","type":"email_sent","direction":"outbound","subject":"Sustainable packaging for Acme","raw_content":"Hi John, I noticed Acme Corp has been expanding its eco-friendly product line..."}'

# 3. Get context (triggers context generation)
curl http://localhost:3000/api/v1/context/CONTACT_UUID?level=2 \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "X-Tenant-ID: YOUR_TENANT_ID"

# 4. Check budget
curl http://localhost:3000/api/v1/usage/budget-check/anna \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "X-Tenant-ID: YOUR_TENANT_ID"
```

### 1.3 Git & GitHub
- [ ] `git init`
- [ ] Create GitHub repo (private): `cortex` under your org
- [ ] Initial commit with everything
- [ ] Push to main

---

## Phase 2: Cortex Dashboard UI [COMPLETE]

A lightweight web dashboard so you can see Cortex working in real-time. Ship fast, iterate later.

### 2.1 Tech Choice
**Next.js 14+ (App Router)** in a `/dashboard` directory within the Cortex repo, or a separate repo. Deployed to Vercel alongside the API.

Key pages:
- **Overview** — active contacts count, today's interactions, pending handoffs, token spend
- **Contacts** — searchable table, click to see full context + interaction timeline
- **Handoffs** — pending/recent handoffs with status badges and accept/reject actions
- **Usage** — token spend charts by agent, by model, by day (line chart + bar chart)
- **Activity Feed** — real-time-ish stream of interactions and handoffs (polling every 30s)

### 2.2 UI Stack
- Next.js 14+ with App Router
- Tailwind CSS + shadcn/ui components
- Recharts or Chart.js for usage charts
- Supabase JS client (direct reads from DB for dashboard — no need to go through the API for reads)
- API calls for writes (create contact, accept handoff, etc.)

### 2.3 Dashboard Pages

| Page | Route | What It Shows |
|------|-------|---------------|
| Overview | `/` | KPI cards, recent activity, pending handoffs |
| Contacts | `/contacts` | Searchable table, stage filters, click for detail |
| Contact Detail | `/contacts/[id]` | Full context (level 2), interaction timeline, handoff history |
| Handoffs | `/handoffs` | Pending queue with accept/reject, completed history |
| Usage | `/usage` | Token spend by agent/model/day, budget bars |
| Activity | `/activity` | Chronological feed of all interactions + handoffs |

### 2.4 Build Order
1. Next.js scaffold + Tailwind + shadcn/ui
2. Supabase client setup (read-only, service role for SSR)
3. Overview page with KPI cards
4. Contacts list + detail page
5. Handoffs page
6. Usage page with charts
7. Activity feed

---

## Phase 3: Deploy to Production

### 3.1 Architecture

```
cortex.stealthygood.com        -> Vercel (API + Dashboard)
  /api/v1/*                    -> Express API (Vercel Serverless Functions)
  /                            -> Next.js Dashboard
  /health                      -> Health checks

Supabase                       -> Managed PostgreSQL
Anthropic API                  -> Claude Haiku for summarization
```

### 3.2 Vercel Deployment Strategy

**Option A: Monorepo (Recommended)**
Both API and dashboard in the same Vercel project using the Vercel monorepo pattern:
```
Cortex/
├── api/                  # Express API adapted for Vercel serverless
│   ├── index.ts          # Vercel serverless handler wrapping Express
│   └── vercel.json       # Route config
├── dashboard/            # Next.js app
│   ├── app/
│   ├── next.config.js
│   └── ...
├── src/                  # Shared services (used by both)
├── supabase/
└── vercel.json           # Root config
```

**Key changes for Vercel:**
- Express app needs to be wrapped as a Vercel serverless function (export the app, not `app.listen()`)
- Background cron jobs move to Vercel Cron (vercel.json `crons` config) or Supabase `pg_cron`
- Environment variables set in Vercel dashboard

### 3.3 Vercel Cron Jobs

```json
// vercel.json
{
  "crons": [
    { "path": "/api/jobs/nightly-refresh", "schedule": "0 2 * * *" },
    { "path": "/api/jobs/stale-cleanup", "schedule": "0 */6 * * *" },
    { "path": "/api/jobs/budget-reset", "schedule": "0 0 * * *" },
    { "path": "/api/jobs/handoff-reminder", "schedule": "0 */2 * * *" }
  ]
}
```

Each job becomes a serverless function endpoint that Vercel hits on schedule.

### 3.4 Domain Setup
- [ ] Add `cortex.stealthygood.com` to Vercel project
- [ ] Configure DNS (CNAME to `cname.vercel-dns.com`)
- [ ] SSL auto-provisioned by Vercel

### 3.5 Environment Variables (Vercel Dashboard)
```
SUPABASE_URL
SUPABASE_SERVICE_KEY
ANTHROPIC_API_KEY
CORTEX_API_KEY
DEFAULT_TENANT_ID
HELIOS_WEBHOOK_URL
CRON_SECRET          # Vercel cron auth
```

---

## Phase 4: Self-Annealing Process [COMPLETE]

Cortex should get smarter over time. When something breaks or underperforms, it should fix itself and update its own instructions.

### 4.1 What Self-Annealing Means for Cortex

**Error Detection -> Root Cause -> Fix -> Update Directive -> Verify**

Three categories:
1. **Operational errors** — API failures, DB timeouts, Claude rate limits
2. **Quality drift** — Summaries getting worse, context becoming stale, budgets blowing up
3. **Integration gaps** — Agents misusing endpoints, missing fields, unexpected patterns

### 4.2 Error Journal

New table: `cortex_errors`
```sql
CREATE TABLE cortex_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  error_type TEXT NOT NULL,        -- 'api_error', 'claude_error', 'budget_exceeded', 'quality_issue'
  service TEXT NOT NULL,           -- 'contextService', 'claudeService', etc.
  operation TEXT NOT NULL,         -- 'summarize_interaction', 'generate_context', etc.
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  context JSONB DEFAULT '{}',     -- request details, input data, etc.
  resolution TEXT,                 -- how it was fixed (filled in after)
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.3 Self-Annealing Loop (Background Job)

New job: `selfAnneal` — runs every 4 hours

```
1. Query cortex_errors from last 4 hours
2. Group by error_type + service + operation
3. For each error pattern:
   a. If count > 3: this is a recurring issue, flag for investigation
   b. If Claude rate limit: automatically switch to smaller batch sizes
   c. If budget exceeded: log recommendation to adjust budget
   d. If context generation failed: retry with fallback prompt
4. For quality checks:
   a. Sample 5 recent summaries, check token count vs. expected range
   b. Check context staleness: any contacts with context older than 48h + recent interactions?
   c. Check orphaned handoffs: any pending > 24h without reminder sent?
5. Log findings to cortex_errors with type 'quality_issue'
6. Update directives/cortex-api.md with any new learnings (append to Learnings section)
```

### 4.4 Quality Scoring

Add a `quality_score` field to interactions:
- After summarization, check: is the summary between 20-200 tokens? Does it contain the key entities from raw_content? Is the sentiment consistent with content?
- If score drops below threshold, queue for re-summarization with Sonnet instead of Haiku
- Track average quality per agent per day

### 4.5 Automatic Fallbacks

| Error | Auto-Response |
|-------|---------------|
| Claude API 429 (rate limit) | Exponential backoff, switch to queued processing |
| Claude API 500 | Retry 3x, then return cached context with `stale: true` |
| Budget exceeded | Downgrade to Haiku, reduce context level, defer non-urgent ops |
| Summary too short (<10 tokens) | Re-summarize with Sonnet |
| Context generation timeout | Return last cached context, queue background regeneration |
| Supabase connection error | Retry with backoff, health endpoint reports degraded |

### 4.6 Directive Auto-Update

When the self-annealing job discovers a new pattern, it appends to `directives/cortex-api.md`:
```markdown
## Learnings & Edge Cases

- [2026-02-15] Claude Haiku sometimes returns empty summary for very short emails (<20 words). Fix: skip summarization for raw_content under 50 chars, use raw_content as summary directly.
- [2026-02-20] Supabase connection pool exhaustion at >50 concurrent requests. Fix: added connection timeout of 5s and max retries of 2.
```

This is the self-annealing feedback loop: errors become documentation become prevention.

---

## Phase 5: Hardening & Observability

### 5.1 Rate Limiting
- Add `express-rate-limit` middleware
- Per-API-key: 100 req/min
- Per-IP: 200 req/min
- Separate limits for write vs. read endpoints

### 5.2 Structured Logging
- Replace `console.log` with `pino` (fast JSON logger)
- Log every request: method, path, status, duration, tenant_id, agent
- Log every Claude API call: model, tokens, cost, duration
- Ship logs to Vercel Logs or Datadog

### 5.3 Error Tracking
- Add Sentry for error reporting
- Capture unhandled rejections
- Tag errors with tenant_id, agent, endpoint

### 5.4 API Documentation
- Generate OpenAPI spec from Zod schemas
- Serve Swagger UI at `/docs`
- Or use `zod-to-openapi` package

### 5.5 Tests
Priority test areas:
1. Context staleness detection logic
2. Budget calculation math
3. Claude response parsing (JSON extraction from markdown blocks)
4. Handoff status transitions
5. Contact upsert conflict resolution

---

## Phase 6: Agent Integration

### 6.1 Cortex SDK (TypeScript)

Create a thin client library agents can import:

```typescript
// packages/cortex-sdk/index.ts
class CortexClient {
  constructor(config: { baseUrl: string; apiKey: string; tenantId: string; agentName: string })

  // Context
  getContext(contactId: string, level?: 0|1|2|3): Promise<ContextResponse>
  refreshContext(contactId: string): Promise<RefreshResult>

  // Interactions
  logInteraction(data: CreateInteractionInput): Promise<InteractionResult>

  // Handoffs
  createHandoff(data: CreateHandoffInput): Promise<HandoffResult>
  getPendingHandoffs(): Promise<HandoffEvent[]>
  acceptHandoff(id: string): Promise<HandoffEvent>
  completeHandoff(id: string): Promise<HandoffEvent>

  // Budget
  checkBudget(estimatedTokens?: number): Promise<BudgetCheckResult>

  // Contacts
  findOrCreateContact(email: string, data?: Partial<Contact>): Promise<Contact>
}
```

### 6.2 Integration Order
1. **Luna** (customer service) — most context-dependent, best first test
2. **Anna** (outbound) — high volume, tests budget enforcement
3. **Jasper** (sales follow-up) — tests handoff flow
4. **Mia** (retention) — tests churn signals
5. **Helios** (dashboard) — reads usage + handoffs, already covered by UI

---

## Phase 7: Future Enhancements (V2)

- **Vector embeddings** — semantic search across interactions using pgvector
- **Predictive scoring** — ML-based churn/upsell scoring from interaction patterns
- **Cross-contact insights** — "Other contacts at this company said..."
- **Real-time subscriptions** — WebSocket feed for Helios live view
- **Agent learning** — track which email templates/approaches get positive sentiment, feed back to agent prompts
- **Webhook system** — notify external systems on handoffs, stage changes, budget alerts

---

## Immediate TODO (Right Now)

1. [x] Build Cortex API
2. [ ] Set up Supabase + run migrations (includes 009_cortex_errors.sql)
3. [ ] Smoke test locally
4. [x] Initialize git + push to GitHub
5. [ ] Set up Vercel project
6. [ ] Deploy to cortex.stealthygood.com
7. [x] Build dashboard UI (Next.js 14 + Tailwind + Recharts in /dashboard)
8. [x] Implement self-annealing system (error journal, self-anneal job, error tracking in services/middleware)
9. [ ] Integrate first agent (Luna)
