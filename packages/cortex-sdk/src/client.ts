import type {
  CortexClientConfig,
  Contact,
  CreateContactInput,
  UpdateContactInput,
  ListContactsFilters,
  ContactListResult,
  ContextResponse,
  RefreshResult,
  CreateInteractionInput,
  InteractionResult,
  Interaction,
  ListInteractionsFilters,
  CreateHandoffInput,
  HandoffResult,
  HandoffEvent,
  PendingHandoffsFilters,
  BudgetCheckResult,
  UsageSummary,
  HealthCheckResult,
} from './types.js';

// ─── Errors ───

export class CortexError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'CortexError';
  }
}

export class CortexAuthError extends CortexError {
  constructor(message: string, details?: unknown) {
    super(message, 401, details);
    this.name = 'CortexAuthError';
  }
}

export class CortexNotFoundError extends CortexError {
  constructor(message: string, details?: unknown) {
    super(message, 404, details);
    this.name = 'CortexNotFoundError';
  }
}

export class CortexBudgetExceededError extends CortexError {
  constructor(message: string, details?: unknown) {
    super(message, 429, details);
    this.name = 'CortexBudgetExceededError';
  }
}

// ─── Client ───

export class CortexClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly agentName: string;
  private readonly fetchFn: typeof fetch;

  constructor(config: CortexClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.agentName = config.agentName;
    this.fetchFn = config.fetch ?? globalThis.fetch;

    this.headers = {
      'Authorization': `Bearer ${config.apiKey}`,
      'X-Tenant-ID': config.tenantId,
      'X-Agent-Name': config.agentName,
      'Content-Type': 'application/json',
    };
  }

  // ─── Context ───

  /** Retrieve working context for a contact. Level 0-3 controls detail depth. */
  async getContext(
    contactId: string,
    options?: { level?: 0 | 1 | 2 | 3; refresh?: boolean },
  ): Promise<ContextResponse> {
    const params = new URLSearchParams();
    if (options?.level !== undefined) params.set('level', String(options.level));
    if (options?.refresh) params.set('refresh', 'true');

    const qs = params.toString();
    return this.request<ContextResponse>('GET', `/api/v1/context/${contactId}${qs ? `?${qs}` : ''}`);
  }

  /** Force-regenerate context for a contact. */
  async refreshContext(contactId: string): Promise<RefreshResult> {
    return this.request<RefreshResult>('POST', `/api/v1/context/${contactId}/refresh`);
  }

  // ─── Interactions ───

  /** Log an interaction. Auto-summarizes via Claude if raw_content is provided without a summary. */
  async logInteraction(input: CreateInteractionInput): Promise<InteractionResult> {
    return this.request<InteractionResult>('POST', '/api/v1/interactions', input);
  }

  /** List interactions for a contact with optional filters. */
  async listInteractions(contactId: string, filters?: ListInteractionsFilters): Promise<Interaction[]> {
    const params = new URLSearchParams({ contact_id: contactId });
    if (filters?.agent) params.set('agent', filters.agent);
    if (filters?.type) params.set('type', filters.type);
    if (filters?.since) params.set('since', filters.since);
    if (filters?.limit !== undefined) params.set('limit', String(filters.limit));
    if (filters?.include_raw) params.set('include_raw', 'true');

    const res = await this.request<{ data: Interaction[] }>('GET', `/api/v1/interactions?${params}`);
    return res.data;
  }

  // ─── Handoffs ───

  /** Create a handoff from one agent to another (or to a human). */
  async createHandoff(input: CreateHandoffInput): Promise<HandoffResult> {
    return this.request<HandoffResult>('POST', '/api/v1/handoffs', input);
  }

  /** Get pending handoffs. Defaults to filtering by this client's agentName. */
  async getPendingHandoffs(filters?: PendingHandoffsFilters): Promise<HandoffEvent[]> {
    const params = new URLSearchParams();
    // Default to this agent's name if no agent filter specified
    const agent = filters?.agent ?? this.agentName;
    if (agent) params.set('agent', agent);
    if (filters?.human_id) params.set('human_id', filters.human_id);
    if (filters?.urgency) params.set('urgency', filters.urgency);

    const res = await this.request<{ data: HandoffEvent[] }>('GET', `/api/v1/handoffs/pending?${params}`);
    return res.data;
  }

  /** Accept a pending handoff. */
  async acceptHandoff(handoffId: string): Promise<HandoffEvent> {
    const res = await this.request<{ data: HandoffEvent }>('PATCH', `/api/v1/handoffs/${handoffId}`, {
      status: 'accepted',
    });
    return res.data;
  }

  /** Mark a handoff as completed. */
  async completeHandoff(handoffId: string): Promise<HandoffEvent> {
    const res = await this.request<{ data: HandoffEvent }>('PATCH', `/api/v1/handoffs/${handoffId}`, {
      status: 'completed',
    });
    return res.data;
  }

  /** Reject a pending handoff. */
  async rejectHandoff(handoffId: string): Promise<HandoffEvent> {
    const res = await this.request<{ data: HandoffEvent }>('PATCH', `/api/v1/handoffs/${handoffId}`, {
      status: 'rejected',
    });
    return res.data;
  }

  // ─── Contacts ───

  /** Create or update a contact by email (upsert). */
  async findOrCreateContact(email: string, data?: Omit<CreateContactInput, 'email'>): Promise<Contact> {
    const res = await this.request<{ data: Contact }>('POST', '/api/v1/contacts', { email, ...data });
    return res.data;
  }

  /** Get a single contact by ID. */
  async getContact(contactId: string): Promise<Contact> {
    const res = await this.request<{ data: Contact }>('GET', `/api/v1/contacts/${contactId}`);
    return res.data;
  }

  /** Update a contact by ID. */
  async updateContact(contactId: string, data: UpdateContactInput): Promise<Contact> {
    const res = await this.request<{ data: Contact }>('PATCH', `/api/v1/contacts/${contactId}`, data);
    return res.data;
  }

  /** List/search contacts with optional filters. */
  async listContacts(filters?: ListContactsFilters): Promise<ContactListResult> {
    const params = new URLSearchParams();
    if (filters?.stage) params.set('stage', filters.stage);
    if (filters?.owner_agent) params.set('owner_agent', filters.owner_agent);
    if (filters?.owner_human_id) params.set('owner_human_id', filters.owner_human_id);
    if (filters?.tag) params.set('tag', filters.tag);
    if (filters?.search) params.set('search', filters.search);
    if (filters?.limit !== undefined) params.set('limit', String(filters.limit));
    if (filters?.offset !== undefined) params.set('offset', String(filters.offset));

    const qs = params.toString();
    const res = await this.request<{ data: Contact[]; count: number; limit: number; offset: number }>(
      'GET',
      `/api/v1/contacts${qs ? `?${qs}` : ''}`,
    );
    return {
      contacts: res.data,
      count: res.count,
      limit: res.limit,
      offset: res.offset,
    };
  }

  // ─── Usage & Budget ───

  /** Check if this agent has token budget remaining. */
  async checkBudget(estimatedTokens?: number): Promise<BudgetCheckResult> {
    const params = new URLSearchParams();
    if (estimatedTokens !== undefined) params.set('estimated_tokens', String(estimatedTokens));

    const qs = params.toString();
    return this.request<BudgetCheckResult>(
      'GET',
      `/api/v1/usage/budget-check/${this.agentName}${qs ? `?${qs}` : ''}`,
    );
  }

  /** Get usage summary for a time period. */
  async getUsageSummary(period?: 'day' | 'week' | 'month', agent?: string): Promise<UsageSummary> {
    const params = new URLSearchParams();
    if (period) params.set('period', period);
    if (agent) params.set('agent', agent);

    const qs = params.toString();
    return this.request<UsageSummary>('GET', `/api/v1/usage/summary${qs ? `?${qs}` : ''}`);
  }

  // ─── Health ───

  /** Basic liveness check (no auth required). */
  async healthCheck(): Promise<HealthCheckResult> {
    const res = await this.fetchFn(`${this.baseUrl}/health`);
    return res.json() as Promise<HealthCheckResult>;
  }

  /** Deep health check — verifies database and Claude connectivity. */
  async deepHealthCheck(): Promise<HealthCheckResult> {
    const res = await this.fetchFn(`${this.baseUrl}/health/deep`);
    return res.json() as Promise<HealthCheckResult>;
  }

  // ─── Internal ───

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const init: RequestInit = {
      method,
      headers: this.headers,
    };

    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    const res = await this.fetchFn(url, init);

    if (!res.ok) {
      const text = await res.text();
      let parsed: { error?: string; details?: unknown } | undefined;
      try {
        parsed = JSON.parse(text);
      } catch {
        // Not JSON — use raw text
      }

      const message = parsed?.error || text || `HTTP ${res.status}`;

      switch (res.status) {
        case 401:
          throw new CortexAuthError(message, parsed?.details);
        case 404:
          throw new CortexNotFoundError(message, parsed?.details);
        case 429:
          throw new CortexBudgetExceededError(message, parsed?.details);
        default:
          throw new CortexError(message, res.status, parsed?.details);
      }
    }

    return res.json() as Promise<T>;
  }
}
