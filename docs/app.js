(function () {
  const $ = (id) => document.getElementById(id);
  const WIN = "#16a34a", LOSE = "#9aa3b2", ACCENT = "#2563eb", INK = "#1c2430", GRID = "#e5e9f0";
  const DEFAULTS = { walks: 500, steps: 100, target: 60, clumsy: 0.1, seed: "" };

  function setup(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = parseInt(canvas.getAttribute("height"), 10);
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  function axes(ctx, w, h, m, xmax, ymax, xlabel, ylabel) {
    ctx.strokeStyle = GRID; ctx.fillStyle = INK; ctx.font = "12px system-ui"; ctx.lineWidth = 1;
    const iw = w - m.l - m.r, ih = h - m.t - m.b;
    for (let i = 0; i <= 5; i++) {
      const y = m.t + ih - (i / 5) * ih, v = Math.round((i / 5) * ymax);
      ctx.beginPath(); ctx.moveTo(m.l, y); ctx.lineTo(w - m.r, y); ctx.stroke();
      ctx.textAlign = "right"; ctx.fillText(v, m.l - 6, y + 4);
    }
    for (let i = 0; i <= 5; i++) {
      const x = m.l + (i / 5) * iw;
      ctx.textAlign = "center"; ctx.fillText(Math.round((i / 5) * xmax), x, h - m.b + 16);
    }
    ctx.textAlign = "center"; ctx.fillText(xlabel, m.l + iw / 2, h - 6);
    ctx.save(); ctx.translate(14, m.t + ih / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(ylabel, 0, 0); ctx.restore();
    return { iw, ih };
  }

  function targetLine(ctx, m, w, y, label) {
    ctx.save(); ctx.strokeStyle = ACCENT; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(m.l, y); ctx.lineTo(w - m.r, y); ctx.stroke(); ctx.restore();
    ctx.fillStyle = ACCENT; ctx.textAlign = "left"; ctx.fillText(label, m.l + 6, y - 5);
  }

  function drawWalks(res, p) {
    const { ctx, w, h } = setup($("walkChart"));
    const m = { l: 48, r: 16, t: 12, b: 36 };
    const ymax = Math.max(p.target * 1.1, ...res.ends, ...res.all.slice(0, 300).map((x) => Math.max(...x)));
    const { iw, ih } = axes(ctx, w, h, m, p.steps, ymax, "Roll number", "Step");
    const X = (i) => m.l + (i / p.steps) * iw, Y = (v) => m.t + ih - (v / ymax) * ih;
    const drawn = res.all.slice(0, 300);
    [false, true].forEach((winPass) => {           // draw losers first, winners on top
      ctx.lineWidth = 1; ctx.strokeStyle = winPass ? WIN : LOSE; ctx.globalAlpha = winPass ? 0.55 : 0.4;
      drawn.forEach((walk) => {
        const won = walk[walk.length - 1] >= p.target;
        if (won !== winPass) return;
        ctx.beginPath();
        walk.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
        ctx.stroke();
      });
    });
    ctx.globalAlpha = 1;
    targetLine(ctx, m, w, Y(p.target), "Target " + p.target);
    if (res.all.length > 300) { ctx.fillStyle = "#5b6677"; ctx.textAlign = "right"; ctx.fillText("showing first 300 of " + res.all.length + " walks", w - m.r, m.t + 12); }
  }

  function drawHist(res, p) {
    const { ctx, w, h } = setup($("histChart"));
    const m = { l: 48, r: 16, t: 12, b: 36 };
    const maxEnd = Math.max(p.target, ...res.ends);
    const nb = Math.min(30, Math.max(5, maxEnd + 1));
    const bw = (maxEnd + 1) / nb;
    const counts = new Array(nb).fill(0);
    res.ends.forEach((e) => counts[Math.min(nb - 1, Math.floor(e / bw))]++);
    const cmax = Math.max(...counts);
    const { iw, ih } = axes(ctx, w, h, m, maxEnd + 1, cmax, "Final step", "Number of walks");
    const X = (v) => m.l + (v / (maxEnd + 1)) * iw;
    counts.forEach((c, i) => {
      const lo = i * bw, hi = (i + 1) * bw;
      ctx.fillStyle = lo >= p.target ? WIN : (hi > p.target ? "#7fbf94" : LOSE);
      const bh = (c / cmax) * ih;
      ctx.fillRect(X(lo) + 1, m.t + ih - bh, X(hi) - X(lo) - 2, bh);
    });
    const tx = X(p.target);
    ctx.save(); ctx.strokeStyle = ACCENT; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(tx, m.t); ctx.lineTo(tx, m.t + ih); ctx.stroke(); ctx.restore();
    ctx.fillStyle = ACCENT; ctx.textAlign = "right"; ctx.fillText("Target " + p.target, tx - 6, m.t + 12);
  }

  function readParams() {
    const clamp = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
    const p = {
      walks: Math.round(clamp(+$("walks").value, 1, 20000, 500)),
      steps: Math.round(clamp(+$("steps").value, 1, 1000, 100)),
      target: Math.round(clamp(+$("target").value, 1, 5000, 60)),
      clumsy: clamp(+$("clumsy").value, 0, 100, 0.1) / 100,
      seed: $("seed").value === "" ? null : +$("seed").value,
    };
    $("walks").value = p.walks; $("steps").value = p.steps; $("target").value = p.target;
    return p;
  }

  let last = null;
  function run() {
    const p = readParams();
    const res = Sim.simulate(p);
    last = { res, p };
    const pct = (res.chance * 100).toFixed(1);
    const sorted = res.ends.slice().sort((a, b) => a - b);
    const mean = res.ends.reduce((a, b) => a + b, 0) / res.ends.length;
    const med = sorted[Math.floor(sorted.length / 2)];
    $("big").textContent = pct + "%";
    $("plain").innerHTML = "Out of <b>" + res.ends.length.toLocaleString() + "</b> simulated climbs, <b>" +
      res.wins.toLocaleString() + "</b> reached step " + p.target + " or higher in " + p.steps + " rolls. " +
      (res.chance >= 0.5 ? "The bet is in your favor." : "The odds are against you.");
    $("stats").innerHTML =
      "<dt>Average final step</dt><dd>" + mean.toFixed(1) + "</dd>" +
      "<dt>Median final step</dt><dd>" + med + "</dd>" +
      "<dt>Lowest / highest</dt><dd>" + sorted[0] + " / " + sorted[sorted.length - 1] + "</dd>" +
      "<dt>Seed</dt><dd>" + (p.seed === null ? "random" : p.seed) + "</dd>";
    drawWalks(res, p); drawHist(res, p);
  }

  function reset() {
    Object.keys(DEFAULTS).forEach((k) => ($(k).value = DEFAULTS[k]));
    run();
  }

  $("run").addEventListener("click", run);
  $("reset").addEventListener("click", reset);
  $("coin").addEventListener("click", () => { $("coinOut").textContent = Math.random() < 0.5 ? "Heads" : "Tails"; });
  $("die").addEventListener("click", () => { $("dieOut").textContent = 1 + Math.floor(Math.random() * 6); });
  window.addEventListener("resize", () => { if (last) { drawWalks(last.res, last.p); drawHist(last.res, last.p); } });
  run();
})();
