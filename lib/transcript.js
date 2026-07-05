// Deterministic transcript parsing. No LLM involved — used both by the offline
// classifier and to pre-compute quantitative signals (talk-time) that we hand
// to the model as facts instead of asking it to estimate.

const SPEAKER_RE = /^\s*(?:\[[^\]]*\]\s*)?([A-Z][A-Za-z0-9 .'-]{0,40}?)\s*:\s*(.*)$/;
const STAGE_RE = /\([^)]*\)/g; // "(Interrupting)" etc.

// Metadata labels that look like speakers but are transcript headers.
const METADATA_LABELS = new Set(
  ["context", "duration", "date", "time", "location", "attendees", "participants", "meeting", "subject", "topic", "present", "agenda", "notes", "summary", "title"]
);

export function parseTurns(transcript) {
  const turns = [];
  let current = null;
  for (const raw of transcript.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    const m = line.match(SPEAKER_RE);
    if (m && !METADATA_LABELS.has(m[1].trim().toLowerCase())) {
      if (current) turns.push(current);
      current = { speaker: m[1].trim(), text: m[2] };
    } else if (current) {
      current.text += " " + line.trim();
    } else {
      // preamble before any speaker label (e.g. "Context:", "Duration:")
      continue;
    }
  }
  if (current) turns.push(current);
  return turns.map((t) => ({ speaker: t.speaker, text: t.text.replace(STAGE_RE, "").trim() }));
}

const wordCount = (s) => (s.match(/[A-Za-z0-9']+/g) || []).length;

export function talkTime(transcript) {
  const turns = parseTurns(transcript);
  const words = {};
  let total = 0;
  for (const t of turns) {
    const w = wordCount(t.text);
    words[t.speaker] = (words[t.speaker] || 0) + w;
    total += w;
  }
  const shares = Object.entries(words)
    .map(([speaker, w]) => ({
      speaker,
      words: w,
      pct: total ? Math.round((w / total) * 100) : 0,
    }))
    .sort((a, b) => b.words - a.words);
  return { total, speakers: shares, turnCount: turns.length };
}

// Count how often the FIRST speaker (assumed coach) interrupts, using the
// stage-direction "(Interrupting)" convention or an em/double dash at the end
// of the previous speaker's line.
export function interruptionSignals(transcript, coach) {
  const lines = transcript.split(/\r?\n/);
  let count = 0;
  let prevEndedCutOff = false;
  for (const raw of lines) {
    const m = raw.match(SPEAKER_RE);
    if (!m || METADATA_LABELS.has(m[1].trim().toLowerCase())) continue;
    const speaker = m[1].trim();
    // Count at most once per coach turn: either an explicit "(Interrupting)"
    // marker on this line, or the coach speaking right after a cut-off line.
    const explicit = /\(interrupt/i.test(raw);
    const followsCutoff = prevEndedCutOff && coach && speaker === coach;
    if (explicit || followsCutoff) count++;
    prevEndedCutOff = /[—–-]\s*$/.test(raw.trim()) || /\.\.\.\s*$/.test(raw.trim());
  }
  return count;
}
