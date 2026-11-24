// Optimal-stopping version of the game (no DOM, so it can be tested in Node and used in the browser).
// Mirrors src/stopping.py: stopping on step >= target collects a prize of 1, stopping lower quits with nothing,
// every roll costs `fee`, and the game ends by itself after `rolls` rolls.
(function (root) {
  const SIZE = (rolls) => 6 * rolls + 8;

  // Expected value of the next-roll values `nx`, from every step (the game's rule for one roll).
  function expectedNext(nx, size, clumsy) {
    const out = new Float64Array(size);
    for (let s = 0; s < size - 7; s++) {
      let w = (2 / 6) * nx[Math.max(s - 1, 0)] + (3 / 6) * nx[s + 1];
      for (let k = 1; k <= 6; k++) w += nx[s + k] / 36;
      out[s] = (1 - clumsy) * w + clumsy * nx[0];
    }
    return out;
  }

  // Backwards dynamic programming. W[t][s] = best payoff from step s after roll t.
  // cont[t][s] = payoff of rolling once more and then playing best. stop[s] = payoff of stopping now.
  function optimalStopping({ rolls = 100, target = 60, clumsy = 0.001, fee = 0.005 } = {}) {
    const size = SIZE(rolls);
    const stop = new Float64Array(size);
    for (let s = target; s < size; s++) stop[s] = 1;
    const W = [], cont = [];
    for (let t = 0; t <= rolls; t++) { W.push(new Float64Array(size)); cont.push(new Float64Array(size).fill(-9)); }
    W[rolls].set(stop);
    for (let t = rolls - 1; t >= 0; t--) {
      const e = expectedNext(W[t + 1], size, clumsy);
      for (let s = 0; s < size - 7; s++) {
        cont[t][s] = -fee + e[s];
        W[t][s] = Math.max(stop[s], cont[t][s]);
      }
    }
    return { rolls, target, clumsy, fee, size, W, cont, stop };
  }

  // Payoff of each action at a position, and which one is best.
  function actionValues(model, t, s) {
    const roll = model.cont[t][s], stop = model.stop[s];
    return { roll, stop, best: roll > stop ? "roll" : "stop" };
  }

  // One roll of the game: same rule as Sim.randomWalk. `rng` comes from Sim.makeRng.
  function nextStep(rng, step, clumsy) {
    const dice = rng.randint(1, 7);
    if (dice <= 2) step = Math.max(0, step - 1);
    else if (dice <= 5) step = step + 1;
    else step = step + rng.randint(1, 7);
    if (rng() <= clumsy) step = 0;
    return step;
  }

  const api = { optimalStopping, actionValues, nextStep };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Stopping = api;
})(typeof window !== "undefined" ? window : globalThis);
