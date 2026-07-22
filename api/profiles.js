// Shared voice profiles (team-wide). Auth required.
//   GET    /api/profiles            -> list all profiles
//   POST   /api/profiles  {profile} -> create or update
//   DELETE /api/profiles?id=...      -> delete
import { requireUser } from "./_lib/auth.js";
import { sql, audit } from "./_lib/db.js";

export default async function handler(req, res) {
  let user;
  try { user = await requireUser(req); }
  catch (e) { res.status(e.status || 401).json({ error: e.message }); return; }

  try {
    if (req.method === "GET") {
      const rows = await sql`select id,name,role,topics,notes,sample from profiles order by name asc`;
      res.status(200).json({ profiles: rows });
      return;
    }

    if (req.method === "POST") {
      let body = req.body; if (typeof body === "string") body = JSON.parse(body || "{}");
      const p = (body && body.profile) || {};
      if (!p.name) { res.status(400).json({ error: "Profile name is required." }); return; }
      const id = p.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
      await sql`
        insert into profiles (id,name,role,topics,notes,sample,created_by,updated_at)
        values (${id},${p.name},${p.role || ""},${p.topics || ""},${p.notes || ""},${p.sample || ""},${user.email},now())
        on conflict (id) do update set
          name=excluded.name, role=excluded.role, topics=excluded.topics,
          notes=excluded.notes, sample=excluded.sample, updated_at=now()`;
      audit(user.email, "profile_saved", id, p.name);
      res.status(200).json({ ok: true, id });
      return;
    }

    if (req.method === "DELETE") {
      const id = (req.query && req.query.id) || "";
      if (!id) { res.status(400).json({ error: "Missing id." }); return; }
      await sql`delete from profiles where id=${id}`;
      audit(user.email, "profile_deleted", id, "");
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    res.status(500).json({ error: "Database error: " + (e && e.message ? e.message : String(e)) });
  }
}
