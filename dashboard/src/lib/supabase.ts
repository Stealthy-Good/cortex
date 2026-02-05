import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY || '';

const isConfigured = supabaseUrl.length > 0 && supabaseKey.length > 0;

// Create a real client if configured, otherwise a placeholder that returns empty results
export const supabase: SupabaseClient = isConfigured
  ? createClient(supabaseUrl, supabaseKey)
  : createClient('https://placeholder.supabase.co', 'placeholder-key');

export const supabaseReady = isConfigured;
