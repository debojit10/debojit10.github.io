/* Dot & Key — static ads dashboard.
 * No framework, no build step. Data is embedded by build_data.py; Plotly is
 * loaded from a CDN. Everything below runs in the browser.
 */
(() => {
  "use strict";

  const DATA = window.DK_DATA;
  const CAMPAIGNS = DATA.campaigns;
  const ALL_CAMPS = new Set(CAMPAIGNS.map((_, i) => i));

  // Compact row -> named object. This is the only place the schema is decoded.
  const ROWS = DATA.rows.map((r) => ({
    date: r[0],
    week: r[1],
    c: r[2],
    o: r[3],
    spend: r[4],
    imps: r[5],
    clicks: r[6],
    purch: r[7],
    rev: r[8],
    capped: r[9],
  }));

  const MIN_DATE = ROWS[0].date;
  const MAX_DATE = ROWS[ROWS.length - 1].date;
  const COLORS = {
    bg: "#0d0f1a",
    panel: "#1a1d2e",
    grid: "#1e2240",
    text: "#e8eaf6",
    muted: "#6b7194",
    accent: "#7c6fe0",
    pink: "#f06292",
    green: "#81c784",
    orange: "#ffb74d",
    red: "#ff7043",
    blue: "#4fc3f7",
  };

  const state = {
    start: MIN_DATE,
    end: MAX_DATE,
    camps: new Set(ALL_CAMPS),
    objective: "all",
    tab: "overview",
  };

  // ── formatting ───────────────────────────────────────────────────────
  const fmtInt = (n) => Math.round(n).toLocaleString("en-IN");
  const fmtDate = (iso) =>
    new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });

  function fmtINR(n) {
    if (!Number.isFinite(n)) return "—";
    const sign = n < 0 ? "-" : "";
    const abs = Math.abs(n);
    if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)}Cr`;
    if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(1)}L`;
    if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(1)}K`;
    return `${sign}₹${Math.round(abs)}`;
  }

  function fmtPct(n) {
    return Number.isFinite(n) ? `${n.toFixed(2)}%` : "—";
  }

  function monday(iso) {
    const d = new Date(iso + "T00:00:00Z");
    const day = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - day);
    return d.toISOString().slice(0, 10);
  }

  function weekLabel(iso) {
    return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      timeZone: "UTC",
    });
  }

  // ── aggregation ──────────────────────────────────────────────────────
  function agg(rows) {
    let spend = 0;
    let rev = 0;
    let clicks = 0;
    let imps = 0;
    let purch = 0;
    for (const r of rows) {
      spend += r.spend;
      rev += r.rev;
      clicks += r.clicks;
      imps += r.imps;
      purch += r.purch;
    }
    return {
      spend,
      rev,
      clicks,
      imps,
      purch,
      roas: spend ? rev / spend : 0,
      ctr: imps ? (clicks / imps) * 100 : 0,
      cpa: purch ? spend / purch : 0,
      cvr: clicks ? (purch / clicks) * 100 : 0,
      aov: purch ? rev / purch : 0,
      contribution: rev - spend,
    };
  }

  function groupBy(rows, keyFn) {
    const map = new Map();
    for (const r of rows) {
      const key = keyFn(r);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    return [...map.entries()].map(([key, rs]) => ({ key, rows: rs, m: agg(rs) }));
  }

  function activeRows() {
    return ROWS.filter(
      (r) =>
        r.date >= state.start &&
        r.date <= state.end &&
        state.camps.has(r.c) &&
        (state.objective === "all" || DATA.objectives[r.o] === state.objective)
    );
  }

  // ── plot helpers ─────────────────────────────────────────────────────
  const BASE_LAYOUT = {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { family: "Inter, sans-serif", color: COLORS.text, size: 10 },
    margin: { l: 56, r: 16, t: 8, b: 38 },
    hovermode: "closest",
    hoverlabel: {
      bgcolor: "#12152b",
      bordercolor: COLORS.grid,
      font: { color: COLORS.text, size: 11 },
    },
    legend: {
      orientation: "h",
      x: 0,
      y: 1.16,
      font: { size: 9, color: COLORS.muted },
      bgcolor: "rgba(0,0,0,0)",
    },
    xaxis: {
      gridcolor: COLORS.grid,
      linecolor: COLORS.grid,
      zerolinecolor: COLORS.grid,
      tickfont: { color: COLORS.muted, size: 9 },
      automargin: true,
    },
    yaxis: {
      gridcolor: COLORS.grid,
      linecolor: COLORS.grid,
      zerolinecolor: COLORS.grid,
      tickfont: { color: COLORS.muted, size: 9 },
      automargin: true,
    },
  };

  function L(extra = {}) {
    return {
      ...BASE_LAYOUT,
      ...extra,
      xaxis: { ...BASE_LAYOUT.xaxis, ...(extra.xaxis || {}) },
      yaxis: { ...BASE_LAYOUT.yaxis, ...(extra.yaxis || {}) },
      legend: { ...BASE_LAYOUT.legend, ...(extra.legend || {}) },
      margin: { ...BASE_LAYOUT.margin, ...(extra.margin || {}) },
    };
  }

  const PLOT_CONFIG = { responsive: true, displayModeBar: false, displaylogo: false };

  function draw(id, traces, layout) {
    const el = document.getElementById(id);
    if (!el) return;
    Plotly.react(el, traces, layout, PLOT_CONFIG);
  }

  function lineTrace(x, y, name, color, opts = {}) {
    return {
      type: "scatter",
      mode: opts.mode || "lines+markers",
      name,
      x,
      y,
      line: { color, width: 2 },
      marker: { size: 4, color },
      fill: opts.fill || "none",
      fillcolor: opts.fillcolor,
      hovertemplate: opts.hovertemplate || `${name}: %{y:,.2f}<extra></extra>`,
    };
  }

  function barTrace(x, y, name, color, opts = {}) {
    return {
      type: "bar",
      name,
      x,
      y,
      orientation: opts.orientation || "v",
      marker: { color, line: { width: 0 } },
      hovertemplate: opts.hovertemplate || `${name}: %{y:,.0f}<extra></extra>`,
      text: opts.text,
      textposition: opts.textposition,
    };
  }

  function campaignColor(i) {
    return CAMPAIGNS[i]?.color || COLORS.accent;
  }

  function campaignName(i) {
    return CAMPAIGNS[i]?.name || "?";
  }

  // ── header / KPIs ────────────────────────────────────────────────────
  function renderHeader(rows) {
    const m = agg(rows);
    document.getElementById("hero-roas").textContent = m.spend ? `${m.roas.toFixed(2)}x` : "—";
    document.getElementById("hero-sub").textContent = `revenue ÷ spend · ${fmtINR(m.rev)} / ${fmtINR(m.spend)}`;
    document.getElementById("header-meta").textContent =
      `${fmtDate(state.start)} — ${fmtDate(state.end)} · ${rows.length.toLocaleString("en-IN")} ad-set/day rows · ${state.camps.size} campaign${state.camps.size === 1 ? "" : "s"}`;
    document.getElementById("freshness").textContent =
      `Data as of ${DATA.as_of} · source: ads_performance_ready.csv`;
  }

  function renderKpis(rows) {
    const m = agg(rows);
    const items = [
      { label: "Revenue", value: fmtINR(m.rev), sub: "attributed revenue", color: COLORS.accent },
      { label: "Spend", value: fmtINR(m.spend), sub: "media investment", color: COLORS.pink },
      {
        label: "Contribution",
        value: fmtINR(m.contribution),
        sub: `rev − spend · ${m.rev ? ((m.contribution / m.rev) * 100).toFixed(1) : "0"}%`,
        color: m.contribution >= 0 ? COLORS.green : COLORS.red,
        negative: m.contribution < 0,
      },
      { label: "Orders", value: fmtInt(m.purch), sub: `AOV ${fmtINR(m.aov)}`, color: COLORS.blue },
      { label: "CPA", value: fmtINR(m.cpa), sub: "cost per purchase", color: COLORS.orange },
      { label: "CTR", value: fmtPct(m.ctr), sub: `CVR ${fmtPct(m.cvr)}`, color: COLORS.red },
    ];
    document.getElementById("kpis").innerHTML = items
      .map(
        (it) => `<div class="kpi${it.negative ? " negative" : ""}" style="--accent:${it.color}">
          <div class="label">${it.label}</div>
          <div class="value">${it.value}</div>
          <div class="sub">${it.sub}</div>
        </div>`
      )
      .join("");
    document.querySelectorAll(".kpi").forEach((el, i) => {
      el.style.setProperty("--accent", items[i].color);
    });
  }

  // ── decisions ────────────────────────────────────────────────────────
  const DECISIONS = [
    {
      tag: "Scale",
      cls: "scale",
      title: "Raise the retargeting cap",
      short: "₹4.14 return per ₹1 — 3.1× the account average — but the cap binds.",
      metric: "+₹11.2L/mo",
      metricSub: "revenue on +₹2.7L spend at 4.14 ROAS",
      body:
        "Retargeting returns ₹4.14 for every ₹1 spent — 3.1× the 1.33 account average — but spend pins at exactly ₹9,500/day on 75 of 180 ad-set days (42%). That is a budget ceiling, not missing data. Raise the combined daily cap ~50% (₹19k → ₹28k) and review weekly; walk it back if ROAS drops below 3.0. Worth: +₹2.7L/month spend at 4.14 ROAS ≈ +₹11.2L/month revenue.",
    },
    {
      tag: "Refresh",
      cls: "refresh",
      title: "Refresh Tinted SPF creatives",
      short: "ROAS 1.73 → 1.10 and CTR 1.53% → 1.16% from April to June.",
      metric: "+₹4.4L/mo",
      metricSub: "revenue by restoring the 1.39 average ROAS",
      body:
        "Tinted SPF ROAS fell 1.73 → 1.10 and CTR 1.53% → 1.16% from April to June while spend held at ₹15–18L/month. Same money, ~36% less return — the signature of creative fatigue on a launch campaign. Refresh 2–3 hero creatives (new hooks/formats), not a full relaunch. Worth: restoring only the 13-week average ROAS of 1.39 on ₹15.2L/month adds ~₹4.4L/month revenue.",
    },
    {
      tag: "Cut / re-measure",
      cls: "cut",
      title: "Cut — or re-measure — Watermelon",
      short: "₹8.8L/month (15.1% of budget) returns ₹0.11 per ₹1.",
      metric: "+₹5.4L/mo",
      metricSub: "revenue by moving half to conversion at 1.33 ROAS",
      body:
        "Watermelon Awareness spends ₹8.8L/month (15.1% of the whole budget) and returns ₹0.11 per ₹1 — 1.2% of revenue. It is funded like a performance campaign and judged like one, which suits neither. Either move half (~₹4.4L/month) to conversion, or — if it is a deliberate brand play — stop grading it on ROAS and track reach/CPM instead. Worth: half reallocated at the 1.33 blended ROAS adds ~₹5.4L/month revenue versus ₹0.11 today. Fast follow: Barrier Repair (ROAS 1.03) is below the ~1.43 breakeven.",
    },
  ];

  const FLAGS = [
    {
      title: "Retargeting spend is frozen at ₹9,500",
      body:
        "Looks like a data error; it is a budget cap. Revenue and purchases on capped days are normal (ROAS 4.08 capped vs 4.19 uncapped), so spend is pinned at the ceiling, not missing. Conclusion: a scaling signal, not dirty data.",
      proof: "75 of 180 ad-set days · 41.7%",
    },
    {
      title: "`adset` is not a unique key",
      body:
        "Broad_18-34 exists in both Tinted SPF (Conversions) and Watermelon (Awareness). Aggregating by adset alone silently blends a 1.39-ROAS conversion campaign with a 0.11-ROAS awareness campaign. Always key on campaign + adset + date.",
      proof: "1 duplicate ad-set name · 14 campaign-adset keys",
    },
    {
      title: "Week 20 is an account-wide ROAS collapse",
      body:
        "Every campaign dropped 20–35% in the same week — Tinted 1.48→1.02, Vit-C 1.24→0.95, Barrier 1.01→0.79, Retargeting 4.52→2.91, Lip Balm 1.14→0.90 — then mostly recovered. Unrelated campaigns falling together points to a pixel/tracking outage or site issue. Treat week-20 numbers as untrusted before acting.",
      proof: "Account ROAS 1.41 → 1.01 · week of 11 May",
    },
  ];

  function renderDecisionStrip() {
    document.getElementById("decision-strip").innerHTML = DECISIONS.map(
      (d, i) => `<button class="decision-mini" data-goto="decisions" type="button">
        <div class="tag">${d.tag}</div>
        <h3>${d.title}</h3>
        <p>${d.short}</p>
      </button>`
    ).join("");
  }

  function renderDecisions() {
    document.getElementById("decision-grid").innerHTML = DECISIONS.map(
      (d, i) => `<article class="decision">
        <span class="tag ${d.cls}">${i + 1} · ${d.tag}</span>
        <h3>${d.title}</h3>
        <p class="body">${d.body}</p>
        <div class="impact"><strong>${d.metric}</strong><span>${d.metricSub}</span></div>
      </article>`
    ).join("");
    document.getElementById("flag-grid").innerHTML = FLAGS.map(
      (f) => `<article class="flag"><h3>${f.title}</h3><p>${f.body}</p><span class="proof">${f.proof}</span></article>`
    ).join("");
  }

  // ── charts: overview ─────────────────────────────────────────────────
  function renderOverview(rows) {
    const weekly = groupBy(rows, (r) => monday(r.date)).sort((a, b) => (a.key < b.key ? -1 : 1));
    const labels = weekly.map((w) => weekLabel(w.key));

    draw(
      "ch-weekly",
      [
        barTrace(labels, weekly.map((w) => w.m.spend), "Spend", "rgba(240,98,146,0.72)", {
          hovertemplate: "Spend: ₹%{y:,.0f}<extra></extra>",
        }),
        barTrace(labels, weekly.map((w) => w.m.rev), "Revenue", "rgba(124,111,224,0.78)", {
          hovertemplate: "Revenue: ₹%{y:,.0f}<extra></extra>",
        }),
        lineTrace(labels, weekly.map((w) => w.m.roas), "ROAS", COLORS.orange, {
          hovertemplate: "ROAS: %{y:.2f}x<extra></extra>",
        }),
      ].map((t, i) => (i === 2 ? { ...t, yaxis: "y2" } : t)),
      L({
        barmode: "group",
        hovermode: "x unified",
        yaxis: { tickformat: "~s", title: { text: "₹", font: { size: 9 } } },
        yaxis2: {
          overlaying: "y",
          side: "right",
          showgrid: false,
          tickfont: { color: COLORS.orange, size: 9 },
          title: { text: "ROAS", font: { size: 9, color: COLORS.orange } },
        },
        shapes: [
          {
            type: "line",
            xref: "paper",
            x0: 0,
            x1: 1,
            yref: "y2",
            y0: 1.43,
            y1: 1.43,
            line: { color: COLORS.green, width: 1, dash: "dot" },
          },
        ],
      })
    );

    const trend = (id, values, color, hover, tickformat, extra = {}) =>
      draw(
        id,
        [lineTrace(labels, values, "", color, { hovertemplate: hover, fill: "tozeroy", fillcolor: `${color}18` })],
        L({
          showlegend: false,
          yaxis: { tickformat, ...(extra.yaxis || {}) },
          ...extra.layout,
        })
      );

    trend("ch-roas-trend", weekly.map((w) => w.m.roas), COLORS.orange, "ROAS: %{y:.2f}x<extra></extra>", ".2f", {
      yaxis: { ticksuffix: "x" },
    });
    trend("ch-ctr-trend", weekly.map((w) => w.m.ctr), COLORS.blue, "CTR: %{y:.2f}%<extra></extra>", ".2f", {
      yaxis: { ticksuffix: "%" },
    });
    trend("ch-cpa-trend", weekly.map((w) => w.m.cpa), COLORS.pink, "CPA: ₹%{y:,.0f}<extra></extra>", ",.0f");

    const daily = groupBy(rows, (r) => r.date).sort((a, b) => (a.key < b.key ? -1 : 1));
    draw(
      "ch-daily",
      [
        lineTrace(daily.map((d) => d.key), daily.map((d) => d.m.spend), "Spend", COLORS.pink, {
          fill: "tozeroy",
          fillcolor: "rgba(240,98,146,0.10)",
          hovertemplate: "Spend: ₹%{y:,.0f}<extra></extra>",
        }),
        lineTrace(daily.map((d) => d.key), daily.map((d) => d.m.rev), "Revenue", COLORS.accent, {
          fill: "tozeroy",
          fillcolor: "rgba(124,111,224,0.10)",
          hovertemplate: "Revenue: ₹%{y:,.0f}<extra></extra>",
        }),
      ],
      L({
        hovermode: "x unified",
        yaxis: { tickformat: "~s" },
        xaxis: { type: "date", tickformat: "%d %b" },
      })
    );
  }

  // ── charts: campaigns ────────────────────────────────────────────────
  function renderCampaigns(rows) {
    const byCamp = groupBy(rows, (r) => r.c).sort((a, b) => b.m.spend - a.m.spend);
    const names = byCamp.map((c) => campaignName(c.key));
    const colors = byCamp.map((c) => campaignColor(c.key));

    draw(
      "ch-camp-spend",
      [
        {
          type: "bar",
          orientation: "h",
          name: "Spend",
          x: byCamp.map((c) => c.m.spend),
          y: names,
          marker: { color: "rgba(240,98,146,0.75)", line: { width: 0 } },
          hovertemplate: "Spend: ₹%{x:,.0f}<extra></extra>",
        },
        {
          type: "bar",
          orientation: "h",
          name: "Revenue",
          x: byCamp.map((c) => c.m.rev),
          y: names,
          marker: { color: "rgba(124,111,224,0.8)", line: { width: 0 } },
          hovertemplate: "Revenue: ₹%{x:,.0f}<extra></extra>",
        },
      ],
      L({
        barmode: "group",
        margin: { l: 110, r: 20, t: 8, b: 38 },
        xaxis: { tickformat: "~s" },
        yaxis: { autorange: "reversed" },
      })
    );

    draw(
      "ch-camp-roas",
      [barTrace(names, byCamp.map((c) => c.m.roas), "ROAS", colors, { hovertemplate: "ROAS: %{y:.2f}x<extra></extra>" })],
      L({
        showlegend: false,
        margin: { l: 110, r: 20, t: 8, b: 38 },
        yaxis: { ticksuffix: "x" },
        shapes: [
          { type: "line", xref: "paper", x0: 0, x1: 1, yref: "y", y0: 1.43, y1: 1.43, line: { color: COLORS.green, width: 1, dash: "dot" } },
        ],
      })
    );

    draw(
      "ch-camp-ctr",
      [barTrace(names, byCamp.map((c) => c.m.ctr), "CTR", colors, { hovertemplate: "CTR: %{y:.2f}%<extra></extra>" })],
      L({ showlegend: false, margin: { l: 110, r: 20, t: 8, b: 38 }, yaxis: { ticksuffix: "%" } })
    );

    draw(
      "ch-camp-cpa",
      [barTrace(names, byCamp.map((c) => c.m.cpa), "CPA", colors, { hovertemplate: "CPA: ₹%{y:,.0f}<extra></extra>" })],
      L({ showlegend: false, margin: { l: 110, r: 20, t: 8, b: 38 } })
    );

    const donut = (id, values) =>
      draw(
        id,
        [
          {
            type: "pie",
            hole: 0.62,
            labels: names,
            values,
            marker: { colors, line: { color: "#0d0f1a", width: 2 } },
            textinfo: "percent",
            textfont: { size: 10, color: COLORS.text },
            hovertemplate: "%{label}: ₹%{value:,.0f}<br>%{percent}<extra></extra>",
          },
        ],
        L({ showlegend: true, margin: { l: 8, r: 8, t: 8, b: 8 }, legend: { orientation: "h", y: -0.05, font: { size: 8 } } })
      );

    donut("ch-spend-donut", byCamp.map((c) => c.m.spend));
    donut("ch-rev-donut", byCamp.map((c) => c.m.rev));

    const maxSpend = Math.max(...byCamp.map((c) => c.m.spend), 1);
    draw(
      "ch-bubble",
      [
        {
          type: "scatter",
          mode: "markers+text",
          x: byCamp.map((c) => c.m.ctr),
          y: byCamp.map((c) => c.m.cvr),
          text: names,
          textposition: "top center",
          textfont: { size: 9, color: COLORS.muted },
          marker: {
            size: byCamp.map((c) => c.m.spend),
            sizemode: "area",
            sizeref: (2 * maxSpend) / (42 * 42),
            sizemin: 8,
            color: colors,
            opacity: 0.82,
            line: { color: "#0d0f1a", width: 1 },
          },
          customdata: byCamp.map((c) => [c.m.spend, c.m.roas, c.m.cpa]),
          hovertemplate:
            "<b>%{text}</b><br>CTR: %{x:.2f}%<br>CVR: %{y:.2f}%<br>Spend: ₹%{customdata[0]:,.0f}<br>ROAS: %{customdata[1]:.2f}x<br>CPA: ₹%{customdata[2]:,.0f}<extra></extra>",
        },
      ],
      L({
        showlegend: false,
        xaxis: { title: { text: "CTR %", font: { size: 10 } }, ticksuffix: "%" },
        yaxis: { title: { text: "CVR %", font: { size: 10 } }, ticksuffix: "%" },
      })
    );
  }

  // ── charts: audience / budget ────────────────────────────────────────
  function renderAudience(rows) {
    const byObj = groupBy(rows, (r) => DATA.objectives[r.o]);
    draw(
      "ch-objective",
      [
        barTrace(byObj.map((o) => o.key), byObj.map((o) => o.m.spend), "Spend", "rgba(240,98,146,0.75)", {
          hovertemplate: "Spend: ₹%{y:,.0f}<extra></extra>",
        }),
        barTrace(byObj.map((o) => o.key), byObj.map((o) => o.m.rev), "Revenue", "rgba(124,111,224,0.8)", {
          hovertemplate: "Revenue: ₹%{y:,.0f}<extra></extra>",
        }),
      ],
      L({ barmode: "group", yaxis: { tickformat: "~s", tickprefix: "₹" } })
    );

    const ret = rows.filter((r) => r.c === 3);
    const capped = ret.filter((r) => r.capped === 1);
    const uncapped = ret.filter((r) => r.capped === 0);
    const cm = agg(capped);
    const um = agg(uncapped);
    draw(
      "ch-capped",
      [
        {
          type: "bar",
          x: ["Capped days", "Uncapped days"],
          y: [cm.spend ? cm.roas : 0, um.spend ? um.roas : 0],
          marker: { color: [COLORS.orange, COLORS.green], line: { width: 0 } },
          text: [cm.spend ? `${cm.roas.toFixed(2)}x` : "no rows", um.spend ? `${um.roas.toFixed(2)}x` : "no rows"],
          textposition: "outside",
          textfont: { size: 11, color: COLORS.text },
          customdata: [
            [cm.spend, cm.rev, capped.length],
            [um.spend, um.rev, uncapped.length],
          ],
          hovertemplate:
            "%{x}<br>ROAS: %{y:.2f}x<br>Spend: ₹%{customdata[0]:,.0f}<br>Revenue: ₹%{customdata[1]:,.0f}<br>Ad-set days: %{customdata[2]}<extra></extra>",
        },
      ],
      L({
        showlegend: false,
        margin: { l: 56, r: 16, t: 36, b: 38 },
        yaxis: { ticksuffix: "x", range: [0, Math.max(cm.roas, um.roas, 1) * 1.28] },
        annotations: [
          {
            text: ret.length
              ? `${capped.length} of ${ret.length} retargeting ad-set days are capped · spend ₹${fmtINR(cm.spend)} vs ₹${fmtINR(um.spend)}`
              : "Retargeting not in the current filter",
            showarrow: false,
            x: 0.5,
            y: 1.06,
            xref: "paper",
            yref: "paper",
            font: { size: 9, color: COLORS.muted },
          },
        ],
      })
    );

    const weekly = groupBy(rows, (r) => monday(r.date)).sort((a, b) => (a.key < b.key ? -1 : 1));
    const campKeys = [...state.camps].sort((a, b) => a - b);
    const z = campKeys.map((c) =>
      weekly.map((w) => {
        const rs = w.rows.filter((r) => r.c === c);
        return rs.length ? agg(rs).roas : null;
      })
    );
    draw(
      "ch-heatmap",
      [
        {
          type: "heatmap",
          x: weekly.map((w) => weekLabel(w.key)),
          y: campKeys.map((c) => campaignName(c)),
          z,
          zmin: 0,
          zmax: 2.5,
          colorscale: [
            [0, "#4a1f2e"],
            [0.35, "#7a3b3b"],
            [0.6, "#2f5d50"],
            [1, "#1f7a5a"],
          ],
          text: z.map((row) => row.map((v) => (v == null ? "" : v.toFixed(2)))),
          texttemplate: "%{text}",
          textfont: { size: 8, color: "rgba(232,234,246,0.85)" },
          hovertemplate: "%{y}<br>%{x}<br>ROAS: %{z:.2f}x<extra></extra>",
          colorbar: { thickness: 8, tickfont: { size: 8, color: COLORS.muted }, outlinewidth: 0 },
        },
      ],
      L({ margin: { l: 105, r: 10, t: 8, b: 38 } })
    );

    const retDaily = groupBy(ret, (r) => r.date).sort((a, b) => (a.key < b.key ? -1 : 1));
    draw(
      "ch-retarget-daily",
      [
        lineTrace(retDaily.map((d) => d.key), retDaily.map((d) => d.m.spend), "Daily spend", COLORS.orange, {
          hovertemplate: "Spend: ₹%{y:,.0f}<extra></extra>",
        }),
        {
          type: "scatter",
          mode: "markers",
          name: "Capped",
          x: ret.filter((r) => r.capped === 1).map((r) => r.date),
          y: ret.filter((r) => r.capped === 1).map((r) => r.spend),
          marker: { color: COLORS.red, size: 6, symbol: "circle" },
          hovertemplate: "Capped: ₹%{y:,.0f}<extra></extra>",
        },
      ],
      L({
        showlegend: true,
        xaxis: { type: "date", tickformat: "%d %b" },
        yaxis: { tickformat: "~s" },
        annotations: ret.length
          ? []
          : [{ text: "Retargeting is not in the current campaign filter", showarrow: false, x: 0.5, y: 0.5, xref: "paper", yref: "paper", font: { size: 11, color: COLORS.muted } }],
      })
    );
  }

  // ── data table / download ────────────────────────────────────────────
  function renderData(rows) {
    const byCamp = groupBy(rows, (r) => r.c).sort((a, b) => b.m.spend - a.m.spend);
    const m = agg(rows);
    document.getElementById("data-summary").textContent =
      `${rows.length.toLocaleString("en-IN")} ad-set/day rows · ${fmtDate(state.start)} — ${fmtDate(state.end)} · ${state.camps.size} campaign${state.camps.size === 1 ? "" : "s"}`;

    const head = ["Campaign", "Spend", "Revenue", "ROAS", "CTR", "CPA", "Orders", "Contribution"];
    const body = byCamp
      .map(
        (c) => `<tr>
          <td>${campaignName(c.key)}</td>
          <td>${fmtINR(c.m.spend)}</td>
          <td>${fmtINR(c.m.rev)}</td>
          <td class="${c.m.roas >= 1.43 ? "good" : "bad"}">${c.m.roas.toFixed(2)}x</td>
          <td>${fmtPct(c.m.ctr)}</td>
          <td>${fmtINR(c.m.cpa)}</td>
          <td>${fmtInt(c.m.purch)}</td>
          <td class="${c.m.contribution >= 0 ? "good" : "bad"}">${fmtINR(c.m.contribution)}</td>
        </tr>`
      )
      .join("");
    const total = `<tr>
      <td><strong>Total</strong></td><td><strong>${fmtINR(m.spend)}</strong></td><td><strong>${fmtINR(m.rev)}</strong></td>
      <td class="${m.roas >= 1.43 ? "good" : "bad"}"><strong>${m.roas.toFixed(2)}x</strong></td>
      <td><strong>${fmtPct(m.ctr)}</strong></td><td><strong>${fmtINR(m.cpa)}</strong></td>
      <td><strong>${fmtInt(m.purch)}</strong></td><td class="${m.contribution >= 0 ? "good" : "bad"}"><strong>${fmtINR(m.contribution)}</strong></td>
    </tr>`;
    document.querySelector("#data-table thead").innerHTML = `<tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr>`;
    document.querySelector("#data-table tbody").innerHTML = body + total;
  }

  function downloadCsv() {
    const rows = activeRows();
    const head = ["date", "week", "campaign", "objective", "adset_index", "spend_inr", "impressions", "clicks", "purchases", "revenue_inr", "spend_capped"];
    const lines = [head.join(",")];
    for (const r of rows) {
      lines.push(
        [r.date, `W${r.week}`, campaignName(r.c), DATA.objectives[r.o], r.c, r.spend, r.imps, r.clicks, r.purch, r.rev, r.capped].join(",")
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dk_ads_filtered_${state.start}_${state.end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── tabs / filters ───────────────────────────────────────────────────
  function setTab(tab) {
    state.tab = tab;
    document.querySelectorAll(".tab").forEach((b) => {
      const on = b.dataset.tab === tab;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === `tab-${tab}`));
    renderTab();
  }

  function renderTab() {
    const rows = activeRows();
    if (state.tab === "overview") renderOverview(rows);
    else if (state.tab === "campaigns") renderCampaigns(rows);
    else if (state.tab === "audience") renderAudience(rows);
    else if (state.tab === "data") renderData(rows);
  }

  function renderAll() {
    const rows = activeRows();
    renderHeader(rows);
    renderKpis(rows);
    renderDecisionStrip();
    renderTab();
  }

  function renderFilters() {
    const menu = document.getElementById("camp-menu");
    menu.innerHTML = `
      <div style="display:flex;gap:8px;padding:2px 4px 8px;">
        <button type="button" class="reset" data-all="1" style="min-height:28px;padding:4px 8px;font-size:10px;">All</button>
        <button type="button" class="reset" data-all="0" style="min-height:28px;padding:4px 8px;font-size:10px;">None</button>
      </div>
      ${CAMPAIGNS.map(
        (c, i) => `<label>
          <input type="checkbox" value="${i}" ${state.camps.has(i) ? "checked" : ""} />
          <span class="swatch" style="background:${c.color}"></span>
          <span>${c.name}</span>
        </label>`
      ).join("")}`;
    document.getElementById("camp-count").textContent = `${state.camps.size} of ${CAMPAIGNS.length}`;
    document.getElementById("date-start").value = state.start;
    document.getElementById("date-end").value = state.end;
    document.getElementById("date-start").min = MIN_DATE;
    document.getElementById("date-end").max = MAX_DATE;
    document.getElementById("date-start").max = MAX_DATE;
    document.getElementById("date-end").min = MIN_DATE;
    document.getElementById("objective").value = state.objective;
  }

  function wire() {
    document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));
    // The decision strip is re-rendered on every filter change, so use delegation.
    document.addEventListener("click", (e) => {
      const go = e.target.closest("[data-goto]");
      if (go) setTab(go.dataset.goto);
    });

    document.getElementById("date-start").addEventListener("change", (e) => {
      state.start = e.target.value || MIN_DATE;
      if (state.start > state.end) state.end = state.start;
      renderFilters();
      renderAll();
    });
    document.getElementById("date-end").addEventListener("change", (e) => {
      state.end = e.target.value || MAX_DATE;
      if (state.end < state.start) state.start = state.end;
      renderFilters();
      renderAll();
    });
    document.getElementById("objective").addEventListener("change", (e) => {
      state.objective = e.target.value;
      renderAll();
    });
    document.getElementById("camp-menu").addEventListener("change", (e) => {
      const i = Number(e.target.value);
      if (e.target.checked) state.camps.add(i);
      else state.camps.delete(i);
      document.getElementById("camp-count").textContent = `${state.camps.size} of ${CAMPAIGNS.length}`;
      renderAll();
    });
    document.getElementById("camp-menu").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-all]");
      if (!btn) return;
      const all = btn.dataset.all === "1";
      state.camps = all ? new Set(ALL_CAMPS) : new Set();
      renderFilters();
      renderAll();
      document.getElementById("camp-filter").removeAttribute("open");
    });
    document.getElementById("reset").addEventListener("click", () => {
      state.start = MIN_DATE;
      state.end = MAX_DATE;
      state.camps = new Set(ALL_CAMPS);
      state.objective = "all";
      renderFilters();
      renderAll();
    });
    document.getElementById("download").addEventListener("click", downloadCsv);

    window.addEventListener("resize", () => {
      document.querySelectorAll(".tab-panel.active .js-plotly-plot").forEach((el) => Plotly.Plots.resize(el));
    });
  }

  function init() {
    renderFilters();
    renderDecisions();
    wire();
    renderAll();
    setTab("overview");
  }

  init();
})();
