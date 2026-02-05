import { supabase } from '../db.js';
import * as claudeService from './claudeService.js';
import * as usageService from './usageService.js';
import * as errorService from './errorService.js';
import type { Contact, ContactContext, Interaction, ContextResponse } from '../types/index.js';

const STALENESS_HOURS = 24;

export async function getContext(
  tenantId: string,
  contactId: string,
  level: number = 1,
  forceRefresh: boolean = false,
): Promise<ContextResponse> {
  // 1. Fetch contact
  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', contactId)
    .single();

  if (contactError || !contact) {
    const err = new Error('Contact not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  const c = contact as Contact;

  // Header (always included)
  const header = {
    name: c.name,
    company: c.company_name,
    email: c.email,
    stage: c.stage,
    last_touch: c.last_touch_at,
    last_touch_agent: c.owner_agent,
  };

  // Level 0: header only
  if (level === 0) {
    return {
      contact_id: contactId,
      level: 0,
      token_count: 50,
      header,
      generated_at: null,
      is_stale: false,
    };
  }

  // Get or generate context for levels 1-3
  let ctx = await getCachedContext(tenantId, contactId);
  const currentInteractionCount = await getInteractionCount(contactId);
  const isStale = !ctx || forceRefresh || isContextStale(ctx, currentInteractionCount);

  if (isStale) {
    ctx = await regenerateContext(tenantId, contactId, c, currentInteractionCount);
  }

  // Build response
  const response: ContextResponse = {
    contact_id: contactId,
    level,
    token_count: ctx?.token_count || 0,
    header,
    context: ctx
      ? {
          summary: ctx.summary,
          key_facts: ctx.key_facts || [],
          current_status: ctx.current_status,
          recommended_tone: ctx.recommended_tone,
          open_threads: ctx.open_threads || [],
          signals: {
            churn_risk: ctx.churn_risk_score,
            upsell_potential: ctx.upsell_potential_score,
            risk_factors: ctx.risk_factors || [],
            opportunity_factors: ctx.opportunity_factors || [],
          },
        }
      : undefined,
    generated_at: ctx?.generated_at || null,
    is_stale: false,
  };

  // Level 2+: include recent interactions
  if (level >= 2) {
    const recentLimit = level === 2 ? 10 : 50;
    const { data: interactions } = await supabase
      .from('interactions')
      .select('id, agent, type, summary, sentiment, created_at')
      .eq('contact_id', contactId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(recentLimit);

    response.recent_interactions = (interactions || []).map((i) => ({
      id: i.id,
      agent: i.agent,
      type: i.type,
      summary: i.summary,
      sentiment: i.sentiment,
      date: i.created_at,
    }));
  }

  // Include last handoff
  const { data: lastHandoff } = await supabase
    .from('handoff_events')
    .select('from_agent, to_agent, reason, created_at')
    .eq('contact_id', contactId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  response.last_handoff = lastHandoff
    ? {
        from: lastHandoff.from_agent,
        to: lastHandoff.to_agent,
        reason: lastHandoff.reason,
        date: lastHandoff.created_at,
      }
    : null;

  return response;
}

export async function refreshContext(
  tenantId: string,
  contactId: string,
): Promise<{ contact_id: string; regenerated: boolean; previous_generated_at: string | null; new_generated_at: string; token_count: number }> {
  const ctx = await getCachedContext(tenantId, contactId);
  const previousGeneratedAt = ctx?.generated_at || null;

  const response = await getContext(tenantId, contactId, 1, true);

  return {
    contact_id: contactId,
    regenerated: true,
    previous_generated_at: previousGeneratedAt,
    new_generated_at: response.generated_at || new Date().toISOString(),
    token_count: response.token_count,
  };
}

// ─── Internal helpers ───

async function getCachedContext(tenantId: string, contactId: string): Promise<ContactContext | null> {
  const { data, error } = await supabase
    .from('contact_context')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('contact_id', contactId)
    .single();

  if (error || !data) return null;
  return data as ContactContext;
}

async function getInteractionCount(contactId: string): Promise<number> {
  const { count } = await supabase
    .from('interactions')
    .select('id', { count: 'exact', head: true })
    .eq('contact_id', contactId);

  return count || 0;
}

function isContextStale(ctx: ContactContext, currentInteractionCount: number): boolean {
  // Check if interaction count changed
  if (ctx.interaction_count_at_generation !== null && ctx.interaction_count_at_generation !== currentInteractionCount) {
    return true;
  }

  // Check if older than staleness threshold
  const generatedAt = new Date(ctx.generated_at).getTime();
  const ageMs = Date.now() - generatedAt;
  const ageHours = ageMs / (1000 * 60 * 60);
  if (ageHours > STALENESS_HOURS) {
    return true;
  }

  return false;
}

async function regenerateContext(
  tenantId: string,
  contactId: string,
  contact: Contact,
  interactionCount: number,
): Promise<ContactContext> {
  // Fetch recent interactions for context generation
  const { data: recentInteractions } = await supabase
    .from('interactions')
    .select('*')
    .eq('contact_id', contactId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(20);

  const interactions = (recentInteractions || []) as Interaction[];

  // Generate context via Claude
  let result: { summary: string; key_facts: string[]; current_status: string; recommended_tone: string };
  let usage: { model: string; input_tokens: number; output_tokens: number; cost_usd: number };

  try {
    const claudeResult = await claudeService.generateWorkingContext(contact, interactions);
    result = claudeResult.result;
    usage = claudeResult.usage;
  } catch (err) {
    errorService.logError({
      tenant_id: tenantId,
      error_type: 'claude_error',
      service: 'contextService',
      operation: 'generate_context',
      error_message: (err as Error).message,
      stack_trace: (err as Error).stack,
      pattern_id: (err as Error).message.includes('rate_limit') ? 'claude_rate_limit' : undefined,
      context: { contact_id: contactId },
    });
    throw err;
  }

  const now = new Date().toISOString();
  const tokenCount = usage.input_tokens + usage.output_tokens;

  // Upsert contact_context
  const { data, error } = await supabase
    .from('contact_context')
    .upsert(
      {
        tenant_id: tenantId,
        contact_id: contactId,
        summary: result.summary,
        key_facts: result.key_facts,
        current_status: result.current_status,
        recommended_tone: result.recommended_tone,
        interaction_count_at_generation: interactionCount,
        generated_at: now,
        token_count: tokenCount,
        updated_at: now,
      },
      { onConflict: 'contact_id' },
    )
    .select()
    .single();

  if (error) throw error;

  // Log token usage
  await usageService.logUsage(tenantId, {
    agent: 'cortex',
    model: usage.model,
    operation: 'generate_context',
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    cost_usd: usage.cost_usd,
    contact_id: contactId,
  });

  return data as ContactContext;
}
