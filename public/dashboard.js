// Results dashboard — behaviors, filtering, sorting.

const $ = (id) => document.getElementById(id);
const EXT = {
  classification: "http://www.tincanapi.co.uk/extensions/result/classification",
  topic: "http://id.tincanapi.com/extension/topic",
  tags: "http://id.tincanapi.com/extension/tags",
};

let ROWS = []; // normalized rows derived from statements

// ---------- source toggle ----------
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
      $("load-status").classList.add("hidden");
    }
    renderAll();
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
  const activityType = obj.definition?.type || "";

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
    activityType,
    classification: rext[EXT.classification] ?? findExt(rext, "classification"),
    score: s.result?.score?.scaled ?? null,
    scoreRaw: s.result?.score?.raw ?? null,
    scoreMax: s.result?.score?.max ?? null,
    sentiment: numeric(findExt(rext, "sentiment")),
    topics: splitList(cext[EXT.topic]),
    tags: cext[EXT.tags] || [],
    metricName: findExt(cext, "metric-name"),
    summary: s.result?.response || "",
  };
}

const numeric = (v) => (typeof v === "number" ? v : v == null ? null : Number(v));
const splitList = (v) => (Array.isArray(v) ? v : typeof v === "string" ? v.split(/,\s*/).filter(Boolean) : []);

// ---------- render ----------
function renderAll() {
  renderSummary();
  renderBehaviors();
  populateFilters();
  renderResults();
}

function renderSummary() {
  const actors = new Set(ROWS.map((r) => r.actorName));
  const activities = new Set(ROWS.map((r) => r.activityName));
  const scored = ROWS.filter((r) => r.score != null);
  const avg = scored.length ? scored.reduce((a, r) => a + r.score, 0) / scored.length : null;
  const sents = ROWS.filter((r) => r.sentiment != null);
  const avgSent = sents.length ? sents.reduce((a, r) => a + r.sentiment, 0) / sents.length : null;

  $("summary-cards").innerHTML = [
    card("Statements", ROWS.length),
    card("Actors", actors.size),
    card("Activities", activities.size),
    card("Avg score", avg == null ? "—" : Math.round(avg * 100) + "%"),
    card("Avg sentiment", avgSent == null ? "—" : avgSent.toFixed(2)),
  ].join("");
}
const card = (label, val) => `<div class="card"><div class="card-val">${val}</div><div class="card-label">${label}</div></div>`;

function renderBehaviors() {
  // verb bars
  const byVerb = countBy(ROWS, (r) => r.verbDisplay);
  const max = Math.max(1, ...byVerb.map((x) => x.count));
  $("verb-bars").innerHTML = byVerb
    .map(
      (v) => `<div class="bar-row"><span class="bar-label">${esc(v.key)}</span>
        <span class="bar"><span class="bar-fill" style="width:${(v.count / max) * 100}%"></span></span>
        <span class="bar-count">${v.count}</span></div>`
    )
    .join("");

  // topics + tags
  const topics = {};
  ROWS.forEach((r) => [...r.topics, ...r.tags].forEach((t) => (topics[t] = (topics[t] || 0) + 1)));
  $("topic-chips").innerHTML =
    Object.entries(topics)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([t, n]) => `<span class="chip">${esc(t)} <em>×${n}</em></span>`)
      .join("") || '<span class="hint">No topics captured (enable the topic/tags extensions when mapping).</span>';

  // actor table
  const groups = groupBy(ROWS, (r) => r.actorName);
  const rows = Object.entries(groups)
    .map(([name, rs]) => {
      const scored = rs.filter((r) => r.score != null);
      const sents = rs.filter((r) => r.sentiment != null);
      const avg = scored.length ? scored.reduce((a, r) => a + r.score, 0) / scored.length : null;
      const avgS = sents.length ? sents.reduce((a, r) => a + r.sentiment, 0) / sents.length : null;
      const verbs = [...new Set(rs.map((r) => r.verbDisplay))].join(", ");
      return { name, count: rs.length, avg, avgS, verbs };
    })
    .sort((a, b) => b.count - a.count);
  $("actor-table").querySelector("tbody").innerHTML = rows
    .map(
      (r) => `<tr><td>${esc(r.name)}</td><td>${r.count}</td>
        <td>${r.avg == null ? "—" : Math.round(r.avg * 100) + "%"}</td>
        <td>${r.avgS == null ? "—" : sentimentPill(r.avgS)}</td>
        <td class="muted">${esc(r.verbs)}</td></tr>`
    )
    .join("");
}

