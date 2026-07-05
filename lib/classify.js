import Anthropic from "@anthropic-ai/sdk";
import { talkTime, interruptionSignals, parseTurns } from "./transcript.js";

// Zero-arg client: resolves ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, or an
// `ant auth login` profile from the environment.
const client = new Anthropic();

const MODEL = process.env.CLASSIFIER_MODEL || "claude-sonnet-5";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const PARTICIPANT_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    role: { type: "string", description: "Their role, e.g. 'Coach', 'Coachee', or '' if unknown." },
    contribution_summary: { type: "string", description: "1-2 sentences on their role in the discussion." },
    sentiment: { type: "number", description: "This participant's sentiment, -1..1." },
    metric_note: { type: "string", description: "How this participant related to the metric." },
  },
  required: ["name", "role", "contribution_summary", "sentiment", "metric_note"],
  additionalProperties: false,
};

const EVIDENCE_SCHEMA = {
  type: "object",
  properties: {
    quote: { type: "string", description: "Short verbatim quote from the transcript." },
    speaker: { type: "string", description: "Speaker name, or 'Unknown'." },
    significance: { type: "string", description: "Why this moment matters for the dimension." },
    polarity: { type: "string", enum: ["positive", "negative", "neutral"] },
  },
  required: ["quote", "speaker", "significance", "polarity"],
  additionalProperties: false,
};

// --- Single-metric mode (original) ---
const SINGLE_SCHEMA = {
  type: "object",
  properties: {
    classification: { type: "string", description: "The single label assigned on the user's metric scale." },
    score_scaled: { type: "number", description: "Result mapped onto 0..1 (0 worst, 1 best). Always provide." },
    score_raw: { type: "number", description: "Raw score on the metric's scale; ordinal label position for categorical." },
    confidence: { type: "number", description: "Confidence, 0..1." },
    sentiment: { type: "number", description: "Overall sentiment, -1..1." },
    summary: { type: "string", description: "3-5 sentence summary focused on the metric." },
    rationale: { type: "string", description: "Why this classification, citing transcript behavior." },
    topics: { type: "array", items: { type: "string" } },
    tags: { type: "array", items: { type: "string" } },
    key_moments: { type: "array", items: EVIDENCE_SCHEMA },
    participants: { type: "array", items: PARTICIPANT_SCHEMA },
    recommendations: { type: "array", items: { type: "string" } },
  },
  required: [
    "classification", "score_scaled", "score_raw", "confidence", "sentiment",
    "summary", "rationale", "topics", "tags", "key_moments", "participants", "recommendations",
  ],
  additionalProperties: false,
};

// --- Multi-dimensional rubric mode ---
function rubricSchema(metric) {
  const levelEnum = metric.levels;
  const dimNames = metric.dimensions.map((d) => d.name);
  return {
    type: "object",
    properties: {
      overall_classification: { type: "string", enum: levelEnum, description: "The overall/dominant level across dimensions." },
      overall_score_scaled: { type: "number", description: "Mean of the per-dimension scaled scores, 0..1." },
      confidence: { type: "number", description: "Overall confidence, 0..1." },
      sentiment: { type: "number", description: "Overall discussion sentiment, -1..1." },
      summary: { type: "string", description: "3-5 sentence overall summary." },
      dimensions: {
        type: "array",
        description: `Exactly one entry per rubric dimension, in this order: ${dimNames.join("; ")}.`,
        items: {
          type: "object",
          properties: {
            name: { type: "string", enum: dimNames, description: "Must match a rubric dimension name exactly." },
            level: { type: "string", enum: levelEnum },
            score_raw: { type: "integer", description: "1-based ordinal position of the level (1 = worst)." },
            score_scaled: { type: "number", description: "Level mapped onto 0..1 across the level scale." },
            rationale: { type: "string", description: "Why this level, referencing the level descriptors." },
            observed_behaviors: { type: "array", items: { type: "string" }, description: "Look-for behaviors that WERE present." },
            missing_behaviors: { type: "array", items: { type: "string" }, description: "Look-for behaviors that were ABSENT." },
            evidence: { type: "array", items: EVIDENCE_SCHEMA, description: "1-4 verbatim quotes supporting the level." },
          },
          required: ["name", "level", "score_raw", "score_scaled", "rationale", "observed_behaviors", "missing_behaviors", "evidence"],
          additionalProperties: false,
        },
      },
      quantitative_signals: {
        type: "array",
        description: "Computed measures relevant to a dimension (e.g. coach talk-time %). Reuse the provided facts.",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            value: { type: "number" },
            unit: { type: "string", description: "e.g. 'percent', 'count'." },
            note: { type: "string" },
          },
          required: ["label", "value", "unit", "note"],
          additionalProperties: false,
        },
      },
      participants: { type: "array", items: PARTICIPANT_SCHEMA },
      topics: { type: "array", items: { type: "string" } },
      tags: { type: "array", items: { type: "string" } },
      recommendations: { type: "array", items: { type: "string" } },
    },
    required: [
      "overall_classification", "overall_score_scaled", "confidence", "sentiment", "summary",
      "dimensions", "quantitative_signals", "participants", "topics", "tags", "recommendations",
    ],
    additionalProperties: false,
  };
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

