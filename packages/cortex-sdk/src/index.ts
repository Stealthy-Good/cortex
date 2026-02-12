export { CortexClient, CortexError, CortexAuthError, CortexNotFoundError, CortexBudgetExceededError } from './client.js';

export type {
  // Config
  CortexClientConfig,

  // Agents
  AgentName,

  // Contacts
  Contact,
  CreateContactInput,
  UpdateContactInput,
  ListContactsFilters,
  ContactListResult,

  // Context
  ContextResponse,
  RefreshResult,

  // Interactions
  Interaction,
  CreateInteractionInput,
  InteractionResult,
  ListInteractionsFilters,

  // Handoffs
  HandoffEvent,
  CreateHandoffInput,
  HandoffResult,
  PendingHandoffsFilters,

  // Usage & Budget
  BudgetCheckResult,
  UsageSummary,

  // Health
  HealthCheckResult,
} from './types.js';

export { VALID_AGENTS } from './types.js';
