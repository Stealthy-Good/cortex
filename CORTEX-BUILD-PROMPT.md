# Cortex: Shared Memory Service for Agent Team

## Overview

Cortex is the central nervous system for our AI agent team. It provides shared memory, context management, and handoff coordination between agents (Luna, Mia, Anna, Jasper) while enforcing token budgets to control costs.

### Design Principles

1. **Agents stay lightweight** — They call Cortex for context, not manage it themselves
2. **Summarize early, retrieve smart** — Raw data is summarized at write time; agents get pre-processed context
3. **Token-conscious by default** — Every endpoint respects budgets; full history is opt-in
4. **Handoffs are first-class** — Explicit handoff events create audit trails and trigger context regeneration
5. **Multi-tenant ready** — Schema and API support multiple clients from day one

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CORTEX                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │   REST API   │  │  Background  │  │   Token Budget       │   │
│  │   Service    │  │  Workers     │  │   Enforcer           │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│           │                │                    │                │
│           └────────────────┼────────────────────┘                │
│                            │                                     │
│                    ┌───────▼───────┐                            │
│                    │   Supabase    │                            │
│                    │   Database    │                            │
│                    └───────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
        ▲                    ▲                    ▲
        │                    │                    │
   ┌────┴────┐         ┌─────┴─────┐        ┌────┴────┐
   │  Luna   │         │   Anna    │        │ Helios  │
   │  Mia    │         │  Jasper   │        │(read)   │
   └─────────┘         └───────────┘        └─────────┘
```

---

## Tech Stack

- **Runtime**: Node.js with TypeScript (or Python with FastAPI — choose based on existing agent stack)
- **Database**: Supabase (PostgreSQL)
- **Cache**: Redis (for working context cache)
- **Queue**: BullMQ or Supabase Edge Functions (for background jobs)
- **LLM**: Claude API (Haiku for summarization, Sonnet for complex context generation)

---

## Database Schema

### Table: `tenants`

Multi-client support from day one.

```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,  -- e.g., "top-cup"
  config JSONB DEFAULT '{}',  -- tenant-specific settings
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `contacts`

The source of truth for every person/company in the system.

```sql
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

  -- Identity
  email TEXT NOT NULL,
  name TEXT,
  company_name TEXT,
  phone TEXT,

  -- Classification
  stage TEXT NOT NULL DEFAULT 'prospect',
  -- Values: prospect, qualified, opportunity, customer, churning, lost, recovered

  source TEXT,  -- how they entered: 'anna_outbound', 'inbound_form', 'referral', etc.

  -- Ownership
  owner_agent TEXT,      -- current agent: 'anna', 'luna', 'mia', 'jasper', or NULL
  owner_human_id TEXT,   -- human sales rep ID if assigned

  -- Metadata
  tags TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}',

  -- Timestamps
  first_touch_at TIMESTAMPTZ,
  last_touch_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,  -- when they became a customer
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, email)
);

CREATE INDEX idx_contacts_tenant_stage ON contacts(tenant_id, stage);
CREATE INDEX idx_contacts_tenant_owner ON contacts(tenant_id, owner_agent);
CREATE INDEX idx_contacts_last_touch ON contacts(tenant_id, last_touch_at DESC);
```

### Table: `interactions`

Append-only log of every touchpoint. Raw content stored but summaries used for context.

```sql
CREATE TABLE interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,

  -- Who/What
  agent TEXT NOT NULL,  -- 'anna', 'luna', 'mia', 'jasper', 'human'
  human_id TEXT,        -- if agent='human', who specifically

  type TEXT NOT NULL,
  -- Values: email_sent, email_received, ticket_opened, ticket_resolved,
  --         call, note, order_placed, refund_processed, nudge_sent,
  --         sequence_started, sequence_completed

  direction TEXT,  -- 'inbound' or 'outbound' (for emails/calls)

  -- Content
  subject TEXT,
  raw_content TEXT,           -- full email/ticket body
  summary TEXT,               -- AI-generated 1-2 sentence summary (generated at write time)

  -- Analysis
  sentiment TEXT,             -- 'positive', 'neutral', 'negative', 'escalation'
  key_points TEXT[],          -- extracted bullet points
  intent TEXT,                -- 'question', 'complaint', 'purchase_intent', 'churn_risk', etc.

  -- References
  external_id TEXT,           -- ticket ID, email ID, order ID, etc.
  campaign_id TEXT,           -- for Anna/Jasper sequences
  thread_id TEXT,             -- to group conversation threads

  -- Metadata
  metadata JSONB DEFAULT '{}',
  token_count INT,            -- tokens used for this interaction's processing

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_interactions_contact ON interactions(contact_id, created_at DESC);
CREATE INDEX idx_interactions_tenant_agent ON interactions(tenant_id, agent, created_at DESC);
CREATE INDEX idx_interactions_thread ON interactions(thread_id, created_at);
```

