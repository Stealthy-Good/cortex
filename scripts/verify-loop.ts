/**
 * Cortex Verification Script
 *
 * Tests the full write-read-context loop end-to-end.
 * Run with: npx tsx scripts/verify-loop.ts
 *
 * Requires: .env file with SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY, CORTEX_API_KEY
 * Requires: Server running on localhost:3000 (npm run dev)
 */

const BASE = 'http://localhost:3000';

// Read API key from .env
import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.CORTEX_API_KEY || '';
const TENANT_ID = process.env.DEFAULT_TENANT_ID || '';

if (!API_KEY) {
  console.error('❌ CORTEX_API_KEY not found in .env');
  process.exit(1);
}

// ---------- helpers ----------

let stepNum = 0;
let passCount = 0;
let failCount = 0;

function header(label: string) {
  stepNum++;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  STEP ${stepNum}: ${label}`);
  console.log('='.repeat(60));
}

function pass(msg: string) {
  passCount++;
  console.log(`  ✅ ${msg}`);
}

function fail(msg: string) {
  failCount++;
  console.log(`  ❌ ${msg}`);
}

function info(msg: string) {
  console.log(`  ℹ️  ${msg}`);
}

function show(label: string, value: unknown) {
  const v = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
  // indent every line
  const indented = v.split('\n').map(l => `     ${l}`).join('\n');
  console.log(`  📦 ${label}:\n${indented}`);
}

async function api(method: string, path: string, body?: object): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  };
  if (TENANT_ID) headers['X-Tenant-ID'] = TENANT_ID;
  headers['X-Agent-Name'] = 'anna';

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

// ---------- main ----------

async function main() {
  console.log('\n🧠 CORTEX VERIFICATION — Full Write-Read-Context Loop\n');

  // ---- Step 0: Health check ----
  header('Health Check');
  try {
    const res = await fetch(`${BASE}/health/deep`);
    const data = await res.json();
    show('Response', data);

    if (data.checks?.database === 'connected') pass('Database connected');
    else fail(`Database: ${data.checks?.database}`);

    if (data.checks?.anthropic === 'configured') pass('Anthropic configured');
    else fail(`Anthropic: ${data.checks?.anthropic}`);

    if (data.checks?.database !== 'connected') {
      console.error('\n💥 Database not connected. Fix .env and restart server before continuing.\n');
      process.exit(1);
    }
  } catch (err) {
    fail(`Server not reachable at ${BASE}. Is it running? (npm run dev)`);
    process.exit(1);
  }

  // ---- Step 1: Look up tenant ----
  header('Tenant Check');
  if (TENANT_ID) {
    info(`Using DEFAULT_TENANT_ID from .env: ${TENANT_ID}`);
    pass('Tenant ID configured');
  } else {
    info('No DEFAULT_TENANT_ID set. Attempting to fetch from database...');
    // The health/ready endpoint queries tenants — we can try a contacts list to see if tenant works
    // Actually, let's just try creating a contact and see what happens
    info('Will auto-detect tenant from first API call');
    pass('Proceeding without explicit tenant (will use server default)');
  }

  // ---- Step 2: Create a contact ----
  header('Create Contact (WRITE)');
  const contactEmail = `test-${Date.now()}@acme.com`;
  const { status: createStatus, data: createData } = await api('POST', '/api/v1/contacts', {
    email: contactEmail,
    name: 'John Smith',
    company_name: 'Acme Corp',
    stage: 'prospect',
    source: 'anna_outbound',
  });

  show('Response', createData);

  if (createStatus === 201 && createData?.data?.id) {
    pass(`Contact created (status ${createStatus})`);
    pass(`ID: ${createData.data.id}`);
    pass(`Email: ${createData.data.email}`);
  } else {
    fail(`Contact creation failed (status ${createStatus})`);
    if (createStatus === 401) info('→ Check CORTEX_API_KEY in .env matches what the server loaded');
    if (createStatus === 400) info('→ Check DEFAULT_TENANT_ID matches a row in the tenants table');
    console.error('\n💥 Cannot continue without a contact. Fix the error above.\n');
    process.exit(1);
  }

  const contactId: string = createData.data.id;

  // ---- Step 3: Read the contact back ----
  header('Read Contact Back (READ)');
  const { status: readStatus, data: readData } = await api('GET', `/api/v1/contacts/${contactId}`);
  show('Response', readData);

  if (readStatus === 200 && readData?.data?.email === contactEmail) {
    pass(`Contact retrieved (name: ${readData.data.name}, company: ${readData.data.company_name})`);
  } else {
    fail(`Contact read failed (status ${readStatus})`);
  }

  // ---- Step 4: Log an interaction (triggers Claude summarization) ----
  header('Log Interaction (WRITE + AI Summarization)');
  info('This calls Claude Haiku to auto-summarize. May take a few seconds...');

  const { status: intStatus, data: intData } = await api('POST', '/api/v1/interactions', {
    contact_id: contactId,
    agent: 'anna',
    type: 'email_sent',
    direction: 'outbound',
    subject: 'Sustainable packaging for Acme',
    raw_content: 'Hi John, I noticed Acme Corp has been expanding its eco-friendly product line. We offer sustainable packaging solutions that could reduce your costs by 20% while improving your environmental footprint. Would you be open to a quick 15-minute call this week to explore this?',
  });

  show('Response', intData);

  if (intStatus === 201) {
    pass(`Interaction logged (status ${intStatus})`);

    if (intData?.summary) pass(`AI Summary: "${intData.summary}"`);
    else fail('No AI summary generated — check ANTHROPIC_API_KEY');

    if (intData?.sentiment) pass(`Sentiment: ${intData.sentiment}`);
    else info('No sentiment extracted');

    if (intData?.key_points?.length) pass(`Key points: ${intData.key_points.length} extracted`);
    else info('No key points extracted');

    if (intData?.intent) pass(`Intent: ${intData.intent}`);
    else info('No intent extracted');

    if (intData?.token_usage) {
      pass(`Tokens used: ${intData.token_usage.input_tokens} in / ${intData.token_usage.output_tokens} out ($${intData.token_usage.cost_usd})`);
    } else {
      info('No token usage reported');
    }
  } else {
    fail(`Interaction logging failed (status ${intStatus})`);
  }

  const interactionId: string | null = intData?.id || null;

  // ---- Step 5: Read interactions back ----
  header('Read Interactions Back (READ)');
  const { status: listIntStatus, data: listIntData } = await api('GET', `/api/v1/interactions?contact_id=${contactId}`);
  show('Response', listIntData);

  if (listIntStatus === 200 && listIntData?.data?.length > 0) {
    pass(`${listIntData.data.length} interaction(s) found`);
    pass(`Most recent type: ${listIntData.data[0].type}`);
  } else {
    fail(`No interactions returned (status ${listIntStatus})`);
  }

  // ---- Step 6: Get context briefing ----
  header('Get Context Briefing (CONTEXT GENERATION)');
  info('This generates the shared memory briefing an agent reads. May take a few seconds...');

  const { status: ctxStatus, data: ctxData } = await api('GET', `/api/v1/context/${contactId}?level=2`);
  show('Response', ctxData);

  if (ctxStatus === 200) {
    pass(`Context retrieved (level ${ctxData?.level})`);

    if (ctxData?.header) pass(`Header: ${ctxData.header.name} @ ${ctxData.header.company}`);

    if (ctxData?.context?.summary) pass(`Summary generated: "${ctxData.context.summary.substring(0, 100)}..."`);
    else fail('No context summary generated');

    if (ctxData?.context?.key_facts?.length) pass(`Key facts: ${ctxData.context.key_facts.length} items`);
    if (ctxData?.context?.recommended_tone) pass(`Recommended tone: ${ctxData.context.recommended_tone}`);
    if (ctxData?.token_count) pass(`Token count: ~${ctxData.token_count} tokens`);
    if (ctxData?.is_stale === false) pass('Context is fresh (not stale)');
  } else {
    fail(`Context retrieval failed (status ${ctxStatus})`);
  }

  // ---- Step 7: Budget check ----
  header('Budget Check');
  const { status: budgetStatus, data: budgetData } = await api('GET', '/api/v1/usage/budget-check/anna');
  show('Response', budgetData);

  if (budgetStatus === 200) {
    pass(`Budget check passed (status ${budgetStatus})`);
    if (budgetData?.within_budget !== undefined) {
      pass(`Within budget: ${budgetData.within_budget}`);
      pass(`Recommendation: ${budgetData.recommendation}`);
    }
    if (budgetData?.tokens_used !== undefined) {
      pass(`Tokens used today: ${budgetData.tokens_used}`);
    }
  } else {
    fail(`Budget check failed (status ${budgetStatus})`);
  }

  // ---- Step 8: Handoff flow ----
  header('Create Handoff (Anna → Jasper)');
  info('This generates a handoff briefing via Claude. May take a few seconds...');

  const { status: hoStatus, data: hoData } = await api('POST', '/api/v1/handoffs', {
    contact_id: contactId,
    from_agent: 'anna',
    to_agent: 'jasper',
    reason: 'warm_reply',
    reason_detail: 'Prospect expressed interest in sustainable packaging, asking about pricing',
    suggested_action: 'Send pricing sheet, offer discovery call',
    urgency: 'normal',
  });

  show('Response', hoData);

  if (hoStatus === 201) {
    pass(`Handoff created (status ${hoStatus})`);
    if (hoData?.context_summary) pass(`Context summary for Jasper: "${hoData.context_summary.substring(0, 100)}..."`);
    if (hoData?.status === 'pending') pass('Status: pending');
    if (hoData?.context_refreshed) pass('Context refresh triggered');
  } else {
    fail(`Handoff creation failed (status ${hoStatus})`);
  }

  const handoffId: string | null = hoData?.id || null;

  // ---- Step 9: Check pending handoffs (as Jasper) ----
  header('Check Pending Handoffs (as Jasper)');
  const { status: pendingStatus, data: pendingData } = await api('GET', '/api/v1/handoffs/pending?agent=jasper');
  show('Response', pendingData);

  if (pendingStatus === 200 && pendingData?.data?.length > 0) {
    pass(`${pendingData.data.length} pending handoff(s) for Jasper`);
  } else {
    fail(`No pending handoffs found (status ${pendingStatus})`);
  }

  // ---- Step 10: Accept handoff ----
  if (handoffId) {
    header('Accept Handoff (as Jasper)');
    const { status: acceptStatus, data: acceptData } = await api('PATCH', `/api/v1/handoffs/${handoffId}`, {
      status: 'accepted',
    });
    show('Response', acceptData);

    if (acceptStatus === 200 && acceptData?.data?.status === 'accepted') {
      pass('Handoff accepted by Jasper');
      if (acceptData?.data?.accepted_at) pass(`Accepted at: ${acceptData.data.accepted_at}`);
    } else {
      fail(`Handoff accept failed (status ${acceptStatus})`);
    }
  }

  // ---- Step 11: Re-check context after handoff ----
  header('Re-check Context After Handoff (FULL LOOP)');
  info('Forcing a refresh to incorporate the handoff...');

  // small delay to let background refresh finish
  await new Promise(r => setTimeout(r, 2000));

  const { status: ctx2Status, data: ctx2Data } = await api('GET', `/api/v1/context/${contactId}?level=2&refresh=true`);
  show('Response', ctx2Data);

  if (ctx2Status === 200 && ctx2Data?.context?.summary) {
    pass('Context refreshed successfully after handoff');
    pass(`Updated summary: "${ctx2Data.context.summary.substring(0, 120)}..."`);
  } else {
    fail(`Context refresh failed (status ${ctx2Status})`);
  }

  // ---- Summary ----
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  RESULTS: ${passCount} passed, ${failCount} failed`);
  console.log('='.repeat(60));

  if (failCount === 0) {
    console.log('\n🎉 ALL CHECKS PASSED — Cortex shared memory loop is working end-to-end!\n');
    console.log('What was verified:');
    console.log('  ✅ Database connectivity (Supabase)');
    console.log('  ✅ Contact create + read');
    console.log('  ✅ Interaction logging with AI summarization (Claude Haiku)');
    console.log('  ✅ Context generation (shared memory briefing)');
    console.log('  ✅ Token budget tracking');
    console.log('  ✅ Agent-to-agent handoff with context generation');
    console.log('  ✅ Handoff acceptance flow');
    console.log('  ✅ Context refresh after new data');
    console.log('\n→ Next: deploy to Vercel or integrate your first agent (Luna)\n');
  } else {
    console.log(`\n⚠️  ${failCount} check(s) failed. Review the output above for details.\n`);
  }

  // Clean up: note we leave the test data in Supabase so user can inspect it
  info(`Test contact ID: ${contactId}`);
  info('You can inspect this data in Supabase Dashboard → Table Editor');
  console.log('');

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('💥 Unexpected error:', err);
  process.exit(1);
});