function populateFilters() {
  fillSelect("f-activity", uniq(ROWS.map((r) => r.activityName)));
  fillSelect("f-actor", uniq(ROWS.map((r) => r.actorName)));
  fillSelect("f-verb", uniq(ROWS.map((r) => r.verbDisplay)));
}
function fillSelect(id, values) {
  const sel = $(id);
  const keep = sel.firstElementChild.outerHTML;
  sel.innerHTML = keep + values.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
}

["f-activity", "f-actor", "f-verb", "f-sort"].forEach((id) => $(id).addEventListener("change", renderResults));

function renderResults() {
  const fa = $("f-activity").value,
    fac = $("f-actor").value,
    fv = $("f-verb").value,
    sort = $("f-sort").value;

  let rows = ROWS.filter(
    (r) => (!fa || r.activityName === fa) && (!fac || r.actorName === fac) && (!fv || r.verbDisplay === fv)
  );

  const cmp = {
    "score-desc": (a, b) => (b.score ?? -1) - (a.score ?? -1),
    "score-asc": (a, b) => (a.score ?? 2) - (b.score ?? 2),
    "sentiment-desc": (a, b) => (b.sentiment ?? -2) - (a.sentiment ?? -2),
    "sentiment-asc": (a, b) => (a.sentiment ?? 2) - (b.sentiment ?? 2),
    "time-desc": (a, b) => (b.time || "").localeCompare(a.time || ""),
    "time-asc": (a, b) => (a.time || "").localeCompare(b.time || ""),
    "actor-asc": (a, b) => a.actorName.localeCompare(b.actorName),
  }[sort];
  rows = rows.slice().sort(cmp);

  $("results-table").querySelector("tbody").innerHTML = rows
    .map(
      (r, i) => `<tr data-i="${i}">
        <td class="muted">${r.time ? new Date(r.time).toLocaleString() : "—"}</td>
        <td>${esc(r.actorName)}</td>
        <td>${esc(r.verbDisplay)}</td>
        <td>${esc(r.activityName)}</td>
        <td>${r.classification ? `<span class="badge">${esc(r.classification)}</span>` : "—"}</td>
        <td>${scoreCell(r)}</td>
        <td>${r.sentiment == null ? "—" : sentimentPill(r.sentiment)}</td>
        <td><button class="link" data-detail="${i}">view</button></td>
      </tr>`
    )
    .join("");
  $("results-count").textContent = `${rows.length} statement${rows.length === 1 ? "" : "s"}`;

  $("results-table")
    .querySelectorAll("button[data-detail]")
    .forEach((b) =>
      b.addEventListener("click", () => {
        $("detail-json").textContent = JSON.stringify(rows[Number(b.dataset.detail)].statement, null, 2);
        $("detail-panel").classList.remove("hidden");
        $("detail-panel").scrollIntoView({ behavior: "smooth" });
      })
    );
}

function scoreCell(r) {
  if (r.score == null) return "—";
  const pct = Math.round(r.score * 100);
  const raw = r.scoreRaw != null ? ` (${r.scoreRaw}${r.scoreMax != null ? "/" + r.scoreMax : ""})` : "";
  return `<span class="meter"><span class="meter-fill" style="width:${pct}%"></span></span> ${pct}%${raw}`;
}

// ---------- helpers ----------
function countBy(arr, fn) {
  const m = {};
  arr.forEach((x) => (m[fn(x)] = (m[fn(x)] || 0) + 1));
  return Object.entries(m)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}
function groupBy(arr, fn) {
  const m = {};
  arr.forEach((x) => (m[fn(x)] = m[fn(x)] || []).push(x));
  return m;
}
const uniq = (a) => [...new Set(a)].sort((x, y) => String(x).localeCompare(String(y)));
function sentimentPill(v) {
  const cls = v > 0.15 ? "pos" : v < -0.15 ? "neg" : "neu";
  const label = v > 0.15 ? "positive" : v < -0.15 ? "negative" : "neutral";
  return `<span class="sentiment-pill ${cls}">${label} ${v.toFixed(2)}</span>`;
}
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// initial load from local log
loadData();
