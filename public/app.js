// Meeting Metric → xAPI wizard

const state = {
  catalog: null,
  classification: null, // { mode, result, model, usage }
  statements: null,
  maxStepReached: 1,
  rubrics: {},
  config: { llmMode: "api" },
};

const $ = (id) => document.getElementById(id);

const METRIC_PRESETS = [
  {
    name: "Psychological Safety",
    description:
      "How safe did participants appear to feel speaking up? High: people voice dissent, admit mistakes, ask questions, and build on each other's ideas without fear. Low: silence after disagreements, hedging, deference to authority, interruptions that shut people down.",
    scaleType: "categorical",
    labels: "Low, Moderate, High",
  },
  {
    name: "Sentiment",
    description:
      "Overall emotional tone of the discussion. High: positive, energized, appreciative language. Low: frustration, cynicism, conflict, disengagement.",
    scaleType: "categorical",
    labels: "Negative, Mixed, Neutral, Positive",
  },
  {
    name: "Decision Quality",
    description:
      "Were decisions made explicitly, with options considered, owners assigned, and follow-ups captured? High: clear decisions with rationale and next steps. Low: circular discussion, decisions deferred or ambiguous.",
    scaleType: "numeric",
    min: 1,
    max: 5,
  },
  {
    name: "Engagement Balance",
    description:
      "How evenly was participation distributed? High: all attendees contribute substantively. Low: one or two voices dominate while others are silent.",
    scaleType: "numeric",
    min: 1,
    max: 5,
  },
  {
    name: "Coaching Presence",
    description:
      "Did the facilitator/coach listen actively, ask open questions, reflect back, and let the coachee generate insights (rather than advising)? Based on ICF-style coaching competencies.",
    scaleType: "categorical",
    labels: "Directive, Mixed, Coach-like",
  },
];

// ---------- navigation ----------
function showStep(n) {
  for (let i = 1; i <= 5; i++) {
    $(`step-${i}`).classList.toggle("hidden", i !== n);
    const btn = document.querySelector(`#steps .step[data-step="${i}"]`);
    btn.classList.toggle("active", i === n);
    btn.classList.toggle("done", i < state.maxStepReached && i !== n);
    btn.disabled = i > state.maxStepReached;
  }
  state.maxStepReached = Math.max(state.maxStepReached, n);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("#steps .step").forEach((btn) => {
  btn.addEventListener("click", () => {
    const n = Number(btn.dataset.step);
    if (n <= state.maxStepReached) showStep(n);
  });
});

function setStatus(el, kind, text) {
  el.className = `status ${kind}`;
  el.textContent = text;
  el.classList.remove("hidden");
}

// ---------- step 1: transcript ----------
$("transcript-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  let text = await file.text();
  if (/\.(vtt|srt)$/i.test(file.name)) text = stripCaptionTiming(text);
  $("transcript").value = text;
  if (!$("meeting-title").value) {
    $("meeting-title").value = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
  }
});

