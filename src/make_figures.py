"""Make the charts for the site (light) and the presentation (dark), and save the numbers they show.

Run from the project root:  python -m src.make_figures
Writes docs/images/headline.png, figures/deck/*.png and figures/facts.json
"""
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib import font_manager
from matplotlib.colors import LinearSegmentedColormap
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, log_loss, roc_auc_score
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler

from . import hacker_stats as hs

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "docs" / "images"
CH = ROOT / "figures" / "deck"
for d in (IMG, CH):
    d.mkdir(parents=True, exist_ok=True)
for f in Path("/usr/share/fonts/opentype/inter").glob("Inter-*.otf"):
    font_manager.fontManager.addfont(str(f))
plt.rcParams["font.family"] = "Inter"

TARGET, ROLLS, CLUMSY = 60, 100, 0.001
LIGHT = dict(bg="#ffffff", ink="#1f1b18", muted="#5f5852", grid="#e6e0d8", win="#2F6690", lose="#a39b93", acc="#9A3B2E", gold="#A87613")
DARK = dict(bg="#1e1b18", ink="#f6f2ec", muted="#cfc7be", grid="#3a352f", win="#7fb2db", lose="#8a8279", acc="#e0796a", gold="#e2b45a")


def style(ax, C, xlabel="", ylabel=""):
    ax.set_facecolor(C["bg"])
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    for s in ("left", "bottom"):
        ax.spines[s].set_color(C["grid"])
    ax.tick_params(colors=C["muted"], labelsize=13)
    ax.grid(color=C["grid"], lw=0.8, alpha=0.8)
    ax.set_axisbelow(True)
    ax.set_xlabel(xlabel, color=C["muted"], fontsize=14)
    ax.set_ylabel(ylabel, color=C["muted"], fontsize=14)


def fig(C, w=10, h=5.6):
    f, ax = plt.subplots(figsize=(w, h), dpi=200)
    f.patch.set_facecolor(C["bg"])
    return f, ax


def save(f, path, C):
    f.tight_layout()
    f.savefig(path, facecolor=C["bg"])
    plt.close(f)


paths = hs.simulate(walks=10_000, rolls=ROLLS, clumsy=CLUMSY, seed=123)
ends = paths[:, -1]
dist = hs.exact_distribution(ROLLS, CLUMSY)
exact = hs.exact_win_chance(ROLLS, TARGET, CLUMSY)
exact0 = hs.exact_win_chance(ROLLS, TARGET, 0.0)
sim = hs.win_chance(paths, TARGET)
lo, hi = hs.wilson_interval(int((ends >= TARGET).sum()), len(ends))
V = hs.value_map(ROLLS, TARGET, CLUMSY)
facts = dict(exact=exact, exact_no_clumsy=exact0, simulated=sim, ci=[lo, hi], mean_end=float(ends.mean()), median_end=float(np.median(ends)),
             any_fall=1 - (1 - CLUMSY) ** ROLLS, v_start=float(V[0, 0]), v_t30_s40=float(V[30, 40]), v_t30_s20=float(V[30, 20]), v_t50_s30=float(V[50, 30]))


def bins_for(paths_ends, width=4):
    """Whole-number bin edges (so every bin holds the same count of possible steps)."""
    top = int(np.ceil((max(TARGET, paths_ends.max()) + 1) / width) * width)
    return np.arange(0, top + width, width), top


def hist_with_exact(ax, C, with_exact=True):
    edges, top = bins_for(ends)
    counts, _ = np.histogram(ends, bins=edges)
    centres = (edges[:-1] + edges[1:]) / 2
    colours = [C["win"] if edges[i] >= TARGET else C["lose"] for i in range(len(centres))]
    ax.bar(centres, counts / len(ends), width=np.diff(edges) * 0.92, color=colours)
    if with_exact:
        eb = np.zeros(len(centres))
        for s, pr in enumerate(dist):
            eb[min(len(centres) - 1, int(np.searchsorted(edges, s, side="right")) - 1)] += pr
        ax.plot(centres, eb, color=C["acc"], lw=3, label="Exact (Markov chain)")
        ax.legend(frameon=False, labelcolor=C["ink"], fontsize=13, loc="upper left")
    ax.axvline(TARGET, color=C["gold"], ls="--", lw=2)
    ax.yaxis.set_major_formatter(matplotlib.ticker.PercentFormatter(1, 0))


