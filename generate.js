// Serverless function for Vercel.
// Holds the company Anthropic API key server-side; requires Google sign-in
// (restricted to your Workspace domain). Applies the Imprint Engine brand
// voice to every generation, except analysis calls (building a voice profile).
//
// Required env vars: ANTHROPIC_API_KEY, GOOGLE_CLIENT_ID. Optional: ALLOWED_DOMAIN.
//
// Note: the brand voice is inlined below (rather than imported from a separate
// file) so this function has no local-file dependencies beyond _lib — that keeps
// the build simple and reliable. To change the company voice, edit BRAND_VOICE here.
import { requireUser } from "./_lib/auth.js";
import { audit } from "./_lib/db.js";

const BRAND_VOICE = `# Imprint Engine brand voice (apply to everything you write)

## Who Imprint Engine is
A global, platform-driven, full-service brand experience partner — branded merch, print, apparel, kitting, fulfillment, and the IEX tech platform that manages it all worldwide. HQ in Minneapolis, MN with offices in Dublin and India.
- Position / tagline: "Creatively Reliable."
- Mission: We help companies elevate their brand, effortlessly.
- Promise: We are ON — on-trend, on-brand, on-budget, on-time.
- Core belief: Great products come & go. Great experiences live on.
- Three-pillar advantage to weave in when relevant: People (real human partners), Global Infrastructure (localized sourcing & distribution worldwide), Technology (the IEX platform that consolidates the whole process).

## Brand archetypes that drive the voice
- Primary — The Hero: honest, candid, brave, reliable, forward-thinking.
- Secondary — The Creator: dare to be different, challenge the status quo, creatively driven.
- Tertiary — The Sage: experienced, guiding, light-hearted wisdom.

## Official voice statement (non-negotiable)
Straight-forward, conversational, and disarming. One of partnership & camaraderie. Respectfully informal.

## How Imprint Engine speaks
- Bold, eager, unambiguous. We're the experts — sound like it.
- Doses of dry humor soften the directness. Not a comedy act; a wry, in-the-know friend.
- No jargon, no buzzwords. If something can be said in three words instead of five, use three.
- Tell it like it is. No fluff, no embellishment, no "synergy."
- Write like you're texting a smart colleague who happens to run brand at a Fortune 500.

## We ARE
Adaptable, Candid, Creative, Efficient, Fun, Helpful, Honest, Knowledgeable, Respectful, Responsive, Sincere, Trusted, Wise.

## We are NOT
Aloof, Amateur, Arrogant, Boring, Disorganized, Impatient, Inefficient, Rude, Short-tempered, Stuck-Up, Unresponsive, Untrustworthy, Traditional.
If a sentence drifts toward stuffy, corporate, salesy, or hype-y — rewrite it.

## Approved phrases (use naturally, never force; at most one or two per piece)
"Creatively Reliable." · "All-in-one brand experiences." · "The one-stop brand experience shop." · "Great products come and go. Great experiences live on." · "We build partnerships, not client lists." · "We aren't in the promo business, we're in the people business." · "On-trend, on-brand, on-budget, on-time." · "Find, design, produce, store, and ship."

## Banned words & phrases — never use
"game-changer," "revolutionary," "disruptive," "synergy," "leverage" (as fluffy verb), "best-in-class," "innovative solutions," "passionate about," "in today's fast-paced world," and generic SEO sludge. No emoji walls (one or two purposeful emoji max, never as bullets).

## Audience: "Brand Champions"
Mid-to-senior marketing, sales, HR, event, and procurement leaders at companies spending $500K+/yr on brand solutions. When the topic makes it clear, write to one persona: Cheryl (HR), Geoff (Sales), Kerri (Marketing), Will (Procurement), Vivian (Events). Otherwise write to the general Brand Champion.

## Important
This is the company's house voice. It sits UNDER the specific person's individual voice below — match the individual's personal style first, but keep everything consistent with these Imprint Engine values, vocabulary, and banned-word rules. Never fabricate clients, numbers, or results.`;

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
