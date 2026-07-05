// Curated xAPI vocabulary catalog.
// Every IRI below was verified against the canonical profile JSON-LD files in
// https://github.com/adlnet/xapi-authored-profiles (adl, acrossx, tincan),
// the same data served by the ADL Profile Server and tools.xapi.ly.

export const PROFILES = [
  {
    id: "https://w3id.org/xapi/adl",
    name: "ADL Vocabulary",
    description:
      "The core ADL verb and activity-type vocabulary. Home of the canonical 'meeting' activity type and everyday verbs (attended, commented, asked, answered, shared).",
    bestFor: ["meeting", "general"],
  },
  {
    id: "https://w3id.org/xapi/acrossx",
    name: "AcrossX Profile",
    description:
      "Social and collaborative learning profile. Defines 'evaluated', discussion activity types (face-to-face-discussion, online-discussion, collaboration) and rubric/feedback extensions.",
    bestFor: ["discussion", "evaluation", "collaboration"],
  },
  {
    id: "https://registry.tincanapi.com",
    name: "TinCan Registry",
    description:
      "The broad community registry. Rich set of discussion/communication concepts (discussion, chat-message, webinar, rated, reviewed, mentioned) and metadata extensions (topic, tags, quality-rating, classification, powered-by).",
    bestFor: ["discussion", "chat", "webinar", "metadata"],
  },
];

export const VERBS = [
  { id: "https://w3id.org/xapi/acrossx/verbs/evaluated", display: "evaluated", profile: "https://w3id.org/xapi/acrossx", hint: "The metric-based evaluation of the meeting or a participant. Best default for the analysis statement." },
  { id: "http://adlnet.gov/expapi/verbs/commented", display: "commented", profile: "https://w3id.org/xapi/adl", hint: "A participant offered a comment during the discussion." },
  { id: "http://adlnet.gov/expapi/verbs/attended", display: "attended", profile: "https://w3id.org/xapi/adl", hint: "A participant attended the meeting (attendance/participation statements)." },
  { id: "http://adlnet.gov/expapi/verbs/asked", display: "asked", profile: "https://w3id.org/xapi/adl", hint: "A participant asked a question." },
  { id: "http://adlnet.gov/expapi/verbs/answered", display: "answered", profile: "https://w3id.org/xapi/adl", hint: "A participant answered a question." },
  { id: "http://adlnet.gov/expapi/verbs/shared", display: "shared", profile: "https://w3id.org/xapi/adl", hint: "A participant shared a resource or idea." },
  { id: "http://adlnet.gov/expapi/verbs/interacted", display: "interacted", profile: "https://w3id.org/xapi/adl", hint: "Generic interaction when no specific verb fits." },
  { id: "http://id.tincanapi.com/verb/reviewed", display: "reviewed", profile: "https://registry.tincanapi.com", hint: "The transcript/meeting was reviewed (softer than 'evaluated' — no judgment implied)." },
  { id: "http://id.tincanapi.com/verb/rated", display: "rated", profile: "https://registry.tincanapi.com", hint: "A numeric or scaled rating was assigned. Pair with result.score and the quality-rating extension." },
  { id: "http://id.tincanapi.com/verb/mentioned", display: "mentioned", profile: "https://registry.tincanapi.com", hint: "A participant mentioned a topic or person." },
  { id: "http://id.tincanapi.com/verb/talked-with", display: "talked with", profile: "https://registry.tincanapi.com", hint: "Two participants held a conversation." },
  { id: "http://id.tincanapi.com/verb/adjourned", display: "adjourned", profile: "https://registry.tincanapi.com", hint: "The meeting was closed/adjourned." },
  { id: "http://adlnet.gov/expapi/verbs/experienced", display: "experienced", profile: "https://w3id.org/xapi/adl", hint: "Fallback verb when nothing else fits." },
];

export const ACTIVITY_TYPES = [
  { id: "http://adlnet.gov/expapi/activities/meeting", display: "meeting", profile: "https://w3id.org/xapi/adl", hint: "The canonical meeting activity type. Best default object for a meeting transcript." },
  { id: "http://id.tincanapi.com/activitytype/discussion", display: "discussion", profile: "https://registry.tincanapi.com", hint: "A discussion — good when the transcript is an open-ended conversation rather than a formal meeting." },
  { id: "https://w3id.org/xapi/acrossx/activities/face-to-face-discussion", display: "face-to-face discussion", profile: "https://w3id.org/xapi/acrossx", hint: "An in-person discussion." },
  { id: "https://w3id.org/xapi/acrossx/activities/online-discussion", display: "online discussion", profile: "https://w3id.org/xapi/acrossx", hint: "A remote/virtual discussion (video call, chat thread)." },
  { id: "https://w3id.org/xapi/acrossx/activities/collaboration", display: "collaboration", profile: "https://w3id.org/xapi/acrossx", hint: "A collaborative working session." },
  { id: "http://id.tincanapi.com/activitytype/webinar", display: "webinar", profile: "https://registry.tincanapi.com", hint: "A webinar or broadcast-style session." },
  { id: "http://id.tincanapi.com/activitytype/conference-session", display: "conference session", profile: "https://registry.tincanapi.com", hint: "A session within a larger conference." },
  { id: "http://id.tincanapi.com/activitytype/chat-message", display: "chat message", profile: "https://registry.tincanapi.com", hint: "A single chat message (per-utterance statements)." },
  { id: "http://id.tincanapi.com/activitytype/tutor-session", display: "tutor session", profile: "https://registry.tincanapi.com", hint: "A 1:1 tutoring or coaching session." },
];