# ---- site headline figure (light) ----
C = LIGHT
f, (a, b) = plt.subplots(1, 2, figsize=(12, 4.8), dpi=170, gridspec_kw=dict(width_ratios=[1.15, 1]))
f.patch.set_facecolor(C["bg"])
for i in range(200):
    a.plot(paths[i], color=C["win"] if ends[i] >= TARGET else C["lose"], lw=0.9, alpha=0.55)
a.axhline(TARGET, color=C["acc"], ls="--", lw=1.8)
style(a, C, "Roll number", "Step reached"); a.set_title("200 simulated climbs", color=C["ink"], fontsize=14, loc="left")
hist_with_exact(b, C); style(b, C, "Final step", "Share of 10,000 walks"); b.set_title("Where the climbs ended", color=C["ink"], fontsize=14, loc="left")
save(f, IMG / "headline.png", C)

# ---- presentation charts (dark) ----
C = DARK
# 1 one walk
f, ax = fig(C); w = hs.simulate(1, ROLLS, 0.0, seed=7)[0]
ax.plot(w, color=C["win"], lw=3); ax.axhline(TARGET, color=C["gold"], ls="--", lw=2)
ax.text(2, TARGET + 2, "Target: step 60", color=C["gold"], fontsize=14); style(ax, C, "Roll number", "Step"); save(f, CH / "one_walk.png", C)
facts["one_walk_end"] = int(w[-1])
# 2 many walks
f, ax = fig(C)
for i in range(250):
    ax.plot(paths[i], color=C["win"] if ends[i] >= TARGET else C["lose"], lw=0.8, alpha=0.5)
ax.axhline(TARGET, color=C["acc"], ls="--", lw=2); style(ax, C, "Roll number", "Step"); save(f, CH / "many_walks.png", C)
# 3 histogram (simulation only)
f, ax = fig(C); hist_with_exact(ax, C, with_exact=False); style(ax, C, "Final step", "Share of walks"); save(f, CH / "histogram.png", C)
# 4 clumsiness
f, ax = fig(C); vals = [exact0 * 100, exact * 100]
ax.bar(["No clumsiness", "0.1% clumsiness"], vals, color=[C["lose"], C["win"]], width=0.5)
for i, v in enumerate(vals):
    ax.text(i, v + 1.5, f"{v:.1f}%", ha="center", color=C["ink"], fontsize=20, fontweight="bold")
