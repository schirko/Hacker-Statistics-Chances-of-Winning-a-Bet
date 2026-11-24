// Run with: node tests/test_stopping.js
const assert = require("assert");
const Sim = require("../docs/sim.js");
const S = require("../docs/stopping.js");

// Values from the Python version (src/stopping.py)
let m = S.optimalStopping({ rolls: 100, target: 60, clumsy: 0.001, fee: 0.005 });
assert(Math.abs(m.W[0][0] - 0.42589065606692506) < 1e-12, "best payoff at fee 0.005");
m = S.optimalStopping({ rolls: 100, target: 60, clumsy: 0.001, fee: 0 });
assert(Math.abs(m.W[0][0] - 0.8108035149520809) < 1e-12, "best payoff with no fee");

// The quit boundary after roll 70 and roll 90 (from the notebook): quit at or below step 22 and 40
m = S.optimalStopping({});
const boundary = (t) => { let b = -1; for (let s = 0; s < 60; s++) if (S.actionValues(m, t, s).best === "stop") b = s; return b; };
assert.strictEqual(boundary(70), 22); assert.strictEqual(boundary(90), 40); assert.strictEqual(boundary(30), -1);
for (let t = 0; t < 100; t++) for (const s of [60, 61, 75, 120]) assert.strictEqual(S.actionValues(m, t, s).best, "stop", "collect from the target on");

// nextStep uses the same rule as Sim.randomWalk (same seed, same path)
const a = Sim.randomWalk(Sim.makeRng(5), 100, 0.001);
const rng = Sim.makeRng(5); let s = 0; const b = [0];
for (let i = 0; i < 100; i++) { s = S.nextStep(rng, s, 0.001); b.push(s); }
assert.deepStrictEqual(a, b);
console.log("stopping.js: all tests passed");
