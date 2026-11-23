// Data-science lab: every card analyses the simulation configured at the top of the page.
(function () {
  const $ = (id) => document.getElementById(id);
  let T = Theme.get();
  const pct = (v, d) => (v * 100).toFixed(d === undefined ? 1 : d) + "%";
  const fmt = (v) => String(+Number(v).toPrecision(3));
  const clamp = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
  const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

  // ---------- tiny plotting library ----------
  function prep(canvas) {
    T = Theme.get();
    const dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = +canvas.getAttribute("height");
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    ctx.font = "12px Inter, system-ui, sans-serif"; return { ctx, w, h };
  }
  function plot(canvas, o) {
    const { ctx, w, h } = prep(canvas), m = o.m || { l: 54, r: 14, t: o.series && o.series.some((s) => s.label) ? 30 : 14, b: 40 };
    const iw = w - m.l - m.r, ih = h - m.t - m.b, lg = o.logx, xf = (v) => (lg ? Math.log10(v) : v);
    const x0 = xf(o.xmin), x1 = xf(o.xmax);
    const X = (v) => m.l + ((xf(v) - x0) / (x1 - x0)) * iw, Y = (v) => m.t + ih - ((v - o.ymin) / (o.ymax - o.ymin)) * ih;
    ctx.lineWidth = 1; ctx.strokeStyle = T.line; ctx.fillStyle = T.muted;
    for (let i = 0; i <= 4; i++) {
      const v = o.ymin + ((o.ymax - o.ymin) * i) / 4, y = Y(v);
      ctx.beginPath(); ctx.moveTo(m.l, y); ctx.lineTo(w - m.r, y); ctx.stroke();
      ctx.textAlign = "right"; ctx.fillText(o.yfmt ? o.yfmt(v) : (o.ymax - o.ymin >= 10 ? String(Math.round(v)) : fmt(v)), m.l - 6, y + 4);
    }
    const ticks = [];
    if (lg) for (let e = Math.ceil(x0); e <= Math.floor(x1); e++) ticks.push(Math.pow(10, e));
    else for (let i = 0; i <= 5; i++) ticks.push(o.xmin + ((o.xmax - o.xmin) * i) / 5);
    ctx.textAlign = "center"; ticks.forEach((v) => ctx.fillText(o.xfmt ? o.xfmt(v) : (o.xmax - o.xmin >= 10 ? String(Math.round(v)) : fmt(v)), X(v), h - m.b + 16));
    if (o.xlabel) ctx.fillText(o.xlabel, m.l + iw / 2, h - 4);
    if (o.ylabel) { ctx.save(); ctx.translate(13, m.t + ih / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(o.ylabel, 0, 0); ctx.restore(); }
    ctx.save(); ctx.beginPath(); ctx.rect(m.l, m.t - 2, iw, ih + 4); ctx.clip();
    (o.series || []).forEach((s) => {
      ctx.setLineDash(s.dash || []); ctx.lineWidth = s.width || 2; ctx.strokeStyle = s.color; ctx.fillStyle = s.color;
      if (s.type === "band") {
        ctx.globalAlpha = 0.18; ctx.beginPath();
        s.x.forEach((v, i) => (i ? ctx.lineTo(X(v), Y(s.hi[i])) : ctx.moveTo(X(v), Y(s.hi[i]))));
        for (let i = s.x.length - 1; i >= 0; i--) ctx.lineTo(X(s.x[i]), Y(s.lo[i]));
        ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
      } else if (s.type === "bars") {
        s.x.forEach((v, i) => { ctx.fillStyle = typeof s.color === "function" ? s.color(i) : s.color; const a = X(v - s.w / 2), b = X(v + s.w / 2), y = Y(s.y[i]); ctx.fillRect(a + 1, y, Math.max(1, b - a - 2), Y(o.ymin) - y); });
      } else if (s.type === "points") {
        s.x.forEach((v, i) => { ctx.beginPath(); ctx.arc(X(v), Y(s.y[i]), s.r || 4, 0, 6.3); ctx.fill(); });
      } else if (s.type === "hline") {
        ctx.beginPath(); ctx.moveTo(m.l, Y(s.y)); ctx.lineTo(w - m.r, Y(s.y)); ctx.stroke();
      } else if (s.type === "vline") {
        ctx.beginPath(); ctx.moveTo(X(s.x), m.t); ctx.lineTo(X(s.x), m.t + ih); ctx.stroke();
      } else {
        ctx.globalAlpha = s.alpha || 1; ctx.beginPath();
        s.x.forEach((v, i) => (i ? ctx.lineTo(X(v), Y(s.y[i])) : ctx.moveTo(X(v), Y(s.y[i])))); ctx.stroke(); ctx.globalAlpha = 1;
      }
    });
    ctx.restore(); ctx.setLineDash([]);
    let lx = m.l; ctx.textAlign = "left";
    (o.series || []).filter((s) => s.label).forEach((s) => {
      ctx.fillStyle = s.color; ctx.fillRect(lx, 10, 14, 4); ctx.fillStyle = T.ink; ctx.fillText(s.label, lx + 19, 16); lx += 30 + ctx.measureText(s.label).width;
    });
    return { ctx, X, Y, m, iw, ih, w, h };
  }
  const ramp = (v) => { // accent (bad) -> cream -> blue (good)
    const lo = [154, 59, 46], mid = [241, 233, 220], hi = [47, 102, 144], t = Math.min(1, Math.max(0, v));
    const a = t < 0.5 ? lo : mid, b = t < 0.5 ? mid : hi, u = t < 0.5 ? t * 2 : (t - 0.5) * 2;
    return a.map((c, i) => Math.round(c + (b[i] - c) * u));
  };

  // ---------- state ----------
  let S = null;
  function readSettings() {
    const p = {
      walks: Math.round(clamp(+$("lab-walks").value, 200, 20000, 2000)),
      steps: Math.round(clamp(+$("lab-steps").value, 10, 300, 100)),
      target: Math.round(clamp(+$("lab-target").value, 1, 1800, 60)),
      clumsy: clamp(+$("lab-clumsy").value, 0, 100, 0.1) / 100,
      seed: $("lab-seed").value === "" ? null : +$("lab-seed").value,
    };
    $("lab-walks").value = p.walks; $("lab-steps").value = p.steps; $("lab-target").value = p.target;
    return p;
  }
  function runSettings() {
    const p = readSettings(), res = Sim.simulate(p);
    S = { p, res };
    $("lab-status").innerHTML = "Analysing <b>" + res.ends.length.toLocaleString() + "</b> simulated walks of <b>" + p.steps +
      "</b> rolls. Target step <b>" + p.target + "</b>, clumsiness <b>" + (p.clumsy * 100).toFixed(2) + "%</b>. Simulated win chance: <b>" + pct(res.chance) + "</b>.";
    document.querySelectorAll(".lab-card .out").forEach((e) => (e.innerHTML = ""));
    document.querySelectorAll(".lab-card canvas").forEach((c) => c.getContext("2d").clearRect(0, 0, c.width, c.height));
  }
  const kv = (rows) => "<dl class=\"kv\">" + rows.map((r) => "<dt>" + r[0] + "</dt><dd>" + r[1] + "</dd>").join("") + "</dl>";
  const table = (head, rows) => "<table class=\"tbl\"><thead><tr>" + head.map((h) => "<th>" + h + "</th>").join("") + "</tr></thead><tbody>" +
    rows.map((r) => "<tr>" + r.map((c) => "<td>" + c + "</td>").join("") + "</tr>").join("") + "</tbody></table>";

  // ---------- the cards ----------
  const cards = [];

  cards.push({
    id: "exact", title: "1. The exact answer (no simulation needed)", tags: ["Markov chain", "dynamic programming", "validation"], canvas: 280, button: "Compute the exact answer",
    look: "Simulation gives an estimate. Because each roll only depends on where you are standing, the game is a <b>Markov chain</b>, and we can calculate the exact odds by tracking the probability of every step, one roll at a time. Does the simulation agree?",
    read: "Bars are the simulated share of walks ending in each range of steps. The line is the exact probability for the same range. If the line runs through the tops of the bars, the simulation is trustworthy. The KS number is the largest gap between the two cumulative curves.",
    mean: "The simulation is a good estimate of the true odds, and the exact answer shows how far off it can be. Having an exact answer to test against is what makes the later machine-learning results meaningful.",
    next: "How many walks do we need before the estimate settles? Card 2.",
    run() {
      const { p, res } = S, n = res.ends.length, dist = Stats.stepDist(p.steps, p.clumsy), ex = Stats.tail(dist, p.target);
      const [lo, hi] = Stats.wilson(res.wins, n), ks = Stats.ksDiscrete(res.ends, dist);
      const maxEnd = Math.max(p.target, ...res.ends), nb = Math.min(40, maxEnd + 1), bw = (maxEnd + 1) / nb;
      const sb = new Array(nb).fill(0), eb = new Array(nb).fill(0);
      res.ends.forEach((e) => sb[Math.min(nb - 1, Math.floor(e / bw))]++);
      for (let s = 0; s < dist.length; s++) if (dist[s]) eb[Math.min(nb - 1, Math.floor(s / bw))] += dist[s];
      const xs = sb.map((_, i) => (i + 0.5) * bw), sf = sb.map((c) => c / n);
      plot($("exact-c"), { xmin: 0, xmax: maxEnd + 1, ymin: 0, ymax: Math.max(...sf, ...eb) * 1.15, xlabel: "Final step", ylabel: "Share of walks", yfmt: (v) => pct(v, 0),
        series: [{ type: "bars", x: xs, y: sf, w: bw, color: (i) => (xs[i] - bw / 2 >= p.target ? T.win : T.lose), label: "Simulated" },
          { x: xs, y: eb, color: T.accent, width: 2.5, label: "Exact" }, { type: "vline", x: p.target, color: T.gold, dash: [6, 4], width: 1.5 }] });
      return kv([["Exact chance (Markov chain)", "<b>" + pct(ex, 2) + "</b>"],
        ["Simulated chance", pct(res.wins / n, 2) + " (95% interval " + pct(lo) + " to " + pct(hi) + ")"],
        ["Exact value inside the interval?", ex >= lo && ex <= hi ? "Yes" : "No (this happens about 1 time in 20 by chance)"],
        ["KS distance between curves", ks.D.toFixed(4) + " (about " + ks.critical.toFixed(4) + " is expected from noise alone)"]]);
    },
  });

  cards.push({
    id: "conv", title: "2. How many walks is enough?", tags: ["law of large numbers", "confidence interval", "bootstrap"], canvas: 300, button: "Show the estimate settling",
    look: "Every simulation result has a margin of error. We want to see how the estimate and its uncertainty change as walks are added, and to compare two ways of measuring that uncertainty.",
    read: "Horizontal axis is the number of walks used (log scale). The solid line is the running estimate of the win chance, the shaded band is its 95% confidence interval (Wilson method), and the dashed line is the exact answer. The band should shrink and keep catching the dashed line.",
    mean: "Early estimates swing wildly; later ones settle. Error shrinks with the square root of the number of walks, so cutting the error in half takes four times as many. The bootstrap, which re-draws the walks at random thousands of times, gives nearly the same interval without any formula.",
    next: "Instead of one range, can we show every plausible win chance? Card 3.",
    run() {
      const { p, res } = S, ind = res.ends.map((e) => (e >= p.target ? 1 : 0)), N = ind.length, pre = [0];
      ind.forEach((v, i) => pre.push(pre[i] + v));
      const ns = [...new Set(Array.from({ length: 61 }, (_, i) => Math.round(Math.pow(10, 1 + ((Math.log10(N) - 1) * i) / 60))))];
      const est = ns.map((n) => pre[n] / n), ci = ns.map((n) => Stats.wilson(pre[n], n)), ex = Stats.tail(Stats.stepDist(p.steps, p.clumsy), p.target);
      const c = pre[N] / N;
      plot($("conv-c"), { logx: true, xmin: 10, xmax: N, ymin: Math.max(0, c - 0.25), ymax: Math.min(1, c + 0.25), xlabel: "Number of walks used", ylabel: "Win chance", yfmt: (v) => pct(v, 0),
        series: [{ type: "band", x: ns, lo: ci.map((v) => v[0]), hi: ci.map((v) => v[1]), color: T.win }, { x: ns, y: est, color: T.win, label: "Running estimate" },
          { type: "hline", y: ex, color: T.accent, dash: [6, 4], label: "Exact answer" }] });
      const rng = Sim.makeRng(null), bp = Stats.bootstrapCI(ind, 500, rng), bm = Stats.bootstrapCI(res.ends, 500, rng), w = ci[ci.length - 1];
      const mean = res.ends.reduce((a, b) => a + b, 0) / N;
      return kv([["Win chance with all " + N.toLocaleString() + " walks", "<b>" + pct(c) + "</b> &plusmn; " + ((w[1] - w[0]) * 50).toFixed(1) + " points"],
        ["Wilson 95% interval", pct(w[0]) + " to " + pct(w[1])], ["Bootstrap 95% interval (500 re-draws)", pct(bp[0]) + " to " + pct(bp[1])],
        ["Average final step, bootstrap 95% interval", mean.toFixed(1) + " (" + bm[0].toFixed(1) + " to " + bm[1].toFixed(1) + ")"]]);
    },
  });

  cards.push({
    id: "bayes", title: "3. Bayesian view: what win chances are plausible?", tags: ["Bayesian inference", "Beta-Binomial", "credible interval"], canvas: 280, button: "Update beliefs with the data",
    look: "Start knowing nothing (every win chance from 0% to 100% equally likely). As walks come in, update that belief. We want the full range of plausible win chances, not a single number.",
    read: "Each curve is the belief about the true win chance after seeing that many walks. Taller and narrower means more certain. Where a curve is highest is the most plausible value; the 95% credible interval is the range holding 95% of the belief.",
    mean: "With 10 walks the belief is broad. With thousands it is a narrow spike over the right answer. This is the same message as card 2 told another way: the credible interval answers \"how likely is the true chance in this range?\" directly.",
    next: "Can we know the odds <i>during</i> a walk, not just at the start? Card 4.",
    run() {
      const { p, res } = S, ind = res.ends.map((e) => (e >= p.target ? 1 : 0)), N = ind.length;
      const sizes = [...new Set([Math.min(10, N), Math.min(100, N), N])], cols = [T.lose, T.gold, T.accent];
      const c = ind.reduce((a, b) => a + b, 0) / N, xmin = Math.max(0, c - 0.4), xmax = Math.min(1, c + 0.25);
      const grid = Array.from({ length: 500 }, (_, i) => xmin + ((i + 0.5) / 500) * (xmax - xmin));
      const rows = [], series = [];
      let ymax = 0;
      sizes.forEach((m, i) => {
        const wins = ind.slice(0, m).reduce((a, b) => a + b, 0), post = Stats.betaPosterior(wins, m, grid), q = Stats.betaQuantiles(post.a, post.b, [0.025, 0.975]);
        ymax = Math.max(ymax, ...post.pdf); series.push({ x: grid, y: post.pdf, color: cols[i], width: 2.5, label: m.toLocaleString() + " walks" });
        rows.push([m.toLocaleString(), pct(post.mean), pct(q[0]) + " to " + pct(q[1])]);
      });
      plot($("bayes-c"), { xmin, xmax, ymin: 0, ymax: ymax * 1.1, xlabel: "True win chance", ylabel: "Belief (density)", xfmt: (v) => pct(v, 0), yfmt: (v) => fmt(v), series });
      return table(["Walks seen", "Best guess (posterior mean)", "95% credible interval"], rows);
    },
  });

  cards.push({
    id: "vm", title: "4. Win-probability map (a value function)", tags: ["dynamic programming", "reinforcement learning idea", "Markov decision process"], canvas: 380, button: "Draw the map",
    controls: "<p class=\"hover\" id=\"vm-hover\">Hover over the map to read a value.</p>",
    look: "Halfway through a climb, how good is your position? For every possible (roll number, step) pair we calculate the chance of still reaching the target, working backwards from the last roll. Reinforcement learning calls this table a <b>value function</b>.",
    read: "Horizontal axis is the roll you have just finished, vertical axis the step you are standing on. Blue means you are very likely to win from there, rust means you are very likely to lose, cream is a coin flip. The dark line is the first simulated walk travelling across the map. Hover to read the exact chance.",
    mean: "The map is the answer to \"what are my odds right now?\" The edge between rust and blue is the line of no return: below it, even good luck rarely saves you. It also gives the best possible prediction at every moment, which the machine-learning models in card 7 are measured against.",
    next: "How sensitive are the odds to the rules themselves? Card 5.",
    run() {
      const { p, res } = S, V = Stats.valueMap(p.steps, p.target, p.clumsy), ymaxS = Math.min(6 * p.steps, Math.round(p.target * 1.8) + 10);
      const cv = $("vm-c"), o = plot(cv, { xmin: 0, xmax: p.steps + 1, ymin: 0, ymax: ymaxS + 1, xlabel: "Roll number", ylabel: "Step you are standing on" });
      const off = document.createElement("canvas"); off.width = p.steps + 1; off.height = ymaxS + 1;
      const octx = off.getContext("2d"), img = octx.createImageData(off.width, off.height);
      for (let t = 0; t <= p.steps; t++) for (let s = 0; s <= ymaxS; s++) {
        const v = V[t][s], i = ((ymaxS - s) * off.width + t) * 4;
        if (Number.isNaN(v)) { img.data[i + 3] = 0; continue; }
        const c = ramp(v); img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
      }
      octx.putImageData(img, 0, 0); o.ctx.imageSmoothingEnabled = false; o.ctx.drawImage(off, o.m.l, o.m.t, o.iw, o.ih);
      o.ctx.save(); o.ctx.beginPath(); o.ctx.rect(o.m.l, o.m.t, o.iw, o.ih); o.ctx.clip();
      o.ctx.strokeStyle = T.ink; o.ctx.lineWidth = 2; o.ctx.beginPath();
      res.all[0].forEach((s, t) => (t ? o.ctx.lineTo(o.X(t + 0.5), o.Y(s + 0.5)) : o.ctx.moveTo(o.X(t + 0.5), o.Y(s + 0.5)))); o.ctx.stroke(); o.ctx.restore();
      o.ctx.strokeStyle = T.line; o.ctx.strokeRect(o.m.l, o.m.t, o.iw, o.ih);
      cv.onmousemove = (e) => {
        const r = cv.getBoundingClientRect(), t = Math.floor(((e.clientX - r.left - o.m.l) / o.iw) * (p.steps + 1)), s = ymaxS - Math.floor(((e.clientY - r.top - o.m.t) / o.ih) * (ymaxS + 1));
        const h = $("vm-hover");
        if (t < 0 || t > p.steps || s < 0 || s > ymaxS) { h.textContent = "Hover over the map to read a value."; return; }
        const v = V[t][s]; h.innerHTML = Number.isNaN(v) ? "After roll " + t + ", step " + s + " cannot be reached." : "After roll <b>" + t + "</b> on step <b>" + s + "</b>: <b>" + pct(v) + "</b> chance of reaching " + p.target + ".";
      };
      return kv([["Chance at the very start", "<b>" + pct(V[0][0], 2) + "</b> (matches the exact answer in card 1)"],
        ["Halfway (roll " + Math.round(p.steps / 2) + ") standing on step " + Math.round(p.target / 2), pct(V[Math.round(p.steps / 2)][Math.round(p.target / 2)])]]);
    },
  });

  cards.push({
    id: "sens", title: "5. Sensitivity: change the rules, watch the odds", tags: ["sensitivity analysis", "parameter sweep", "exact computation"], button: "Build the table",
    look: "Which setting matters most: the target or the clumsiness? We sweep both and compute the exact win chance for every combination.",
    read: "Each cell is the chance of winning for that target (columns) and clumsiness (rows). Blue is a good bet, rust is a poor one. The outlined cell is the setting you are analysing.",
    mean: "Reading across a row shows how quickly the odds collapse as the target gets harder. Reading down a column shows that clumsiness matters far less at small targets, where a fall costs little, and more as the target rises.",
    next: "Can a machine learn these odds from examples alone? Card 7. First, how early is the outcome knowable? Card 6.",
    run() {
      const { p } = S, cs = [...new Set([0, 0.0005, 0.001, 0.002, 0.005, 0.01, 0.02, p.clumsy])].sort((a, b) => a - b);
      const ts = [...new Set([0.4, 0.6, 0.8, 1, 1.2, 1.4, 1.6].map((f) => Math.max(1, Math.round(f * p.target))))].sort((a, b) => a - b);
      const rows = cs.map((c) => { const d = Stats.stepDist(p.steps, c); return [c, ts.map((t) => Stats.tail(d, t))]; });
      let h = "<table class=\"tbl heat\"><thead><tr><th>Clumsiness \\ Target</th>" + ts.map((t) => "<th>" + t + "</th>").join("") + "</tr></thead><tbody>";
      rows.forEach(([c, vals]) => {
        h += "<tr><th>" + (c * 100).toFixed(2) + "%</th>" + vals.map((v, j) => {
          const col = ramp(v), cur = c === p.clumsy && ts[j] === p.target;
          return "<td style=\"background:rgba(" + col.join(",") + ",0.55)" + (cur ? ";outline:2px solid var(--ink)" : "") + "\">" + pct(v, 0) + "</td>";
        }).join("") + "</tr>";
      });
      return h + "</tbody></table>";
    },
  });

  cards.push({
    id: "r2", title: "6. How early can the outcome be predicted?", tags: ["linear regression", "R-squared", "feature importance over time"], canvas: 260, button: "Run the regressions",
    look: "After roll <i>t</i>, how much of the final result is already decided by where you stand? We fit a straight line from the step at roll <i>t</i> to the final step, for every <i>t</i>, and record how much of the variation it explains (R&sup2;).",
    read: "Horizontal axis is the roll number. Vertical axis is R&sup2;: 0 means where you stand tells you nothing about the final step, 1 means it tells you everything. A rising curve means the future is becoming predictable.",
    mean: "Early rolls explain little because there is a lot of luck still to come. R&sup2; climbs steadily as rolls are used up. The roll where it passes 50% and 80% shows when the game is mostly decided.",
    next: "Let machine learning try to predict the win from a single mid-game position. Card 7.",
    run() {
      const { p, res } = S, ends = res.ends, ts = [], r2 = [];
      for (let t = 1; t <= p.steps; t++) { ts.push(t); r2.push(Stats.ols(res.all.map((w) => w[t]), ends).r2); }
      plot($("r2-c"), { xmin: 1, xmax: p.steps, ymin: 0, ymax: 1, xlabel: "Roll number", ylabel: "R²", series: [{ x: ts, y: r2, color: T.win, width: 2.5 }, { type: "hline", y: 0.5, color: T.gold, dash: [5, 4] }, { type: "hline", y: 0.8, color: T.accent, dash: [5, 4] }] });
      const first = (lvl) => { const i = r2.findIndex((v) => v >= lvl); return i < 0 ? "not reached" : "roll " + ts[i]; };
      return kv([["R² after roll " + Math.round(p.steps / 4), pct(r2[Math.round(p.steps / 4) - 1], 0)], ["R² after roll " + Math.round(p.steps / 2), pct(r2[Math.round(p.steps / 2) - 1], 0)],
        ["First roll with R² of 50% / 80%", first(0.5) + " / " + first(0.8)]]);
    },
  });

  cards.push({
    id: "ml", title: "7. Machine learning: predict the winner mid-game", tags: ["supervised learning", "logistic regression", "neural network", "train/test split", "AUC", "calibration"], canvas: 320, button: "Train the models",
    controls: "<label class=\"inline\">Predict after roll <input id=\"ml-k\" type=\"number\" min=\"1\" max=\"299\" value=\"30\"></label>",
    look: "Given only the step you are standing on after roll <i>k</i>, can a model predict whether you will finish at or above the target? We generate 5,000 new walks, train on 4,000 and test on the 1,000 it has never seen, with a logistic regression and a small neural network (8 hidden units, trained with the Adam optimiser). Both are compared to the exact answer from card 4, which is the best any model could possibly do.",
    read: "The curves show each model's predicted win chance for every possible step. Dots are the real win rates of test walks grouped by step. A good model sits on the dark exact line. In the table, higher accuracy and AUC are better (AUC 0.5 is a coin flip, 1.0 perfect) and lower log loss is better. AUC only compares rankings, and all three models rank positions the same way (higher step, better chance), so their AUC matches; log loss, which also judges how well-calibrated the probabilities are, is the sharper comparison.",
    mean: "The models learn an S-shaped curve from examples alone and land almost on top of the exact answer, so they are about as good as any model can be here. Nothing was gained from the neural network's extra flexibility because the true relationship is already a smooth S-curve. Keeping a test set is what proves this is not just memorising.",
    next: "Group whole walks by their shape. Card 8.",
    async run() {
      const { p } = S, k = Math.round(clamp(+$("ml-k").value, 1, p.steps - 1, 30)); $("ml-k").value = k;
      const data = Sim.simulate({ walks: 5000, steps: p.steps, target: p.target, clumsy: p.clumsy, seed: null });
      const xs = data.all.map((w) => w[k]), ys = data.ends.map((e) => (e >= p.target ? 1 : 0)), ntr = 4000;
      const st = Stats.standardizer(xs.slice(0, ntr)), xtr = xs.slice(0, ntr).map(st.f), ytr = ys.slice(0, ntr), xte = xs.slice(ntr).map(st.f), yte = ys.slice(ntr), rawTe = xs.slice(ntr);
      const lr = Stats.fitLogistic(xtr, ytr), nn = Stats.fitMLP(xtr, ytr, Sim.makeRng(null)), V = Stats.valueMap(p.steps, p.target, p.clumsy);
      const base = ytr.reduce((a, b) => a + b, 0) / ntr, pb = yte.map(() => base), pl = xte.map(lr.predict), pn = xte.map(nn.predict), pe = rawTe.map((s) => V[k][s]);
      const row = (name, pr) => [name, pct(Stats.accuracy(pr, yte)), Stats.logLoss(pr, yte).toFixed(3), (Stats.auc(pr, yte) || 0).toFixed(3)];
      const lo = Math.min(...xs), hi = Math.max(...xs), grid = Array.from({ length: 80 }, (_, i) => lo + ((hi - lo) * i) / 79);
      const order = rawTe.map((v, i) => i).sort((a, b) => rawTe[a] - rawTe[b]), bins = 10, bx = [], by = [];
      for (let b = 0; b < bins; b++) { const ch = order.slice(Math.floor((b * order.length) / bins), Math.floor(((b + 1) * order.length) / bins)); bx.push(ch.reduce((a, i) => a + rawTe[i], 0) / ch.length); by.push(ch.reduce((a, i) => a + yte[i], 0) / ch.length); }
      plot($("ml-c"), { xmin: lo, xmax: hi, ymin: 0, ymax: 1, xlabel: "Step after roll " + k, ylabel: "Predicted chance of winning", yfmt: (v) => pct(v, 0),
        series: [{ x: grid, y: grid.map((x) => V[k][Math.round(x)]), color: T.ink, width: 3, label: "Exact (best possible)" }, { x: grid, y: grid.map((x) => lr.predict(st.f(x))), color: T.win, label: "Logistic regression" },
          { x: grid, y: grid.map((x) => nn.predict(st.f(x))), color: T.accent, label: "Neural network" }, { type: "points", x: bx, y: by, color: T.gold, r: 4.5, label: "Test walks (grouped)" }] });
      return table(["Model (test set, 1,000 walks)", "Accuracy", "Log loss (lower is better)", "AUC"],
        [row("Always guess the base rate", pb), row("Logistic regression", pl), row("Neural network (1 hidden layer)", pn), row("Exact (dynamic programming)", pe)]);
    },
  });

  cards.push({
    id: "km", title: "8. Clustering: what kinds of climbs are there?", tags: ["unsupervised learning", "k-means", "k-means++", "elbow method"], canvas: 300, button: "Cluster the walks",
    controls: "<label class=\"inline\">Number of clusters <select id=\"km-k\"><option>2</option><option selected>3</option><option>4</option><option>5</option></select></label>",
    look: "Without telling the computer who won, can it find natural groups of climbs just from their shape? k-means repeatedly assigns each walk to the nearest group average and moves the averages, starting from smartly spread-out guesses (k-means++).",
    read: "Each line is the average path of one cluster; the dashed line is the target. The table gives each cluster's size and how often its walks actually won. The \"elbow\" list shows how tight the groups are (lower is tighter) for 1 to 6 clusters: the number where improvement slows is a sensible choice.",
    mean: "The groups it finds line up with the outcome even though the outcome was never used: the high-flying clusters win almost every time, while the stalled cluster wins far less often. Shape alone says a lot about the result.",
    next: "Which individual walks are truly unusual? Card 9.",
    run() {
      const { p, res } = S, k = +$("km-k").value, rng = Sim.makeRng(null), stepEvery = Math.max(1, Math.ceil(p.steps / 20)), idx = [];
      for (let t = 0; t <= p.steps; t += stepEvery) idx.push(t);
      const sample = res.all.slice(0, 1500), X = sample.map((w) => idx.map((t) => w[t])), fit = Stats.kmeans(X, k, rng);
      const elbow = [1, 2, 3, 4, 5, 6].map((kk) => Stats.kmeans(X, kk, rng).inertia);
      const info = fit.centers.map((c, i) => { const mem = sample.filter((_, j) => fit.assign[j] === i); return { c, n: mem.length, mean: mem.reduce((a, w) => a + w[w.length - 1], 0) / (mem.length || 1), wins: mem.filter((w) => w[w.length - 1] >= p.target).length / (mem.length || 1) }; }).sort((a, b) => a.c[a.c.length - 1] - b.c[b.c.length - 1]);
      const pal = [T.accent, T.gold, T.lose, T.ink, T.win], col = (r) => (k === 1 ? T.win : pal[Math.round((r * 4) / (k - 1))]);
      const ymax = Math.max(p.target * 1.1, ...info.map((i) => Math.max(...i.c)));
      plot($("km-c"), { xmin: 0, xmax: p.steps, ymin: 0, ymax, xlabel: "Roll number", ylabel: "Average step in cluster",
        series: info.map((c, r) => ({ x: idx, y: c.c, color: col(r), width: 3, label: "Cluster " + (r + 1) })).concat([{ type: "hline", y: p.target, color: T.muted, dash: [6, 4] }]) });
      return table(["Cluster", "Share of walks", "Average final step", "Actually won"], info.map((c, r) => ["<b style=\"color:" + col(r) + "\">Cluster " + (r + 1) + "</b>", pct(c.n / sample.length, 0), c.mean.toFixed(1), pct(c.wins, 0)])) +
        "<p class=\"note\">Elbow (total spread for 1 to 6 clusters): " + elbow.map((v, i) => (i + 1) + " &rarr; " + Math.round(v).toLocaleString()).join(" &middot; ") + "</p>";
    },
  });

  cards.push({
    id: "out", title: "9. Outlier detection: the unusual walks", tags: ["anomaly detection", "robust statistics", "median absolute deviation"], canvas: 300, button: "Find the outliers",
    look: "Which walks are so far from normal that they deserve a second look? We score every walk's final step with a <b>robust z-score</b> (based on the median, so extreme walks cannot hide themselves by shifting the average) and flag scores beyond &plusmn;3.",
    read: "Grey lines are ordinary walks (first 300 shown). Rust lines are flagged outliers. The table lists the most extreme, with how many times each one was hit by a clumsy fall to zero.",
    mean: "Nearly all the flagged walks are unlucky ones that fell back to zero late in the game, which is the long low tail of the distribution. Lucky outliers are rarer. Robust scores flag these correctly where an ordinary mean-and-standard-deviation z-score is thrown off by the same tail.",
    next: "Is each step independent of the last, as a true random walk requires? Card 10.",
    run() {
      const { p, res } = S, z = Stats.robustZ(res.ends), falls = res.all.map((w) => { let c = 0; for (let t = 1; t < w.length; t++) if (w[t] === 0 && w[t - 1] >= 2) c++; return c; });
      const flagged = z.map((v, i) => i).filter((i) => Math.abs(z[i]) > 3), ymax = Math.max(p.target * 1.1, ...res.all.slice(0, 300).map((w) => Math.max(...w)));
      const o = plot($("out-c"), { xmin: 0, xmax: p.steps, ymin: 0, ymax, xlabel: "Roll number", ylabel: "Step", series: [{ type: "hline", y: p.target, color: T.muted, dash: [6, 4] }] });
      o.ctx.save(); o.ctx.beginPath(); o.ctx.rect(o.m.l, o.m.t, o.iw, o.ih); o.ctx.clip();
      const draw = (w, c, a, lw) => { o.ctx.strokeStyle = c; o.ctx.globalAlpha = a; o.ctx.lineWidth = lw; o.ctx.beginPath(); w.forEach((s, t) => (t ? o.ctx.lineTo(o.X(t), o.Y(s)) : o.ctx.moveTo(o.X(t), o.Y(s)))); o.ctx.stroke(); };
      res.all.slice(0, 300).forEach((w) => draw(w, T.lose, 0.3, 1)); flagged.slice(0, 40).forEach((i) => draw(res.all[i], T.accent, 0.9, 1.6)); o.ctx.restore();
      const top = flagged.sort((a, b) => Math.abs(z[b]) - Math.abs(z[a])).slice(0, 5);
      return kv([["Flagged walks", flagged.length.toLocaleString() + " of " + res.ends.length.toLocaleString() + " (" + pct(flagged.length / res.ends.length) + ")"]]) +
        (top.length ? table(["Walk #", "Final step", "Robust z-score", "Clumsy falls"], top.map((i) => [i + 1, res.ends[i], z[i].toFixed(1), falls[i]])) : "<p class=\"note\">No walks beyond &plusmn;3 with these settings.</p>");
    },
  });

  cards.push({
    id: "acf", title: "10. Time-series check: is it really a random walk?", tags: ["time series", "autocorrelation (ACF)", "stationarity", "drift"], canvas: 280, button: "Compute autocorrelations",
    look: "A random walk's <i>changes</i> from roll to roll should be unrelated to each other, while its <i>level</i> remembers where it has been. Autocorrelation measures that memory at lags of 1, 2, 3&hellip; rolls.",
    read: "Horizontal axis is the lag (how many rolls apart). Vertical axis is the correlation (&minus;1 to 1). The rust line is the correlation of the changes; it should hug zero, close to the dashed noise band (tiny departures come from the floor at step 0 and the clumsy resets). The blue line is the correlation of the level; it should stay near 1 and fade slowly.",
    mean: "Changes are essentially unpredictable from earlier changes, which is what makes this a random walk, and levels are strongly remembered, which is why a walk that is ahead tends to stay ahead. The positive drift (average gain per roll) is what pulls the whole crowd upward.",
    next: "Are the differences between settings real or just luck? Card 11.",
    run() {
      const { p, res } = S, sample = res.all.slice(0, 2000), inc = sample.map((w) => w.slice(1).map((v, i) => v - w[i])), maxLag = Math.min(20, p.steps - 2);
      const a = Stats.acf(inc, maxLag), b = Stats.acf(sample, maxLag), lags = Array.from({ length: maxLag }, (_, i) => i + 1), tot = inc.length * inc[0].length;
      const all = inc.flat(), mean = all.reduce((x, y) => x + y, 0) / all.length, sd = Math.sqrt(all.reduce((x, y) => x + (y - mean) * (y - mean), 0) / all.length), band = 1.96 / Math.sqrt(tot);
      plot($("acf-c"), { xmin: 1, xmax: maxLag, ymin: -0.25, ymax: 1, xlabel: "Lag (rolls apart)", ylabel: "Autocorrelation",
        series: [{ x: lags, y: b, color: T.win, label: "Level of the walk" }, { x: lags, y: a, color: T.accent, label: "Change per roll" }, { type: "hline", y: band, color: T.muted, dash: [4, 4] }, { type: "hline", y: -band, color: T.muted, dash: [4, 4] }, { type: "hline", y: 0, color: T.line }] });
      return kv([["Average gain per roll (drift)", "<b>" + mean.toFixed(3) + "</b> steps"], ["Standard deviation of one roll's change", sd.toFixed(2)],
        ["Largest change-autocorrelation (any lag)", Math.max(...a.map(Math.abs)).toFixed(3) + " (noise band &plusmn;" + band.toFixed(3) + ")"], ["Level autocorrelation at lag 1", b[0].toFixed(3)]]);
    },
  });

  cards.push({
    id: "tests", title: "11. Hypothesis tests: is it fair, and does clumsiness matter?", tags: ["chi-square goodness of fit", "two-proportion z-test", "p-values"], canvas: 220, button: "Run the tests",
    look: "Two questions answered with formal tests. First, is the random number generator behind every simulation fair, with all six faces equally likely? Second, is the win chance with clumsiness genuinely lower than without, or could the difference be luck?",
    read: "The bars count 60,000 simulated die rolls per face; the dashed line is the 10,000 expected for a fair die. A <b>p-value</b> above 0.05 means the data is consistent with fairness; a p-value below 0.05 means a gap this large would be unusual by luck alone.",
    mean: "The generator passes: the die is fair to within normal noise. The clumsiness test depends on the sample: at 10,000 walks each, a drop from about 84% to 78% is overwhelmingly significant, so the difference is real, not luck.",
    next: "Everything above is a result you can now explain, and each step is reproducible in a Python notebook. That is the next milestone.",
    run() {
      const { p } = S, rng = Sim.makeRng(null), counts = [0, 0, 0, 0, 0, 0];
      for (let i = 0; i < 60000; i++) counts[rng.randint(1, 7) - 1]++;
      const cs = Stats.chiSquareUniform(counts), alt = p.clumsy > 0 ? p.clumsy : 0.001, n = 10000;
      const a = Sim.simulate({ walks: n, steps: p.steps, target: p.target, clumsy: 0, seed: null }), b = Sim.simulate({ walks: n, steps: p.steps, target: p.target, clumsy: alt, seed: null });
      const z = Stats.twoProportionZ(a.wins, n, b.wins, n);
      plot($("tests-c"), { xmin: 0.5, xmax: 6.5, ymin: 0, ymax: Math.max(...counts, 10000) * 1.15, xlabel: "Die face", ylabel: "Times rolled", xfmt: (v) => (Number.isInteger(v) ? v : ""),
        series: [{ type: "bars", x: [1, 2, 3, 4, 5, 6], y: counts, w: 1, color: T.win }, { type: "hline", y: 10000, color: T.accent, dash: [6, 4] }] });
      return kv([["Fair-die test (60,000 rolls)", "chi-square = " + cs.chi2.toFixed(2) + ", df = " + cs.df + ", p = <b>" + cs.p.toFixed(3) + "</b> &rarr; " + (cs.p > 0.05 ? "consistent with a fair die" : "unusual; run it again")],
        ["Win chance without vs with " + (alt * 100).toFixed(2) + "% clumsiness", pct(a.wins / n) + " vs " + pct(b.wins / n)],
        ["Two-proportion z-test", "z = " + z.z.toFixed(1) + ", p = <b>" + (z.p < 0.0001 ? "&lt; 0.0001" : z.p.toFixed(4)) + "</b> &rarr; " + (z.p < 0.05 ? "the difference is real" : "could be luck at this sample size")]]);
    },
  });

  // ---------- wiring ----------
  function mount() {
    $("lab-cards").innerHTML = cards.map((c) => "<section class=\"lab-card\" id=\"" + c.id + "\"><h3>" + c.title + "</h3><div class=\"tags\">" + c.tags.map((t) => "<span class=\"tag\">" + t + "</span>").join("") + "</div>" +
      "<p><b>What we're looking for:</b> " + c.look + "</p>" + (c.controls || "") + "<button class=\"btn primary run\" data-id=\"" + c.id + "\">" + c.button + "</button><div class=\"out\" id=\"" + c.id + "-out\"></div>" +
      (c.canvas ? "<canvas id=\"" + c.id + "-c\" height=\"" + c.canvas + "\"></canvas>" : "") +
      "<p><b>How to read it:</b> " + c.read + "</p><p><b>What it means:</b> " + c.mean + "</p><p><b>What's next:</b> " + c.next + "</p></section>").join("");
    document.querySelectorAll(".run").forEach((btn) => btn.addEventListener("click", async () => {
      const c = cards.find((x) => x.id === btn.dataset.id), out = $(c.id + "-out"); out.innerHTML = "<p class=\"note\">Working&hellip;</p>";
      await new Promise((r) => setTimeout(r, 30));
      try { out.innerHTML = await c.run(); } catch (e) { out.innerHTML = "<p class=\"note\">Something went wrong: " + e.message + "</p>"; console.error(e); }
    }));
  }
  mount(); $("lab-run").addEventListener("click", runSettings); runSettings();
  Theme.onChange(() => document.querySelectorAll(".lab-card .out").forEach((e) => (e.innerHTML = "<p class=\"note\">Colours changed: press the card's button to redraw.</p>")));
  window.LabCards = cards; window.LabState = () => S;
})();
