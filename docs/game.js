(function () {
  const $ = (id) => document.getElementById(id);
  const ROLLS = 100, TARGET = 60, CLUMSY = 0.001;
  const PRIZE = 100;                                   // points; the exact maths uses a prize of 1
  let model, fee = 0.005, g = null, botTimer = null;
  const session = { games: 0, payoff: 0, loss: 0, matched: 0, decisions: 0, prizes: 0 };
  let C = {};
  function colours() { const t = Theme.get(); C = { ink: t.ink, muted: t.muted, line: t.line, accent: t.accent, win: t.win, gold: t.gold, surface: t.surface }; }
  const pts = (x) => (x * PRIZE).toFixed(1);

  function buildModel() {
    model = Stopping.optimalStopping({ rolls: ROLLS, target: TARGET, clumsy: CLUMSY, fee });
    $("r-fee").textContent = (fee * PRIZE).toFixed(1);
    $("r-best").textContent = pts(model.W[0][0]);
  }

  function newGame(isBot) {
    stopBot();
    g = { t: 0, step: 0, path: [0], rng: Sim.makeRng(null), over: false, bot: !!isBot, fees: 0, decisions: 0, matched: 0, loss: 0, outcome: null };
    $("result").hidden = true;
    $("feedback").innerHTML = isBot ? "Watching the exact best rule play." : "Press <b>Roll</b> to start climbing.";
    render();
  }

  // The decision at the current position: returns the payoff of each action and which one is best.
  function here() { return Stopping.actionValues(model, g.t, g.step); }

  function choose(action) {
    if (!g || g.over) return;
    const v = here();
    const best = v.best, chosen = action;
    const lost = Math.max(v.roll, v.stop) - (chosen === "roll" ? v.roll : v.stop);
    g.decisions++; if (chosen === best || lost < 1e-12) g.matched++; g.loss += lost;
    const stopWord = g.step >= TARGET ? "collect the prize" : "quit";
    const worth = `rolling is worth ${pts(v.roll)} points on average, stopping ${pts(v.stop)}`;
    if (lost < 0.0005) $("feedback").innerHTML = `${chosen === "roll" ? "You rolled" : "You chose to " + stopWord}. Good call: ${worth}.`;
    else $("feedback").innerHTML = `${chosen === "roll" ? "You rolled" : "You chose to " + stopWord}. The best move was to <b>${best === "roll" ? "keep rolling" : stopWord}</b> (${worth}). That choice cost you about <b>${pts(lost)}</b> points on average.`;
    if (chosen === "stop") return finish("stopped");
    g.fees += fee; g.t++; g.step = Stopping.nextStep(g.rng, g.step, CLUMSY); g.path.push(g.step);
    if (g.t >= ROLLS) return finish("ran out");
    render();
  }

  function finish(how) {
    g.over = true;
    const collected = g.step >= TARGET;
    g.payoff = (collected ? 1 : 0) - g.fees;
    if (!g.bot) { session.games++; session.payoff += g.payoff; session.loss += g.loss; session.matched += g.matched; session.decisions += g.decisions; if (collected) session.prizes++; }
    render(); showResult(how, collected);
  }

  function showResult(how, collected) {
    $("result").hidden = false;
    $("big").textContent = (g.payoff * PRIZE >= 0 ? "+" : "") + pts(g.payoff) + " points";
    const where = how === "ran out" ? `The game ended after ${ROLLS} rolls on step ${g.step}` : `You stopped after ${g.t} roll${g.t === 1 ? "" : "s"} on step ${g.step}`;
    $("resultText").textContent = `${where}. ` + (collected ? `You collected the prize of ${PRIZE} points and paid ${pts(g.fees)} in fees.` : `That is below the target, so no prize. You paid ${pts(g.fees)} in fees.`);
    const rows = g.bot ? [["Played by", "the exact best rule (not counted in your session)"], ["Rolls taken", g.t]] :
      [["Rolls taken", g.t], ["Decisions that matched the best move", `${g.matched} of ${g.decisions}`],
       ["Expected loss from your decisions", `${pts(g.loss)} points`], ["Best rule, average from the start", `${pts(model.W[0][0])} points`]];
    $("resultStats").innerHTML = rows.map((r) => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join("");
    $("show-map").checked = $("show-map").checked; // map is drawn automatically at the end, the box is left as the user set it
    renderSession();
  }

  function renderSession() {
    const n = session.games;
    $("session").innerHTML = n === 0 ? "<dt>Games finished</dt><dd>0</dd>" : [
      ["Games finished", n], ["Prizes collected", `${session.prizes} of ${n}`],
      ["Average score", `${(session.payoff / n * PRIZE).toFixed(1)} points (best rule: ${pts(model.W[0][0])})`],
      ["Average expected loss per game", `${(session.loss / n * PRIZE).toFixed(1)} points`],
      ["Decisions matching the best move", `${session.matched} of ${session.decisions} (${(100 * session.matched / session.decisions).toFixed(0)}%)`]
    ].map((r) => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join("");
  }

  function render() {
    const rollBtn = $("btn-roll"), stopBtn = $("btn-stop");
    if (g.over) {
      $("status").textContent = "Game over";
      rollBtn.disabled = stopBtn.disabled = true; $("hint").hidden = true;
    } else {
      $("status").innerHTML = `Roll ${g.t} of ${ROLLS}<br>Step ${g.step} &middot; fees paid ${pts(g.fees)}`;
      rollBtn.disabled = stopBtn.disabled = !!g.bot;
      stopBtn.innerHTML = (g.step >= TARGET ? "Stop and collect the prize" : "Stop and quit") + " <kbd>S</kbd>";
      const v = here();
      $("hint").hidden = !$("show-hint").checked;
      $("hint").innerHTML = `<b>Best move now:</b> ${v.best === "roll" ? "keep rolling" : (g.step >= TARGET ? "stop and collect the prize" : "stop and quit")}. Rolling is worth ${pts(v.roll)} points on average, stopping ${pts(v.stop)}.`;
    }
    draw();
  }

  function draw() {
    colours();
    const canvas = $("chart"), dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = parseInt(canvas.getAttribute("height"), 10);
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const m = { l: 48, r: 16, t: 12, b: 36 }, iw = w - m.l - m.r, ih = h - m.t - m.b;
    const ymax = Math.max(90, Math.max(...g.path) + 6);
    const X = (t) => m.l + (t / ROLLS) * iw, Y = (s) => m.t + ih - (s / ymax) * ih;
    if ($("show-map").checked || g.over) {
      ctx.globalAlpha = 0.2;
      for (let t = 0; t < ROLLS; t++) {
        const x0 = Math.floor(X(t)), x1 = Math.floor(X(t + 1)) + (t === ROLLS - 1 ? 1 : 0);
        let q = -1;                                          // highest step below the target where the best move is to quit
        for (let s = 0; s < TARGET; s++) if (Stopping.actionValues(model, t, s).best === "stop") q = s;
        ctx.fillStyle = C.win; ctx.fillRect(x0, Math.round(Y(ymax)), x1 - x0, Math.round(Y(TARGET)) - Math.round(Y(ymax)));
        if (q >= 0) { ctx.fillStyle = C.accent; ctx.fillRect(x0, Math.round(Y(q + 1)), x1 - x0, Math.round(Y(0)) - Math.round(Y(q + 1))); }
      }
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = C.line; ctx.fillStyle = C.ink; ctx.font = "12px system-ui"; ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = m.t + ih - (i / 5) * ih; ctx.beginPath(); ctx.moveTo(m.l, y); ctx.lineTo(w - m.r, y); ctx.stroke();
      ctx.textAlign = "right"; ctx.fillText(Math.round((i / 5) * ymax), m.l - 6, y + 4);
      const x = m.l + (i / 5) * iw; ctx.textAlign = "center"; ctx.fillText(Math.round((i / 5) * ROLLS), x, h - m.b + 16);
    }
    ctx.textAlign = "center"; ctx.fillText("Roll number", m.l + iw / 2, h - 6);
    ctx.save(); ctx.translate(14, m.t + ih / 2); ctx.rotate(-Math.PI / 2); ctx.fillText("Step", 0, 0); ctx.restore();
    ctx.save(); ctx.strokeStyle = C.accent; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(m.l, Y(TARGET)); ctx.lineTo(w - m.r, Y(TARGET)); ctx.stroke(); ctx.restore();
    ctx.fillStyle = C.accent; ctx.textAlign = "left"; ctx.fillText("Target " + TARGET, m.l + 6, Y(TARGET) - 5);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.beginPath();
    g.path.forEach((s, t) => (t ? ctx.lineTo(X(t), Y(s)) : ctx.moveTo(X(t), Y(s)))); ctx.stroke();
    const last = g.path.length - 1; ctx.fillStyle = g.over ? C.gold : C.accent;
    ctx.beginPath(); ctx.arc(X(last), Y(g.path[last]), 5, 0, 7); ctx.fill();
  }

  function stopBot() { if (botTimer) { clearInterval(botTimer); botTimer = null; } }
  function watchBot() {
    newGame(true);
    botTimer = setInterval(() => {
      if (!g || g.over) return stopBot();
      choose(here().best);
    }, 70);
  }

  $("btn-roll").addEventListener("click", () => choose("roll"));
  $("btn-stop").addEventListener("click", () => choose("stop"));
  $("btn-new").addEventListener("click", () => newGame(false));
  $("btn-bot").addEventListener("click", watchBot);
  $("show-hint").addEventListener("change", render);
  $("show-map").addEventListener("change", draw);
  $("fee").addEventListener("change", () => { fee = parseFloat($("fee").value); buildModel(); session.games = session.payoff = session.loss = session.matched = session.decisions = session.prizes = 0; renderSession(); newGame(false); });
  document.addEventListener("keydown", (e) => {
    if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) && e.target.type !== "checkbox") return;
    if (g && !g.bot) { if (e.key === "r" || e.key === "R") choose("roll"); if (e.key === "s" || e.key === "S") choose("stop"); }
  });
  window.addEventListener("resize", () => g && draw());
  Theme.onChange(() => g && draw());
  buildModel(); newGame(false);
})();
