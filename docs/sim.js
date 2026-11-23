// Core simulation logic (no DOM) so it can be tested in Node and used in the browser.
(function (root) {
  // Small seedable PRNG (mulberry32) - same seed gives the same results, like np.random.seed()
  function makeRng(seed) {
    if (seed === null || seed === undefined || seed === "" || Number.isNaN(Number(seed))) {
      seed = (Math.random() * 2 ** 32) >>> 0;
    }
    let a = Number(seed) >>> 0;
    const next = function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.randint = (lo, hi) => lo + Math.floor(next() * (hi - lo)); // hi exclusive, like numpy
    return next;
  }

  // One walk: roll a die each turn. 1-2 down, 3-5 up one, 6 roll again and climb that many.
  // clumsy = chance (0-1) of falling back to step 0 on any turn.
  function randomWalk(rng, steps, clumsy) {
    const walk = [0];
    for (let i = 0; i < steps; i++) {
      let step = walk[walk.length - 1];
      const dice = rng.randint(1, 7);
      if (dice <= 2) step = Math.max(0, step - 1);
      else if (dice <= 5) step = step + 1;
      else step = step + rng.randint(1, 7);
      if (rng() <= clumsy) step = 0;
      walk.push(step);
    }
    return walk;
  }

  function simulate({ walks, steps, target, clumsy, seed }) {
    const rng = makeRng(seed);
    const all = [];
    const ends = [];
    let wins = 0;
    for (let i = 0; i < walks; i++) {
      const w = randomWalk(rng, steps, clumsy);
      all.push(w);
      const end = w[w.length - 1];
      ends.push(end);
      if (end >= target) wins++;
    }
    return { all, ends, wins, chance: wins / walks };
  }

  const api = { makeRng, randomWalk, simulate };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Sim = api;
})(typeof window !== "undefined" ? window : globalThis);
