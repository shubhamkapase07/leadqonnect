// Scheduled sequence sender (replaces the processSequences Cloud Function). GitHub Actions cron.
// Finds due active enrollments, sends the current step from the user's connected Gmail/Reddit,
// then advances or completes. Stops if the lead already engaged.
// Run: node --env-file-if-exists=.env.local --import tsx scripts/process-sequences.mjs
import { db } from "../api/_lib/turso.ts";
import { gmailSend, getValidRedditToken, redditApi } from "../api/_lib/oauth.ts";

const ENGAGED = new Set(["replied", "meeting", "proposal", "won", "lost", "archived"]);
const fill = (text, lead) => {
  const name = lead?.author || lead?.handle || "there";
  const first = String(name).replace(/^u\//, "").split(/[\s_]/)[0] || "there";
  return (text || "")
    .replace(/\{\{\s*name\s*\}\}/gi, first)
    .replace(/\{\{\s*author\s*\}\}/gi, String(name))
    .replace(/\{\{\s*keyword\s*\}\}/gi, lead?.keywords?.[0] || "this")
    .replace(/\{\{\s*title\s*\}\}/gi, lead?.title || "");
};

const client = db();
const nowIso = new Date().toISOString();
const rows = await client.execute("SELECT * FROM sequence_enrollments WHERE status='active'");
let sent = 0;

async function docJson(uid, collection, docId) {
  const r = await client.execute({ sql: "SELECT json FROM workspace_docs WHERE user_id=? AND collection=? AND doc_id=?", args: [uid, collection, docId] });
  try { return r.rows[0] ? JSON.parse(r.rows[0].json) : null; } catch { return null; }
}

for (const e of rows.rows) {
  if (e.next_run_at && e.next_run_at > nowIso) continue;
  const uid = e.user_id;
  try {
    const seq = await docJson(uid, "sequences", e.sequence_id);
    if (!seq || !Array.isArray(seq.steps) || !seq.steps.length) {
      await client.execute({ sql: "UPDATE sequence_enrollments SET status='failed', last_error='sequence not found', updated_at=? WHERE id=?", args: [nowIso, e.id] });
      continue;
    }
    const lead = await docJson(uid, "leads", e.lead_id);
    if (lead && ENGAGED.has(lead.status)) {
      await client.execute({ sql: "UPDATE sequence_enrollments SET status='stopped', last_error='lead engaged', updated_at=? WHERE id=?", args: [nowIso, e.id] });
      continue;
    }
    const step = seq.steps[e.current_step];
    if (!step) {
      await client.execute({ sql: "UPDATE sequence_enrollments SET status='completed', updated_at=? WHERE id=?", args: [nowIso, e.id] });
      continue;
    }
    const body = fill(step.body, lead || {});
    const subject = fill(step.subject || "Following up", lead || {});
    if (e.channel === "email") await gmailSend(uid, { to: e.recipient, subject, text: body });
    else { const tok = await getValidRedditToken(uid); await redditApi(tok, "/api/compose", { to: String(e.recipient).replace(/^u\//, ""), subject, text: body }); }
    sent++;

    if (lead && lead.status === "potential") {
      lead.status = "contacted";
      await client.execute({ sql: "UPDATE workspace_docs SET json=? WHERE user_id=? AND collection='leads' AND doc_id=?", args: [JSON.stringify(lead), uid, e.lead_id] });
    }

    const next = Number(e.current_step) + 1;
    if (next >= seq.steps.length) {
      await client.execute({ sql: "UPDATE sequence_enrollments SET current_step=?, status='completed', last_sent_at=?, updated_at=? WHERE id=?", args: [next, nowIso, nowIso, e.id] });
    } else {
      const delayDays = Number(seq.steps[next].delayDays) || 0;
      const nextRun = new Date(Date.now() + delayDays * 86400000).toISOString();
      await client.execute({ sql: "UPDATE sequence_enrollments SET current_step=?, next_run_at=?, last_sent_at=?, updated_at=? WHERE id=?", args: [next, nextRun, nowIso, nowIso, e.id] });
    }
  } catch (err) {
    console.error(`[process-sequences] ${e.id} failed:`, err?.message || err);
    await client.execute({ sql: "UPDATE sequence_enrollments SET status='failed', last_error=?, updated_at=? WHERE id=?", args: [String(err?.message || err).slice(0, 300), nowIso, e.id] });
  }
}

console.log(`[process-sequences] sent ${sent} messages.`);
process.exit(0);
