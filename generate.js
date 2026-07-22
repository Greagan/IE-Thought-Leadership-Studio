// Serverless function for Vercel.
// Holds the company Anthropic API key server-side; requires Google sign-in
// (restricted to your Workspace domain). Applies the Imprint Engine brand
// voice to every generation, except analysis calls (building a voice profile).
//
// Required env vars: ANTHROPIC_API_KEY, GOOGLE_CLIENT_ID. Optional: ALLOWED_DOMAIN.
import { BRAND_VOICE } from "./brand-voice.js";
import { requireUser } from "./_lib/auth.js";
import { audit } from "./_lib/db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  let user;
  try { user = await requireUser(req); }
  catch (e) { res.status(e.status || 401).json({ error: e.message || "Unauthorized" }); return; }

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) { res.status(500).json({ error: "Server is not configured: ANTHROPIC_API_KEY missing." }); return; }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const { system, user: userMsg, model, max_tokens } = body || {};
  if (!userMsg || typeof userMsg !== "string") { res.status(400).json({ error: "Missing 'user' content in request." }); return; }

  const ALLOWED = ["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"];
  const useModel = ALLOWED.includes(model) ? model : "claude-sonnet-4-6";

  const applyVoice = body.applyBrandVoice !== false;
  const baseSystem = typeof system === "string" ? system : "";
  const fullSystem = applyVoice ? (BRAND_VOICE + "\n\n---\n\n" + baseSystem) : baseSystem;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: useModel,
        max_tokens: Math.min(Number(max_tokens) || 2400, 4000),
        system: fullSystem,
        messages: [{ role: "user", content: userMsg }]
      })
    });
    const data = await r.json();
    if (!r.ok) {
      const msg = (data && data.error && data.error.message) || ("Anthropic error (" + r.status + ")");
      res.status(r.status).json({ error: msg });
      return;
    }
    const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
    audit(user.email, applyVoice ? "generated" : "analyzed", "-", "model=" + useModel);
    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: "Request failed: " + (e && e.message ? e.message : String(e)) });
  }
}
