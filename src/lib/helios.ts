import { config } from '../config.js';

// ─── In-memory counters ───

let totalRequests = 0;
let totalErrors = 0;
let totalLatencyMs = 0;

/**
 * Track a single request's latency and error status.
 * Call this in a finally block of each API route handler.
 */
export function trackRequest(latencyMs: number, isError: boolean): void {
  totalRequests++;
  totalLatencyMs += latencyMs;
  if (isError) {
    totalErrors++;
  }
}

/**
 * POST accumulated metrics to Helios, then reset counters.
 * Also sends a health-check ping.
 */
export async function reportToHelios(): Promise<void> {
  const { url, agentId } = config.helios;
  if (!url || !agentId) return;

  const snapshot = {
    agent_id: agentId,
    total_requests: totalRequests,
    total_errors: totalErrors,
    avg_latency_ms: totalRequests > 0 ? Math.round(totalLatencyMs / totalRequests) : 0,
    reported_at: new Date().toISOString(),
  };

  // Reset counters before awaiting network calls
  totalRequests = 0;
  totalErrors = 0;
  totalLatencyMs = 0;

  try {
    await fetch(`${url}/api/metrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    });
  } catch (err) {
    console.error('[Helios] Failed to report metrics:', err);
  }

  try {
    await fetch(`${url}/api/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: agentId, status: 'ok', timestamp: new Date().toISOString() }),
    });
  } catch (err) {
    console.error('[Helios] Failed to send health check:', err);
  }
}

/**
 * Report token usage and estimated cost after an LLM call.
 */
export async function reportCost(input: {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  operation: string;
}): Promise<void> {
  const { url, agentId } = config.helios;
  if (!url || !agentId) return;

  try {
    await fetch(`${url}/api/costs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: agentId,
        date: new Date().toISOString().slice(0, 10),
        model: input.model,
        input_tokens: input.input_tokens,
        output_tokens: input.output_tokens,
        cost_usd: input.cost_usd,
        operation: input.operation,
      }),
    });
  } catch (err) {
    console.error('[Helios] Failed to report cost:', err);
  }
}
