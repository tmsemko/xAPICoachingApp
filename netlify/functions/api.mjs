// Netlify Function (Functions 2.0) — serves every /api/* route on Netlify.
// Mirrors server.js, which remains the local-dev server. Both share lib/.
//
// The local send log lives in Netlify Blobs (the filesystem on Netlify is
// ephemeral); if Blobs is unavailable the send still succeeds — the dashboard
// then relies on the "Query LRS" source.

import { getStore } from "@netlify/blobs";
import {
  PROFILES,
  VERBS,
  ACTIVITY_TYPES,
  EXTENSIONS,
  CUSTOM_EXTENSION_SUFFIXES,
  suggest,
} from "../../lib/catalog.js";
import { classifyTranscript, hasLlmCredential, resolveProvider, resolveModel } from "../../lib/classify.js";
import { classifyLocally } from "../../lib/localClassifier.js";
import { RUBRICS } from "../../lib/rubrics.js";
import { buildStatements, sendToLrs } from "../../lib/xapi.js";

const LLM_MODE = process.env.LLM_MODE || (hasLlmCredential() ? "api" : "local");

// Server-side LRS defaults (Netlify site env vars). UI fields override them;
// the secret never reaches the browser — config only reports that creds exist.
const lrsDefaults = () => ({
  endpoint: process.env.LRS_ENDPOINT || "",
  key: process.env.LRS_KEY || "",
  secret: process.env.LRS_SECRET || "",
});

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// --- send log (Netlify Blobs) ---

const LOG_KEY = "sent-statements";

async function readLog() {
  try {
    const store = getStore("send-log");
    return (await store.get(LOG_KEY, { type: "json" })) || [];
  } catch {
    return [];
  }
}

async function appendLog(entries) {
  try {
    const store = getStore("send-log");
    const log = (await store.get(LOG_KEY, { type: "json" })) || [];
    log.push(...entries);
    await store.setJSON(LOG_KEY, log);
  } catch {
    // Blobs not available — non-fatal; the LRS itself remains the source of truth.
  }
}

// --- route handlers ---

async function handleClassify(req) {
  const { transcript, metric } = (await req.json().catch(() => ({}))) || {};
  if (!transcript || !transcript.trim()) return json({ error: "Transcript is required." }, 400);
  if (!metric || !metric.name) return json({ error: "A metric (with at least a name) is required." }, 400);
  const isRubric = metric.mode === "rubric" || Array.isArray(metric.dimensions);
  if (!isRubric && metric.scaleType === "categorical" && (!metric.labels || metric.labels.length < 2)) {
    return json({ error: "Categorical metrics need at least 2 labels." }, 400);
  }
  try {
    const out =
      LLM_MODE === "local"
        ? classifyLocally({ transcript, metric })
        : await classifyTranscript({ transcript, metric });
    return json(out);
  } catch (err) {
    const msg = err.message || "Classification failed.";
    if (/authentication|api.?key|authToken/i.test(msg)) {
      return json(
        {
          error:
            "No LLM API key is configured. Set ANTHROPIC_API_KEY (Claude) or GEMINI_API_KEY (Gemini) in the Netlify site's environment variables.",
        },
        500
      );
    }
    return json({ error: msg }, err.status && err.status >= 400 ? 502 : 500);
  }
}

async function handleBuild(req) {
  const { result, metric, mapping, meeting, actor, model } = (await req.json().catch(() => ({}))) || {};
  if (!result || !metric || !mapping || !meeting || !actor) {
    return json({ error: "result, metric, mapping, meeting, and actor are required." }, 400);
  }
  try {
    return json({ statements: buildStatements({ result, metric, mapping, meeting, actor, model }) });
  } catch (err) {
    return json({ error: err.message }, 400);
  }
}

async function handleSend(req) {
  const body = (await req.json().catch(() => ({}))) || {};
  const defaults = lrsDefaults();
  const statements = body.statements;
  const endpoint = body.endpoint || defaults.endpoint;
  const username = body.username || defaults.key;
  const password = body.password || defaults.secret;
  if (!endpoint || !statements?.length) return json({ error: "endpoint and statements are required." }, 400);
  try {
    const out = await sendToLrs({ endpoint, username, password, statements });
    if (out.ok) {
      const ids = Array.isArray(out.body) ? out.body : [];
      await appendLog(
        statements.map((s, i) => ({
          id: ids[i] || null,
          lrs: endpoint,
          storedAt: new Date().toISOString(),
          statement: s,
        }))
      );
    }
    return json(out, out.ok ? 200 : 502);
  } catch (err) {
    return json({ error: `Could not reach LRS: ${err.message}` }, 502);
  }
}

async function handleRecords() {
  const entries = await readLog();
  return json({ source: "local", statements: entries.map((e) => e.statement), entries });
}

async function handleLrsQuery(url) {
  const q = url.searchParams;
  const defaults = lrsDefaults();
  const endpoint = q.get("endpoint") || defaults.endpoint;
  const username = q.get("username") || defaults.key;
  const password = q.get("password") || defaults.secret;
  if (!endpoint) return json({ error: "endpoint is required." }, 400);
  try {
    const target = new URL(endpoint.replace(/\/+$/, "") + "/statements");
    for (const key of ["activity", "verb", "since", "until"]) {
      if (q.get(key)) target.searchParams.set(key, q.get(key));
    }
    target.searchParams.set("limit", String(Math.min(Number(q.get("limit")) || 200, 500)));

    const auth = Buffer.from(`${username}:${password}`).toString("base64");
    const r = await fetch(target, {
      headers: { "X-Experience-API-Version": "1.0.3", Authorization: `Basic ${auth}` },
    });
    const text = await r.text();
    if (!r.ok) return json({ error: `LRS returned HTTP ${r.status}: ${text.slice(0, 300)}` }, 502);
    const body = JSON.parse(text);
    const statements = Array.isArray(body) ? body : body.statements || [];
    return json({ source: "lrs", statements, more: body.more || null });
  } catch (err) {
    return json({ error: `Could not query LRS: ${err.message}` }, 502);
  }
}

// --- router ---

export default async (req) => {
  const url = new URL(req.url);
  const route = url.pathname.replace(/^\/api\//, "").replace(/\/+$/, "");
  const method = req.method;

  if (method === "GET" && route === "catalog") {
    return json({
      profiles: PROFILES,
      verbs: VERBS,
      activityTypes: ACTIVITY_TYPES,
      extensions: EXTENSIONS,
      customExtensionSuffixes: CUSTOM_EXTENSION_SUFFIXES,
    });
  }
  if (method === "GET" && route === "suggest") {
    return json(
      suggest({
        meetingKind: url.searchParams.get("meetingKind"),
        scaleType: url.searchParams.get("scaleType"),
      })
    );
  }
  if (method === "GET" && route === "config") {
    const provider = resolveProvider();
    const lrs = lrsDefaults();
    return json({
      llmMode: LLM_MODE,
      provider,
      model: resolveModel(provider),
      lrsEndpoint: lrs.endpoint,
      lrsCredsConfigured: !!(lrs.key || lrs.secret),
    });
  }
  if (method === "GET" && route === "rubrics") return json(RUBRICS);
  if (method === "POST" && route === "classify") return handleClassify(req);
  if (method === "POST" && route === "statements/build") return handleBuild(req);
  if (method === "POST" && route === "lrs/send") return handleSend(req);
  if (method === "GET" && route === "records") return handleRecords();
  if (method === "GET" && route === "lrs/query") return handleLrsQuery(url);

  return json({ error: `Unknown route: ${method} /api/${route}` }, 404);
};

export const config = { path: "/api/*" };
