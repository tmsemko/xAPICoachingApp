# Model selection — optimizing API calls for rubric classification

Goal: pick the **cheapest model that clears the accuracy bar** on the judgment
sub-skill (S1 in `classifier-skill.md`), and cut token cost around it.

> This is a reasoned starting point plus a runnable eval to confirm it. Do not
> ship a model choice on vibes — run `eval/run-eval.mjs` across the candidates
> (needs an API key) and let per-dimension accuracy decide. The offline
> heuristic already scores 100% on the one gold fixture, but that fixture is a
> clear-cut case; build a gold set of 15–30 varied transcripts (including
> borderline Developing sessions) before trusting any number.

## Candidates

| Model | Input / Output ($/1M) | Fit for this skill |
|-------|----------------------|--------------------|
| **Claude Sonnet 5** | $3 / $15 (intro $2 / $10 through 2026-08-31) | **Recommended default.** Near-Opus reasoning on this class of task, supports structured outputs + adaptive thinking, ~½–⅓ the cost of Opus. The intro pricing makes it especially attractive now. |
| Claude Opus 4.8 | $5 / $25 | **Accuracy ceiling / adjudicator.** Use when Sonnet 5 misses the dimension-3-style nuance in eval, or to grade a low-confidence sample. |
| Claude Haiku 4.5 | $1 / $5 | **Triage tier.** Cheapest; likely fine on clearly-good / clearly-bad sessions but risks flattening the split cases. Only use behind confidence-gated escalation, and only if eval says it clears the bar. |
| Claude Fable 5 | $10 / $50 | **Not for the request path.** This is a single-shot bounded judgment, not long-horizon agentic work — Fable's premium doesn't buy enough over Opus 4.8 here. Reserve it for *building the gold set* (adjudicating human/model disagreements). |

**Why not just always use the biggest model?** The whole reason to define the
skill (S1–S5) was to shrink what the model must do. With talk-time and
interruptions computed in code, the residual judgment is well within Sonnet 5's
range — so paying Opus/Fable rates per call is spending on capability the task
no longer needs. Confirm with eval, then default down.

## Recommended configuration

```
CLASSIFIER_MODEL=claude-sonnet-5      # default (set in lib/classify.js)
# escalate to claude-opus-4-8 on low confidence (see below)
```

Effort: this is a bounded task — run at `medium` or `high`, not `xhigh`/`max`.
Sweep `low`/`medium`/`high` in eval; higher effort rarely moves per-dimension
accuracy here and costs tokens.

## Optimization levers (in priority order)

1. **Offload quantitative work to code (done).** `lib/transcript.js` computes
   talk-time, interruptions, and speaker share; the prompt hands them over as
   facts. Fewer tokens, better accuracy on the two talk-time-dependent
   dimensions, and it lets a cheaper model succeed.
2. **Structured outputs (done).** `json_schema` guarantees the shape — no
   free-form parsing, no retry-on-malformed-JSON cost.
3. **Cache the rubric prompt (done).** The system prompt is identical across
   every transcript; `cache_control` on it means each classification after the
   first reads it at ~0.1×. Biggest win at volume. (Caches only once the prefix
   clears the model's minimum — 2048 tokens on Sonnet 5; add few-shot examples
   to the stable prefix if you want to guarantee it caches.)
4. **One call, all five dimensions (done).** The transcript is read once and all
   dimensions scored together. Do **not** split into five calls — that re-reads
   the transcript 5× and multiplies input cost.
5. **Confidence-gated escalation (opt-in).** Run Haiku 4.5 or Sonnet 5 first; if
   `result.confidence` is below a threshold (say 0.6) or dimensions disagree
   with the code signals, re-run that transcript on Opus 4.8. Most transcripts
   never escalate.
6. **Batch API for backfills.** Classifying an archive of past meetings is not
   latency-sensitive → the Message Batches API runs it at 50% off.

## How to actually decide (with a key)

```bash
LLM_MODE=api CLASSIFIER_MODEL=claude-haiku-4-5 node eval/run-eval.mjs
LLM_MODE=api CLASSIFIER_MODEL=claude-sonnet-5   node eval/run-eval.mjs
LLM_MODE=api CLASSIFIER_MODEL=claude-opus-4-8   node eval/run-eval.mjs
```

Each run appends a scorecard (accuracy + latency + token usage) to
`eval/results.jsonl`. Pick the cheapest model whose **per-dimension exact
accuracy** meets your bar (recommend ≥ 0.9) **and** that gets the dimension-3
split right on the coaching fixture. Then set `CLASSIFIER_MODEL` accordingly.
