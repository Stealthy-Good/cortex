import { supabase } from '../db.js';
import * as claudeService from './claudeService.js';
import * as usageService from './usageService.js';
import * as contextService from './contextService.js';
import type { Contact, HandoffEvent, Interaction, ContactContext } from '../types/index.js';

export interface CreateHandoffInput {
  contact_id: string;
  from_agent: string;
  to_agent?: string;
  to_human_id?: string;
  reason: string;
  reason_detail?: string;
  suggested_action?: string;
  urgency?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateHandoffResult {
  handoff: HandoffEvent;
  context_refreshed: boolean;
}

export async function createHandoff(
  tenantId: string,
  input: CreateHandoffInput,
): Promise<CreateHandoffResult> {
  // Validate contact exists
  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', input.contact_id)
    .single();

  if (contactError || !contact) {
    const err = new Error('Contact not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  const c = contact as Contact;

  // Get existing context and recent interactions
  const { data: existingCtx } = await supabase
    .from('contact_context')
    .select('summary, key_facts')
    .eq('contact_id', input.contact_id)
    .eq('tenant_id', tenantId)
    .single();

  const { data: recentInteractions } = await supabase
    .from('interactions')
    .select('*')
    .eq('contact_id', input.contact_id)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(10);

  const interactions = (recentInteractions || []) as Interaction[];

  // Generate handoff context via Claude
  const { summary: contextSummary, usage } = await claudeService.generateHandoffContext(
    input.from_agent,
    input.to_agent || null,
    input.reason,
    input.reason_detail || null,
    c,
    interactions,
    existingCtx as { summary: string; key_facts: string[] } | null,
  );

  // Insert handoff event
  const { data: handoff, error: handoffError } = await supabase
    .from('handoff_events')
    .insert({
      tenant_id: tenantId,
      contact_id: input.contact_id,
      from_agent: input.from_agent,
      to_agent: input.to_agent || null,
      to_human_id: input.to_human_id || null,
      reason: input.reason,
      reason_detail: input.reason_detail || null,
      context_summary: contextSummary,
      suggested_action: input.suggested_action || null,
      urgency: input.urgency || 'normal',
      status: 'pending',
      metadata: input.metadata || {},
    })
    .select()
    .single();

  if (handoffError) throw handoffError;

  // Update contact ownership
  const ownerUpdate: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.to_agent) {
    ownerUpdate.owner_agent = input.to_agent;
    ownerUpdate.owner_human_id = null;
  } else if (input.to_human_id) {
    ownerUpdate.owner_human_id = input.to_human_id;
    ownerUpdate.owner_agent = null;
  }

  await supabase
    .from('contacts')
    .update(ownerUpdate)
    .eq('id', input.contact_id)
    .eq('tenant_id', tenantId);

  // Log token usage
  await usageService.logUsage(tenantId, {
    agent: input.from_agent,
    model: usage.model,
    operation: 'generate_handoff_context',
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    cost_usd: usage.cost_usd,
    contact_id: input.contact_id,
  });

  // Trigger context refresh in background (don't await)
  contextService.refreshContext(tenantId, input.contact_id).catch((err) => {
    console.error('[Handoff] Background context refresh failed:', err);
  });

  return {
    handoff: handoff as HandoffEvent,
    context_refreshed: true,
  };
}

export interface PendingHandoffsFilters {
  agent?: string;
  human_id?: string;
  urgency?: string;
}

export async function getPendingHandoffs(
  tenantId: string,
  filters: PendingHandoffsFilters,
): Promise<HandoffEvent[]> {
  let query = supabase
    .from('handoff_events')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (filters.agent) query = query.eq('to_agent', filters.agent);
  if (filters.human_id) query = query.eq('to_human_id', filters.human_id);
  if (filters.urgency) query = query.eq('urgency', filters.urgency);

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as HandoffEvent[];
}

export async function updateHandoff(
  tenantId: string,
  handoffId: string,
  updates: { status: string },
): Promise<HandoffEvent> {
  const updateData: Record<string, unknown> = {
    status: updates.status,
  };

  if (updates.status === 'accepted') {
    updateData.accepted_at = new Date().toISOString();
  } else if (updates.status === 'completed') {
    updateData.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('handoff_events')
    .update(updateData)
    .eq('id', handoffId)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) throw error;
  return data as HandoffEvent;
}