### Table: `contact_context`

Pre-generated working memory. Cached summaries that agents retrieve.

```sql
CREATE TABLE contact_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE UNIQUE,

  -- The Briefing
  summary TEXT NOT NULL,          -- paragraph: who is this, what's the history
  key_facts TEXT[] DEFAULT '{}',  -- bullet points for quick scanning

  -- Current State
  current_status TEXT,            -- what's happening right now
  recommended_tone TEXT,          -- how to approach them based on history
  open_threads JSONB DEFAULT '[]', -- active conversations/tickets

  -- Risk/Opportunity Signals
  churn_risk_score FLOAT,         -- 0-1
  upsell_potential_score FLOAT,   -- 0-1
  risk_factors TEXT[],
  opportunity_factors TEXT[],

  -- Last Handoff Reference
  last_handoff_id UUID,
  last_handoff_summary TEXT,

  -- Cache Management
  interaction_count_at_generation INT,  -- to detect staleness
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,               -- optional TTL

  -- Token Tracking
  token_count INT,  -- how many tokens this context represents

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_context_tenant ON contact_context(tenant_id);
CREATE INDEX idx_context_staleness ON contact_context(generated_at);
```

### Table: `handoff_events`

Explicit transitions between agents or to humans.

```sql
CREATE TABLE handoff_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,

  -- The Handoff
  from_agent TEXT NOT NULL,       -- 'anna', 'luna', 'mia', 'jasper'
  to_agent TEXT,                  -- NULL if going to human
  to_human_id TEXT,               -- human ID if escalating to person

  -- Context
  reason TEXT NOT NULL,
  -- Values: warm_reply, escalation, complex_question, upsell_opportunity,
  --         churn_risk, completed_sequence, customer_request, other

  reason_detail TEXT,             -- free text explanation
  context_summary TEXT NOT NULL,  -- what the receiving party needs to know
  suggested_action TEXT,          -- optional recommendation

  -- Priority
  urgency TEXT DEFAULT 'normal',  -- 'low', 'normal', 'high', 'urgent'

  -- Status
  status TEXT DEFAULT 'pending',  -- 'pending', 'accepted', 'completed', 'rejected'
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_handoffs_contact ON handoff_events(contact_id, created_at DESC);
CREATE INDEX idx_handoffs_pending ON handoff_events(tenant_id, to_agent, status)
  WHERE status = 'pending';
CREATE INDEX idx_handoffs_to_human ON handoff_events(tenant_id, to_human_id, status)
  WHERE to_human_id IS NOT NULL;
```

### Table: `token_usage`

Track token consumption per agent for budgeting and monitoring.

```sql
CREATE TABLE token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

  agent TEXT NOT NULL,
  model TEXT NOT NULL,            -- 'haiku', 'sonnet', 'opus'
  operation TEXT NOT NULL,        -- 'summarize', 'generate_context', 'write_email', etc.

  input_tokens INT NOT NULL,
  output_tokens INT NOT NULL,
  total_tokens INT GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,

  cost_usd DECIMAL(10, 6),        -- calculated cost

  contact_id UUID REFERENCES contacts(id),  -- optional, for per-contact tracking
  interaction_id UUID REFERENCES interactions(id),  -- optional

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_token_usage_tenant_agent ON token_usage(tenant_id, agent, created_at DESC);
CREATE INDEX idx_token_usage_daily ON token_usage(tenant_id, DATE(created_at));
```

### Table: `agent_config`

Per-tenant, per-agent configuration including token budgets.

```sql
CREATE TABLE agent_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  agent TEXT NOT NULL,

  -- Token Budgets
  max_input_tokens INT DEFAULT 2000,
  max_output_tokens INT DEFAULT 500,
  daily_token_budget INT DEFAULT 100000,

  -- Model Preferences
  default_model TEXT DEFAULT 'haiku',
  complex_task_model TEXT DEFAULT 'sonnet',

  -- Behavior
  config JSONB DEFAULT '{}',  -- agent-specific settings

  enabled BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, agent)
);
```

