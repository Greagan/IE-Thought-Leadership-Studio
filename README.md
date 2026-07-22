# Imprint Engine — Thought Leadership Studio (Vercel)

A web app leadership can open at a URL to ghostwrite thought-leadership content in their own voice. The Anthropic API key lives **only on the server** (a Vercel environment variable), so no one ever has to enter or see a key. Access is protected by a shared team password you set.

> Draft tool. Everything it produces is a draft for human review before posting.

---

## What's in this folder

```
ie-thought-leadership-vercel/
├── index.html          The app (what leadership sees)
├── api/
│   ├── generate.js      Serverless function: holds the key, applies brand voice, calls Anthropic
│   └── brand-voice.js   Imprint Engine brand voice (edit this to change the company voice)
├── BRAND_VOICE.md       Human-readable brand voice reference
├── vercel.json          Minimal Vercel config
├── package.json         Declares Node 18+ / ES modules
├── .gitignore
└── README.md            This guide
```

## What the app does

- Eight content types: LinkedIn post, LinkedIn comment, repurpose one piece → a week of posts, hot take (react to news), transcript ghostwrite, short-form video script, long-form article, newsletter.
- Reusable voice profiles per person, with **auto-build from posts** — paste someone's real posts and it drafts their voice profile.
- A **source / reference** field to ground drafts in a real stat or link (reduces fabrication).
- Editable drafts (click to edit) with a live LinkedIn character counter, a **"5 hooks"** generator, a **visual idea** for each draft, copy, and refine.
- A **Saved** library to keep drafts worth reusing.

## Phase 2 — sign-in, database, review (built)

Phase 2 is in this repo. It replaces the shared password with **Google Workspace sign-in** locked to `@imprintengine.com`, stores **shared voice profiles + saved drafts + an audit log** in **Neon Postgres**, and adds a **configurable review step** (self-review by default, approver queue per content type).

**This changes setup.** See `SETUP-PHASE2.md` for the full walkthrough. In short, you now set these environment variables in Vercel: `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID`, `ALLOWED_DOMAIN`, `DATABASE_URL` (the old `APP_PASSWORD` is no longer used), and run `db/schema.sql` once against your Neon database.

> The Method A/B deploy steps below predate phase 2 — the deploy mechanics are the same, but use the phase-2 environment variables from `SETUP-PHASE2.md`, not `APP_PASSWORD`.

### Still future
- Analytics dashboard tying drafts to what posted and how it performed (the audit log is the foundation).
- Posting/scheduling integrations.

## Brand voice is built in

Every draft automatically follows Imprint Engine's official brand voice — "Creatively Reliable," dry humor, no buzzwords, the approved phrases and banned words, the Brand Champion personas — sourced from the company brand voice spec and the 2023 Brand Book. It's applied **server-side** (in `api/generate.js` via `api/brand-voice.js`), so it covers everyone and can't be skipped. Each person's individual voice profile sits on top of it: the app matches the person first, then keeps everything consistent with the house voice. To change the company voice, edit `api/brand-voice.js` and redeploy.

You don't need to edit any code. You only set two secret values in Vercel: the API key and the team password.

---

## Before you start (5 minutes)

1. **An Anthropic API key.** Go to https://console.anthropic.com → Settings → API Keys → Create Key. Copy the `sk-ant-...` value somewhere safe. Make sure that account has billing/credits set up (Billing tab). All app usage bills to this one account.
2. **A Vercel account.** Sign up free at https://vercel.com (use "Continue with GitHub" if you have GitHub — it makes Method A below easier).
3. **Pick a team password.** Any phrase you'll share with leadership, e.g. `imprint-2026-spring`. This stops strangers from using your key if they find the URL.

---

## Deploy — Method A: GitHub + Vercel dashboard (recommended, no terminal)

This is the easiest path and makes future updates one drag-and-drop.

1. **Put this folder on GitHub.**
   - Go to https://github.com/new, name the repo (e.g. `ie-thought-leadership`), keep it **Private**, click *Create repository*.
   - On the next page click **"uploading an existing file"**, then drag in the **contents** of this folder (the `index.html`, the `api` folder, `vercel.json`, `package.json`). Commit.
2. **Import into Vercel.**
   - In Vercel click **Add New… → Project**, choose **Import Git Repository**, and pick the repo you just made.
   - Framework Preset: leave as **Other**. Don't change build settings. Click **Deploy** (it's fine if the first deploy runs before env vars are set — you'll add them next, then redeploy).
3. **Add your secrets.** In the project, go to **Settings → Environment Variables** and add two:
   | Name | Value |
   |------|-------|
   | `ANTHROPIC_API_KEY` | your `sk-ant-...` key |
   | `APP_PASSWORD` | your chosen team password |
   Set both for the **Production** environment, click Save.
4. **Redeploy so the secrets take effect.** Go to **Deployments**, open the latest one, click the **⋯ menu → Redeploy**.
5. **Open your URL.** Vercel gives you a link like `https://ie-thought-leadership.vercel.app`. Open it, click Generate, enter the team password when prompted. Done.

---

## Deploy — Method B: Vercel CLI (fastest if you're comfortable in a terminal)

1. Install the CLI: `npm install -g vercel`
2. In a terminal, `cd` into this folder.
3. Run `vercel` and follow the prompts (link to your account, accept defaults). It deploys a preview URL.
4. Add the secrets:
   ```
   vercel env add ANTHROPIC_API_KEY production
   vercel env add APP_PASSWORD production
   ```
   Paste the values when asked.
5. Push to production with the secrets applied: `vercel --prod`
6. Open the production URL it prints.

---

## Test it works

- Open the URL. Go to **Voice profiles → + New profile**, add a name and paste a writing sample, save.
- Back on **Compose**, pick that profile, type a topic, click **Generate**.
- First generate will prompt for the team password. Enter it. You should get drafts.
- If you see "Unauthorized" you typed the wrong password (use **Settings → Sign out** to re-enter). If you see "Server is not configured," the `ANTHROPIC_API_KEY` variable isn't set or you didn't redeploy after adding it.

---

## Share with leadership

Just send them the URL and the team password. They each:
- Build their own voice profile once (stored in their own browser).
- Generate, copy, refine. No key, no setup.

Voice profiles are stored per-person in their browser, so each exec keeps their own. They are **not** shared between people or stored on the server.

---

## Updating the app later

- **Method A (GitHub):** upload the changed file to the repo — Vercel redeploys automatically.
- **Method B (CLI):** run `vercel --prod` again from the folder.

To change the password or rotate the key, edit the value under **Settings → Environment Variables** and redeploy.

---

## Costs

- **Vercel:** the free "Hobby" plan is enough for this. (Note: Vercel's Hobby tier is for non-commercial use; for company use you may need a Pro seat — check current Vercel terms.)
- **Anthropic:** pay-as-you-go per word generated, billed to the key's account. A few hundred posts a month is typically a small bill, but it's real money on one card — watch usage in the Anthropic console and consider setting a spend limit there.

---

## Security notes (worth a quick IT/Security read before wide rollout)

- The key is only ever on Vercel's servers and in the function — never in `index.html`, never in the browser, never in Git (keep the repo private anyway).
- The shared password is basic protection. Anyone with the URL **and** password can spend on your key. For a real rollout, consider upgrading to proper sign-in restricted to `@imprintengine.com` (Vercel Authentication / SSO, or an auth provider) instead of a shared password.
- Rotate the password if it leaks, and rotate the Anthropic key from the console if it's ever exposed.
- This is a drafting tool. Keep a human-review step before anything is published externally.