function singleSystemPrompt(metric) {
  const scaleDesc =
    metric.scaleType === "numeric"
      ? `a numeric scale from ${metric.scaleMin} to ${metric.scaleMax}`
      : `these ordered categories (worst to best): ${metric.labels.join(" < ")}`;
  return [
    "You are a meeting-transcript analyst. You classify discussions against a single user-defined metric and extract sentiment and evidence.",
    "",
    "## The metric",
    `Name: ${metric.name}`,
    metric.description ? `Definition/rubric: ${metric.description}` : "",
    `Scale: ${scaleDesc}`,
    "",
    "## Rules",
    "- Classify strictly against the metric as defined.",
    "- Ground every judgment in the transcript. Quotes in key_moments must be verbatim.",
    "- For categorical scales, `classification` must be exactly one of the labels, and `score_raw` its 1-based position.",
    "- For numeric scales, `classification` is a short band label and `score_raw` the numeric value.",
    "- `score_scaled` always maps onto 0..1 across the full scale.",
  ]
    .filter(Boolean)
    .join("\n");
}

function rubricSystemPrompt(metric, facts) {
  const dims = metric.dimensions
    .map((d, i) => {
      const levels = metric.levels
        .map((lvl) => `    - ${lvl}: ${d.levels[lvl]}`)
        .join("\n");
      return [
        `### ${i + 1}. ${d.name}`,
        `Definition: ${d.definition}`,
        `Look-fors: ${d.lookFors}`,
        `Levels:`,
        levels,
      ].join("\n");
    })
    .join("\n\n");

  return [
    "You are an expert coaching-conversation analyst. You evaluate a transcript against a MULTI-DIMENSIONAL rubric, scoring each dimension independently with verbatim evidence.",
    "",
    `## Rubric: ${metric.name}`,
    `Level scale (worst to best): ${metric.levels.join(" < ")}`,
    "",
    dims,
    "",
    "## Pre-computed facts (deterministic — use these, do not re-estimate)",
    facts,
    "",
    "## Rules",
    "- Score EACH dimension independently. A transcript can be Advanced on one dimension and Needs Improvement on another — do not let an overall impression flatten the scores.",
    "- Judge a dimension by its own descriptor, not by who is doing the work. (E.g. domain/tool integration is scored on the quality of the integration even if the coach, not the coachee, produces it.)",
    "- Every `level` must be exactly one of the level names. `score_raw` is its 1-based position (1 = worst).",
    "- Provide verbatim `evidence` quotes for every dimension, and list observed vs. missing look-for behaviors.",
    "- Populate `quantitative_signals` from the pre-computed facts (e.g. coach talk-time %). Reference the relevant signal in that dimension's rationale.",
    "- `recommendations` must target the lowest-scoring dimensions with concrete, behavioral next steps.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Pre-computed facts block (shared with the local classifier)
// ---------------------------------------------------------------------------

export function computeFacts(transcript) {
  const tt = talkTime(transcript);
  const turns = parseTurns(transcript);
  const coach = tt.speakers[0]?.speaker; // first/most-talkative speaker heuristic
  const interruptions = interruptionSignals(transcript, coach);
  return {
    talkTime: tt,
    coach,
    interruptions,
    turnCount: turns.length,
  };
}

function factsBlock(facts) {
  const shares = facts.talkTime.speakers.map((s) => `${s.speaker}: ${s.pct}% (${s.words} words)`).join("; ");
  return [
    `- Speakers & talk-time share: ${shares}`,
    `- Assumed coach (most talk-time): ${facts.coach}`,
    `- Coach talk-time: ${facts.talkTime.speakers[0]?.pct}%`,
    `- Detected interruptions by the coach: ${facts.interruptions}`,
    `- Total turns: ${facts.turnCount}`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function classifyTranscript({ transcript, metric }) {
  const isRubric = metric.mode === "rubric" || Array.isArray(metric.dimensions);
  const facts = computeFacts(transcript);
  const schema = isRubric ? rubricSchema(metric) : SINGLE_SCHEMA;
  const system = isRubric
    ? rubricSystemPrompt(metric, factsBlock(facts))
    : singleSystemPrompt(metric);

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    // The rubric/system prompt is identical across every transcript, so cache
    // it — subsequent classifications read it at ~0.1x instead of full price.
    // (Only caches once the prefix clears the model's minimum; harmless below.)
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    output_config: { format: { type: "json_schema", schema } },
    messages: [
      {
        role: "user",
        content: `Analyze the following transcript against "${metric.name}".\n\n<transcript>\n${transcript}\n</transcript>`,
      },
    ],
  });

  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new Error("The model declined to analyze this transcript.");
  if (message.stop_reason === "max_tokens") throw new Error("The analysis was truncated (max_tokens). Try a shorter transcript.");

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock) throw new Error("No analysis text returned by the model.");

  return {
    mode: isRubric ? "rubric" : "single",
    result: JSON.parse(textBlock.text),
    facts,
    model: message.model,
    usage: message.usage,
  };
}
