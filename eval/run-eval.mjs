#!/usr/bin/env node
// Model evaluation harness.
//
// Scores a classifier run against gold labels: per-dimension exact-match
// accuracy, adjacent-match (off-by-one level) accuracy, overall-level match,
// and the talk-time signal within tolerance. Run the SAME eval across models
// to pick the cheapest one that clears your accuracy bar.
//
//   # offline heuristic baseline (no key)
//   LLM_MODE=local node eval/run-eval.mjs
//
//   # a real model
//   LLM_MODE=api CLASSIFIER_MODEL=claude-sonnet-5 node eval/run-eval.mjs
//   LLM_MODE=api CLASSIFIER_MODEL=claude-opus-4-8  node eval/run-eval.mjs
//   LLM_MODE=api CLASSIFIER_MODEL=claude-haiku-4-5 node eval/run-eval.mjs
//
// Sweep several models and append each scorecard to eval/results.jsonl.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { classifyTranscript } from "../lib/classify.js";
import { classifyLocally } from "../lib/localClassifier.js";
import { RUBRICS } from "../lib/rubrics.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const HAS_CRED = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const mode = process.env.LLM_MODE || (HAS_CRED ? "api" : "local");
const model = mode === "local" ? "local-heuristic" : process.env.CLASSIFIER_MODEL || "claude-sonnet-5";

const goldDir = path.join(here, "gold");
const goldFiles = fs.readdirSync(goldDir).filter((f) => f.endsWith(".json"));

function levelIndex(levels, name) {
  return levels.indexOf(name);
}

async function runOne(goldFile) {
  const gold = JSON.parse(fs.readFileSync(path.join(goldDir, goldFile), "utf8"));
  const metric = RUBRICS[gold.rubric];
  const transcript = fs.readFileSync(path.join(root, gold.transcript), "utf8");

  const started = Date.now();
  const out =
    mode === "local"
      ? classifyLocally({ transcript, metric })
      : await classifyTranscript({ transcript, metric });
  const ms = Date.now() - started;

  const r = out.result;
  const byName = Object.fromEntries(r.dimensions.map((d) => [d.name, d.level]));

  let exact = 0,
    adjacent = 0,
    total = 0;
  const perDim = {};
  for (const [dim, goldLevel] of Object.entries(gold.gold.dimensions)) {
    total++;
    const got = byName[dim];
    const gi = levelIndex(metric.levels, goldLevel);
    const pi = levelIndex(metric.levels, got);
    const isExact = got === goldLevel;
    const isAdj = pi >= 0 && Math.abs(pi - gi) <= 1;
    if (isExact) exact++;
    if (isAdj) adjacent++;
    perDim[dim] = { gold: goldLevel, got, exact: isExact };
  }

  const overallMatch = r.overall_classification === gold.gold.overall_classification;

  const ttGold = gold.gold.signals?.coach_talk_time_pct;
  const ttSignal = (r.quantitative_signals || []).find((s) => /talk.?time/i.test(s.label));
  const ttOk =
    ttGold && ttSignal ? Math.abs(ttSignal.value - ttGold.expected) <= ttGold.tolerance : null;

  const usage = out.usage
    ? { input: out.usage.input_tokens, output: out.usage.output_tokens }
    : null;

  return {
    fixture: goldFile,
    model,
    mode,
    ms,
    dimension_exact_accuracy: +(exact / total).toFixed(3),
    dimension_adjacent_accuracy: +(adjacent / total).toFixed(3),
    overall_match: overallMatch,
    talk_time_within_tolerance: ttOk,
    perDim,
    usage,
  };
}

const scorecards = [];
for (const f of goldFiles) scorecards.push(await runOne(f));

// Print
for (const sc of scorecards) {
  console.log(`\n=== ${sc.fixture} — ${sc.model} (${sc.mode}) ===`);
  console.log(`  dimension exact accuracy : ${(sc.dimension_exact_accuracy * 100).toFixed(0)}%`);
  console.log(`  dimension adjacent (±1)  : ${(sc.dimension_adjacent_accuracy * 100).toFixed(0)}%`);
  console.log(`  overall level match      : ${sc.overall_match ? "yes" : "no"}`);
  console.log(`  talk-time within tol.    : ${sc.talk_time_within_tolerance == null ? "n/a" : sc.talk_time_within_tolerance ? "yes" : "no"}`);
  console.log(`  latency                  : ${sc.ms} ms`);
  if (sc.usage) console.log(`  tokens                   : in ${sc.usage.input} / out ${sc.usage.output}`);
  console.log("  per-dimension:");
  for (const [dim, v] of Object.entries(sc.perDim)) {
    console.log(`    ${v.exact ? "✓" : "✗"} ${dim}: gold=${v.gold} got=${v.got}`);
  }
}

// Append to results log for cross-model comparison.
const logPath = path.join(here, "results.jsonl");
fs.appendFileSync(
  logPath,
  scorecards.map((s) => JSON.stringify({ ...s, ts: new Date().toISOString() })).join("\n") + "\n"
);
console.log(`\nAppended ${scorecards.length} scorecard(s) to eval/results.jsonl`);
