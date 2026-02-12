# Agent Cortex Integration — Directive

> Give these steps to Claude Code inside each agent's repo.
> Replace `<AGENT_NAME>` with the agent's name: `luna`, `mia`, `anna`, `jasper`, or `helios`.

---

## Step 1: Add Environment Variables

"Add these to my `.env.local` file:
```
CORTEX_URL=https://cortex.stealthygood.com
CORTEX_API_KEY=<your-cortex-api-key>
CORTEX_TENANT_ID=<your-tenant-uuid>
CORTEX_AGENT_NAME=<AGENT_NAME>
```
Replace those placeholders with the actual values from the Cortex Vercel dashboard."

---

## Step 2: Install the SDK

"Run `npm install @stealthy-good/cortex-sdk` to add the Cortex shared memory SDK."

> If the GitHub Packages registry isn't configured yet, the agent will need an `.npmrc` with:
> ```
> @stealthy-good:registry=https://npm.pkg.github.com
> //npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
> ```

---

## Step 3: Create the Cortex Client Utility

"Create a file at `lib/cortex.ts` that exports a singleton `cortex` client. Import `CortexClient` from `@stealthy-good/cortex-sdk` and initialize it with `CORTEX_URL`, `CORTEX_API_KEY`, `CORTEX_TENANT_ID`, and `CORTEX_AGENT_NAME` from environment variables. Export the client instance so other files can import it. Wrap the initialization in a check so it only creates one instance."

Expected output — something like:

```typescript
import { CortexClient } from '@stealthy-good/cortex-sdk'

let client: CortexClient | null = null

export function getCortex(): CortexClient {
  if (!client) {
    client = new CortexClient({
      baseUrl: process.env.CORTEX_URL!,
      apiKey: process.env.CORTEX_API_KEY!,
      tenantId: process.env.CORTEX_TENANT_ID!,
      agentName: process.env.CORTEX_AGENT_NAME! as any,
    })
  }
  return client
}
```

---

## Step 4: Log Interactions After the Agent Does Work

"Wherever this agent sends an email, responds to a ticket, makes a call, or takes any action on a contact, add a `cortex.logInteraction()` call after the action completes. Pass the `contact_id`, `agent` name, interaction `type`, `direction`, `subject`, and `raw_content`. Cortex will auto-summarize via Claude. Wrap it in try/catch so failures don't crash the agent."

### Interaction types to use

| Agent action | `type` value | `direction` |
|-------------|-------------|-------------|
| Sent an email | `email_sent` | `outbound` |
| Received an email | `email_received` | `inbound` |
| Opened a support ticket | `ticket_opened` | `inbound` |
| Resolved a ticket | `ticket_resolved` | `outbound` |
| Made a phone call | `call` | `outbound` |
| Received a call | `call` | `inbound` |
| Internal note | `note` | — |
| Order placed | `order_placed` | `inbound` |
| Refund processed | `refund_processed` | `outbound` |

Example:

```typescript
import { getCortex } from '@/lib/cortex'

// After sending an email to a contact:
try {
  await getCortex().logInteraction({
    contact_id: contactId,
    agent: process.env.CORTEX_AGENT_NAME!,
    type: 'email_sent',
    direction: 'outbound',
    subject: emailSubject,
    raw_content: emailBody,
    thread_id: threadId,           // optional, for grouping conversations
    campaign_id: campaignId,       // optional, for sequence tracking
    external_id: emailMessageId,   // optional, for deduplication
  })
} catch (err) {
  console.error('Cortex: failed to log interaction', err)
}
```

---

## Step 5: Get Context Before Interacting With a Contact

"Before this agent replies to or reaches out to a contact, call `cortex.getContext(contactId, { level: 2 })` to retrieve the shared context. This returns a summary, key facts, recommended tone, recent interactions from all agents, and risk/opportunity signals. Use this to inform the agent's response. Level 2 includes the last 10 interactions. Use level 1 for a lighter check, level 3 for full history + last handoff."

### Context levels

| Level | What's included | When to use |
|-------|----------------|-------------|
| 0 | Header only (name, email, company, stage) | Quick lookup |
| 1 | Header + AI summary + signals (churn risk, upsell) | Before most actions |
| 2 | Level 1 + last 10 interactions | Before replying to a contact |
| 3 | Level 1 + last 50 interactions + last handoff | Deep investigation |

Example:

```typescript
import { getCortex } from '@/lib/cortex'

// Before composing a reply:
const context = await getCortex().getContext(contactId, { level: 2 })

// Feed into the agent's prompt:
const systemPrompt = `
You are ${agentName}. Here is what we know about this contact:

${context.context?.summary}

Key facts:
${context.context?.key_facts?.map(f => `- ${f}`).join('\n')}

Recommended tone: ${context.context?.recommended_tone}

