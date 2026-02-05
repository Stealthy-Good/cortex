# Cortex API — Directive

## What is Cortex?

Cortex is the shared memory service for the AI agent team (Luna, Mia, Anna, Jasper, Helios). It provides:
- **Contact context** — pre-generated briefings agents retrieve before interacting with a contact
- **Interaction logging** — append-only log with AI-generated summaries
- **Handoff coordination** — explicit transitions between agents with context generation
- **Token budget enforcement** — per-agent daily limits with budget checks

## Running Locally

### Prerequisites
- Node.js 18+
- Supabase project with credentials

### Setup
1. Fill in `.env` with Supabase URL, service key, and Anthropic API key
2. Run migrations in order: `supabase/migrations/001_tenants.sql` through `008_seed_data.sql`
3. Copy the default tenant ID from Supabase and set `DEFAULT_TENANT_ID` in `.env`
4. `npm install && npm run dev`

### Verify
```bash
# Health check
curl http://localhost:3000/health

# Deep health (checks DB + Anthropic)
curl http://localhost:3000/health/deep

# Create a contact (replace TENANT_ID)
curl -X POST http://localhost:3000/api/v1/contacts \
  -H "Authorization: Bearer cortex-dev-key-change-me" \
  -H "X-Tenant-ID: YOUR_TENANT_ID" \
  -H "X-Agent-Name: anna" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User","company_name":"Acme"}'
```

## API Authentication

All endpoints (except `/health*`) require:
- `Authorization: Bearer <CORTEX_API_KEY>`
- `X-Tenant-ID: <tenant-uuid>` (or relies on DEFAULT_TENANT_ID)
- `X-Agent-Name: <agent-name>` (optional, used for budget tracking)

## Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /context/:contact_id | Get working context (levels 0-3) |
| POST | /context/:contact_id/refresh | Force context regeneration |
| POST | /interactions | Log interaction (auto-summarizes) |
| GET | /interactions | Query interactions |
| POST | /handoffs | Create handoff (generates context) |
| GET | /handoffs/pending | Get pending handoffs |
| PATCH | /handoffs/:id | Update handoff status |
| POST | /contacts | Create/upsert contact |
| GET | /contacts/:id | Get contact |
| PATCH | /contacts/:id | Update contact |
| GET | /contacts | List/search contacts |
| GET | /usage/summary | Token usage summary |
| GET | /usage/budget-check/:agent | Budget check |
| GET | /errors/summary | Error summary (self-annealing) |
| GET | /errors/recent | Recent errors list |
| GET | /errors/patterns | Recurring error patterns |
| PATCH | /errors/resolve | Resolve errors by pattern/ID |

## Background Jobs

Scheduled via node-cron (in-process):
- **Nightly context refresh** — 2:00 AM, regenerates stale context for active contacts
- **Stale context cleanup** — Every 6h, removes context for inactive contacts
- **Token budget reset** — Midnight, logs daily usage summary
- **Handoff reminder** — Every 2h, logs warnings for overdue pending handoffs
- **Self-annealing** — Every 4h, detects error patterns, auto-fixes recurring issues, checks quality, updates directive

## Self-Annealing System

The self-annealing system automatically detects and responds to operational issues:

1. **Error Journal** — All errors are logged to `cortex_errors` table with type, service, operation, and context
2. **Pattern Detection** — The self-anneal job groups errors by type/service/operation to find recurring patterns
3. **Auto-Fixes** — Rate limits → batch size recommendations; budget exceeded → budget increase suggestions; quality issues → Sonnet fallback recommendations
4. **Quality Checks** — Samples recent summaries for empty/short outputs, checks context staleness, detects orphaned handoffs
5. **Directive Updates** — Appends learnings to this file's "Learnings & Edge Cases" section automatically

Error tracking is wired into: error handler middleware, interaction service (Claude failures), context service (generation failures), and budget guard (budget exceeded).

## Dashboard

The dashboard is a Next.js 14 app in `/dashboard` with Tailwind CSS and Recharts:

| Route | Page | Description |
|-------|------|-------------|
| `/` | Overview | KPI cards, recent activity, pending handoffs |
| `/contacts` | Contacts | Searchable/filterable table, click for detail |
| `/contacts/[id]` | Contact Detail | Working context, interaction timeline, handoff history |
| `/handoffs` | Handoffs | Pending queue with status filters and stats |
| `/usage` | Usage | Token spend charts by agent/model/day, budget bars |
| `/activity` | Activity | Auto-refreshing feed of interactions + handoffs |
| `/errors` | Errors | Self-annealing dashboard: patterns, auto-fixes, error list |

Run with: `cd dashboard && npm install && npm run dev` (port 3001)

## Learnings & Edge Cases

*(Update this section as issues are discovered)*

- Supabase upsert requires the conflict columns to match exactly
- Claude Haiku JSON responses sometimes come wrapped in markdown code blocks — the parser strips these
- Budget checks are non-blocking: if the check fails (DB error), the request proceeds anyway

## Tech Stack
- Node.js + TypeScript + Express
- Supabase (PostgreSQL) — no Redis
- Anthropic Claude API (Haiku for summarization)
- node-cron for background jobs
- Zod for request validation
