// Review settings + approver list. Auth required.
//   GET /api/settings              -> { modes:{type:'self'|'approver'}, approvers:[email], me:{email,isApprover} }
//   PUT /api/settings  {modes, approvers}  -> update (approvers only; first-ever caller bootstraps themselves)
import { requireUser, isApprover } from "./_lib/auth.js";
import { sql, audit } from "./_lib/db.js";

export default async function handler(req, res) {
  let user;
  try { user = await requireUser(req); }
  catch (e) { res.status(e.status || 401).json({ error: e.message }); return; }

  try {
    if (req.method === "GET") {
      const modesRows = await sql`select content_type, mode from review_settings`;
      const apprRows = await sql`select email from approvers order by email`;
      const modes = {}; modesRows.forEach(r => modes[r.content_type] = r.mode);
      res.status(200).json({
        modes,
        approvers: apprRows.map(r => r.email),
        me: { email: user.email, isApprover: await isApprover(user.email) }
      });
      return;
    }

    if (req.method === "PUT") {
      const apprCount = (await sql`select count(*)::int as n from approvers`)[0].n;
      const amApprover = await isApprover(user.email);
      // Bootstrap: if no approvers exist yet, the first signed-in editor becomes one.
      if (apprCount > 0 && !amApprover) { res.status(403).json({ error: "Only approvers can change review settings." }); return; }

      let body = req.body; if (typeof body === "string") body = JSON.parse(body || "{}");
      const { modes, approvers } = body || {};

      if (modes && typeof modes === "object") {
        for (const [type, mode] of Object.entries(modes)) {
          const m = mode === "approver" ? "approver" : "self";
          await sql`insert into review_settings (content_type, mode) values (${type},${m})
                    on conflict (content_type) do update set mode=excluded.mode`;
        }
      }
      if (Array.isArray(approvers)) {
        const clean = approvers.map(e => String(e).trim().toLowerCase()).filter(Boolean);
        // Always keep the bootstrapping user as an approver so nobody locks everyone out.
        if (apprCount === 0 && !clean.includes(user.email)) clean.push(user.email);
        await sql`delete from approvers`;
        for (const email of clean) {
          await sql`insert into approvers (email, added_by) values (${email}, ${user.email})
                    on conflict (email) do nothing`;
        }
      }
      audit(user.email, "settings_updated", "-", "");
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    res.status(500).json({ error: "Database error: " + (e && e.message ? e.message : String(e)) });
  }
}
