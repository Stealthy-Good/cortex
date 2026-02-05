import cron from 'node-cron';
import { nightlyContextRefresh } from './nightlyContextRefresh.js';
import { staleContextCleanup } from './staleContextCleanup.js';
import { tokenBudgetReset } from './tokenBudgetReset.js';
import { handoffReminder } from './handoffReminder.js';
import { selfAnneal } from './selfAnneal.js';

export function startJobs(): void {
  console.log('[Jobs] Scheduling background jobs...');

  // Nightly context refresh: 2:00 AM daily
  cron.schedule('0 2 * * *', () => {
    nightlyContextRefresh().catch((err) => {
      console.error('[Jobs] nightlyContextRefresh failed:', err);
    });
  });

  // Stale context cleanup: every 6 hours
  cron.schedule('0 */6 * * *', () => {
    staleContextCleanup().catch((err) => {
      console.error('[Jobs] staleContextCleanup failed:', err);
    });
  });

  // Token budget reset (daily summary): midnight
  cron.schedule('0 0 * * *', () => {
    tokenBudgetReset().catch((err) => {
      console.error('[Jobs] tokenBudgetReset failed:', err);
    });
  });

  // Handoff reminder: every 2 hours
  cron.schedule('0 */2 * * *', () => {
    handoffReminder().catch((err) => {
      console.error('[Jobs] handoffReminder failed:', err);
    });
  });

  // Self-annealing: every 4 hours
  cron.schedule('0 */4 * * *', () => {
    selfAnneal().catch((err) => {
      console.error('[Jobs] selfAnneal failed:', err);
    });
  });

  console.log('[Jobs] All jobs scheduled');
}
