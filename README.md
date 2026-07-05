# xAPI Coaching App (Meeting Metric → xAPI)

Classify coaching and meeting transcripts against a **metric you define at run
time**, extract sentiment and behavioral evidence, map the result to xAPI, and
route the statements to any Learning Record Store (LRS). A results dashboard
reads the statements back for behavior analysis. Classification runs on
**Claude or Gemini** — pick the provider with an environment variable.

- **Repository:** https://github.com/tmsemko/xAPICoachingApp
- **Hosting:** Netlify (static frontend + serverless `/api/*` function)
- **Default LRS:** `https://sample-lrs-iguname.lrs.io/xapi/` (prefilled in the
  send step and dashboard; supply your lrs.io key/secret as username/password)

## What it does

1. **Transcript in** — paste or upload a `.txt`/`.vtt`/`.srt` transcript (caption
   timing is stripped automatically).
2. **Ask for the metric** — the classification is driven by a metric you supply
   at the start of each run (name + rubric + categorical labels or a numeric
   scale). Presets are included (Psychological Safety, Decision Quality,
   Engagement Balance, Coaching Presence, Sentiment).
3. **Classify** — Claude or Gemini (schema-constrained JSON output) returns
   the classification, a 0–1 score,
   sentiment, per-participant breakdown, key evidence quotes, topics/tags, and
   recommendations.
4. **Map to xAPI** — the app suggests a verb, activity type, profiles, and
   extensions based on your meeting type and scale, and explains each choice.
   You can override anything. All IRIs are verified against the
   [ADL xAPI Authored Profiles](https://github.com/adlnet/xapi-authored-profiles)
   (ADL Vocabulary, AcrossX, TinCan Registry).
5. **Send to LRS** — statements are POSTed to your LRS with
   `X-Experience-API-Version: 1.0.3` and Basic auth, and logged locally.
6. **Dashboard** (`/dashboard.html`) — surfaces behaviors (verb distribution,
   per-actor behavior, topics) and a results table you can **filter by activity,
   actor, and verb** and **sort by result score, sentiment, time, or actor**.
7. **Data dashboard** (`/analytics.html`) — tabbed statement explorer:
   **Individual** (choose actor + activity → per-verb result breakdown),
   **Verb** (choose verb, optionally filter by actor → per-actor performance
   and every occurrence), and **Classification** (clickable level distribution
   → all results at the chosen level).

## Metric modes

- **Single metric** — one scale (categorical labels or numeric), as above.
- **Multi-dimensional rubric** — several sub-dimensions, each scored
  independently on a shared level scale, with per-dimension evidence. Six
  built-in rubrics ship in [`lib/rubrics.js`](lib/rubrics.js) and are chosen
  via the **coaching framework picker** in the Metric step:

  | Framework | Job function | Levels |
  |-----------|--------------|--------|
  | **GROW** | Management / people leadership | Developing → Exemplary (4) |
  | **CLEAR** | Executive & senior leadership coaching | Developing → Exemplary (4) |
  | **OSKAR** | Team performance / solution-focused management | Developing → Exemplary (4) |
  | **FUEL** | Sales coaching & manager-initiated feedback | Developing → Exemplary (4) |
  | **Co-Active** | Executive presence, public speaking & career | Developing → Exemplary (4) |
  | **Performance** | Data & analytics coaching (domain-specific) | Needs Improvement → Advanced (3) |

  Each framework rubric is the machine-usable version of the corresponding
  document in [`docs/frameworks/`](docs/frameworks/) (see
  [`comparison.md`](docs/frameworks/comparison.md) for how to choose). Rubric
  runs produce one overall xAPI statement plus one per dimension, so the
  dashboard can filter/sort by individual competency.

## LLM providers — Claude or Gemini

The live classifier supports two providers, selected by `LLM_PROVIDER` (or
inferred from whichever API key is present; Claude wins ties):

| Provider | API key env var | Default model | Override |
|----------|-----------------|---------------|----------|
| `claude` (default) | `ANTHROPIC_API_KEY` | `claude-sonnet-5` | `CLASSIFIER_MODEL` |
| `gemini` | `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) | `gemini-2.5-flash` | `CLASSIFIER_MODEL` |

Both backends use schema-constrained JSON output, so the rest of the pipeline
(xAPI mapping, statements, dashboard) is provider-agnostic.

## Environment variables (.env)

Copy [`.env.example`](.env.example) to `.env` and fill in your keys — `.env` is
gitignored and loaded automatically by `npm start` (Node's `--env-file-if-exists`,
no dotenv dependency).

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Claude classification |
| `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) | Gemini classification |
| `LLM_PROVIDER` | `claude` \| `gemini` (optional; inferred from keys) |
| `CLASSIFIER_MODEL` | Model override (optional) |
| `LRS_ENDPOINT` | Default LRS endpoint (`https://sample-lrs-iguname.lrs.io/xapi/`) |
| `LRS_KEY` / `LRS_SECRET` | LRS Basic-auth credentials (lrs.io key/secret) |

The LRS values are **server-side defaults**: the send step and dashboard use
them whenever the UI fields are left blank, and the secret never reaches the
browser (`/api/config` only reports *that* credentials are configured, plus the
endpoint to prefill). Filling in the UI fields overrides them per request.

```bash
cp .env.example .env   # then edit .env
npm start
```

## Deploying to Netlify

The repo is Netlify-ready: [`netlify.toml`](netlify.toml) publishes `public/`
as the static site and [`netlify/functions/api.mjs`](netlify/functions/api.mjs)
serves every `/api/*` route as a serverless function (same `lib/` code as the
local Express server).

1. In Netlify: **Add new site → Import an existing project → GitHub →
   `xAPICoachingApp`**. The build settings are read from `netlify.toml` — no
   changes needed.
