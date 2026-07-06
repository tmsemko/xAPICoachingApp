import { VERBS, ACTIVITY_TYPES, suggestStatementVerb } from "./catalog.js";

const VERB_ID_SET = new Set(VERBS.map((v) => v.id));
const ACTIVITY_TYPE_ID_SET = new Set(ACTIVITY_TYPES.map((t) => t.id));

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "meeting";

function verbObject(verbId) {
  const v = VERBS.find((x) => x.id === verbId);
  return { id: verbId, display: { "en-US": v ? v.display : verbId.split("/").pop() } };
}

// Per-statement verb resolution: the model's inline suggestion wins (if it is a
// valid catalog IRI), then the deterministic rule-based mapper, then the
// run-level verb the user chose. Guarantees a valid IRI on every statement.
function resolveVerb(suggested, ruleArgs, fallbackVerb) {
  if (suggested && VERB_ID_SET.has(suggested)) return suggested;
  return suggestStatementVerb(ruleArgs) || fallbackVerb;
}

function resolveActivityType(suggested, fallbackType) {
  return suggested && ACTIVITY_TYPE_ID_SET.has(suggested) ? suggested : fallbackType;
}

function agentFor({ name, email, homePage }) {
  const agent = { objectType: "Agent", name };
  if (email) agent.mbox = `mailto:${email}`;
  else agent.account = { homePage, name };
  return agent;
}

/**
 * Entry point — dispatches on result shape.
 * Rubric results (with a `dimensions` array) produce an overall statement plus
 * one statement per dimension; single-metric results use the original builder.
 */
export function buildStatements(args) {
  if (args.result && Array.isArray(args.result.dimensions)) return buildRubricStatements(args);
  return buildSingleStatements(args);
}

function buildRubricStatements({ result, metric, mapping, meeting, actor, model }) {
  const base = (mapping.customBase || "http://example.org/xapi").replace(/\/+$/, "");
  const ext = (suffix) => `${base}/extensions/${suffix}`;
  const meetingId = `${base}/activities/${slugify(meeting.title)}`;
  const timestamp = meeting.date ? new Date(meeting.date).toISOString() : new Date().toISOString();
  const category = mapping.profiles.map((id) => ({ objectType: "Activity", id }));
  const actorAgent = agentFor({ ...actor, homePage: base });

  const meetingObject = {
    objectType: "Activity",
    id: meetingId,
    definition: {
      type: mapping.activityType,
      name: { "en-US": meeting.title },
      description: { "en-US": `Evaluated against the multi-dimensional rubric "${metric.name}".` },
    },
  };

  const statements = [];

  // --- Overall statement ---
  statements.push({
    actor: actorAgent,
    verb: verbObject(mapping.verb),
    object: meetingObject,
    result: {
      score: { scaled: Math.max(0, Math.min(1, result.overall_score_scaled)) },
      response: result.summary,
      extensions: {
        "http://www.tincanapi.co.uk/extensions/result/classification": result.overall_classification,
        [ext("sentiment")]: result.sentiment,
        [ext("confidence")]: result.confidence,
      },
    },
    context: {
      contextActivities: { category },
      extensions: {
        [ext("metric-name")]: metric.name,
        [ext("model")]: model,
        [ext("rubric-dimensions")]: result.dimensions.map((d) => d.name),
        ...(result.topics?.length ? { "http://id.tincanapi.com/extension/topic": result.topics.join(", ") } : {}),
        ...quantSignalExtensions(result.quantitative_signals, ext),
      },
    },
    timestamp,
  });

  // --- One statement per dimension (each gets its own contextual verb) ---
  for (const d of result.dimensions) {
    const dimId = `${meetingId}/dimensions/${slugify(d.name)}`;
    const dimVerb = resolveVerb(d.suggested_verb, { kind: "dimension", name: d.name }, mapping.verb);
    const dimActivityType = resolveActivityType(d.suggested_activity_type, mapping.activityType);
    statements.push({
      actor: actorAgent,
      verb: verbObject(dimVerb),
      object: {
        objectType: "Activity",
        id: dimId,
        definition: {
          type: dimActivityType,
          name: { "en-US": `${meeting.title} — ${d.name}` },
          description: { "en-US": d.rationale },
        },
      },
      result: {
        score: { scaled: Math.max(0, Math.min(1, d.score_scaled)), raw: d.score_raw, min: 1, max: metric.levels.length },
        response: (d.evidence || []).map((e) => `"${e.quote}" — ${e.speaker}`).join(" | "),
        extensions: {
          "http://www.tincanapi.co.uk/extensions/result/classification": d.level,
          [ext("dimension")]: d.name,
          [ext("observed-behaviors")]: d.observed_behaviors,
          [ext("missing-behaviors")]: d.missing_behaviors,
        },
      },
      context: {
        contextActivities: {
          category,
          parent: [{ objectType: "Activity", id: meetingId }],
        },
        extensions: { [ext("metric-name")]: metric.name },
      },
      timestamp,
    });
  }

  return statements;
}

