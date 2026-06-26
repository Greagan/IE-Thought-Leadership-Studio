// Serverless function for Vercel.
// Holds the company Anthropic API key server-side so end users never see or type a key.
// Runs at:  POST /api/generate
//
// Required environment variable:  ANTHROPIC_API_KEY
// Optional (recommended) variable: APP_PASSWORD  -> shared password gate
//
// The browser sends { system, user, model, max_tokens } and (if a password is set)
// an "x-app-password" header. This function checks the password, prepends the
// Imprint Engine brand voice, calls Anthropic with the secret key, and returns { text }.

import { BRAND_VOICE } from "./brand-voice.js";

export default async function handler(req, res) {
  // Only POST is allowed.
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  const APP_PASSWORD = process.env.APP_PASSWORD; // may be undefined = no gate

  if (!API_KEY) {
    res.status(500).json({
      error: "Server is not configured. The ANTHROPIC_API_KEY environment variable is missing."
    });
    return;
  }

  // Password gate (only enforced if APP_PASSWORD is set in the environment).
  if (APP_PASSWORD) {
    const provided = req.headers["x-app-password"] || "";
    if (provided !== APP_PASSWORD) {
      res.status(401).json({ error: "Unauthorized — wrong or missing access password." });
      return;
    }
  }

  // Parse body (Vercel auto-parses JSON, but guard for string bodies too).
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const { system, user, model, max_tokens } = body || {};

  if (!user || typeof user !== "string") {
    res.status(400).json({ error: "Missing 'user' content in request." });
    return;
  }

  // Allowlist the models the app is permitted to use.
  const ALLOWED = ["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"];
  const useModel = ALLOWED.includes(model) ? model : "claude-sonnet-4-6";

  // Prepend the Imprint Engine brand voice so it applies to every draft (server-enforced).
  // Skip it only for analysis calls (e.g. building a voice profile from someone's posts),
  // where we want the person's real voice, not the house voice.
  const applyVoice = body.applyBrandVoice !== false;
  const baseSystem = typeof system === "string" ? system : "";
  const fullSystem = applyVoice ? (BRAND_VOICE + "\n\n---\n\n" + baseSystem) : baseSystem;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: useModel,
        max_tokens: Math.min(Number(max_tokens) || 2400, 4000),
        system: fullSystem,
        messages: [{ role: "user", content: user }]
      })
    });

    const data = await r.json();
    if (!r.ok) {
      const msg = (data && data.error && data.error.message) || ("Anthropic error (" + r.status + ")");
      res.status(r.status).json({ error: msg });
      return;
    }

    const text = (data.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("")
      .trim();

    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: "Request failed: " + (e && e.message ? e.message : String(e)) });
  }
}