Recent interactions:
${context.recent_interactions?.map(i => `- [${i.date}] ${i.agent}: ${i.summary}`).join('\n')}
`
```

---

## Step 6: Find or Create Contacts

"When this agent encounters a new email address (from a form submission, inbound email, etc.), call `cortex.findOrCreateContact(email, { name, company_name, source, stage })`. This upserts — if the contact exists, it returns the existing record. If not, it creates one. Always use this instead of managing contacts locally."

Example:

```typescript
import { getCortex } from '@/lib/cortex'

const contact = await getCortex().findOrCreateContact(incomingEmail, {
  name: senderName,
  company_name: companyName,
  source: 'anna_outbound',   // or 'inbound_form', 'support_ticket', etc.
  stage: 'prospect',
})

// Now use contact.id for all subsequent Cortex calls
const contactId = contact.id
```

---

## Step 7: Create Handoffs When Escalating

"When this agent needs to pass a contact to another agent or a human, call `cortex.createHandoff()`. Cortex will auto-generate a context briefing for the receiving agent. Set the `urgency` field based on the situation."

Example:

```typescript
import { getCortex } from '@/lib/cortex'

// Luna escalating a frustrated customer to a human:
await getCortex().createHandoff({
  contact_id: contactId,
  from_agent: 'luna',
  to_human_id: 'support-team',  // or to_agent: 'mia' for agent-to-agent
  reason: 'Customer requesting refund, sentiment negative',
  reason_detail: 'Third email about the same billing issue, tone is frustrated',
  suggested_action: 'Review billing history and process refund if applicable',
  urgency: 'high',
})
```

---

## Step 8: Check for Pending Handoffs (Receiving Agents)

"On startup or at the beginning of each work cycle, call `cortex.getPendingHandoffs()` to check if another agent or human has handed off a contact to this agent. Accept the handoff, do the work, then complete it."

Example:

```typescript
import { getCortex } from '@/lib/cortex'

const pendingHandoffs = await getCortex().getPendingHandoffs()

for (const handoff of pendingHandoffs) {
  // Accept it
  await getCortex().acceptHandoff(handoff.id)

  // Read the context briefing
  console.log(`Handoff from ${handoff.from_agent}: ${handoff.context_summary}`)
  console.log(`Suggested action: ${handoff.suggested_action}`)

  // ... do the work ...

  // Mark it done
  await getCortex().completeHandoff(handoff.id)
}
```

---

## Step 9: Check Budget Before Expensive Operations (Optional)

"Before making LLM calls or other expensive operations, call `cortex.checkBudget(estimatedTokens)` to verify the agent is within its daily token budget. If `within_budget` is false, defer or downgrade the operation."

Example:

```typescript
import { getCortex } from '@/lib/cortex'

const budget = await getCortex().checkBudget(5000)

if (!budget.within_budget) {
  console.warn(`Budget ${budget.recommendation}: ${budget.remaining} tokens remaining`)
  // Use a cheaper model, skip summarization, or defer
  return
}
```

---

## Per-Agent Cheat Sheet

Which steps matter most for each agent:

| Step | Luna | Anna | Jasper | Mia | Helios |
|------|------|------|--------|-----|--------|
| 1-3 (Setup) | Yes | Yes | Yes | Yes | Yes |
| 4 (Log interactions) | **High** — every ticket/email | **High** — every outbound email | **High** — every follow-up | **High** — every retention touchpoint | No |
| 5 (Get context) | **Critical** — before every reply | **High** — before outreach | **Critical** — before follow-ups | **Critical** — before retention calls | Read-only |
| 6 (Find/create contacts) | Medium | **High** — creates prospects | Medium | Medium | No |
| 7 (Create handoffs) | **High** — escalations to humans | Medium — pass warm leads to Jasper | Medium — pass to Mia if churn risk | **High** — escalate to humans | No |
| 8 (Receive handoffs) | Medium | Low | **High** — receives from Anna | **High** — receives churn risks | No |
| 9 (Budget check) | Optional | **High** — high volume | Optional | Optional | Read-only |

---

## Verifying It Works

After integration, check the Cortex Supabase tables:

1. **`interactions`** — should see rows with the agent's name after it processes work
2. **`token_usage`** — should see summarization token costs appearing
3. **`contacts`** — should see new contacts being created/updated
4. **`contact_context`** — should see AI-generated context appearing after interactions
5. **`handoff_events`** — should see handoffs when agents escalate

Or hit the usage endpoint:
```bash
curl -H "Authorization: Bearer $CORTEX_API_KEY" \
     -H "X-Tenant-ID: $CORTEX_TENANT_ID" \
     https://cortex.stealthygood.com/api/v1/usage/summary?period=day
```

If `by_agent` shows entries for the agent, it's working.

---

## Learnings

*(Update as issues are discovered during integration)*