export const EXTENSIONS = [
  { id: "http://id.tincanapi.com/extension/topic", display: "topic", location: "context", profile: "https://registry.tincanapi.com", hint: "The main topic(s) discussed. Filled from the classification's detected topics." },
  { id: "http://id.tincanapi.com/extension/tags", display: "tags", location: "context", profile: "https://registry.tincanapi.com", hint: "Free-form tags/themes detected in the discussion." },
  { id: "http://id.tincanapi.com/extension/powered-by", display: "powered by", location: "context", profile: "https://registry.tincanapi.com", hint: "Identifies the AI tool that produced the analysis. Recommended for transparency." },
  { id: "http://id.tincanapi.com/extension/observer", display: "observer", location: "context", profile: "https://registry.tincanapi.com", hint: "The agent who observed/analyzed the activity (useful when the AI is the observer)." },
  { id: "http://id.tincanapi.com/extension/quality-rating", display: "quality rating", location: "result", profile: "https://registry.tincanapi.com", hint: "The metric rating as a structured value (rating + scale min/max)." },
  { id: "http://www.tincanapi.co.uk/extensions/result/classification", display: "classification", location: "result", profile: "https://registry.tincanapi.com", hint: "The classification label assigned by the metric (e.g. 'constructive', 'high psychological safety')." },
  { id: "http://id.tincanapi.com/extension/severity", display: "severity", location: "context", profile: "https://registry.tincanapi.com", hint: "Severity level — useful for compliance or risk-focused metrics." },
  { id: "http://id.tincanapi.com/extension/feedback", display: "feedback", location: "context", profile: "https://registry.tincanapi.com", hint: "Narrative feedback/recommendations from the analysis." },
  { id: "http://id.tincanapi.com/extension/duration", display: "duration", location: "result", profile: "https://registry.tincanapi.com", hint: "Meeting duration, if known." },
  { id: "https://w3id.org/xapi/acrossx/extensions/rubrics", display: "rubrics", location: "result", profile: "https://w3id.org/xapi/acrossx", hint: "Structured rubric scores — good for multi-dimension metrics." },
  { id: "https://w3id.org/xapi/acrossx/extensions/supplemental-info", display: "supplemental info", location: "activity", profile: "https://w3id.org/xapi/acrossx", hint: "Extra info about the activity definition." },
];

// Extensions the app itself defines for AI-derived metadata that has no
// registry equivalent. The base IRI is configurable in the UI; these are the
// path suffixes.
export const CUSTOM_EXTENSION_SUFFIXES = [
  { suffix: "metric-name", display: "metric name", location: "context", hint: "The name of the user-defined metric this classification used." },
  { suffix: "metric-definition", display: "metric definition", location: "context", hint: "The full definition/rubric of the metric, for reproducibility." },
  { suffix: "sentiment", display: "sentiment", location: "result", hint: "Overall sentiment (-1..1) detected in the discussion." },
  { suffix: "confidence", display: "confidence", location: "result", hint: "Model confidence (0..1) in the classification." },
  { suffix: "model", display: "model", location: "context", hint: "The AI model id that produced the classification." },
];

// Rule-based suggestions from the classification output + user choices.
export function suggest({ meetingKind = "meeting", scaleType = "categorical" } = {}) {
  const byId = (list, id) => list.find((x) => x.id === id);

  const activityType =
    {
      meeting: "http://adlnet.gov/expapi/activities/meeting",
      discussion: "http://id.tincanapi.com/activitytype/discussion",
      "online-discussion": "https://w3id.org/xapi/acrossx/activities/online-discussion",
      "face-to-face-discussion": "https://w3id.org/xapi/acrossx/activities/face-to-face-discussion",
      webinar: "http://id.tincanapi.com/activitytype/webinar",
      coaching: "http://id.tincanapi.com/activitytype/tutor-session",
      collaboration: "https://w3id.org/xapi/acrossx/activities/collaboration",
    }[meetingKind] || "http://adlnet.gov/expapi/activities/meeting";

  const verb =
    scaleType === "numeric"
      ? "http://id.tincanapi.com/verb/rated"
      : "https://w3id.org/xapi/acrossx/verbs/evaluated";

  const activity = byId(ACTIVITY_TYPES, activityType);
  const profileId = byId(VERBS, verb).profile;

  const extensions = [
    "http://www.tincanapi.co.uk/extensions/result/classification",
    "http://id.tincanapi.com/extension/topic",
    "http://id.tincanapi.com/extension/tags",
    "http://id.tincanapi.com/extension/powered-by",
  ];
  if (scaleType === "numeric") {
    extensions.push("http://id.tincanapi.com/extension/quality-rating");
  }

  return {
    verb,
    activityType,
    // Category should reflect the profiles the statement draws from.
    profiles: [...new Set([profileId, activity.profile])],
    extensions,
  };
}
