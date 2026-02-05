# Cortex

Shared memory and context management service for an AI agent team. Cortex acts as the central nervous system connecting multiple AI agents (Luna, Mia, Anna, Jasper) — handling context generation, interaction logging, handoff coordination, and token budget enforcement.

## Architecture

Cortex follows a 3-layer architecture:

1. **Directives** (`directives/`) — SOPs in Markdown defining goals, inputs, outputs, and edge cases
2. **Orchestration** — AI-driven decision-making layer that reads directives and routes work
3. **Execution** (`execution/`) — Deterministic scripts that handle API calls, data processing, and file operations

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 18+ |
| Language | TypeScript 5.7 (strict mode) |
| Framework | Express 4.21 |
| Database | Supabase (PostgreSQL) |
| AI | Anthropic SDK (Claude Haiku) |
| Validation | Zod 3.24 |
| Scheduling | node-cron 3.0 |

## Project Structure

```
src/
  index.ts              # Entry point
  app.ts                # Express app setup
  config.ts             # Environment configuration
  db.ts                 # Supabase client
  types/index.ts        # TypeScript interfaces
  services/             # Business logic
    claudeService.ts    # Claude API interaction & token accounting
    contextService.ts   # Context generation & caching
    contactService.ts   # Contact CRUD & upsert
    interactionService.ts # Interaction logging & summarization
    handoffService.ts   # Agent handoff coordination
    usageService.ts     # Token usage tracking & budgets
  routes/               # API endpoints
    health.ts           # Health checks
    contacts.ts         # Contact management
    interactions.ts     # Interaction logging
    context.ts          # Context retrieval & refresh
    handoffs.ts         # Handoff management
    usage.ts            # Usage & budget queries
  middleware/
    auth.ts             # Bearer token validation
    tenant.ts           # Multi-tenant extraction
    budgetGuard.ts      # Token budget enforcement
    errorHandler.ts     # Global error handling
  jobs/                 # Background cron jobs
    runner.ts           # Cron scheduler
    nightlyContextRefresh.ts
    staleContextCleanup.ts
    tokenBudgetReset.ts
    handoffReminder.ts
supabase/
  migrations/           # 8 SQL migration files
directives/             # Operating SOPs
```

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- An [Anthropic API](https://console.anthropic.com) key

### Environment Variables

Create a `.env` file in the project root:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
ANTHROPIC_API_KEY=your-anthropic-key
CORTEX_API_KEY=your-bearer-token
DEFAULT_TENANT_ID=your-tenant-uuid
PORT=3000                    # optional, defaults to 3000
HELIOS_WEBHOOK_URL=          # optional, external webhook
```

### Installation

```bash
npm install
```

### Database Setup

Run the SQL migrations in `supabase/migrations/` against your Supabase project in order (001 through 008).

### Development

```bash
npm run dev
```

### Build & Run

```bash
npm run build
npm start
```

### Tests

```bash
npm test
```

## API Overview

All endpoints (except health) require a `Bearer` token via the `Authorization` header and a `X-Tenant-ID` header.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Basic health check |
| `GET` | `/health/deep` | Deep health check (DB + Anthropic) |
| `POST` | `/contacts` | Upsert a contact |
| `GET` | `/contacts/:id` | Get contact by ID |
| `GET` | `/contacts` | List/search contacts |
| `POST` | `/interactions` | Log an interaction (auto-summarized) |
| `GET` | `/interactions` | Query interactions |
| `GET` | `/context/:contact_id` | Get contact context (levels 0-3) |
| `POST` | `/context/:contact_id/refresh` | Force context regeneration |
| `POST` | `/handoffs` | Create a handoff |
| `GET` | `/handoffs/pending` | List pending handoffs |
| `PATCH` | `/handoffs/:id` | Update handoff status |
| `GET` | `/usage/summary` | Token usage summary |
| `GET` | `/usage/budget-check/:agent` | Check agent budget |

### Context Levels

| Level | Content | ~Tokens |
|-------|---------|---------|
| 0 | Name, email, company, stage | ~50 |
| 1 | + Summary, key facts, signals | ~200 |
| 2 | + Last 10 interactions | ~500 |
| 3 | + Last 50 interactions, full handoff history | ~2000 |

## Background Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| Nightly Context Refresh | 2:00 AM | Regenerate context for recently active contacts |
| Stale Context Cleanup | Every 6h | Remove context for inactive contacts |
| Token Budget Reset | Midnight | Log daily usage summary |
| Handoff Reminder | Every 2h | Alert on overdue pending handoffs |

## License

Private
