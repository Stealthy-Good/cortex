import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import type { Contact, Interaction, ClaudeSummaryResult, ClaudeContextResult } from '../types/index.js';

type AnthropicClient = InstanceType<typeof Anthropic>;

let client: AnthropicClient | null = null;

function getClient(): AnthropicClient {
  if (!client) {
    client = new Anthropic({ apiKey: config.anthropic.apiKey });
  }
  return client;
}

// Haiku model ID
const HAIKU_MODEL = 'claude-3-5-haiku-20241022';

// Cost per million tokens (Haiku)
const HAIKU_INPUT_COST_PER_M = 1.0;
const HAIKU_OUTPUT_COST_PER_M = 5.0;

function calculateCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * HAIKU_INPUT_COST_PER_M +
    (outputTokens / 1_000_000) * HAIKU_OUTPUT_COST_PER_M;
}

export interface ClaudeUsage {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

/**
 * Summarize a single interaction (email, ticket, etc.)
 */
export async function summarizeInteraction(
  interactionType: string,
  subject: string | null,
  rawContent: string,
): Promise<{ result: ClaudeSummaryResult; usage: ClaudeUsage }> {
  const prompt = `Summarize this ${interactionType} in 1-2 sentences. Extract:
- Key points discussed
- Any commitments or next steps
- Sentiment (positive/neutral/negative)
- Intent (question/complaint/purchase_intent/churn_risk/info_request/other)

${subject ? `Subject: ${subject}` : ''}

Content:
${rawContent}

Respond in JSON:
{
  "summary": "...",
  "key_points": ["...", "..."],
  "sentiment": "...",
  "intent": "..."
}`;

  const response = await getClient().messages.create({
    model: HAIKU_MODEL,
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  // Parse JSON from response (handle markdown code blocks)
  const jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  const result = JSON.parse(jsonStr) as ClaudeSummaryResult;

  const usage: ClaudeUsage = {
    model: HAIKU_MODEL,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    cost_usd: calculateCost(response.usage.input_tokens, response.usage.output_tokens),
  };

  return { result, usage };
}

/**
 * Generate working context summary for a contact
 */
export async function generateWorkingContext(
  contact: Contact,
  recentInteractions: Interaction[],
): Promise<{ result: ClaudeContextResult; usage: ClaudeUsage }> {
  const interactionsText = recentInteractions
    .map((i) => `- [${i.created_at}] ${i.agent}: ${i.type} — ${i.summary || '(no summary)'}`)
    .join('\n');

  const prompt = `You are generating a working context summary for an AI agent about to interact with a contact.

Contact: ${contact.name || 'Unknown'} (${contact.email})
Company: ${contact.company_name || 'Unknown'}
Stage: ${contact.stage}
First contact: ${contact.first_touch_at || 'Unknown'}
Source: ${contact.source || 'Unknown'}

Recent interactions (newest first):
${interactionsText || '(none)'}

Generate a concise briefing with:
1. A 2-3 sentence summary paragraph (who they are, key history, current relationship)
2. 4-6 bullet point key facts (things the agent needs to know)
3. Current status (one line)
4. Recommended tone for communication

Respond in JSON:
{
  "summary": "...",
  "key_facts": ["...", "..."],
  "current_status": "...",
  "recommended_tone": "..."
}

Keep total output under 300 tokens. Be specific and actionable.`;

  const response = await getClient().messages.create({
    model: HAIKU_MODEL,
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  const result = JSON.parse(jsonStr) as ClaudeContextResult;

  const usage: ClaudeUsage = {
    model: HAIKU_MODEL,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    cost_usd: calculateCost(response.usage.input_tokens, response.usage.output_tokens),
  };

  return { result, usage };
}

/**
 * Generate handoff context summary
 */
export async function generateHandoffContext(
  fromAgent: string,
  toAgent: string | null,
  reason: string,
  reasonDetail: string | null,
  contact: Contact,
  recentInteractions: Interaction[],
  existingContext: { summary: string; key_facts: string[] } | null,
): Promise<{ summary: string; usage: ClaudeUsage }> {
  const interactionsText = recentInteractions
    .map((i) => `- [${i.created_at}] ${i.summary || '(no summary)'}`)
    .join('\n');

  const contextText = existingContext
    ? `Working context summary:\n${existingContext.summary}\n\nKey facts:\n${existingContext.key_facts.map((f) => `- ${f}`).join('\n')}`
    : '(no existing context)';

  const prompt = `You are creating a handoff summary for an AI agent receiving a contact from another agent.

FROM: ${fromAgent}
TO: ${toAgent || 'human'}
REASON: ${reason}
${reasonDetail ? `DETAIL: ${reasonDetail}` : ''}

Contact: ${contact.name || 'Unknown'} at ${contact.company_name || 'Unknown'}
Current stage: ${contact.stage}

Recent relevant interactions:
${interactionsText || '(none)'}

${contextText}

Generate a handoff briefing (150-200 tokens) that:
1. Explains why this handoff is happening
2. Summarizes what the receiving agent needs to know
3. Suggests an immediate next action

Focus on actionable context for ${toAgent || 'the receiving party'}.`;

  const response = await getClient().messages.create({
    model: HAIKU_MODEL,
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  const usage: ClaudeUsage = {
    model: HAIKU_MODEL,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    cost_usd: calculateCost(response.usage.input_tokens, response.usage.output_tokens),
  };

  return { summary: text.trim(), usage };
}