function quantSignalExtensions(signals, ext) {
  const out = {};
  for (const s of signals || []) out[ext(`signal/${slugify(s.label)}`)] = { value: s.value, unit: s.unit, note: s.note };
  return out;
}

/**
 * Build the xAPI statement set for one single-metric classification.
 *
 * mapping: { verb, activityType, profiles[], extensions[], customBase,
 *            includeParticipants, meetingKind }
 * meeting: { title, date }
 * actor:   { name, email }
 */
function buildSingleStatements({ result, metric, mapping, meeting, actor, model }) {
  const base = (mapping.customBase || "http://example.org/xapi").replace(/\/+$/, "");
  const ext = (suffix) => `${base}/extensions/${suffix}`;
  const activityId = `${base}/activities/${slugify(meeting.title)}`;
  const timestamp = meeting.date ? new Date(meeting.date).toISOString() : new Date().toISOString();
  const has = (id) => mapping.extensions.includes(id);

  const activityTypeDef = ACTIVITY_TYPES.find((t) => t.id === mapping.activityType);

  const object = {
    objectType: "Activity",
    id: activityId,
    definition: {
      type: mapping.activityType,
      name: { "en-US": meeting.title },
      description: {
        "en-US": `${activityTypeDef ? activityTypeDef.display : "Meeting"} analyzed against the metric "${metric.name}".`,
      },
    },
  };

  const category = mapping.profiles.map((id) => ({ objectType: "Activity", id }));

  // --- Primary evaluation statement ---
  const resultExtensions = {};
  if (has("http://www.tincanapi.co.uk/extensions/result/classification")) {
    resultExtensions["http://www.tincanapi.co.uk/extensions/result/classification"] =
      result.classification;
  }
  if (has("http://id.tincanapi.com/extension/quality-rating") && metric.scaleType === "numeric") {
    resultExtensions["http://id.tincanapi.com/extension/quality-rating"] = {
      rating: result.score_raw,
      min: metric.scaleMin,
      max: metric.scaleMax,
    };
  }
  resultExtensions[ext("sentiment")] = result.sentiment;
  resultExtensions[ext("confidence")] = result.confidence;

  const contextExtensions = {
    [ext("metric-name")]: metric.name,
    [ext("model")]: model,
  };
  if (metric.description) contextExtensions[ext("metric-definition")] = metric.description;
  if (has("http://id.tincanapi.com/extension/topic")) {
    contextExtensions["http://id.tincanapi.com/extension/topic"] = result.topics.join(", ");
  }
  if (has("http://id.tincanapi.com/extension/tags")) {
    contextExtensions["http://id.tincanapi.com/extension/tags"] = result.tags;
  }
  if (has("http://id.tincanapi.com/extension/powered-by")) {
    contextExtensions["http://id.tincanapi.com/extension/powered-by"] =
      "Meeting Metric Classifier (Claude)";
  }
  if (has("http://id.tincanapi.com/extension/severity")) {
    contextExtensions["http://id.tincanapi.com/extension/severity"] =
      result.score_scaled < 0.34 ? "high" : result.score_scaled < 0.67 ? "medium" : "low";
  }
  if (has("http://id.tincanapi.com/extension/feedback")) {
    contextExtensions["http://id.tincanapi.com/extension/feedback"] =
      result.recommendations.join(" ");
  }

  const scoreObj = { scaled: Math.max(0, Math.min(1, result.score_scaled)) };
  if (metric.scaleType === "numeric") {
    scoreObj.raw = result.score_raw;
    scoreObj.min = metric.scaleMin;
    scoreObj.max = metric.scaleMax;
  }

  const statements = [
    {
      actor: agentFor({ ...actor, homePage: base }),
      verb: verbObject(mapping.verb),
      object,
      result: {
        score: scoreObj,
        response: result.summary,
        extensions: resultExtensions,
      },
      context: {
        contextActivities: { category },
        extensions: contextExtensions,
      },
      timestamp,
    },
  ];

  // --- Per-participant statements (each gets its own contextual verb) ---
  if (mapping.includeParticipants) {
    for (const p of result.participants) {
      const pVerb = resolveVerb(
        p.suggested_verb,
        { kind: "participant", name: p.role || p.name, context: p.metric_note || p.contribution_summary || "" },
        "http://adlnet.gov/expapi/verbs/commented"
      );
      statements.push({
        actor: agentFor({ name: p.name, homePage: base }),
        verb: verbObject(pVerb),
        object,
        result: {
          response: p.contribution_summary,
          extensions: {
            [ext("sentiment")]: p.sentiment,
            [ext("metric-note")]: p.metric_note,
          },
        },
        context: {
          contextActivities: { category },
          extensions: { [ext("metric-name")]: metric.name },
        },
        timestamp,
      });
    }
  }

  return statements;
}

export async function sendToLrs({ endpoint, username, password, statements }) {
  const url = endpoint.replace(/\/+$/, "") + "/statements";
  const auth = Buffer.from(`${username}:${password}`).toString("base64");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Experience-API-Version": "1.0.3",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify(statements),
  });

  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, ok: res.ok, body };
}
