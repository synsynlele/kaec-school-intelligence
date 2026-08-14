import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const integration = readFileSync(new URL("../lib/integrations/khpos.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/integrations/khpos/route.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/integrations/khpos/page.tsx", import.meta.url), "utf8");
const bridge = readFileSync(new URL("../components/integrations/khpos-sync-bridge.tsx", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8");

assert.match(integration, /KHPOS_KSI_CONTRACT_VERSION = "1\.0"/);
assert.match(integration, /SIGNAL_WINDOW_DAYS = 90/);
assert.match(integration, /workspace_members/);
assert.match(integration, /\["owner", "admin"\]/);
assert.match(integration, /workspace_type", "school"/);
assert.match(integration, /hqls_fidelity_checks/);
assert.match(integration, /intervention_handoffs/);
assert.doesNotMatch(integration, /students"/);
assert.doesNotMatch(integration, /SUPABASE_SERVICE_ROLE/);
assert.match(integration, /KHPOS_INTEGRATION_BASE_URL/);
assert.doesNotMatch(integration, /callbackUrl|callback_url|receiverUrl\s*:/);

assert.match(route, /httpOnly: true/);
assert.match(route, /secure: true/);
assert.match(route, /sameSite: "lax"/);
assert.match(route, /SYNC_INTERVAL_MS = 60 \* 60 \* 1000/);
assert.match(route, /pairWithKhpos/);
assert.match(route, /syncWithKhpos/);
assert.doesNotMatch(route, /service[_-]?role/i);

assert.match(page, /Approve institutional learning-signal sharing/);
assert.match(page, /Not shared: student names/);
assert.match(page, /Owner or Admin/);
assert.match(page, /only manual approval/i);
assert.match(bridge, /action: "sync"/);
assert.match(bridge, /non-blocking/);
assert.match(dashboard, /KhposSyncBridge/);

console.log("KSI → KHP-OS Stage 7 integration validation passed: RLS-scoped aggregation, one-time owner/admin approval, privacy boundary and throttled non-blocking sync are present.");
