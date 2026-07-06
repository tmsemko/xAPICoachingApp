// Offline, deterministic classifier for local testing without an API key.
// It is NOT as nuanced as the model — it uses talk-time + keyword/pattern
// heuristics — but it produces schema-valid output so the full pipeline
// (classify -> map -> send -> dashboard) can be exercised, and it gets the
// obvious cases right. Enable with LLM_MODE=local.

import { computeFacts } from "./classify.js";
import { parseTurns } from "./transcript.js";
import { suggestStatementVerb } from "./catalog.js";

const LEADING_Q = /\b(don'?t you (think|agree)|shouldn'?t we|is it because|wouldn'?t (it|you)|right\?|,?\s*right\b|don'?t you\?)/gi;
const OPEN_Q = /\b(what|how|why)\b[^?]*\?/gi;
const DOMAIN_TERMS =
  /\b(conversion|psychographic|behavioral segmentation|calculated field|data blend|cross-database join|dimension|CRM|Shopify|Tableau|segment|intent|CPG|dashboard)\b/gi;
const INTERRUPT = /\(interrupt/gi;
const CAPACITY = /\b(other deadlines|i'?m busy|capacity|too much|no time|swamped|already have)\b/gi;
const IMPOSED = /\b(right now|by \d{1,2}\s*(am|pm|:\d\d)|jump into|just \w+ the|email me)\b/gi;
const AFFIRM = /\b(clean dashboards|good (job|work)|nice work|well done|i appreciate|that'?s great work|you did (a )?(good|great)|nicely)\b/gi;

const clampSent = (v) => Math.max(-1, Math.min(1, v));

function heuristicSentiment(text) {
  const pos = (text.match(/\b(great|awesome|perfect|good|thanks|excellent|agree|yes|makes sense)\b/gi) || []).length;
  const neg = (text.match(/\b(flat|disappointed|problem|fail|broad|generic|too|but|roadblock|can'?t|worried)\b/gi) || []).length;
  const total = pos + neg || 1;
  return clampSent((pos - neg) / total);
}

// Map a level name to its 1-based ordinal + 0..1 scaled position.
function levelScore(levels, level) {
  const idx = levels.indexOf(level);
  return { raw: idx + 1, scaled: levels.length > 1 ? idx / (levels.length - 1) : 0 };
}

function pick(levels, want) {
  // want: "low" | "mid" | "high" -> worst | middle | best
  if (want === "high") return levels[levels.length - 1];
  if (want === "mid") return levels[Math.floor((levels.length - 1) / 2)];
  return levels[0];
}

function evidenceFor(turns, re, polarity, limit = 2) {
  const out = [];
  for (const t of turns) {
    if (re.test(t.text)) {
      out.push({ quote: t.text.slice(0, 160), speaker: t.speaker, significance: "Pattern-matched by the offline heuristic.", polarity });
      re.lastIndex = 0;
      if (out.length >= limit) break;
    }
    re.lastIndex = 0;
  }
  return out;
}

function scoreDimension(dim, ctx) {
  const { levels } = ctx.metric;
  const turns = ctx.turns;
  const coachTurns = turns.filter((t) => t.speaker === ctx.facts.coach);
  const coachText = coachTurns.map((t) => t.text).join(" ");
  let want = "mid";
  let observed = [];
  let missing = [];
  let evidence = [];

  const name = dim.name.toLowerCase();

  if (name.includes("questioning")) {
    const leading = (coachText.match(LEADING_Q) || []).length;
    const open = (coachText.match(OPEN_Q) || []).length;
    want = leading > open * 2 ? "low" : open > leading ? "high" : "mid";
    (leading ? missing : observed).push("open-ended What/How/Why questions");
    if (leading) observed.push(`${leading} leading/binary question patterns`);
    evidence = evidenceFor(coachTurns, LEADING_Q, "negative");
  } else if (name.includes("problem solving")) {
    const coachPct = ctx.facts.talkTime.speakers[0]?.pct ?? 50;
    want = coachPct > 60 ? "low" : coachPct > 40 ? "mid" : "high";
    observed.push(`coach talk-time ${coachPct}%`);
    if (coachPct >= 30) missing.push("coach speaking under 30%");
    evidence = coachTurns.slice(0, 2).map((t) => ({ quote: t.text.slice(0, 160), speaker: t.speaker, significance: "Coach-driven turn.", polarity: "negative" }));
  } else if (name.includes("domain") || name.includes("tool")) {
    const terms = new Set((ctx.full.match(DOMAIN_TERMS) || []).map((s) => s.toLowerCase()));
    want = terms.size >= 6 ? "high" : terms.size >= 3 ? "mid" : "low";
    observed.push(`${terms.size} distinct domain/tool terms: ${[...terms].slice(0, 8).join(", ")}`);
    evidence = evidenceFor(coachTurns, DOMAIN_TERMS, "positive");
  } else if (name.includes("safety") || name.includes("listening")) {
    const interruptions = ctx.facts.interruptions;
    const affirms = (ctx.full.match(AFFIRM) || []).length;
    want = interruptions >= 2 && affirms === 0 ? "low" : interruptions >= 1 || affirms === 0 ? "mid" : "high";
    if (interruptions) observed.push(`${interruptions} interruptions`);
    if (!affirms) missing.push("validation of the coachee's work (e.g. 'clean dashboards')");
    evidence = evidenceFor(turns, INTERRUPT, "negative");
  } else if (name.includes("action") || name.includes("accountability")) {
    const imposed = (coachText.match(IMPOSED) || []).length;
    const capacityFlag = CAPACITY.test(ctx.full);
    CAPACITY.lastIndex = 0;
    want = imposed >= 1 && capacityFlag ? "low" : imposed >= 1 ? "mid" : "mid";
    if (imposed) observed.push("specific action items and a deadline");
    if (capacityFlag) missing.push("verifying the coachee's capacity before committing");
    evidence = evidenceFor(coachTurns, IMPOSED, "negative");
  }

  const level = pick(levels, want);
  const s = levelScore(levels, level);
  return {
    name: dim.name,
    level,
    score_raw: s.raw,
    score_scaled: s.scaled,
    rationale: `Offline heuristic: ${observed.join("; ") || "no strong signals"}.`,
    observed_behaviors: observed,
    missing_behaviors: missing,
    evidence: evidence.length ? evidence : [{ quote: coachTurns[0]?.text.slice(0, 120) || "", speaker: ctx.facts.coach || "Unknown", significance: "Representative turn.", polarity: "neutral" }],
    suggested_verb: suggestStatementVerb({ kind: "dimension", name: dim.name }),
    suggested_activity_type: null,
  };
}

export function classifyLocally({ transcript, metric }) {
  const facts = computeFacts(transcript);
  const turns = parseTurns(transcript);
  const full = transcript;
  const sentiment = heuristicSentiment(full);

  const participants = facts.talkTime.speakers.map((s, i) => {
    const role = i === 0 ? "Coach (assumed)" : "Coachee";
    const metric_note = i === 0 ? "Drove the conversation." : "Responded to the coach.";
    return {
      name: s.speaker,
      role,
      contribution_summary: `${s.pct}% of talk-time across ${turns.filter((t) => t.speaker === s.speaker).length} turns.`,
      sentiment: heuristicSentiment(turns.filter((t) => t.speaker === s.speaker).map((t) => t.text).join(" ")),
      metric_note,
      suggested_verb: suggestStatementVerb({ kind: "participant", name: role, context: metric_note }),
      suggested_activity_type: metric.activityTypeHint || "http://adlnet.gov/expapi/activities/meeting",
    };
  });

  const topicsRaw = [...new Set((full.match(DOMAIN_TERMS) || []).map((s) => s.toLowerCase()))].slice(0, 8);

  if (metric.mode === "rubric" || Array.isArray(metric.dimensions)) {
    const ctx = { metric, turns, facts, full };
    const dimensions = metric.dimensions.map((d) => scoreDimension(d, ctx));
    const avg = dimensions.reduce((a, d) => a + d.score_scaled, 0) / dimensions.length;
    const overallLevel = pick(metric.levels, avg > 0.66 ? "high" : avg > 0.33 ? "mid" : "low");
    return {
      mode: "rubric",
      model: "local-heuristic",
      facts,
      usage: null,
      result: {
        overall_classification: overallLevel,
        overall_score_scaled: Number(avg.toFixed(3)),
        confidence: 0.55,
        sentiment,
        summary: `Offline heuristic classification across ${dimensions.length} dimensions. Coach talk-time ${facts.talkTime.speakers[0]?.pct}%, ${facts.interruptions} interruptions detected. NOT a substitute for the model — for pipeline testing only.`,
        dimensions,
        quantitative_signals: [
          { label: "coach_talk_time", value: facts.talkTime.speakers[0]?.pct ?? 0, unit: "percent", note: `Speaker: ${facts.coach}` },
          { label: "interruptions", value: facts.interruptions, unit: "count", note: "Detected via stage directions / cut-off dashes." },
        ],
        participants,
        topics: topicsRaw,
        tags: topicsRaw.slice(0, 4),
        recommendations: dimensions
          .filter((d) => d.score_scaled < 0.5)
          .map((d) => `Improve "${d.name}": address ${d.missing_behaviors[0] || "the gaps noted"}.`),
      },
    };
  }

  // Single-metric fallback
  const labels = metric.scaleType === "numeric" ? null : metric.labels;
  const scaled = 0.5;
  return {
    mode: "single",
    model: "local-heuristic",
    facts,
    usage: null,
    result: {
      classification: labels ? labels[Math.floor(labels.length / 2)] : String(Math.round(((metric.scaleMin + metric.scaleMax) / 2))),
      score_scaled: scaled,
      score_raw: labels ? Math.ceil(labels.length / 2) : Math.round((metric.scaleMin + metric.scaleMax) / 2),
      confidence: 0.4,
      sentiment,
      summary: "Offline heuristic classification (midpoint) — for pipeline testing only.",
      rationale: "The offline classifier does not judge free-form single metrics; it returns a neutral midpoint.",
      topics: topicsRaw,
      tags: topicsRaw.slice(0, 4),
      key_moments: turns.slice(0, 3).map((t) => ({ quote: t.text.slice(0, 140), speaker: t.speaker, significance: "Sampled turn.", polarity: "neutral" })),
      participants,
      recommendations: ["Run with a live model (LLM_MODE=api) for a substantive single-metric classification."],
    },
  };
}
