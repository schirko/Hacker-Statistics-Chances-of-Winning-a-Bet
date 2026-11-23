(function () {
  const $ = (id) => document.getElementById(id);
  let WIN, LOSE, ACCENT, INK, GRID, GOLD, MUTED;
  function refreshColors() { const t = Theme.get(); WIN = t.win; LOSE = t.lose; ACCENT = t.accent; INK = t.ink; GRID = t.line; GOLD = t.gold; MUTED = t.muted; }
  const STEPS = 100, TARGET = 60, CLUMSY = 0.001, N = 10000;

  function setup(c) {
    refreshColors();
    const dpr = window.devicePixelRatio || 1, w = c.clientWidth, h = +c.getAttribute("height");
    c.width = w * dpr; c.height = h * dpr;
    const ctx = c.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    ctx.font = "12px system-ui"; return { ctx, w, h };
  }
  function frame(ctx, w, h, m, xmax, ymax, xl, yl) {
    const iw = w - m.l - m.r, ih = h - m.t - m.b;
    ctx.strokeStyle = GRID; ctx.fillStyle = INK;
    for (let i = 0; i <= 4; i++) {
      const y = m.t + ih - (i / 4) * ih;
      ctx.beginPath(); ctx.moveTo(m.l, y); ctx.lineTo(w - m.r, y); ctx.stroke();
      ctx.textAlign = "right"; ctx.fillText(Math.round((i / 4) * ymax), m.l - 6, y + 4);
    }
    if (xmax) for (let i = 0; i <= 4; i++) { ctx.textAlign = "center"; ctx.fillText(Math.round((i / 4) * xmax), m.l + (i / 4) * iw, h - m.b + 15); }
    ctx.textAlign = "center"; if (xl) ctx.fillText(xl, m.l + iw / 2, h - 3);
    ctx.save(); ctx.translate(12, m.t + ih / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(yl, 0, 0); ctx.restore();
    return { iw, ih };
  }
  function dashed(ctx, x1, y1, x2, y2) {
    ctx.save(); ctx.strokeStyle = ACCENT; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
  }

  function lineChart(canvas, walk) {
    const { ctx, w, h } = setup(canvas), m = { l: 44, r: 12, t: 10, b: 28 };
    const ymax = Math.max(TARGET * 1.1, Math.max(...walk) * 1.05);
    const { iw, ih } = frame(ctx, w, h, m, STEPS, ymax, "Roll number", "Step");
    const X = (i) => m.l + (i / STEPS) * iw, Y = (v) => m.t + ih - (v / ymax) * ih;
    ctx.strokeStyle = walk[walk.length - 1] >= TARGET ? WIN : LOSE; ctx.lineWidth = 2; ctx.beginPath();
    walk.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v)))); ctx.stroke();
    dashed(ctx, m.l, Y(TARGET), w - m.r, Y(TARGET));
  }

  function histChart(canvas, ends) {
    const { ctx, w, h } = setup(canvas), m = { l: 48, r: 12, t: 10, b: 28 };
    const maxEnd = Math.max(TARGET, ...ends), nb = 25, bw = (maxEnd + 1) / nb, counts = new Array(nb).fill(0);
    ends.forEach((e) => counts[Math.min(nb - 1, Math.floor(e / bw))]++);
    const cmax = Math.max(...counts);
    const { iw, ih } = frame(ctx, w, h, m, maxEnd + 1, cmax, "Final step", "Walks");
    const X = (v) => m.l + (v / (maxEnd + 1)) * iw;
    counts.forEach((c, i) => {
      const lo = i * bw, hi = (i + 1) * bw, bh = (c / cmax) * ih;
      ctx.fillStyle = lo >= TARGET ? WIN : hi > TARGET ? GOLD : LOSE;
      ctx.fillRect(X(lo) + 1, m.t + ih - bh, X(hi) - X(lo) - 2, bh);
    });
    dashed(ctx, X(TARGET), m.t, X(TARGET), m.t + ih);
  }

  function barChart(canvas, labels, values) {
    const { ctx, w, h } = setup(canvas), m = { l: 44, r: 12, t: 10, b: 28 };
    const { iw, ih } = frame(ctx, w, h, m, 0, 100, "", "Win chance (%)");
    const slot = iw / labels.length;
    values.forEach((v, i) => {
      const bh = (v / 100) * ih, x = m.l + i * slot + slot * 0.25;
      ctx.fillStyle = i ? ACCENT : LOSE; ctx.fillRect(x, m.t + ih - bh, slot * 0.5, bh);
      ctx.fillStyle = INK; ctx.textAlign = "center";
      ctx.fillText(v.toFixed(1) + "%", x + slot * 0.25, m.t + ih - bh - 5);
      ctx.fillText(labels[i], x + slot * 0.25, h - 8);
    });
  }

  const sim = (n, clumsy) => Sim.simulate({ walks: n, steps: STEPS, target: TARGET, clumsy, seed: null });
  let last = {};

  $("s1btn").addEventListener("click", () => {
    const d = 1 + Math.floor(Math.random() * 6);
    const move = d <= 2 ? "step down one (never below 0)" : d <= 5 ? "step up one" : "roll again and climb that many steps";
    $("s1out").textContent = d;
    $("s1txt").textContent = "You rolled a " + d + ": " + move + ".";
  });
  $("s2btn").addEventListener("click", () => {
    const walk = Sim.randomWalk(Sim.makeRng(null), STEPS, 0);
    const end = walk[walk.length - 1]; last.walk = walk;
    $("s2out").textContent = "Final step: " + end + (end >= TARGET ? " (reached the target)" : " (missed the target)");
    lineChart($("s2c"), walk);
  });
  $("s3btn").addEventListener("click", () => {
    const r = sim(N, 0); last.ends = r.ends;
    $("s3out").textContent = (r.chance * 100).toFixed(1) + "% of " + N.toLocaleString() + " walks reached " + TARGET;
    histChart($("s3c"), r.ends);
  });
  $("s4btn").addEventListener("click", () => {
    const a = sim(N, 0).chance * 100, b = sim(N, CLUMSY).chance * 100; last.bars = [a, b];
    $("s4out").textContent = "No clumsiness " + a.toFixed(1) + "% vs 0.1% clumsiness " + b.toFixed(1) + "%";
    barChart($("s4c"), ["No clumsiness", "0.1% clumsiness"], [a, b]);
  });
  $("s5btn").addEventListener("click", () => {
    const r = sim(N, CLUMSY);
    $("s5out").innerHTML = r.wins.toLocaleString() + " &divide; " + N.toLocaleString() + " = <b>" + (r.chance * 100).toFixed(1) + "%</b>";
  });
  const redrawAll = () => {
    if (last.walk) lineChart($("s2c"), last.walk);
    if (last.ends) histChart($("s3c"), last.ends);
    if (last.bars) barChart($("s4c"), ["No clumsiness", "0.1% clumsiness"], last.bars);
  };
  window.addEventListener("resize", redrawAll); Theme.onChange(redrawAll);
})();