2. Under **Site configuration → Environment variables**, add:
   - `ANTHROPIC_API_KEY` and/or `GEMINI_API_KEY`
   - `LRS_ENDPOINT`, `LRS_KEY`, `LRS_SECRET` so users never have to type LRS
     credentials into the browser
   - optionally `LLM_PROVIDER` (`claude` | `gemini`) and `CLASSIFIER_MODEL`
   - with no LLM key set, the site runs in offline **local test mode**
     (heuristic classifier) — the full pipeline still works for demos.
3. Deploy. Every push to `main` redeploys automatically.

Netlify notes:

- **Function timeout** — synchronous functions are capped (configured to 26s in
  `netlify.toml`). Prefer fast models on Netlify (`claude-haiku-4-5`,
  `gemini-2.5-flash`) and moderate transcript sizes; for long rubric runs on
  big transcripts, run locally.
- **Send log** — on Netlify the send log is stored in **Netlify Blobs** instead
  of `data/sent-statements.json`. If Blobs is unavailable the dashboard's
  "Query LRS" source still works against any queryable LRS (including the
  default lrs.io endpoint).

## Running locally for testing (no API key)

The classifier has two backends, selected by `LLM_MODE`:

| Mode | What runs | When |
|------|-----------|------|
| `api` (default when a key is present) | Claude or Gemini (see LLM providers above) | Production / real classification |
| `local` (default when no key) | Offline deterministic heuristic in [`lib/localClassifier.js`](lib/localClassifier.js) | Pipeline testing, CI, demos |

Local mode produces schema-valid output so the entire flow (classify → map →
send → dashboard) works with no credentials. The UI shows a **LOCAL TEST MODE**
banner when it's active. It's a heuristic, not the model — good for the obvious
cases, not a substitute for judgment.

```bash
npm install

# offline — no key needed
npm run classify:local           # classify the coaching fixture, print JSON
npm run eval:local               # score the offline classifier vs gold labels
npm start                        # UI in local mode at http://localhost:3400

# real model
export ANTHROPIC_API_KEY=sk-ant-...
LLM_MODE=api CLASSIFIER_MODEL=claude-sonnet-5 npm start
```

Deterministic quantitative signals (talk-time %, interruption count, speaker
share) are computed in code ([`lib/transcript.js`](lib/transcript.js)) and handed
to the model as facts — this improves accuracy and lets a cheaper model succeed.

## Choosing the model

See [`docs/classifier-skill.md`](docs/classifier-skill.md) (the LLM's task
contract, decomposed into sub-skills) and
[`docs/model-selection.md`](docs/model-selection.md) (recommendation + the
levers that cut API cost: code-computed signals, structured outputs, rubric
prompt caching, single-call scoring, confidence-gated escalation, Batch API).

To pick empirically, run the eval across candidates (needs a key) — each run
appends a scorecard to `eval/results.jsonl`:

```bash
LLM_MODE=api CLASSIFIER_MODEL=claude-haiku-4-5 npm run eval
LLM_MODE=api CLASSIFIER_MODEL=claude-sonnet-5   npm run eval
LLM_MODE=api CLASSIFIER_MODEL=claude-opus-4-8   npm run eval
```

Override the model with `CLASSIFIER_MODEL` and the port with `PORT`.

## xAPI vocabulary used

| Kind | Default suggestion | Source profile |
|------|--------------------|----------------|
| Verb (evaluation) | `.../acrossx/verbs/evaluated` | AcrossX |
| Verb (numeric scale) | `.../tincanapi.com/verb/rated` | TinCan Registry |
| Verb (per participant) | `.../adl/.../commented` | ADL Vocabulary |
| Activity type (meeting) | `.../adl/.../activities/meeting` | ADL Vocabulary |
| Extensions | classification, topic, tags, powered-by, quality-rating, + custom (metric name/definition, sentiment, confidence, model) | TinCan / custom |

The full catalog (13 verbs, 9 activity types, 11 registry extensions, 3 profiles)
is browsable and swappable in the mapping step. AI-derived metadata that has no
registry equivalent uses a configurable custom base IRI
(`http://example.org/xapi` by default).

## How the dashboard gets data

- **Local send log** (default) — `data/sent-statements.json`, appended every time
  statements are accepted by an LRS.
- **Query LRS** — issues an xAPI `GET /statements` against a queryable LRS
  (filters: activity, verb, since/until). The mock LRS in `scratchpad` only
  accepts POSTs, so use the local log with it.

## Project layout

```
server.js                Express API + static hosting + send log + mode switch (local dev)
netlify.toml             Netlify build config (publishes public/, 26s function timeout)
netlify/functions/api.mjs  Serverless /api/* routes for Netlify (send log in Netlify Blobs)
lib/classify.js          Claude + Gemini backends; single + rubric JSON schemas; prompts
lib/localClassifier.js   Offline deterministic classifier (LLM_MODE=local)
lib/transcript.js        Deterministic speaker/talk-time/interruption parsing
lib/rubrics.js           Built-in multi-dimensional rubrics (coaching)
lib/catalog.js           Verified xAPI vocabulary + rule-based suggestions
lib/xapi.js              Statement builder (single + rubric) + LRS POST
public/                  index.html (5-step wizard) + dashboard.html + analytics.html + JS/CSS
test/run-classify.mjs    CLI classifier runner (local or api)
test/fixtures/           Transcript fixtures
eval/run-eval.mjs        Model scorecard vs gold labels
eval/gold/               Gold-labeled fixtures for evaluation
docs/classifier-skill.md The LLM skill contract (sub-skill decomposition)
docs/model-selection.md  Model recommendation + cost-optimization levers
```
