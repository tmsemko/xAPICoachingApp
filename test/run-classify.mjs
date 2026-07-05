#!/usr/bin/env node
// Local classification runner — no browser required.
//
//   node test/run-classify.mjs <transcript-file> [rubricKey|metricJsonFile]
//
// Mode:
//   LLM_MODE=local (default when no API key) -> offline heuristic
//   LLM_MODE=api  (needs ANTHROPIC_API_KEY)  -> real model
//
// Examples:
//   node test/run-classify.mjs test/fixtures/coaching-transcript.txt coaching
//   LLM_MODE=api CLASSIFIER_MODEL=claude-opus-4-8 \
//     node test/run-classify.mjs test/fixtures/coaching-transcript.txt coaching

import fs from "fs";
import { classifyTranscript } from "../lib/classify.js";
import { classifyLocally } from "../lib/localClassifier.js";
import { RUBRICS } from "../lib/rubrics.js";

const [, , transcriptPath, metricArg = "coaching"] = process.argv;
if (!transcriptPath) {
  console.error("usage: node test/run-classify.mjs <transcript-file> [rubricKey|metricJsonFile]");
  process.exit(1);
}

const transcript = fs.readFileSync(transcriptPath, "utf8");
const metric = RUBRICS[metricArg]
  ? RUBRICS[metricArg]
  : JSON.parse(fs.readFileSync(metricArg, "utf8"));

const HAS_CRED = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const mode = process.env.LLM_MODE || (HAS_CRED ? "api" : "local");

console.error(`\n[mode: ${mode}] [metric: ${metric.name}]\n`);

const out =
  mode === "local"
    ? classifyLocally({ transcript, metric })
    : await classifyTranscript({ transcript, metric });

// Human-readable summary to stderr, full JSON to stdout (pipe-friendly).
const r = out.result;
if (out.mode === "rubric") {
  console.error(`Overall: ${r.overall_classification}  (${Math.round(r.overall_score_scaled * 100)}%)  sentiment ${r.sentiment}`);
  console.error("Dimensions:");
  for (const d of r.dimensions) console.error(`  - ${d.name}: ${d.level} (${d.score_raw})`);
  console.error("Signals:", r.quantitative_signals.map((s) => `${s.label}=${s.value}${s.unit === "percent" ? "%" : ""}`).join(", "));
} else {
  console.error(`Classification: ${r.classification}  (${Math.round(r.score_scaled * 100)}%)`);
}
console.error(`Model: ${out.model}\n`);

console.log(JSON.stringify(out, null, 2));
