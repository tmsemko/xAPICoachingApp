import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  PROFILES,
  VERBS,
  ACTIVITY_TYPES,
  EXTENSIONS,
  CUSTOM_EXTENSION_SUFFIXES,
  suggest,
} from "./lib/catalog.js";
import { classifyTranscript } from "./lib/classify.js";
import { classifyLocally } from "./lib/localClassifier.js";
import { RUBRICS } from "./lib/rubrics.js";
import { buildStatements, sendToLrs } from "./lib/xapi.js";

// LLM_MODE=local uses the offline heuristic classifier (no API key needed).
// Defaults to local automatically when no Anthropic credential is present.
const HAS_CREDENTIAL = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const LLM_MODE = process.env.LLM_MODE || (HAS_CREDENTIAL ? "api" : "local");

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(here, "public")));

// --- local send log (every statement pushed to an LRS is also recorded here,
// so the dashboard has data even when the LRS doesn't support querying) ---
const DATA_DIR = path.join(here, "data");
const LOG_FILE = path.join(DATA_DIR, "sent-statements.json");

function readLog() {
  try {
    return JSON.parse(fs.readFileSync(LOG_FILE, "utf8"));
  } catch {
    return [];
  }
}

function appendLog(entries) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const log = readLog();
  log.push(...entries);
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
}

app.get("/api/catalog", (_req, res) => {
  res.json({
    profiles: PROFILES,
    verbs: VERBS,
    activityTypes: ACTIVITY_TYPES,
    extensions: EXTENSIONS,
    customExtensionSuffixes: CUSTOM_EXTENSION_SUFFIXES,
  });
});

app.get("/api/suggest", (req, res) => {
  res.json(suggest({ meetingKind: req.query.meetingKind, scaleType: req.query.scaleType }));
});

app.get("/api/config", (_req, res) => {
  res.json({ llmMode: LLM_MODE, model: process.env.CLASSIFIER_MODEL || "claude-sonnet-5" });
});

app.get("/api/rubrics", (_req, res) => {
  res.json(RUBRICS);
});

app.post("/api/classify", async (req, res) => {
  const { transcript, metric } = req.body || {};
  if (!transcript || !transcript.trim()) {
    return res.status(400).json({ error: "Transcript is required." });
  }
  if (!metric || !metric.name) {
    return res.status(400).json({ error: "A metric (with at least a name) is required." });
  }
  const isRubric = metric.mode === "rubric" || Array.isArray(metric.dimensions);
  if (!isRubric && metric.scaleType === "categorical" && (!metric.labels || metric.labels.length < 2)) {
    return res.status(400).json({ error: "Categorical metrics need at least 2 labels." });
  }
  try {
    const out =
      LLM_MODE === "local"
        ? classifyLocally({ transcript, metric })
        : await classifyTranscript({ transcript, metric });
    res.json(out);
  } catch (err) {
    const msg = err.message || "Classification failed.";
    if (/authentication|api.?key|authToken/i.test(msg)) {
      return res.status(500).json({
        error:
          "No Anthropic API key is configured. Set the ANTHROPIC_API_KEY environment variable (see README) and restart the server.",
      });
    }
    const status = err.status && err.status >= 400 ? 502 : 500;
    res.status(status).json({ error: msg });
  }
});

app.post("/api/statements/build", (req, res) => {
  const { result, metric, mapping, meeting, actor, model } = req.body || {};
  if (!result || !metric || !mapping || !meeting || !actor) {
    return res.status(400).json({ error: "result, metric, mapping, meeting, and actor are required." });
  }
  try {
    res.json({ statements: buildStatements({ result, metric, mapping, meeting, actor, model }) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/lrs/send", async (req, res) => {
  const { endpoint, username, password, statements } = req.body || {};
  if (!endpoint || !statements?.length) {
    return res.status(400).json({ error: "endpoint and statements are required." });
  }
  try {
    const out = await sendToLrs({ endpoint, username: username || "", password: password || "", statements });
    if (out.ok) {
      const ids = Array.isArray(out.body) ? out.body : [];
      appendLog(
        statements.map((s, i) => ({
          id: ids[i] || null,
          lrs: endpoint,
          storedAt: new Date().toISOString(),
          statement: s,
        }))
      );
    }
    res.status(out.ok ? 200 : 502).json(out);
  } catch (err) {
    res.status(502).json({ error: `Could not reach LRS: ${err.message}` });
  }
});

// --- dashboard data sources ---
app.get("/api/records", (_req, res) => {
  res.json({ source: "local", statements: readLog().map((e) => e.statement), entries: readLog() });
});

app.get("/api/lrs/query", async (req, res) => {
  const { endpoint, username = "", password = "", activity, verb, since, until, limit } = req.query;
  if (!endpoint) return res.status(400).json({ error: "endpoint is required." });
  try {
    const url = new URL(endpoint.replace(/\/+$/, "") + "/statements");
    if (activity) url.searchParams.set("activity", activity);
    if (verb) url.searchParams.set("verb", verb);
    if (since) url.searchParams.set("since", since);
    if (until) url.searchParams.set("until", until);
    url.searchParams.set("limit", String(Math.min(Number(limit) || 200, 500)));

    const auth = Buffer.from(`${username}:${password}`).toString("base64");
    const r = await fetch(url, {
      headers: {
        "X-Experience-API-Version": "1.0.3",
        Authorization: `Basic ${auth}`,
      },
    });
    const text = await r.text();
    if (!r.ok) return res.status(502).json({ error: `LRS returned HTTP ${r.status}: ${text.slice(0, 300)}` });
    const body = JSON.parse(text);
    // xAPI StatementResult is { statements: [...], more: "..." }; some test
    // servers return a bare array.
    const statements = Array.isArray(body) ? body : body.statements || [];
    res.json({ source: "lrs", statements, more: body.more || null });
  } catch (err) {
    res.status(502).json({ error: `Could not query LRS: ${err.message}` });
  }
});

const PORT = process.env.PORT || 3400;
app.listen(PORT, () => {
  console.log(`Meeting Metric → xAPI app running at http://localhost:${PORT}`);
});
