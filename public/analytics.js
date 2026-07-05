// Data dashboard — tabbed views: Individual, Verb, Classification.

const $ = (id) => document.getElementById(id);
const EXT = {
  classification: "http://www.tincanapi.co.uk/extensions/result/classification",
  topic: "http://id.tincanapi.com/extension/topic",
  tags: "http://id.tincanapi.com/extension/tags",
};

let ROWS = [];

// ---------- data source ----------
document.querySelectorAll('input[name="source"]').forEach((r) =>
  r.addEventListener("change", () => {
    $("lrs-config").classList.toggle("hidden", document.querySelector('input[name="source"]:checked').value !== "lrs");
  })
);

$("load-data").addEventListener("click", loadData);

async function loadData() {
  const source = document.querySelector('input[name="source"]:checked').value;
  setStatus("info", "Loading…");
  try {
    let data;
    if (source === "local") {
      data = await (await fetch("/api/records")).json();
    } else {
      const p = new URLSearchParams({
        endpoint: $("q-endpoint").value.trim(),
        username: $("q-username").value,
        password: $("q-password").value,
      });
      const res = await fetch("/api/lrs/query?" + p.toString());
      data = await res.json();
      if (!res.ok) throw new Error(data.error);
    }
    ROWS = (data.statements || []).map(normalize);
    if (!ROWS.length) {
      setStatus("info", "No statements found for this source yet. Classify a meeting and send it to an LRS first.");
    } else {
      setStatus("success", `Loaded ${ROWS.length} statements.`);
    }
    populateSelectors();
    renderActiveTab();
  } catch (err) {
    setStatus("error", err.message || "Could not load statements.");
  }
}

function setStatus(kind, text) {
  const el = $("load-status");
  el.className = `status ${kind}`;
  el.textContent = text;
  el.classList.remove("hidden");
}

// ---------- normalize an xAPI statement into a flat row ----------
function normalize(s) {
  const langVal = (o) => (o ? o["en-US"] || Object.values(o)[0] : undefined);
  const actor = s.actor || {};
  const actorName = actor.name || (actor.mbox ? actor.mbox.replace("mailto:", "") : "Unknown");
  const verbId = s.verb?.id || "";
  const verbDisplay = langVal(s.verb?.display) || verbId.split("/").pop();
  const obj = s.object || {};
  const activityId = obj.id || "";
  const activityName = langVal(obj.definition?.name) || activityId.split("/").pop();

  const rext = s.result?.extensions || {};
  const cext = s.context?.extensions || {};
  const findExt = (bag, suffix) => {
    const k = Object.keys(bag).find((x) => x.endsWith("/extensions/" + suffix) || x.endsWith("/" + suffix));
    return k ? bag[k] : undefined;
  };

  return {
    statement: s,
    time: s.timestamp || s.stored || null,
    actorName,
    verbId,
    verbDisplay,
    activityId,
    activityName,
    classification: rext[EXT.classification] ?? findExt(rext, "classification"),
    dimension: findExt(rext, "dimension"),
    score: s.result?.score?.scaled ?? null,
    sentiment: numeric(findExt(rext, "sentiment")),
    metricName: findExt(cext, "metric-name"),
    summary: s.result?.response || "",
  };
}

const numeric = (v) => (typeof v === "number" ? v : v == null ? null : Number(v));
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ---------- shared render helpers ----------
const card = (label, val) => `<div class="card"><div class="card-val">${val}</div><div class="card-label">${label}</div></div>`;
const pct = (v) => (v == null ? "—" : Math.round(v * 100) + "%");
const meter = (v) =>
  v == null ? "—" : `<span class="meter"><span class="meter-fill" style="width:${Math.round(v * 100)}%"></span></span> ${pct(v)}`;
const sentPill = (v) => {
  if (v == null) return "—";
  const cls = v > 0.15 ? "good" : v < -0.15 ? "bad" : "";
  return `<span class="sent ${cls}">${v > 0 ? "+" : ""}${Number(v).toFixed(2)}</span>`;
};
const when = (t) => (t ? new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—");
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
const uniqueSorted = (arr) => [...new Set(arr)].sort((a, b) => String(a).localeCompare(String(b)));
const fillSelect = (el, values, { keepFirst = false } = {}) => {
  const prev = el.value;
  const head = keepFirst ? el.options[0].outerHTML : "";
  el.innerHTML = head + values.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
  if ([...el.options].some((o) => o.value === prev)) el.value = prev;
};

// ---------- tabs ----------
document.querySelectorAll(".tab-btn").forEach((btn) =>
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b === btn));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("hidden", p.id !== "tab-" + btn.dataset.tab));
    renderActiveTab();
  })
);

