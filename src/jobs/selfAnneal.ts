import { supabase } from '../db.js';
import * as errorService from '../services/errorService.js';
import type { ErrorPattern } from '../services/errorService.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Self-annealing job: runs every 4 hours.
 *
 * 1. Detect recurring error patterns
 * 2. Apply automatic fixes where possible
 * 3. Run quality checks on recent summaries
 * 4. Check for orphaned handoffs
 * 5. Append learnings to the directive
 */
export async function selfAnneal(): Promise<void> {
  console.log('[Job: selfAnneal] Starting self-annealing cycle...');

  const learnings: string[] = [];

  try {
    // Phase 1: Detect and fix recurring error patterns
    const patternLearnings = await handleErrorPatterns();
    learnings.push(...patternLearnings);

    // Phase 2: Quality checks on recent summaries
    const qualityLearnings = await checkSummaryQuality();
    learnings.push(...qualityLearnings);

    // Phase 3: Check for stale context that should have been refreshed
    const stalenessLearnings = await checkContextStaleness();
    learnings.push(...stalenessLearnings);

    // Phase 4: Check for orphaned handoffs
    const handoffLearnings = await checkOrphanedHandoffs();
    learnings.push(...handoffLearnings);

    // Phase 5: Append learnings to directive
    if (learnings.length > 0) {
      await appendToDirective(learnings);
      console.log(`[Job: selfAnneal] Appended ${learnings.length} learning(s) to directive`);
    }
  } catch (err) {
    console.error('[Job: selfAnneal] Critical error in self-anneal cycle:', err);
    await errorService.logError({
      error_type: 'api_error',
      service: 'selfAnnealJob',
      operation: 'self_anneal_cycle',
      error_message: (err as Error).message,
      stack_trace: (err as Error).stack,
    });
  }

  console.log('[Job: selfAnneal] Complete');
}

// ─── Phase 1: Error Pattern Detection & Auto-Fix ───

async function handleErrorPatterns(): Promise<string[]> {
  const learnings: string[] = [];
  const patterns = await errorService.getErrorPatterns(4);
  const recurringPatterns = patterns.filter((p) => p.count >= 3);

  if (recurringPatterns.length === 0) {
    console.log('[Job: selfAnneal] No recurring error patterns detected');
    return learnings;
  }

  console.log(`[Job: selfAnneal] Found ${recurringPatterns.length} recurring pattern(s)`);

  for (const pattern of recurringPatterns) {
    const fix = await tryAutoFix(pattern);
    if (fix) {
      learnings.push(fix);
    }
  }

  return learnings;
}

async function tryAutoFix(pattern: ErrorPattern): Promise<string | null> {
  const key = `${pattern.error_type}::${pattern.service}::${pattern.operation}`;

  // Claude rate limit → log recommendation
  if (pattern.error_type === 'claude_error' && pattern.latest_message.includes('rate_limit')) {
    const learning = `Claude rate limit hit ${pattern.count}x in ${pattern.service}.${pattern.operation}. Consider reducing batch sizes or adding longer delays between batches.`;
    console.log(`[Job: selfAnneal] Auto-detected: ${learning}`);

    await errorService.resolveErrors({
      pattern_id: pattern.pattern_id || undefined,
      resolution: 'Detected by self-anneal: rate limit pattern. Logged recommendation to reduce batch sizes.',
      auto_fixed: true,
    });

    return learning;
  }

  // Budget exceeded → log recommendation to adjust budgets
  if (pattern.error_type === 'budget_exceeded') {
    const learning = `Budget exceeded ${pattern.count}x for ${pattern.operation}. Consider increasing daily_token_budget for affected agent(s) in agent_config.`;
    console.log(`[Job: selfAnneal] Auto-detected: ${learning}`);

    await errorService.resolveErrors({
      pattern_id: pattern.pattern_id || undefined,
      resolution: 'Detected by self-anneal: recurring budget exceeded. Logged recommendation.',
      auto_fixed: true,
    });

    return learning;
  }

  // Empty summary / quality issue → log for Sonnet fallback
  if (pattern.error_type === 'quality_issue' && pattern.count >= 5) {
    const learning = `Quality issue (${pattern.operation}) recurring ${pattern.count}x. Consider fallback to Claude Sonnet for this operation type.`;
    console.log(`[Job: selfAnneal] Auto-detected: ${learning}`);

    await errorService.resolveErrors({
      pattern_id: pattern.pattern_id || undefined,
      resolution: 'Detected by self-anneal: persistent quality issue. Recommend Sonnet fallback.',
      auto_fixed: true,
    });

    return learning;
  }

  // General recurring error — just flag it
  if (pattern.count >= 5) {
    const learning = `Recurring ${pattern.error_type} in ${pattern.service}.${pattern.operation} (${pattern.count}x): "${pattern.latest_message.slice(0, 100)}"`;
    console.log(`[Job: selfAnneal] Flagged recurring error: ${key} (${pattern.count}x)`);
    return learning;
  }

  return null;
}

