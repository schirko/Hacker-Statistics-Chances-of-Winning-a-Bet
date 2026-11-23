const S = require("../docs/analytics.js"), Sim = require("../docs/sim.js");
let fails = 0;
const ok = (name, cond, extra) => { console.log((cond ? "PASS " : "FAIL ") + name + (extra ? "  " + extra : "")); if (!cond) fails++; };
const near = (a, b, t) => Math.abs(a - b) <= t;

// exact Markov-chain answer vs big simulation
const dist = S.stepDist(100, 0.001), exact = S.tail(dist, 60);
const sim = Sim.simulate({ walks: 200000, steps: 100, target: 60, clumsy: 0.001, seed: 5 });
ok("distribution sums to 1", near(dist.reduce((a, b) => a + b, 0), 1, 1e-9));
ok("exact ~ simulation", near(exact, sim.chance, 0.004), `exact=${exact.toFixed(4)} sim=${sim.chance.toFixed(4)}`);
const V = S.valueMap(100, 60, 0.001);
ok("value map V[0][0] == exact", near(V[0][0], exact, 1e-9));
ok("value map is 1 once over target at the end", V[100][60] === 1 && V[100][59] === 0);
// special functions / tests
ok("chi-square p(11.0705, df5) ~ 0.05", near(S.gammaQ(2.5, 11.0705 / 2), 0.05, 1e-3));
ok("normal cdf(1.96) ~ 0.975", near(S.normCdf(1.96), 0.975, 1e-3));
ok("lgamma(5) = ln 24", near(S.lgamma(5), Math.log(24), 1e-9));
const w = S.wilson(50, 100); ok("wilson(50,100)", near(w[0], 0.4038, 1e-3) && near(w[1], 0.5962, 1e-3));
ok("AUC perfect / random", S.auc([0.1, 0.2, 0.8, 0.9], [0, 0, 1, 1]) === 1 && S.auc([1, 1, 1, 1], [0, 1, 0, 1]) === 0.5);
const o = S.ols([1, 2, 3, 4], [2, 4, 6, 8]); ok("ols perfect line", near(o.slope, 2, 1e-9) && near(o.r2, 1, 1e-9));
const post = S.betaPosterior(40, 50, Array.from({ length: 999 }, (_, i) => (i + 1) / 1000));
ok("beta posterior mean", near(post.mean, 41 / 52, 1e-9) && near(post.pdf.reduce((a, b) => a + b, 0) / 1000, 1, 0.01));
// ML on the real task: models should approach the exact (Bayes-optimal) predictions
const rng = Sim.makeRng(11), data = Sim.simulate({ walks: 5000, steps: 100, target: 60, clumsy: 0.001, seed: 3 }), k = 30;
const xs = data.all.map((w) => w[k]), ys = data.ends.map((e) => (e >= 60 ? 1 : 0));
const st = S.standardizer(xs.slice(0, 4000)), xtr = xs.slice(0, 4000).map(st.f), xte = xs.slice(4000).map(st.f);
const lr = S.fitLogistic(xtr, ys.slice(0, 4000)), nn = S.fitMLP(xtr, ys.slice(0, 4000), rng);
const yte = ys.slice(4000), exactP = xs.slice(4000).map((s) => V[k][s]);
const aucE = S.auc(exactP, yte), aucL = S.auc(xte.map(lr.predict), yte), aucN = S.auc(xte.map(nn.predict), yte);
ok("AUC logistic near exact", aucL > aucE - 0.03, `exact=${aucE.toFixed(3)} lr=${aucL.toFixed(3)} nn=${aucN.toFixed(3)}`);
ok("AUC neural net near exact", aucN > aucE - 0.03);
// k-means recovers two blobs
const pts = []; for (let i = 0; i < 100; i++) { pts.push([rng(), rng()]); pts.push([10 + rng(), 10 + rng()]); }
const km = S.kmeans(pts, 2, rng); ok("kmeans finds 2 blobs", km.assign.filter((a) => a === km.assign[0]).length === 100);
const cs = S.chiSquareUniform([100, 100, 100, 100, 100, 100]); ok("chi-square of perfectly fair counts = 0, p=1", cs.chi2 === 0 && near(cs.p, 1, 1e-9));
console.log(fails ? fails + " FAILED" : "all passed"); process.exit(fails ? 1 : 0);