---

## API Specification

Base URL: `https://cortex.yourdomain.com/api/v1`

All endpoints require header: `X-Tenant-ID: {tenant_id}` or `Authorization: Bearer {token}` (token encodes tenant).

### Context Endpoints

#### `GET /context/:contact_id`

Get working context for a contact. This is the primary endpoint agents call.

**Query Parameters:**
- `level` (optional): `0` | `1` | `2` | `3` (default: `1`)
  - `0`: Header only (~50 tokens)
  - `1`: Working context summary (~300 tokens)
  - `2`: Working context + recent interactions (~800 tokens)
  - `3`: Full history (capped at agent's max_input_tokens)
- `refresh` (optional): `true` to force regeneration

**Response (Level 1):**
```json
{
  "contact_id": "uuid",
  "level": 1,
  "token_count": 287,

  "header": {
    "name": "John Smith",
    "company": "Acme Corp",
    "email": "john@acme.com",
    "stage": "customer",
    "last_touch": "2025-01-28T14:30:00Z",
    "last_touch_agent": "luna"
  },

  "context": {
    "summary": "John is the procurement manager at Acme Corp, a customer since January 2025. They ordered 500 units initially after Anna's outreach about sustainability. Had one shipping delay issue resolved by Luna last week. Generally positive interactions, price-conscious but values quality.",

    "key_facts": [
      "Procurement manager, makes buying decisions",
      "Price-conscious — asked about bulk discounts twice",
      "Values sustainability angle (responded to Anna's eco messaging)",
      "Had shipping issue Jan 20, resolved same day by Luna",
      "Ordered 500 units, hinted at potential for 2000/quarter"
    ],

    "current_status": "Active customer, no open tickets",
    "recommended_tone": "Professional, emphasize value and reliability",

    "open_threads": [],

    "signals": {
      "churn_risk": 0.15,
      "upsell_potential": 0.72,
      "risk_factors": [],
      "opportunity_factors": ["Mentioned scaling up", "Positive recent interaction"]
    }
  },

  "last_handoff": {
    "from": "anna",
    "to": "luna",
    "reason": "Customer converted, first order placed",
    "date": "2025-01-15T10:00:00Z"
  },

  "generated_at": "2025-01-28T15:00:00Z",
  "is_stale": false
}
```

**Response (Level 2)** — adds `recent_interactions`:
```json
{
  "...": "same as level 1",

  "recent_interactions": [
    {
      "id": "uuid",
      "agent": "luna",
      "type": "ticket_resolved",
      "summary": "Resolved shipping delay complaint. Customer satisfied with quick response.",
      "sentiment": "positive",
      "date": "2025-01-20T16:45:00Z"
    },
    {
      "id": "uuid",
      "agent": "anna",
      "type": "email_received",
      "summary": "Customer confirmed first order of 500 units. Asked about timeline.",
      "sentiment": "positive",
      "date": "2025-01-15T09:30:00Z"
    }
    // ... up to 10 recent interactions
  ]
}
```

---

#### `POST /context/:contact_id/refresh`

Force regeneration of working context. Called after significant events.

**Response:**
```json
{
  "contact_id": "uuid",
  "regenerated": true,
  "previous_generated_at": "2025-01-28T10:00:00Z",
  "new_generated_at": "2025-01-28T15:30:00Z",
  "token_count": 312
}
```

---

### Interaction Endpoints

#### `POST /interactions`

Log a new interaction. Cortex generates summary automatically.

**Request:**
```json
{
  "contact_id": "uuid",
  "agent": "luna",
  "type": "ticket_resolved",
  "direction": "outbound",
  "subject": "RE: Shipping delay on order #1234",
  "raw_content": "Hi John, I've tracked down your package and...",
  "external_id": "ticket-5678",
  "thread_id": "thread-abc",
  "metadata": {
    "resolution_type": "shipping_issue",
    "time_to_resolve_minutes": 45
  }
}
```

**Response:**
```json
{
  "id": "uuid",
  "contact_id": "uuid",
  "summary": "Resolved shipping delay. Package located and expedited delivery arranged. Customer thanked for patience.",
  "sentiment": "positive",
  "key_points": [
    "Shipping delay on order #1234",
    "Package tracked and expedited",
    "Customer satisfied"
  ],
  "intent": "complaint_resolved",
  "token_usage": {
    "model": "haiku",
    "input_tokens": 234,
    "output_tokens": 67,
    "cost_usd": 0.00008
  },
  "context_refresh_triggered": true
}
```

**Notes:**
- If `raw_content` is provided without `summary`, Cortex generates the summary using Haiku
- Set `context_refresh_triggered: true` if this interaction is significant enough to regenerate context
- Cortex automatically updates `contact.last_touch_at`

---

#### `GET /interactions`

Query interactions with filters.

**Query Parameters:**
- `contact_id` (required)
- `agent` (optional): filter by agent
- `type` (optional): filter by type
- `since` (optional): ISO timestamp
- `limit` (optional): default 20, max 100
- `include_raw` (optional): `true` to include raw_content (default: `false`, returns summaries only)

---

### Handoff Endpoints

#### `POST /handoffs`

Create a handoff event. Triggers context regeneration and notifications.

**Request:**
```json
{
  "contact_id": "uuid",
  "from_agent": "anna",
  "to_agent": "jasper",  // OR "to_human_id": "jedd-123"
  "reason": "warm_reply",
  "reason_detail": "Prospect asked about bulk pricing for 1000+ units",
  "suggested_action": "Send pricing sheet and offer call",
  "urgency": "high"
}
```

**Response:**
```json
{
  "id": "uuid",
  "contact_id": "uuid",
  "context_summary": "Auto-generated summary of relevant context for Jasper...",
  "status": "pending",
  "notifications_sent": ["jasper", "helios"],
  "context_refreshed": true
}
```

**Notes:**
- Cortex auto-generates `context_summary` based on recent interactions and working context
- Updates `contact.owner_agent` or `contact.owner_human_id`
- Fires webhook/notification to receiving agent and Helios

---

#### `GET /handoffs/pending`

Get pending handoffs for an agent or human.

**Query Parameters:**
- `agent` (optional): filter by to_agent
- `human_id` (optional): filter by to_human_id
- `urgency` (optional): filter by urgency level

---

#### `PATCH /handoffs/:id`

Update handoff status.

**Request:**
```json
{
  "status": "accepted"  // or "completed", "rejected"
}
```

---

### Contact Endpoints

#### `POST /contacts`

Create or update a contact (upsert by email).

**Request:**
```json
{
  "email": "john@acme.com",
  "name": "John Smith",
  "company_name": "Acme Corp",
  "stage": "prospect",
  "source": "anna_outbound",
  "tags": ["manufacturing", "midwest"],
  "custom_fields": {
    "industry": "manufacturing",
    "company_size": "50-200"
  }
}
```

---

#### `GET /contacts/:id`

Get contact details (not context — use `/context/:id` for that).

---

#### `PATCH /contacts/:id`

Update contact fields.

---

#### `GET /contacts`

Search/list contacts.

**Query Parameters:**
- `stage` (optional)
- `owner_agent` (optional)
- `owner_human_id` (optional)
- `tag` (optional)
- `search` (optional): fuzzy search on name, email, company
- `limit`, `offset`

---

### Token & Budget Endpoints

#### `GET /usage/summary`

Get token usage summary for monitoring (Helios calls this).

**Query Parameters:**
- `period`: `day` | `week` | `month`
- `agent` (optional): filter by agent

**Response:**
```json
{
  "period": "day",
  "start": "2025-01-28T00:00:00Z",
  "end": "2025-01-28T23:59:59Z",

  "totals": {
    "input_tokens": 142000,
    "output_tokens": 38000,
    "total_tokens": 180000,
    "cost_usd": 0.54
  },

  "by_agent": {
    "luna": {
      "total_tokens": 78000,
      "cost_usd": 0.23,
      "operations": 92,
      "avg_tokens_per_operation": 848
    },
    "anna": {
      "total_tokens": 45000,
      "cost_usd": 0.14,
      "operations": 144,
      "avg_tokens_per_operation": 312
    }
    // ...
  },

  "by_model": {
    "haiku": { "tokens": 120000, "cost_usd": 0.12 },
    "sonnet": { "tokens": 60000, "cost_usd": 0.42 }
  },

  "budget_status": {
    "luna": { "used": 78000, "budget": 100000, "remaining": 22000 },
    "anna": { "used": 45000, "budget": 80000, "remaining": 35000 }
  }
}
```

---

#### `GET /usage/budget-check/:agent`

Quick budget check before an operation. Agents call this to decide if they should proceed or use a cheaper model.

**Query Parameters:**
- `estimated_tokens` (optional): how many tokens this operation might use

**Response:**
```json
{
  "agent": "luna",
  "daily_budget": 100000,
  "used_today": 78000,
  "remaining": 22000,
  "estimated_tokens": 500,
  "within_budget": true,
  "recommendation": "proceed",  // or "use_haiku", "defer", "alert_human"
  "budget_percentage_used": 78
}
```

---

## Background Jobs

### 1. Nightly Context Refresh

Regenerate working context for active contacts.

```
Schedule: 2:00 AM daily (per tenant timezone)

Logic:
1. Query contacts WHERE last_touch_at > NOW() - INTERVAL '30 days'
2. For each contact:
   a. Check if context is stale (interaction_count changed, or generated_at > 24h)
   b. If stale, regenerate using Claude Haiku
   c. Update contact_context table
3. Log token usage
```

### 2. Stale Context Cleanup

Mark or regenerate contexts that are too old.

```
Schedule: Every 6 hours

Logic:
1. Query contact_context WHERE generated_at < NOW() - INTERVAL '7 days'
2. For inactive contacts (no touch in 30 days): mark as expired, don't regenerate
3. For active contacts: queue for regeneration
```

### 3. Token Budget Reset

Reset daily budgets at midnight.

```
Schedule: Midnight (per tenant timezone)

Logic:
1. No database changes needed (budget is calculated from token_usage by date)
2. Optional: Send daily usage report to Helios/admin
```

### 4. Handoff Reminder

Nudge on pending handoffs.

```
Schedule: Every 2 hours

Logic:
1. Query handoff_events WHERE status = 'pending' AND created_at < NOW() - INTERVAL '4 hours'
2. For high/urgent: send reminder notification
3. For normal after 24h: escalate to admin
```

---

## Context Generation Prompts

### Working Context Summary Prompt (Haiku)

```
You are generating a working context summary for an AI agent about to interact with a contact.

Contact: {{contact.name}} ({{contact.email}})
Company: {{contact.company_name}}
Stage: {{contact.stage}}
First contact: {{contact.first_touch_at}}
Source: {{contact.source}}

Recent interactions (newest first):
{{#each recent_interactions}}
- [{{this.date}}] {{this.agent}}: {{this.type}} — {{this.summary}}
{{/each}}

Generate a concise briefing with:
1. A 2-3 sentence summary paragraph (who they are, key history, current relationship)
2. 4-6 bullet point key facts (things the agent needs to know)
3. Current status (one line)
4. Recommended tone for communication

Keep total output under 300 tokens. Be specific and actionable.
```

### Handoff Context Prompt (Haiku)

```
You are creating a handoff summary for an AI agent receiving a contact from another agent.

FROM: {{from_agent}}
TO: {{to_agent}}
REASON: {{reason}}
{{#if reason_detail}}DETAIL: {{reason_detail}}{{/if}}

Contact: {{contact.name}} at {{contact.company_name}}
Current stage: {{contact.stage}}

Recent relevant interactions:
{{#each recent_interactions}}
- [{{this.date}}] {{this.summary}}
{{/each}}

Working context summary:
{{existing_context.summary}}

Key facts:
{{#each existing_context.key_facts}}
- {{this}}
{{/each}}

Generate a handoff briefing (150-200 tokens) that:
1. Explains why this handoff is happening
2. Summarizes what the receiving agent needs to know
3. Suggests an immediate next action

Focus on actionable context for {{to_agent}}.
```

### Interaction Summary Prompt (Haiku)

```
Summarize this {{interaction_type}} in 1-2 sentences. Extract:
- Key points discussed
- Any commitments or next steps
- Sentiment (positive/neutral/negative)
- Intent (question/complaint/purchase_intent/churn_risk/info_request/other)

{{#if subject}}Subject: {{subject}}{{/if}}

Content:
{{raw_content}}

Respond in JSON:
{
  "summary": "...",
  "key_points": ["...", "..."],
  "sentiment": "...",
  "intent": "..."
}
```

---

## Integration Guide for Agents

### How Luna Should Integrate

```typescript
// At start of ticket handling
const context = await cortex.getContext(contactId, { level: 1 });

// Use context in prompt
const prompt = `
You are Luna, a customer service agent.

Customer Context:
${context.context.summary}

Key Facts:
${context.context.key_facts.map(f => `- ${f}`).join('\n')}

Recommended Tone: ${context.context.recommended_tone}

Current ticket: ${ticketContent}

Respond helpfully while being mindful of this customer's history.
`;

// After resolving ticket
await cortex.logInteraction({
  contact_id: contactId,
  agent: 'luna',
  type: 'ticket_resolved',
  raw_content: responseText,
  external_id: ticketId,
  thread_id: threadId
});

// If escalating
await cortex.createHandoff({
  contact_id: contactId,
  from_agent: 'luna',
  to_human_id: 'support-manager-1',
  reason: 'escalation',
  reason_detail: 'Customer requesting refund beyond policy, needs manager approval',
  urgency: 'high'
});
```

### How Anna Should Integrate

```typescript
// Before sending outreach
const budgetCheck = await cortex.checkBudget('anna', { estimated_tokens: 500 });
if (!budgetCheck.within_budget) {
  // Defer or use simpler template
}

// When prospect replies
await cortex.logInteraction({
  contact_id: contactId,
  agent: 'anna',
  type: 'email_received',
  direction: 'inbound',
  raw_content: emailBody,
  external_id: emailId,
  campaign_id: campaignId
});

// Analyze reply and potentially handoff
if (isWarmReply) {
  await cortex.createHandoff({
    contact_id: contactId,
    from_agent: 'anna',
    to_agent: 'jasper',  // or to_human_id for complex cases
    reason: 'warm_reply',
    reason_detail: 'Prospect asked about pricing and timeline',
    suggested_action: 'Send pricing sheet, offer discovery call'
  });
}
```

### How Helios Should Integrate

```typescript
// For Team Standup view
const usage = await cortex.getUsageSummary({ period: 'day' });
const pendingHandoffs = await cortex.getPendingHandoffs();
const recentHandoffs = await cortex.getHandoffs({
  since: yesterday,
  status: 'completed'
});

// Generate narrative
const narrative = generateStandupNarrative({
  usage,
  handoffs: [...pendingHandoffs, ...recentHandoffs],
  // ... other data
});
```

---

## Error Handling

### Token Budget Exceeded

When an agent exceeds their budget:
1. Return `429 Too Many Requests` with retry-after header
2. Include recommendation in response (use cheaper model, defer, alert)
3. Log to token_usage with `budget_exceeded: true` flag
4. Notify Helios for dashboard alert

### Context Generation Failure

If Claude API fails during context generation:
1. Return last cached context with `stale: true` flag
2. Queue for retry in 5 minutes
3. After 3 failures, alert admin via Helios

### Missing Contact

If context requested for unknown contact:
1. Return 404 with helpful message
2. Suggest using `POST /contacts` to create first

---

## Deployment Notes

### Environment Variables

```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
REDIS_URL=
ANTHROPIC_API_KEY=
CORTEX_API_KEY=           # for agent authentication
HELIOS_WEBHOOK_URL=       # for notifications
DEFAULT_TENANT_ID=        # for single-tenant mode during development
```

### Health Checks

- `GET /health` — basic liveness
- `GET /health/ready` — includes DB and Redis connectivity
- `GET /health/deep` — includes Claude API check

---

## Future Enhancements (V2)

1. **Vector embeddings** — Semantic search across interactions
2. **Predictive signals** — ML-based churn/upsell scoring
3. **Cross-contact insights** — "Other people at this company..."
4. **Agent learning** — Track which approaches work, feed back to prompts
5. **Real-time subscriptions** — WebSocket feed for Helios live view

---

## Getting Started

1. Set up Supabase project and run schema migrations
2. Deploy Cortex API (Node/Python)
3. Configure Redis for caching
4. Set up background job runner
5. Update one agent (suggest Luna) to use Cortex
6. Verify in Helios that data is flowing
7. Roll out to remaining agents
8. Enable Helios Team Standup view

---

## Questions to Resolve Before Building

1. **Existing data migration** — Do we need to backfill interactions from current agent logs?
2. **Authentication** — API keys per agent, or shared tenant key?
3. **Notification delivery** — Webhooks to agents, or agents poll for handoffs?
4. **Multi-tenant isolation** — Separate schemas, or row-level security?
5. **Redis vs Supabase caching** — Is Redis necessary, or can we use Supabase's built-in caching?