function activeTab() {
  return document.querySelector(".tab-btn.active").dataset.tab;
}

function renderActiveTab() {
  ({ individual: renderIndividual, verb: renderVerb, classification: renderClassification })[activeTab()]();
}

function populateSelectors() {
  fillSelect($("ind-actor"), uniqueSorted(ROWS.map((r) => r.actorName)));
  populateIndActivities();
  fillSelect($("vb-verb"), uniqueSorted(ROWS.map((r) => r.verbDisplay)));
  fillSelect($("vb-actor"), uniqueSorted(ROWS.map((r) => r.actorName)), { keepFirst: true });
  fillSelect($("cl-level"), uniqueSorted(ROWS.filter((r) => r.classification != null).map((r) => r.classification)));
}

// ============================================================
// INDIVIDUAL — actor + activity → per-verb result breakdown
// ============================================================
function populateIndActivities() {
  const actor = $("ind-actor").value;
  fillSelect($("ind-activity"), uniqueSorted(ROWS.filter((r) => r.actorName === actor).map((r) => r.activityName)), {
    keepFirst: true,
  });
}

$("ind-actor").addEventListener("change", () => {
  populateIndActivities();
  renderIndividual();
});
$("ind-activity").addEventListener("change", renderIndividual);

function renderIndividual() {
  const actor = $("ind-actor").value;
  const activity = $("ind-activity").value;
  const rows = ROWS.filter((r) => r.actorName === actor && (!activity || r.activityName === activity));
  $("ind-empty").classList.toggle("hidden", rows.length > 0);

  const scored = rows.filter((r) => r.score != null).map((r) => r.score);
  const sents = rows.filter((r) => r.sentiment != null).map((r) => r.sentiment);
  $("ind-cards").innerHTML = rows.length
    ? [
        card("Statements", rows.length),
        card("Verbs", new Set(rows.map((r) => r.verbDisplay)).size),
        card("Activities", new Set(rows.map((r) => r.activityName)).size),
        card("Avg score", pct(avg(scored))),
        card("Avg sentiment", avg(sents) == null ? "—" : avg(sents).toFixed(2)),
      ].join("")
    : "";

  // group by verb
  const byVerb = new Map();
  for (const r of rows) {
    if (!byVerb.has(r.verbDisplay)) byVerb.set(r.verbDisplay, []);
    byVerb.get(r.verbDisplay).push(r);
  }

  $("ind-verbs").innerHTML = [...byVerb.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([verb, list]) => {
      const vScores = list.filter((r) => r.score != null).map((r) => r.score);
      const items = list
        .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0))
        .map(
          (r) => `<tr>
            <td>${when(r.time)}</td>
            <td>${esc(r.activityName)}${r.dimension ? ` <span class="hint">· ${esc(r.dimension)}</span>` : ""}</td>
            <td>${r.classification ? `<span class="chip">${esc(r.classification)}</span>` : "—"}</td>
            <td>${meter(r.score)}</td>
            <td>${sentPill(r.sentiment)}</td>
          </tr>`
        )
        .join("");
      return `<div class="verb-group">
        <div class="verb-group-head">
          <span class="verb-name">${esc(verb)}</span>
          <span class="hint">${list.length} statement${list.length === 1 ? "" : "s"}</span>
          <span class="verb-avg">avg ${meter(avg(vScores))}</span>
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th>When</th><th>Activity</th><th>Classification</th><th>Score</th><th>Sentiment</th></tr></thead>
          <tbody>${items}</tbody>
        </table></div>
      </div>`;
    })
    .join("");
}

// ============================================================
// VERB — verb (+ optional actor) → performance across occurrences
// ============================================================
$("vb-verb").addEventListener("change", renderVerb);
$("vb-actor").addEventListener("change", renderVerb);

