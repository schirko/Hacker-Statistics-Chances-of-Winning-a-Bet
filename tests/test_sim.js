const S = require("../docs/sim.js");
let r = S.simulate({ walks: 200000, steps: 100, target: 60, clumsy: 0.001, seed: 1 });
console.log("chance>=60 with clumsiness:", r.chance.toFixed(4));
r = S.simulate({ walks: 200000, steps: 100, target: 60, clumsy: 0, seed: 1 });
console.log("chance>=60 no clumsiness:", r.chance.toFixed(4));
const a = S.simulate({ walks: 5, steps: 10, target: 5, clumsy: 0, seed: 123 }).ends;
const b = S.simulate({ walks: 5, steps: 10, target: 5, clumsy: 0, seed: 123 }).ends;
console.log("seed reproducible:", JSON.stringify(a) === JSON.stringify(b), a);
const w = S.randomWalk(S.makeRng(7), 1000, 0); console.log("never negative:", Math.min(...w) >= 0);