// ─── Phase 2: Summary Quality Checks ───

async function checkSummaryQuality(): Promise<string[]> {
  const learnings: string[] = [];

  // Sample recent interactions that were auto-summarized
  const { data: recentSummarized } = await supabase
    .from('interactions')
    .select('id, summary, raw_content, token_count')
    .not('summary', 'is', null)
    .not('raw_content', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);

  if (!recentSummarized?.length) return learnings;

  let shortSummaries = 0;
  let emptySummaries = 0;

  for (const row of recentSummarized) {
    if (!row.summary || row.summary.trim().length === 0) {
      emptySummaries++;
    } else if (row.summary.length < 20) {
      shortSummaries++;
    }
  }

  if (emptySummaries > 0) {
    const learning = `Found ${emptySummaries} empty summaries in last ${recentSummarized.length} interactions. Claude may be returning empty responses for very short inputs.`;
    console.log(`[Job: selfAnneal] Quality: ${learning}`);

    await errorService.logError({
      error_type: 'quality_issue',
      service: 'claudeService',
      operation: 'summarize_interaction',
      error_message: learning,
      pattern_id: 'empty_summary',
      context: { sample_size: recentSummarized.length, empty_count: emptySummaries },
    });

    learnings.push(learning);
  }

  if (shortSummaries >= 3) {
    const learning = `Found ${shortSummaries}/${recentSummarized.length} very short summaries (<20 chars). May indicate input content too brief for meaningful summarization.`;
    console.log(`[Job: selfAnneal] Quality: ${learning}`);

    await errorService.logError({
      error_type: 'quality_issue',
      service: 'claudeService',
      operation: 'summarize_interaction',
      error_message: learning,
      pattern_id: 'short_summary',
      context: { sample_size: recentSummarized.length, short_count: shortSummaries },
    });

    learnings.push(learning);
  }

  return learnings;
}

// ─── Phase 3: Context Staleness Checks ───

async function checkContextStaleness(): Promise<string[]> {
  const learnings: string[] = [];

  // Find contacts with recent interactions but stale/missing context
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  // Contacts with interactions in last 2 days
  const { data: activeContacts } = await supabase
    .from('contacts')
    .select('id, tenant_id, name, email, last_touch_at')
    .gte('last_touch_at', twoDaysAgo.toISOString())
    .limit(50);

  if (!activeContacts?.length) return learnings;

  let staleCount = 0;

  for (const contact of activeContacts) {
    const { data: ctx } = await supabase
      .from('contact_context')
      .select('generated_at')
      .eq('contact_id', contact.id)
      .single();

    if (!ctx) {
      staleCount++;
      continue;
    }

    const contextAge = Date.now() - new Date(ctx.generated_at).getTime();
    const contactTouchAge = Date.now() - new Date(contact.last_touch_at).getTime();

    // Context is stale if it's older than 48h AND contact was touched more recently
    if (contextAge > 48 * 60 * 60 * 1000 && contactTouchAge < contextAge) {
      staleCount++;
    }
  }

  if (staleCount > 0) {
    const learning = `Found ${staleCount}/${activeContacts.length} active contacts with stale or missing context. Nightly refresh job may need tuning.`;
    console.log(`[Job: selfAnneal] Staleness: ${learning}`);

    await errorService.logError({
      error_type: 'quality_issue',
      service: 'contextService',
      operation: 'context_staleness_check',
      error_message: learning,
      pattern_id: 'stale_context',
      context: { active_contacts: activeContacts.length, stale_count: staleCount },
    });

    learnings.push(learning);
  }

  return learnings;
}

