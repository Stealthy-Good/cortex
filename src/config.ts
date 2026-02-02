import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),

  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || '',
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  },

  cortexApiKey: process.env.CORTEX_API_KEY || '',
  defaultTenantId: process.env.DEFAULT_TENANT_ID || '',
  heliosWebhookUrl: process.env.HELIOS_WEBHOOK_URL || '',
} as const;

export function validateConfig(): void {
  const required: [string, string][] = [
    ['SUPABASE_URL', config.supabase.url],
    ['SUPABASE_SERVICE_KEY', config.supabase.serviceKey],
    ['CORTEX_API_KEY', config.cortexApiKey],
  ];

  const missing = required.filter(([, value]) => !value).map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
