import { supabase } from '../db.js';
import type { Contact } from '../types/index.js';

export interface UpsertContactInput {
  email: string;
  name?: string;
  company_name?: string;
  phone?: string;
  stage?: string;
  source?: string;
  owner_agent?: string;
  owner_human_id?: string;
  tags?: string[];
  custom_fields?: Record<string, unknown>;
}

export interface ListContactsFilters {
  stage?: string;
  owner_agent?: string;
  owner_human_id?: string;
  tag?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function upsertContact(tenantId: string, input: UpsertContactInput): Promise<Contact> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('contacts')
    .upsert(
      {
        tenant_id: tenantId,
        email: input.email,
        name: input.name,
        company_name: input.company_name,
        phone: input.phone,
        stage: input.stage || 'prospect',
        source: input.source,
        owner_agent: input.owner_agent,
        owner_human_id: input.owner_human_id,
        tags: input.tags || [],
        custom_fields: input.custom_fields || {},
        first_touch_at: now,
        updated_at: now,
      },
      { onConflict: 'tenant_id,email' },
    )
    .select()
    .single();

  if (error) throw error;
  return data as Contact;
}

export async function getContact(tenantId: string, contactId: string): Promise<Contact | null> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', contactId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw error;
  }
  return data as Contact;
}

export async function updateContact(
  tenantId: string,
  contactId: string,
  updates: Partial<UpsertContactInput>,
): Promise<Contact> {
  const { data, error } = await supabase
    .from('contacts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', contactId)
    .select()
    .single();

  if (error) throw error;
  return data as Contact;
}

export async function listContacts(
  tenantId: string,
  filters: ListContactsFilters,
): Promise<{ contacts: Contact[]; count: number }> {
  const limit = Math.min(filters.limit || 20, 100);
  const offset = filters.offset || 0;

  let query = supabase
    .from('contacts')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('last_touch_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (filters.stage) query = query.eq('stage', filters.stage);
  if (filters.owner_agent) query = query.eq('owner_agent', filters.owner_agent);
  if (filters.owner_human_id) query = query.eq('owner_human_id', filters.owner_human_id);
  if (filters.tag) query = query.contains('tags', [filters.tag]);
  if (filters.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,company_name.ilike.%${filters.search}%`,
    );
  }

  const { data, error, count } = await query;

  if (error) throw error;
  return { contacts: (data || []) as Contact[], count: count || 0 };
}
