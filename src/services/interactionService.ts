import { supabase } from '../db.js';
import * as claudeService from './claudeService.js';
import * as usageService from './usageService.js';
import * as errorService from './errorService.js';
import type { Interaction } from '../types/index.js';

export interface CreateInteractionInput {
  contact_id: string;
  agent: string;
  human_id?: string;
  type: string;
  direction?: string;
  subject?: string;
  raw_content?: string;
  summary?: string;
  sentiment?: string;
  key_points?: string[];
  intent?: string;
  external_id?: string;
  campaign_id?: string;
  thread_id?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateInteractionResult {
  interaction: Interaction;
  token_usage?: claudeService.ClaudeUsage;
  context_refresh_triggered: boolean;
}

export async function createInteraction(
  tenantId: string,
  input: CreateInteractionInput,
): Promise<CreateInteractionResult> {
  let summary = input.summary || null;
  let sentiment = input.sentiment || null;
  let keyPoints = input.key_points || null;
  let intent = input.intent || null;
  let tokenUsage: claudeService.ClaudeUsage | undefined;
  let tokenCount: number | null = null;

  // Auto-summarize if raw_content provided without summary
  if (input.raw_content && !input.summary) {
    try {
      const { result, usage } = await claudeService.summarizeInteraction(
        input.type,
        input.subject || null,
        input.raw_content,
      );
      summary = result.summary;
      sentiment = result.sentiment;
      keyPoints = result.key_points;
      intent = result.intent;
      tokenUsage = usage;
      tokenCount = usage.input_tokens + usage.output_tokens;
    } catch (err) {
      console.error('[Interaction] Failed to auto-summarize:', err);
      errorService.logError({
        tenant_id: tenantId,
        error_type: 'claude_error',
        service: 'interactionService',
        operation: 'summarize_interaction',
        error_message: (err as Error).message,
        stack_trace: (err as Error).stack,
        pattern_id: (err as Error).message.includes('rate_limit') ? 'claude_rate_limit' : undefined,
        context: { contact_id: input.contact_id, agent: input.agent, type: input.type },
      });
      // Proceed without summary
    }
  }

  // Insert interaction
  const { data, error } = await supabase
    .from('interactions')
    .insert({
      tenant_id: tenantId,
      contact_id: input.contact_id,
      agent: input.agent,
      human_id: input.human_id || null,
      type: input.type,
      direction: input.direction || null,
      subject: input.subject || null,
      raw_content: input.raw_content || null,
      summary,
      sentiment,
      key_points: keyPoints,
      intent,
      external_id: input.external_id || null,
      campaign_id: input.campaign_id || null,
      thread_id: input.thread_id || null,
      metadata: input.metadata || {},
      token_count: tokenCount,
    })
    .select()
    .single();

  if (error) throw error;

  // Update contact's last_touch_at
  await supabase
    .from('contacts')
    .update({
      last_touch_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.contact_id)
    .eq('tenant_id', tenantId);

  // Log token usage
  if (tokenUsage) {
    await usageService.logUsage(tenantId, {
      agent: input.agent,
      model: tokenUsage.model,
      operation: 'summarize_interaction',
      input_tokens: tokenUsage.input_tokens,
      output_tokens: tokenUsage.output_tokens,
      cost_usd: tokenUsage.cost_usd,
      contact_id: input.contact_id,
      interaction_id: data.id,
    });
  }

  // Determine if context refresh should be triggered
  const refreshTriggers = ['escalation', 'negative'];
  const contextRefreshTriggered =
    (sentiment && refreshTriggers.includes(sentiment)) ||
    ['ticket_resolved', 'order_placed', 'refund_processed'].includes(input.type);

  return {
    interaction: data as Interaction,
    token_usage: tokenUsage,
    context_refresh_triggered: contextRefreshTriggered,
  };
}

export interface ListInteractionsFilters {
  contact_id: string;
  agent?: string;
  type?: string;
  since?: string;
  limit?: number;
  include_raw?: boolean;
}

export async function listInteractions(
  tenantId: string,
  filters: ListInteractionsFilters,
): Promise<Interaction[]> {
  const limit = Math.min(filters.limit || 20, 100);

  let query = supabase
    .from('interactions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('contact_id', filters.contact_id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (filters.agent) query = query.eq('agent', filters.agent);
  if (filters.type) query = query.eq('type', filters.type);
  if (filters.since) query = query.gte('created_at', filters.since);

  const { data, error } = await query;

  if (error) throw error;

  const interactions = (data || []) as Interaction[];

  // Strip raw_content unless explicitly requested
  if (!filters.include_raw) {
    return interactions.map(({ raw_content, ...rest }) => ({ ...rest, raw_content: null }));
  }

  return interactions;
}