ax.set_ylim(0, 100); style(ax, C, "", "Chance of reaching step 60 (%)"); ax.tick_params(axis="x", labelsize=15); save(f, CH / "clumsiness.png", C)
# 5 exact vs simulation
f, ax = fig(C); hist_with_exact(ax, C); style(ax, C, "Final step", "Share of walks"); save(f, CH / "exact_overlay.png", C)
# 6 convergence
ind = (ends >= TARGET).astype(int); ns = np.unique(np.logspace(1, np.log10(len(ind)), 70).astype(int)); cs = np.cumsum(ind)
est = np.array([cs[n - 1] / n for n in ns]); ci = np.array([hs.wilson_interval(cs[n - 1], n) for n in ns])
f, ax = fig(C); ax.fill_between(ns, ci[:, 0], ci[:, 1], color=C["win"], alpha=0.25); ax.plot(ns, est, color=C["win"], lw=2.5, label="Running estimate")
ax.axhline(exact, color=C["acc"], ls="--", lw=2, label="Exact answer"); ax.set_xscale("log"); ax.set_ylim(0.55, 0.95)
ax.yaxis.set_major_formatter(matplotlib.ticker.PercentFormatter(1, 0)); ax.legend(frameon=False, labelcolor=C["ink"], fontsize=13)
style(ax, C, "Number of walks used (log scale)", "Win chance"); save(f, CH / "convergence.png", C)
# 7 value map
cmap = LinearSegmentedColormap.from_list("v", ["#9A3B2E", "#f1e9dc", "#2F6690"]); ymax = int(TARGET * 1.8) + 10
M = V[:, : ymax + 1].T.copy(); reach = np.arange(ymax + 1)[:, None] <= 6 * np.arange(ROLLS + 1)[None, :]; M = np.ma.masked_where(~reach, M)
f, ax = fig(C); im = ax.imshow(M, origin="lower", aspect="auto", cmap=cmap, vmin=0, vmax=1, extent=[0, ROLLS + 1, 0, ymax + 1])
ax.plot(np.arange(ROLLS + 1) + 0.5, paths[0] + 0.5, color="#1f1b18" if False else "#f6f2ec", lw=2); style(ax, C, "Roll number", "Step you are standing on"); ax.grid(False)
cb = f.colorbar(im, ax=ax, pad=0.02); cb.ax.yaxis.set_major_formatter(matplotlib.ticker.PercentFormatter(1, 0)); cb.ax.tick_params(colors=C["muted"], labelsize=12); cb.outline.set_edgecolor(C["grid"])
save(f, CH / "value_map.png", C)
# 8 machine learning
k, M_ = 30, 5000; d = hs.simulate(M_, ROLLS, CLUMSY, seed=2024); x = d[:, k].reshape(-1, 1).astype(float); y = (d[:, -1] >= TARGET).astype(int)
xtr, xte, ytr, yte = x[:4000], x[4000:], y[:4000], y[4000:]; sc = StandardScaler().fit(xtr)
lr = LogisticRegression().fit(sc.transform(xtr), ytr)
nn = MLPClassifier(hidden_layer_sizes=(8,), activation="tanh", max_iter=3000, random_state=0).fit(sc.transform(xtr), ytr)
pe = V[k, xte[:, 0].astype(int)]; pl = lr.predict_proba(sc.transform(xte))[:, 1]; pn = nn.predict_proba(sc.transform(xte))[:, 1]
base = np.full(len(yte), ytr.mean())
ml = {name: dict(acc=float(accuracy_score(yte, p >= 0.5)), logloss=float(log_loss(yte, np.clip(p, 1e-9, 1 - 1e-9))), auc=float(roc_auc_score(yte, p)) if name != "base" else 0.5)
      for name, p in dict(base=base, logistic=pl, nn=pn, exact=pe).items()}
facts["ml"] = ml; facts["ml_k"] = k
grid = np.arange(int(x.min()), int(x.max()) + 1); f, ax = fig(C)
ax.plot(grid, V[k, grid], color=C["ink"], lw=4, label="Exact (best possible)")
ax.plot(grid, lr.predict_proba(sc.transform(grid.reshape(-1, 1).astype(float)))[:, 1], color=C["win"], lw=2.5, label="Logistic regression")
ax.plot(grid, nn.predict_proba(sc.transform(grid.reshape(-1, 1).astype(float)))[:, 1], color=C["acc"], lw=2.5, label="Neural network")
ax.legend(frameon=False, labelcolor=C["ink"], fontsize=13, loc="lower right"); ax.yaxis.set_major_formatter(matplotlib.ticker.PercentFormatter(1, 0))
style(ax, C, f"Step after roll {k}", "Predicted chance of winning"); save(f, CH / "ml_curves.png", C)

(ROOT / "figures" / "facts.json").write_text(json.dumps(facts, indent=2))
print(json.dumps(facts, indent=2))