function renderVerb() {
  const verb = $("vb-verb").value;
  const actor = $("vb-actor").value;
  const rows = ROWS.filter((r) => r.verbDisplay === verb && (!actor || r.actorName === actor));
  $("vb-empty").classList.toggle("hidden", rows.length > 0);

  const scored = rows.filter((r) => r.score != null).map((r) => r.score);
  const sents = rows.filter((r) => r.sentiment != null).map((r) => r.sentiment);
  $("vb-cards").innerHTML = rows.length
    ? [
        card("Statements", rows.length),
        card("Actors", new Set(rows.map((r) => r.actorName)).size),
        card("Activities", new Set(rows.map((r) => r.activityName)).size),
        card("Avg score", pct(avg(scored))),
        card("Avg sentiment", avg(sents) == null ? "—" : avg(sents).toFixed(2)),
      ].join("")
    : "";

  // per-actor rollup
  const byActor = new Map();
  for (const r of rows) {
    if (!byActor.has(r.actorName)) byActor.set(r.actorName, []);
    byActor.get(r.actorName).push(r);
  }
  $("vb-actor-table").querySelector("tbody").innerHTML = [...byActor.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([name, list]) => {
      const sc = list.filter((r) => r.score != null).map((r) => r.score);
      const st = list.filter((r) => r.sentiment != null).map((r) => r.sentiment);
      return `<tr>
        <td>${esc(name)}</td>
        <td>${list.length}</td>
        <td>${meter(avg(sc))}</td>
        <td>${sc.length ? pct(Math.max(...sc)) : "—"}</td>
        <td>${sc.length ? pct(Math.min(...sc)) : "—"}</td>
        <td>${sentPill(avg(st))}</td>
      </tr>`;
    })
    .join("");

  // occurrence bars, newest first
  $("vb-occurrences").innerHTML = rows
    .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0))
    .map(
      (r) => `<div class="bar-row">
        <span class="bar-label wide" title="${esc(r.activityName)}">${esc(r.actorName)} · ${esc(r.activityName)}${r.dimension ? ` · ${esc(r.dimension)}` : ""}</span>
        <span class="bar"><span class="bar-fill" style="width:${r.score == null ? 0 : Math.round(r.score * 100)}%"></span></span>
        <span class="bar-count">${pct(r.score)}</span>
      </div>`
    )
    .join("");
}

// ============================================================
// CLASSIFICATION — level → distribution + results at that level
// ============================================================
$("cl-level").addEventListener("change", renderClassification);

function renderClassification() {
  const level = $("cl-level").value;
  const classified = ROWS.filter((r) => r.classification != null);

  // distribution (clickable)
  const counts = new Map();
  for (const r of classified) counts.set(r.classification, (counts.get(r.classification) || 0) + 1);
  const max = Math.max(1, ...counts.values());
  $("cl-distribution").innerHTML = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(
      ([lvl, n]) => `<div class="bar-row dist ${lvl === level ? "selected" : ""}" data-level="${esc(lvl)}">
        <span class="bar-label wide">${esc(lvl)}</span>
        <span class="bar"><span class="bar-fill" style="width:${(n / max) * 100}%"></span></span>
        <span class="bar-count">${n}</span>
      </div>`
    )
    .join("");
  $("cl-distribution").querySelectorAll(".dist").forEach((el) =>
    el.addEventListener("click", () => {
      $("cl-level").value = el.dataset.level;
      renderClassification();
    })
  );

  const rows = classified.filter((r) => r.classification === level);
  $("cl-empty").classList.toggle("hidden", rows.length > 0);
  $("cl-table").querySelector("tbody").innerHTML = rows
    .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0))
    .map(
      (r) => `<tr>
        <td>${when(r.time)}</td>
        <td>${esc(r.actorName)}</td>
        <td>${esc(r.verbDisplay)}</td>
        <td>${esc(r.activityName)}</td>
        <td>${r.dimension ? esc(r.dimension) : "—"}</td>
        <td>${meter(r.score)}</td>
        <td>${sentPill(r.sentiment)}</td>
      </tr>`
    )
    .join("");
}

// ---------- init ----------
(async () => {
  try {
    const cfg = await (await fetch("/api/config")).json();
    if (cfg.lrsEndpoint) $("q-endpoint").value = cfg.lrsEndpoint;
    if (cfg.lrsCredsConfigured) {
      $("q-username").placeholder = "(leave blank — server credentials configured)";
      $("q-password").placeholder = "(leave blank — server credentials configured)";
    }
  } catch {}
  loadData(); // auto-load the local send log on open
})();
