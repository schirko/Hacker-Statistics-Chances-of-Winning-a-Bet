// Statistics / machine-learning helpers (no DOM). Pure JS so they can be tested in Node.
(function (root) {
  const sigmoid = (z) => 1 / (1 + Math.exp(-z));

  // ---------- special functions ----------
  function lgamma(x) {
    const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
      -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
    x -= 1; let a = c[0]; const t = x + g + 0.5;
    for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
  // regularized upper incomplete gamma Q(a,x); chi-square p-value = gammaQ(df/2, x/2)
  function gammaQ(a, x) {
    if (x <= 0) return 1;
    if (x < a + 1) {
      let sum = 1 / a, del = sum, ap = a;
      for (let n = 0; n < 500; n++) { ap += 1; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-14) break; }
      return 1 - sum * Math.exp(-x + a * Math.log(x) - lgamma(a));
    }
    let b = x + 1 - a, c = 1e300, d = 1 / b, h = d;
    for (let i = 1; i < 500; i++) {
      const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
      c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d;
      const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-14) break;
    }
    return Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
  }
  function normCdf(z) {
    const q = 0.5 * gammaQ(0.5, (z * z) / 2);
    return z >= 0 ? 1 - q : q;
  }

  // ---------- exact answer: Markov chain / dynamic programming ----------
  // Forward: probability distribution of the step after `steps` rolls.
  function stepDist(steps, clumsy) {
    const L = 6 * steps + 8;
    let p = new Float64Array(L); p[0] = 1;
    for (let t = 0; t < steps; t++) {
      const q = new Float64Array(L), top = Math.min(L - 8, 6 * t);
      for (let s = 0; s <= top; s++) {
        const m = p[s]; if (!m) continue;
        q[s > 0 ? s - 1 : 0] += m * (2 / 6);
        q[s + 1] += m * (3 / 6);
        for (let k = 1; k <= 6; k++) q[s + k] += m / 36;
      }
      for (let s = 0; s < L; s++) q[s] *= 1 - clumsy;
      q[0] += clumsy;
      p = q;
    }
    return p;
  }
  const tail = (dist, target) => { let t = 0; for (let s = target; s < dist.length; s++) t += dist[s]; return t; };

  // Backward: V[t][s] = chance of finishing at or above target, given you are at step s after roll t.
  // (This is the "value function" idea from reinforcement learning.)
  function valueMap(steps, target, clumsy) {
    const L = 6 * steps + 8, V = new Array(steps + 1);
    V[steps] = new Float64Array(L);
    for (let s = 0; s < L; s++) V[steps][s] = s >= target ? 1 : 0;
    for (let t = steps - 1; t >= 0; t--) {
      const nx = V[t + 1], cur = new Float64Array(L).fill(NaN), top = Math.min(L - 8, 6 * t);
      for (let s = 0; s <= top; s++) {
        let w = (2 / 6) * nx[s > 0 ? s - 1 : 0] + (3 / 6) * nx[s + 1];
        for (let k = 1; k <= 6; k++) w += nx[s + k] / 36;
        cur[s] = (1 - clumsy) * w + clumsy * nx[0];
      }
      V[t] = cur;
    }
    return V;
  }

  // ---------- inference ----------
  function wilson(k, n, z) {
    z = z || 1.96; const p = k / n, d = 1 + (z * z) / n;
    const c = (p + (z * z) / (2 * n)) / d, h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
    return [Math.max(0, c - h), Math.min(1, c + h)];
  }
  function bootstrapCI(values, B, rng) {
    const n = values.length, stats = new Float64Array(B);
    for (let b = 0; b < B; b++) { let s = 0; for (let i = 0; i < n; i++) s += values[Math.floor(rng() * n)]; stats[b] = s / n; }
    stats.sort();
    return [stats[Math.floor(0.025 * B)], stats[Math.min(B - 1, Math.floor(0.975 * B))]];
  }
  function betaPosterior(wins, n, grid) {
    const a = wins + 1, b = n - wins + 1, lb = lgamma(a) + lgamma(b) - lgamma(a + b);
    const pdf = grid.map((x) => (x <= 0 || x >= 1 ? 0 : Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - lb)));
    return { a, b, mean: a / (a + b), pdf };
  }
  function betaQuantiles(a, b, qs) {
    const N = 4000, lb = lgamma(a) + lgamma(b) - lgamma(a + b), cdf = new Float64Array(N + 1);
    let acc = 0;
    for (let i = 1; i <= N; i++) { const x = (i - 0.5) / N; acc += Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - lb) / N; cdf[i] = acc; }
    return qs.map((q) => { let i = 0; while (i < N && cdf[i] < q * acc) i++; return i / N; });
  }
  function ksDiscrete(values, dist) {
    const n = values.length, counts = new Float64Array(dist.length);
    values.forEach((v) => counts[v]++);
    let fe = 0, fx = 0, D = 0;
    for (let s = 0; s < dist.length; s++) { fe += counts[s] / n; fx += dist[s]; D = Math.max(D, Math.abs(fe - fx)); }
    return { D, critical: 1.36 / Math.sqrt(n) };
  }
  function chiSquareUniform(counts) {
    const n = counts.reduce((a, b) => a + b, 0), e = n / counts.length;
    const x = counts.reduce((a, c) => a + ((c - e) * (c - e)) / e, 0), df = counts.length - 1;
    return { chi2: x, df, p: gammaQ(df / 2, x / 2) };
  }
  function twoProportionZ(k1, n1, k2, n2) {
    const p1 = k1 / n1, p2 = k2 / n2, p = (k1 + k2) / (n1 + n2), se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
    const z = se ? (p1 - p2) / se : 0;
    return { z, p: 2 * (1 - normCdf(Math.abs(z))) };
  }
  const median = (a) => { const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  function robustZ(values) {
    const med = median(values), mad = median(values.map((v) => Math.abs(v - med))) * 1.4826 || 1;
    return values.map((v) => (v - med) / mad);
  }
  function ols(x, y) {
    const n = x.length; let mx = 0, my = 0;
    for (let i = 0; i < n; i++) { mx += x[i]; my += y[i]; }
    mx /= n; my /= n;
    let sxx = 0, sxy = 0, syy = 0;
    for (let i = 0; i < n; i++) { const dx = x[i] - mx, dy = y[i] - my; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; }
    const slope = sxx ? sxy / sxx : 0;
    return { slope, intercept: my - slope * mx, r2: sxx && syy ? (sxy * sxy) / (sxx * syy) : 0 };
  }
  function acf(seriesList, maxLag) {
    let mean = 0, cnt = 0;
    seriesList.forEach((s) => s.forEach((v) => { mean += v; cnt++; })); mean /= cnt;
    let den = 0; seriesList.forEach((s) => s.forEach((v) => { den += (v - mean) * (v - mean); }));
    const out = [];
    for (let lag = 1; lag <= maxLag; lag++) {
      let num = 0; seriesList.forEach((s) => { for (let i = 0; i + lag < s.length; i++) num += (s[i] - mean) * (s[i + lag] - mean); });
      out.push(den ? num / den : 0);
    }
    return out;
  }

  // ---------- machine learning ----------
  function standardizer(x) {
    const n = x.length; let m = 0; x.forEach((v) => (m += v)); m /= n;
    let v2 = 0; x.forEach((v) => (v2 += (v - m) * (v - m)));
    const sd = Math.sqrt(v2 / n) || 1;
    return { mean: m, sd, f: (v) => (v - m) / sd };
  }
  function fitLogistic(x, y, o) {
    o = Object.assign({ iters: 1500, lr: 0.5, l2: 1e-4 }, o);
    let w = 0, b = 0; const n = x.length;
    for (let it = 0; it < o.iters; it++) {
      let gw = 0, gb = 0;
      for (let i = 0; i < n; i++) { const e = sigmoid(w * x[i] + b) - y[i]; gw += e * x[i]; gb += e; }
      w -= o.lr * (gw / n + o.l2 * w); b -= o.lr * (gb / n);
    }
    return { w, b, predict: (v) => sigmoid(w * v + b) };
  }
  // 1 input -> H tanh units -> 1 sigmoid output, trained with Adam on log loss
  function fitMLP(x, y, rng, o) {
    o = Object.assign({ hidden: 8, epochs: 500, lr: 0.03 }, o);
    const H = o.hidden, n = x.length, P = 3 * H + 1;
    const th = new Float64Array(P), g = new Float64Array(P), m = new Float64Array(P), v = new Float64Array(P);
    const gauss = () => Math.sqrt(-2 * Math.log(rng() || 1e-12)) * Math.cos(2 * Math.PI * rng());
    for (let j = 0; j < H; j++) { th[j] = gauss(); th[H + j] = gauss() * 0.5; th[2 * H + j] = gauss() * 0.5; }
    const a = new Float64Array(H);
    for (let ep = 1; ep <= o.epochs; ep++) {
      g.fill(0);
      for (let i = 0; i < n; i++) {
        let z = th[3 * H];
        for (let j = 0; j < H; j++) { a[j] = Math.tanh(th[j] * x[i] + th[H + j]); z += th[2 * H + j] * a[j]; }
        const e = sigmoid(z) - y[i]; g[3 * H] += e;
        for (let j = 0; j < H; j++) {
          g[2 * H + j] += e * a[j];
          const dz = e * th[2 * H + j] * (1 - a[j] * a[j]);
          g[j] += dz * x[i]; g[H + j] += dz;
        }
      }
      const c1 = 1 - Math.pow(0.9, ep), c2 = 1 - Math.pow(0.999, ep);
      for (let k = 0; k < P; k++) {
        const gk = g[k] / n; m[k] = 0.9 * m[k] + 0.1 * gk; v[k] = 0.999 * v[k] + 0.001 * gk * gk;
        th[k] -= (o.lr * (m[k] / c1)) / (Math.sqrt(v[k] / c2) + 1e-8);
      }
    }
    return { predict: (xv) => { let z = th[3 * H]; for (let j = 0; j < H; j++) z += th[2 * H + j] * Math.tanh(th[j] * xv + th[H + j]); return sigmoid(z); } };
  }
  function auc(scores, labels) {
    const idx = scores.map((_, i) => i).sort((a, b) => scores[a] - scores[b]);
    const ranks = new Array(scores.length);
    for (let i = 0; i < idx.length;) {
      let j = i; while (j + 1 < idx.length && scores[idx[j + 1]] === scores[idx[i]]) j++;
      const r = (i + j) / 2 + 1; for (let k = i; k <= j; k++) ranks[idx[k]] = r; i = j + 1;
    }
    let n1 = 0, sr = 0; labels.forEach((l, i) => { if (l) { n1++; sr += ranks[i]; } });
    const n0 = labels.length - n1;
    return n1 && n0 ? (sr - (n1 * (n1 + 1)) / 2) / (n1 * n0) : NaN;
  }
  function logLoss(p, y) { let s = 0; p.forEach((v, i) => { const q = Math.min(1 - 1e-9, Math.max(1e-9, v)); s -= y[i] ? Math.log(q) : Math.log(1 - q); }); return s / p.length; }
  const accuracy = (p, y) => p.reduce((a, v, i) => a + ((v >= 0.5 ? 1 : 0) === y[i] ? 1 : 0), 0) / p.length;

  function kmeans(X, k, rng, maxIter) {
    maxIter = maxIter || 60; const n = X.length, d = X[0].length;
    const dist2 = (a, b) => { let s = 0; for (let i = 0; i < d; i++) { const t = a[i] - b[i]; s += t * t; } return s; };
    const centers = [X[Math.floor(rng() * n)].slice()];
    while (centers.length < k) {
      const d2 = X.map((x) => Math.min(...centers.map((c) => dist2(x, c)))), tot = d2.reduce((a, b) => a + b, 0);
      let r = rng() * tot, pick = n - 1; for (let i = 0; i < n; i++) { r -= d2[i]; if (r <= 0) { pick = i; break; } }
      centers.push(X[pick].slice());
    }
    let assign = new Array(n).fill(0);
    for (let it = 0; it < maxIter; it++) {
      let moved = false;
      for (let i = 0; i < n; i++) {
        let best = 0, bd = Infinity;
        for (let c = 0; c < k; c++) { const dd = dist2(X[i], centers[c]); if (dd < bd) { bd = dd; best = c; } }
        if (assign[i] !== best) { assign[i] = best; moved = true; }
      }
      const sums = centers.map(() => new Array(d).fill(0)), cnt = new Array(k).fill(0);
      for (let i = 0; i < n; i++) { cnt[assign[i]]++; for (let j = 0; j < d; j++) sums[assign[i]][j] += X[i][j]; }
      for (let c = 0; c < k; c++) if (cnt[c]) for (let j = 0; j < d; j++) centers[c][j] = sums[c][j] / cnt[c];
      if (!moved) break;
    }
    let inertia = 0; for (let i = 0; i < n; i++) inertia += dist2(X[i], centers[assign[i]]);
    return { assign, centers, inertia };
  }

  const api = { sigmoid, lgamma, gammaQ, normCdf, stepDist, tail, valueMap, wilson, bootstrapCI, betaPosterior, betaQuantiles,
    ksDiscrete, chiSquareUniform, twoProportionZ, median, robustZ, ols, acf, standardizer, fitLogistic, fitMLP, auc, logLoss, accuracy, kmeans };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Stats = api;
})(typeof window !== "undefined" ? window : globalThis);
