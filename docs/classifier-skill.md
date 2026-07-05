# Skill definition — Transcript Rubric Classification

This is the capability contract for the LLM in this app. It defines what the
model is asked to do, what it must NOT do (because code does it better/cheaper),
and the output contract. Use it to write prompts, pick models, and build evals.

## The skill, in one sentence

> Given a conversation transcript and a multi-dimensional rubric, assign each
> dimension an independent performance level with verbatim evidence, and produce
> an overall roll-up with sentiment and actionable recommendations.

## Decomposition into sub-skills

The system's work is deliberately split. Only the judgment sub-skill needs a
strong (expensive) model; the rest is done in code or is cheap.

| # | Sub-skill | Owner | Why | Model sensitivity |
|---|-----------|-------|-----|-------------------|
| S1 | **Rubric judgment** — score each dimension against its descriptors, independently | **LLM** | Requires reading comprehension + nuance (a session can be Advanced on one dimension, Needs Improvement on the rest) | **High** — this is the model-selection driver |
| S2 | **Verbatim evidence extraction** — pull exact quotes that justify each level | **LLM** | Grounding; must be verbatim | Medium |
| S3 | **Summary + recommendations** — narrative roll-up targeting weak dimensions | **LLM** | Moderate generation task | Low–Medium |
| S4 | **Quantitative signals** — talk-time %, interruption count, speaker parsing | **Code** (`lib/transcript.js`) | Deterministic; LLMs estimate these unreliably and it wastes tokens | N/A (removed from the model's job) |
| S5 | **xAPI vocabulary mapping** — verb / activity type / profile / extensions | **Code** (`lib/catalog.js`) | Rule-based over a fixed registry | N/A |

**Key design decision:** S4 is computed in code and handed to the model as
*facts* ("Coach talk-time: 72%") inside the prompt. This both improves accuracy
on the talk-time-dependent dimensions (Coachee-Led Problem Solving, Psychological
Safety) and lets a cheaper model succeed, because it no longer has to count.

## Input contract

```
{
  transcript: string,              // speaker-labelled dialogue
  metric: {
    name, mode: "rubric",
    levels: [worst … best],        // e.g. ["Needs Improvement","Developing","Advanced"]
    dimensions: [
      { name, definition, lookFors, levels: { <levelName>: descriptor } }
    ]
  }
}
```

## Output contract (S1–S3)

One object; one entry per dimension, in rubric order:

```
{
  overall_classification: <one of levels>,
  overall_score_scaled: 0..1,
  confidence: 0..1,
  sentiment: -1..1,
  summary: string,
  dimensions: [{
    name, level, score_raw (1-based), score_scaled (0..1),
    rationale, observed_behaviors[], missing_behaviors[],
    evidence: [{ quote (verbatim), speaker, significance, polarity }]
  }],
  quantitative_signals: [{ label, value, unit, note }],  // reuses S4 facts
  participants[], topics[], tags[], recommendations[]
}
```

Enforced with structured outputs (`output_config.format` + `json_schema`), so
the shape is guaranteed and there is no parse-retry cost.

## Behavioral requirements (the hard part — S1)

1. **Score each dimension independently.** Do not let an overall impression
   flatten the scores. The canonical test case is a directive coaching session
   that is nonetheless *Advanced* on domain/tool integration.
2. **Judge by the descriptor, not by who did the work.** Domain integration is
   scored on the quality of the integration even when the coach (not the
   coachee) produces it.
3. **Ground every level in verbatim quotes.** No paraphrase in `evidence.quote`.
4. **Use the provided quantitative facts;** do not re-estimate talk-time.
5. **Recommendations target the lowest-scoring dimensions** with concrete,
   behavioral next steps.

## Evaluation

`eval/run-eval.mjs` scores a run against `eval/gold/*.json`:
- per-dimension exact-match accuracy (the primary metric),
- adjacent (±1 level) accuracy,
- overall-level match,
- talk-time signal within tolerance.

The gold set's load-bearing property: a model that flattens all five dimensions
to one level fails, even if that level is "mostly right." That is exactly the
nuance we are paying the model for.