function stripCaptionTiming(text) {
  return text
    .split(/\r?\n/)
    .filter(
      (line) =>
        !/^\s*WEBVTT/i.test(line) &&
        !/^\s*\d+\s*$/.test(line) &&
        !/\d{1,2}:\d{2}(:\d{2})?[.,]\d{3}\s*-->/.test(line)
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

$("to-step-2").addEventListener("click", () => {
  if (!$("transcript").value.trim()) {
    alert("Paste or load a transcript first.");
    return;
  }
  if (!$("meeting-title").value.trim()) $("meeting-title").value = "Untitled meeting";
  showStep(2);
});

// ---------- step 2: metric ----------
const presetsEl = $("metric-presets");
METRIC_PRESETS.forEach((p) => {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = p.name;
  b.addEventListener("click", () => {
    $("metric-name").value = p.name;
    $("metric-description").value = p.description;
    $("scale-type").value = p.scaleType;
    if (p.scaleType === "categorical") $("scale-labels").value = p.labels;
    else {
      $("scale-min").value = p.min;
      $("scale-max").value = p.max;
    }
    toggleScaleConfig();
  });
  presetsEl.appendChild(b);
});

function toggleScaleConfig() {
  const numeric = $("scale-type").value === "numeric";
  $("categorical-config").classList.toggle("hidden", numeric);
  $("numeric-config").classList.toggle("hidden", !numeric);
}
$("scale-type").addEventListener("change", toggleScaleConfig);
$("back-to-1").addEventListener("click", () => showStep(1));

function readMetric() {
  if ($("metric-mode").value === "rubric") {
    return currentRubric();
  }
  const scaleType = $("scale-type").value;
  const metric = {
    name: $("metric-name").value.trim(),
    description: $("metric-description").value.trim(),
    scaleType,
  };
  if (scaleType === "categorical") {
    metric.labels = $("scale-labels").value.split(",").map((s) => s.trim()).filter(Boolean);
  } else {
    metric.scaleMin = Number($("scale-min").value);
    metric.scaleMax = Number($("scale-max").value);
  }
  return metric;
}

// ---------- step 3: classify ----------
$("run-classify").addEventListener("click", async () => {
  const isRubric = $("metric-mode").value === "rubric";
  const metric = readMetric();
  if (!metric || !metric.name) {
    alert("Give the metric a name (or pick a rubric).");
    return;
  }
  if (!isRubric && metric.scaleType === "categorical" && metric.labels.length < 2) {
    alert("Provide at least two labels for a categorical scale.");
    return;
  }

  showStep(3);
  $("results").classList.add("hidden");
  $("rubric-results").classList.add("hidden");
  const modeNote = state.config.llmMode === "local" ? " (offline heuristic — local test mode)" : "";
  setStatus($("classify-status"), "info", `Analyzing transcript against ${isRubric ? "the rubric" : "your metric"}${modeNote}…`);
  $("run-classify").disabled = true;

  try {
    const res = await fetch("/api/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: $("transcript").value, metric }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Classification failed (${res.status}).`);
    state.classification = data;
    $("classify-status").classList.add("hidden");
    if (data.mode === "rubric") {
      renderRubricResults(data.result, metric);
      $("rubric-results").classList.remove("hidden");
    } else {
      renderResults(data.result, metric);
      $("results").classList.remove("hidden");
    }
  } catch (err) {
    setStatus($("classify-status"), "error", err.message);
  } finally {
    $("run-classify").disabled = false;
  }
});

function sentimentPill(v) {
  const cls = v > 0.15 ? "pos" : v < -0.15 ? "neg" : "neu";
  const label = v > 0.15 ? "positive" : v < -0.15 ? "negative" : "neutral";
  return `<span class="sentiment-pill ${cls}">${label} (${v.toFixed(2)})</span>`;
}

function renderResults(r, metric) {
  $("r-classification").textContent = r.classification;
  $("r-score").textContent =
    metric.scaleType === "numeric"
      ? `${r.score_raw} / ${metric.scaleMax}`
      : `${Math.round(r.score_scaled * 100)}%`;
  $("r-sentiment").innerHTML = sentimentPill(r.sentiment);
  $("r-confidence").textContent = `${Math.round(r.confidence * 100)}%`;
  $("r-summary").textContent = r.summary;
  $("r-rationale").textContent = r.rationale;

  $("r-topics").innerHTML = r.topics.map((t) => `<span class="chip">${esc(t)}</span>`).join("");

  $("r-moments").innerHTML = r.key_moments
    .map(
      (m) => `<div class="moment ${m.polarity}">
        <blockquote>“${esc(m.quote)}”</blockquote>
        <div class="who">— ${esc(m.speaker)} · ${esc(m.significance)}</div>
      </div>`
    )
    .join("");

  $("r-participants").innerHTML = r.participants
    .map(
      (p) => `<div class="participant">
        <strong>${esc(p.name)}</strong>${sentimentPill(p.sentiment)}
        <div>${esc(p.contribution_summary)}</div>
        <div class="hint">${esc(p.metric_note)}</div>
      </div>`
    )
    .join("");

  $("r-recommendations").innerHTML = r.recommendations.map((x) => `<li>${esc(x)}</li>`).join("");
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

$("back-to-2").addEventListener("click", () => showStep(2));

// ---------- step 4: xAPI mapping ----------
async function goToMapping() {
  showStep(4);
  if (!state.catalog) {
    state.catalog = await (await fetch("/api/catalog")).json();
  }
  const metric = readMetric();
  const scaleType = metric.mode === "rubric" ? "categorical" : metric.scaleType;
  const suggestion = await (
    await fetch(`/api/suggest?meetingKind=${$("meeting-kind").value}&scaleType=${scaleType}`)
  ).json();
  renderMapping(suggestion);
}
$("to-step-4").addEventListener("click", goToMapping);

function renderMapping(suggestion) {
  const { verbs, activityTypes, profiles, extensions } = state.catalog;
  const profileName = (id) => (profiles.find((p) => p.id === id) || { name: id }).name;

  const verbSel = $("map-verb");
  verbSel.innerHTML = verbs
    .map((v) => `<option value="${v.id}" ${v.id === suggestion.verb ? "selected" : ""}>${v.display} — ${profileName(v.profile)}${v.id === suggestion.verb ? " (suggested)" : ""}</option>`)
    .join("");
  const showVerbHint = () => {
    const v = verbs.find((x) => x.id === verbSel.value);
    $("verb-hint").textContent = v ? `${v.hint} · ${v.id}` : "";
  };
  verbSel.onchange = showVerbHint;
  showVerbHint();

  const actSel = $("map-activity-type");
  actSel.innerHTML = activityTypes
    .map((t) => `<option value="${t.id}" ${t.id === suggestion.activityType ? "selected" : ""}>${t.display} — ${profileName(t.profile)}${t.id === suggestion.activityType ? " (suggested)" : ""}</option>`)
    .join("");
  const showActHint = () => {
    const t = activityTypes.find((x) => x.id === actSel.value);
    $("activity-hint").textContent = t ? `${t.hint} · ${t.id}` : "";
  };
  actSel.onchange = showActHint;
  showActHint();

  $("map-profiles").innerHTML = profiles
    .map(
      (p) => `<label><input type="checkbox" name="profile" value="${p.id}" ${suggestion.profiles.includes(p.id) ? "checked" : ""}/>
        <span><strong>${p.name}</strong>${suggestion.profiles.includes(p.id) ? " (suggested)" : ""} — ${p.description}<br/><span class="iri">${p.id}</span></span></label>`
    )
    .join("");

  $("map-extensions").innerHTML = extensions
    .map(
      (x) => `<label><input type="checkbox" name="extension" value="${x.id}" ${suggestion.extensions.includes(x.id) ? "checked" : ""}/>
        <span><strong>${x.display}</strong> <em>(${x.location})</em>${suggestion.extensions.includes(x.id) ? " (suggested)" : ""} — ${x.hint}<br/><span class="iri">${x.id}</span></span></label>`
    )
    .join("");
}

$("back-to-3").addEventListener("click", () => showStep(3));

// ---------- step 5: build + send ----------
$("build-statements").addEventListener("click", async () => {
  const actorName = $("actor-name").value.trim();
  if (!actorName) {
    alert("Provide an actor name (who the evaluation statement is about).");
    return;
  }
  const mapping = {
    verb: $("map-verb").value,
    activityType: $("map-activity-type").value,
    profiles: [...document.querySelectorAll('input[name="profile"]:checked')].map((el) => el.value),
    extensions: [...document.querySelectorAll('input[name="extension"]:checked')].map((el) => el.value),
    customBase: $("custom-base").value.trim() || "http://example.org/xapi",
    includeParticipants: $("include-participants").checked,
  };

  const res = await fetch("/api/statements/build", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      result: state.classification.result,
      metric: readMetric(),
      mapping,
      meeting: { title: $("meeting-title").value.trim(), date: $("meeting-date").value || null },
      actor: { name: actorName, email: $("actor-email").value.trim() || null },
      model: state.classification.model,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    alert(data.error || "Could not build statements.");
    return;
  }
  state.statements = data.statements;
  $("statement-preview").textContent = JSON.stringify(data.statements, null, 2);
  $("stmt-count").textContent = `(${data.statements.length} statement${data.statements.length === 1 ? "" : "s"})`;
  showStep(5);
});

$("back-to-4").addEventListener("click", () => showStep(4));

$("send-lrs").addEventListener("click", async () => {
  const endpoint = $("lrs-endpoint").value.trim();
  if (!endpoint) {
    alert("Provide the LRS endpoint URL.");
    return;
  }
  $("send-lrs").disabled = true;
  setStatus($("send-status"), "info", "Sending statements…");
  try {
    const res = await fetch("/api/lrs/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint,
        username: $("lrs-username").value,
        password: $("lrs-password").value,
        statements: state.statements,
      }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      const ids = Array.isArray(data.body) ? data.body : [];
      setStatus(
        $("send-status"),
        "success",
        `Accepted by LRS (HTTP ${data.status}). ${ids.length ? "Statement IDs: " + ids.join(", ") : ""}`
      );
    } else {
      setStatus(
        $("send-status"),
        "error",
        `LRS rejected the request (HTTP ${data.status ?? "?"}): ${typeof data.body === "string" ? data.body : JSON.stringify(data.body || data.error)}`
      );
    }
  } catch (err) {
    setStatus($("send-status"), "error", err.message);
  } finally {
    $("send-lrs").disabled = false;
  }
});

// ---------- metric mode (single vs rubric) ----------
async function initModeAndRubrics() {
  try {
    state.config = await (await fetch("/api/config")).json();
    const banner = $("mode-banner");
    if (state.config.llmMode === "local") {
      banner.className = "mode-banner local";
      banner.textContent = "⚙ LOCAL TEST MODE — classification runs on the offline heuristic, no API call. Set ANTHROPIC_API_KEY (Claude) or GEMINI_API_KEY (Gemini) and LLM_MODE=api for the real model.";
      banner.classList.remove("hidden");
    } else {
      banner.className = "mode-banner api";
      banner.textContent = `Live model: ${state.config.model} (${state.config.provider || "claude"})`;
      banner.classList.remove("hidden");
    }
  } catch {}
  try {
    state.rubrics = await (await fetch("/api/rubrics")).json();
    const sel = $("rubric-select");
    sel.innerHTML = Object.entries(state.rubrics)
      .map(([key, r]) => `<option value="${key}">${r.name}</option>`)
      .join("");
    sel.addEventListener("change", renderRubricPreview);
    renderRubricPreview();
  } catch {}
}

function currentRubric() {
  return state.rubrics[$("rubric-select").value];
}

function renderRubricPreview() {
  const r = currentRubric();
  if (!r) return;
  $("rubric-preview").innerHTML =
    `<p class="hint">Levels: ${r.levels.join(" < ")}</p>` +
    r.dimensions.map((d) => `<div class="dim"><strong>${esc(d.name)}</strong> — ${esc(d.definition)}</div>`).join("");
}

$("metric-mode").addEventListener("change", () => {
  const rubric = $("metric-mode").value === "rubric";
  $("rubric-picker").classList.toggle("hidden", !rubric);
  $("single-metric-config").classList.toggle("hidden", rubric);
});

// ---------- rubric results rendering ----------
function renderRubricResults(r, rubric) {
  $("rr-overall").textContent = r.overall_classification;
  $("rr-score").textContent = `${Math.round(r.overall_score_scaled * 100)}%`;
  $("rr-sentiment").innerHTML = sentimentPill(r.sentiment);
  $("rr-confidence").textContent = `${Math.round(r.confidence * 100)}%`;
  $("rr-summary").textContent = r.summary;

  $("rr-signals").innerHTML = (r.quantitative_signals || [])
    .map((s) => `<span class="chip">${esc(s.label)}: <strong>${s.value}${s.unit === "percent" ? "%" : ""}</strong></span>`)
    .join("");

  const nLevels = rubric.levels.length;
  $("rr-dimensions").innerHTML = r.dimensions
    .map((d) => {
      const lvlClass = "l" + Math.min(2, Math.round((d.score_raw - 1) / Math.max(1, nLevels - 1) * 2));
      const ev = (d.evidence || [])
        .map((e) => `<div class="ev">“${esc(e.quote)}” — ${esc(e.speaker)}</div>`)
        .join("");
      const obs = d.observed_behaviors?.length ? `<li><strong>Observed:</strong> ${d.observed_behaviors.map(esc).join("; ")}</li>` : "";
      const miss = d.missing_behaviors?.length ? `<li><strong>Missing:</strong> ${d.missing_behaviors.map(esc).join("; ")}</li>` : "";
      return `<div class="dim-card">
        <div class="dim-head">
          <span class="dim-name">${esc(d.name)}</span>
          <span class="level-badge ${lvlClass}">${esc(d.level)}</span>
          <span class="meter"><span class="meter-fill" style="width:${Math.round(d.score_scaled * 100)}%"></span></span>
        </div>
        <div class="hint">${esc(d.rationale)}</div>
        <ul>${obs}${miss}</ul>
        ${ev}
      </div>`;
    })
    .join("");

  $("rr-recommendations").innerHTML = r.recommendations.map((x) => `<li>${esc(x)}</li>`).join("");
}

$("rr-back-to-2").addEventListener("click", () => showStep(2));
$("rr-to-step-4").addEventListener("click", () => goToMapping());

// default date = today
$("meeting-date").valueAsDate = new Date();
initModeAndRubrics();
showStep(1);
