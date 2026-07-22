// Saved drafts + review workflow. Auth required.
//   GET    /api/drafts                 -> the signed-in user's drafts
//   GET    /api/drafts?queue=1          -> drafts in review (approvers only)
//   POST   /api/drafts   {draft}        -> save a new draft (status: draft | in_review)
//   PATCH  /api/drafts   {id, action}   -> action: submit | approve | request_changes | self_review | edit | delete-note
//   DELETE /api/drafts?id=...
import { requireUser, isApprover } from "./_lib/auth.js";
import { sql, audit } from "./_lib/db.js";

export default async function handler(req, res) {
  let user;
  try { user = await requireUser(req); }
  catch (e) { res.status(e.status || 401).json({ error: e.message }); return; }

  try {
    if (req.method === "GET") {
      if (req.query && req.query.queue) {
        if (!(await isApprover(user.email))) { res.status(403).json({ error: "Approvers only." }); return; }
        const rows = await sql`select * from drafts where status='in_review' order by updated_at asc`;
        res.status(200).json({ drafts: rows });
        return;
      }
      const rows = await sql`select * from drafts where author_email=${user.email} order by updated_at desc`;
      res.status(200).json({ drafts: rows });
      return;
    }

    if (req.method === "POST") {
      let body = req.body; if (typeof body === "string") body = JSON.parse(body || "{}");
      const d = (body && body.draft) || {};
      if (!d.body) { res.status(400).json({ error: "Empty draft." }); return; }
      const id = d.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
      const status = d.status === "in_review" ? "in_review" : "draft";
      await sql`
        insert into drafts (id,author_email,author_name,type,profile_id,body,visual,status,updated_at)
        values (${id},${user.email},${user.name},${d.type || "linkedin"},${d.profile_id || null},${d.body},${d.visual || ""},${status},now())
        on conflict (id) do update set body=excluded.body, visual=excluded.visual, type=excluded.type, status=excluded.status, updated_at=now()`;
      audit(user.email, status === "in_review" ? "submitted" : "saved", id, d.type || "");
      res.status(200).json({ ok: true, id });
      return;
    }

    if (req.method === "PATCH") {
      let body = req.body; if (typeof body === "string") body = JSON.parse(body || "{}");
      const { id, action, note, body: newBody } = body || {};
      if (!id || !action) { res.status(400).json({ error: "Missing id or action." }); return; }

      if (action === "submit") {
        await sql`update drafts set status='in_review', updated_at=now() where id=${id} and author_email=${user.email}`;
        audit(user.email, "submitted", id, "");
      } else if (action === "self_review") {
        await sql`update drafts set status='approved', reviewer_email=${user.email}, review_note='self-reviewed', updated_at=now() where id=${id} and author_email=${user.email}`;
        audit(user.email, "self_reviewed", id, "");
      } else if (action === "edit") {
        await sql`update drafts set body=${newBody || ""}, updated_at=now() where id=${id} and author_email=${user.email}`;
        audit(user.email, "edited", id, "");
      } else if (action === "approve" || action === "request_changes") {
        if (!(await isApprover(user.email))) { res.status(403).json({ error: "Approvers only." }); return; }
        const status = action === "approve" ? "approved" : "changes_requested";
        await sql`update drafts set status=${status}, reviewer_email=${user.email}, review_note=${note || ""}, updated_at=now() where id=${id}`;
        audit(user.email, status, id, note || "");
      } else {
        res.status(400).json({ error: "Unknown action." }); return;
      }
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === "DELETE") {
      const id = (req.query && req.query.id) || "";
      if (!id) { res.status(400).json({ error: "Missing id." }); return; }
      await sql`delete from drafts where id=${id} and author_email=${user.email}`;
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    res.status(500).json({ error: "Database error: " + (e && e.message ? e.message : String(e)) });
  }
}
