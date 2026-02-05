import clsx, { ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return formatDate(dateStr);
}

export function stageBadgeColor(stage: string): string {
  switch (stage) {
    case 'prospect': return 'badge-blue';
    case 'lead': return 'badge-purple';
    case 'opportunity': return 'badge-yellow';
    case 'customer': return 'badge-green';
    case 'churned': return 'badge-red';
    default: return 'badge-gray';
  }
}

export function sentimentBadgeColor(sentiment: string | null): string {
  switch (sentiment) {
    case 'positive': return 'badge-green';
    case 'neutral': return 'badge-gray';
    case 'negative': return 'badge-red';
    case 'escalation': return 'badge-red';
    default: return 'badge-gray';
  }
}

export function urgencyBadgeColor(urgency: string): string {
  switch (urgency) {
    case 'low': return 'badge-gray';
    case 'normal': return 'badge-blue';
    case 'high': return 'badge-yellow';
    case 'critical': return 'badge-red';
    default: return 'badge-gray';
  }
}

export function statusBadgeColor(status: string): string {
  switch (status) {
    case 'pending': return 'badge-yellow';
    case 'accepted': return 'badge-blue';
    case 'completed': return 'badge-green';
    case 'rejected': return 'badge-red';
    default: return 'badge-gray';
  }
}

export function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(6)}`;
  if (cost < 1) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return tokens.toString();
}

export const AGENT_COLORS: Record<string, string> = {
  luna: '#818cf8',
  anna: '#f472b6',
  mia: '#34d399',
  jasper: '#fbbf24',
  helios: '#fb923c',
  cortex: '#64748b',
  human: '#a78bfa',
};