// ─── Phase 4: Orphaned Handoff Checks ───

async function checkOrphanedHandoffs(): Promise<string[]> {
  const learnings: string[] = [];

  const fourHoursAgo = new Date();
  fourHoursAgo.setHours(fourHoursAgo.getHours() - 4);

  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

  // Pending handoffs older than 4 hours
  const { data: overdueHandoffs } = await supabase
    .from('handoff_events')
    .select('id, from_agent, to_agent, urgency, created_at')
    .eq('status', 'pending')
    .lte('created_at', fourHoursAgo.toISOString());

  if (overdueHandoffs?.length) {
    const escalations = overdueHandoffs.filter((h) => h.urgency === 'high' || h.urgency === 'critical');
    const normal = overdueHandoffs.filter((h) => h.urgency !== 'high' && h.urgency !== 'critical');

    if (escalations.length > 0) {
      const learning = `${escalations.length} high/critical priority handoff(s) pending > 4 hours. Immediate attention required.`;
      console.log(`[Job: selfAnneal] Handoffs: ${learning}`);

      await errorService.logError({
        error_type: 'quality_issue',
        service: 'handoffService',
        operation: 'orphaned_handoff_check',
        error_message: learning,
        pattern_id: 'overdue_escalation_handoff',
        context: { handoff_ids: escalations.map((h) => h.id) },
      });

      learnings.push(learning);
    }

    // Only flag normal ones if they're really old (>24h)
    const reallyOld = normal.filter(
      (h) => new Date(h.created_at).getTime() < twentyFourHoursAgo.getTime(),
    );

    if (reallyOld.length > 0) {
      const learning = `${reallyOld.length} normal-priority handoff(s) pending > 24 hours. May be stuck.`;
      console.log(`[Job: selfAnneal] Handoffs: ${learning}`);

      await errorService.logError({
        error_type: 'quality_issue',
        service: 'handoffService',
        operation: 'orphaned_handoff_check',
        error_message: learning,
        pattern_id: 'stuck_handoff',
        context: { handoff_ids: reallyOld.map((h) => h.id) },
      });

      learnings.push(learning);
    }
  }

  return learnings;
}

// ─── Phase 5: Directive Auto-Update ───

async function appendToDirective(learnings: string[]): Promise<void> {
  const directivePath = path.resolve(__dirname, '../../directives/cortex-api.md');

  try {
    let content = fs.readFileSync(directivePath, 'utf-8');

    const today = new Date().toISOString().split('T')[0];
    const newEntries = learnings.map((l) => `- [${today}] ${l}`).join('\n');

    // Append under "Learnings & Edge Cases" section
    const marker = '## Learnings & Edge Cases';
    const markerIndex = content.indexOf(marker);

    if (markerIndex !== -1) {
      // Find the end of the section header line
      const afterMarker = content.indexOf('\n', markerIndex);
      if (afterMarker !== -1) {
        // Find the next content after any existing note
        const insertPoint = content.indexOf('\n\n', afterMarker);
        if (insertPoint !== -1) {
          content = content.slice(0, insertPoint) + '\n' + newEntries + content.slice(insertPoint);
        } else {
          content += '\n' + newEntries + '\n';
        }
      }
    } else {
      // Section doesn't exist, add it
      content += '\n## Learnings & Edge Cases\n\n' + newEntries + '\n';
    }

    fs.writeFileSync(directivePath, content, 'utf-8');
    console.log(`[Job: selfAnneal] Updated directive with ${learnings.length} learning(s)`);
  } catch (err) {
    console.error('[Job: selfAnneal] Failed to update directive:', err);
  }
}
