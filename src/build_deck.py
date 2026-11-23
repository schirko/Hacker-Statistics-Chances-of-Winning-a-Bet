"""Build the presentation: one slide list -> HTML, PDF, PowerPoint, slide images (zip) and a cover.

Run after src.make_figures:   python -m src.build_deck
Needs: playwright (with Chrome), python-pptx, pillow, matplotlib.
Writes docs/presentation/hacker-stats-story.{html,pdf,pptx}, hacker-stats-story-slides.zip and cover.png
"""
import base64
import html as H
import json
import re
import zipfile
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from playwright.sync_api import sync_playwright
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.util import Emu, Pt

from . import hacker_stats as hs

ROOT = Path(__file__).resolve().parent.parent
FIG = ROOT / "figures" / "deck"
OUT = ROOT / "docs" / "presentation"
OUT.mkdir(parents=True, exist_ok=True)
F = json.loads((ROOT / "figures" / "facts.json").read_text())
BG, INK, BODY, MUTED, ACC, GOLD = "#1e1b18", "#f6f2ec", "#ddd5cb", "#cfc7be", "#e0796a", "#e2b45a"
CHROME = "/usr/bin/google-chrome"
pc = lambda v, d=1: f"{v * 100:.{d}f}%"

# ---- title background: one glowing climb along the bottom, like the meat-prices cover ----
w = hs.simulate(1, 100, 0.0, seed=11)[0].astype(float)
f, ax = plt.subplots(figsize=(19.2, 10.8), dpi=100); f.patch.set_facecolor(BG); ax.set_facecolor(BG); ax.axis("off")
x = np.linspace(0.03, 0.985, len(w)); y = 0.035 + 0.19 * (w - w.min()) / (w.max() - w.min())
for lw, a in ((16, 0.05), (10, 0.10), (6, 0.18)):
    ax.plot(x, y, color="#9A3B2E", lw=lw, alpha=a, solid_capstyle="round")
ax.plot(x, y, color="#b24a3b", lw=4.5, solid_capstyle="round"); ax.set_xlim(0, 1); ax.set_ylim(0, 1)
f.subplots_adjust(0, 0, 1, 1); f.savefig(FIG / "title_bg.png", facecolor=BG); plt.close(f)

# ---- slides ----
S = [
 dict(kind="title", kicker="A DATA STORY · HACKER STATISTICS", title="What are the chances of winning the bet?",
      sub="A dice-climbing bet, simulated thousands of times, then checked with exact math, statistics and machine learning.",
      by="Scott Schirkofsky · schirko.com/scott/hacker-statistics", img="title_bg.png",
      notes="You bet you can climb 60 steps by rolling a die 100 times. Instead of working out a formula, I simulate it, then test the answer several ways."),
 dict(kind="cards", title="The bet: roll a die 100 times and climb to step 60", cards=[
        ("1 or 2", "Step **down** one. You can never fall below step 0."), ("3, 4 or 5", "Step **up** one."),
        ("6", "Roll again and climb **that many** steps."), ("Clumsy", "Every roll there is a **0.1% chance** of falling back to step 0.")],
      notes="These are the rules of the game. The clumsiness is rare on any one roll, but over 100 rolls it matters."),
 dict(kind="chart", title="One climb is just one story", body=[f"The line is one climb of 100 rolls. This one finished on step **{F['one_walk_end']}**.",
      "Each step depends on the one before, so this is a **random walk**.", "One story can't tell us the odds. So we repeat it."], img="one_walk.png",
      notes="A single walk can end above or below the target. It tells you nothing about the chance of winning."),
 dict(kind="chart", title="Climb 10,000 times and the odds appear", body=["Each line is one simulated climb.", "**Blue** climbs reached step 60. **Grey** ones did not.",
      "The sharp drops to zero are the clumsy falls."], img="many_walks.png",
      notes="This is hacker statistics: answer a probability question by simulating it many times."),
 dict(kind="chart", title=f"About {round(F['simulated'] * 100)} in 100 climbs reach step 60",
      body=[f"{pc(F['simulated'])} of 10,000 simulated climbs finished at or above 60.", f"95% interval: {pc(F['ci'][0])} to {pc(F['ci'][1])}.", f"The average climb ends near step {F['mean_end']:.0f}."],
      img="histogram.png", notes="Bars show where the climbs ended. Everything right of the dashed line is a win."),
 dict(kind="chart", title="Clumsiness costs about 6 points", body=[f"Without falls: **{pc(F['exact_no_clumsy'])}**.", f"With the 0.1% fall chance: **{pc(F['exact'])}**.",
      f"Over 100 rolls, **{pc(F['any_fall'])}** of climbs take at least one fall to zero."], img="clumsiness.png",
      notes="A fall is rare per roll, but it wipes out all progress, so it adds up."),
 dict(kind="chart", title="The exact math agrees with the simulation", body=["The game is a **Markov chain**: each roll only depends on where you stand.",
      f"Tracking every step's probability gives the exact answer: **{pc(F['exact'])}**.", "The simulated bars follow the exact line."], img="exact_overlay.png",
      notes="Having an exact answer lets me check every other method against the truth."),
 dict(kind="chart", title="How many walks are enough?", body=["The estimate settles as walks are added; the band is its 95% interval.",
      "Error shrinks with the square root of the walks: **4x the walks, half the error**.", "A bootstrap and a Bayesian posterior tell the same story."], img="convergence.png",
      notes="Early estimates swing wildly. By a few thousand walks the interval is tight around the exact answer."),
 dict(kind="chart", title="You can know your odds mid-game", body=[f"At the start: **{pc(F['v_start'])}**.", f"After roll 30 on step 40: **{pc(F['v_t30_s40'], 0)}**. On step 20: **{pc(F['v_t30_s20'], 0)}**.",
      "Calculated backwards from the last roll, this is a **value function**, an idea from reinforcement learning.", "The pale band is the line of no return."], img="value_map.png",
      notes="The white line is one real climb travelling across the map."),
 dict(kind="chart", title="Machine learning learns the same odds", body=["A logistic regression and a small neural network, trained on 4,000 climbs and tested on 1,000 new ones.",
      f"Accuracy **{pc(F['ml']['nn']['acc'])}** for both, against {pc(F['ml']['base']['acc'])} for always guessing the base rate.",
      f"Log loss {F['ml']['nn']['logloss']:.3f} for both, against {F['ml']['exact']['logloss']:.3f} for the exact answer.", "They drift a little high at the far right, where few climbs exist. No model can beat the exact curve."], img="ml_curves.png",
      notes="The models land almost exactly on the exact line, so the neural network's extra flexibility bought nothing: the true relationship is already a smooth S-curve."),
 dict(kind="cards", title="More ways to look at the same climbs", cards=[
        ("Clustering", "k-means groups climbs by shape. The groups line up with who won, though the outcome was never used."),
        ("Outlier detection", "Robust z-scores flag the unusual walks. Most are unlucky climbs that fell late."),
        ("Autocorrelation", "Roll-to-roll changes are unpredictable, so it is a true random walk, with a drift near three-quarters of a step per roll."),
        ("Hypothesis tests", "A chi-square test says the die is fair. A z-test says clumsiness really does lower the odds.")],
      notes="All of these run live in the lab on the project site."),
 dict(kind="cards", title="The verdict: a good bet, with one risk", cards=[
        ("A good bet", f"About 78 times in 100. The exact answer is **{pc(F['exact'])}**."), ("The risk", "A fall back to zero. The 0.1% fall chance costs about **6 points**."),
        ("Every method agrees", "Simulation, exact math and machine learning all give the same answer.")],
      foot="Try it: schirko.com/scott/hacker-statistics", notes="The simulator and lab are on the project page."),
]
N = len(S)


def b64(p):
    return "data:image/png;base64," + base64.b64encode((FIG / p).read_bytes()).decode()


def md(t, tag="b"):
    return re.sub(r"\*\*(.+?)\*\*", lambda m: f"<{tag}>{H.escape(m.group(1))}</{tag}>", H.escape(t).replace("&amp;", "&"))


def slide_html(i, s):
    n = f'<div class="foot">Hacker Statistics · Scott Schirkofsky<span>{i + 1} / {N}</span></div>' if s["kind"] != "title" else ""
    if s["kind"] == "title":
        return f'''<section class="slide title" style="background-image:url({b64(s['img'])})"><div class="kick">{H.escape(s['kicker'])}</div>
<h1>{H.escape(s['title'])}</h1><p class="sub">{H.escape(s['sub'])}</p><p class="by">{H.escape(s['by'])}</p></section>'''
    if s["kind"] == "chart":
        li = "".join(f"<li>{md(t)}</li>" for t in s["body"])
        return f'<section class="slide"><h2>{H.escape(s["title"])}</h2><ul>{li}</ul><img src="{b64(s["img"])}" alt="">{n}</section>'
    cards = "".join(f'<div class="card"><h3>{H.escape(t)}</h3><p>{md(x)}</p></div>' for t, x in s["cards"])
    foot = f'<p class="cta">{H.escape(s["foot"])}</p>' if s.get("foot") else ""
    return f'<section class="slide"><h2>{H.escape(s["title"])}</h2><div class="cards c{len(s["cards"])}">{cards}</div>{foot}{n}</section>'


CSS = f'''*{{box-sizing:border-box}}html,body{{margin:0;height:100%;background:#0f0d0c;font-family:Inter,system-ui,sans-serif}}
.stage{{position:fixed;inset:0;display:grid;place-items:center;overflow:hidden}}
.slide{{position:absolute;left:0;top:0;width:1920px;height:1080px;background:{BG};color:{INK};background-size:cover;display:none;overflow:hidden}}
.slide.on{{display:block}}
.slide h1{{position:absolute;left:134px;top:345px;margin:0;width:1700px;font-size:128px;line-height:1.02;font-weight:800;letter-spacing:-.03em}}
.slide .kick{{position:absolute;left:134px;top:270px;font-size:27px;letter-spacing:.14em;font-weight:700;color:{MUTED}}}
.slide .sub{{position:absolute;left:134px;top:650px;width:1450px;margin:0;font-size:38px;line-height:1.3;color:{BODY}}}
.slide .by{{position:absolute;left:134px;top:790px;margin:0;font-size:34px;color:{BODY}}}
.slide h2{{position:absolute;left:110px;top:80px;width:1700px;margin:0;font-size:68px;line-height:1.08;font-weight:800;letter-spacing:-.02em}}
.slide ul{{position:absolute;left:110px;top:290px;width:610px;margin:0;padding:0;list-style:none;font-size:34px;line-height:1.38;color:{BODY}}}
.slide li{{margin-bottom:26px;padding-left:34px;position:relative}}.slide li::before{{content:"";position:absolute;left:0;top:18px;width:12px;height:12px;border-radius:50%;background:{ACC}}}
.slide b{{color:{INK};font-weight:700}}
.slide img{{position:absolute;left:760px;top:280px;width:1050px;border-radius:16px}}
.cards{{position:absolute;left:110px;top:270px;width:1700px;display:grid;gap:28px}}.c4{{grid-template-columns:repeat(4,1fr)}}.c4 .card p{{font-size:30px}}.c3{{grid-template-columns:repeat(3,1fr)}}
.card{{background:#2a2622;border:1px solid #3a352f;border-top:6px solid {ACC};border-radius:16px;padding:34px 30px;min-height:440px}}
.card h3{{margin:0 0 18px;font-size:42px;color:{INK}}}.card p{{margin:0;font-size:33px;line-height:1.4;color:{BODY}}}
.cta{{position:absolute;left:110px;top:800px;margin:0;font-size:36px;color:{GOLD};font-weight:600}}
.foot{{position:absolute;left:110px;right:110px;bottom:34px;display:flex;justify-content:space-between;font-size:22px;color:{MUTED}}}
.hint{{position:fixed;bottom:10px;right:14px;color:#8a8279;font-size:13px;font-family:Inter,sans-serif}}
@media print{{@page{{size:1920px 1080px;margin:0}}html,body{{background:{BG};height:auto}}.stage{{position:static;display:block;overflow:visible}}
.slide{{display:block!important;position:relative;transform:none!important;page-break-after:always;break-after:page}}.hint{{display:none}}}}'''
JS = '''const sl=[...document.querySelectorAll(".slide")];let i=+(location.hash.slice(1)||1)-1;
function fit(){const k=Math.min(innerWidth/1920,innerHeight/1080);sl.forEach(s=>s.style.transform=`scale(${k})`);sl.forEach(s=>{s.style.transformOrigin="center center"})}
function show(n){i=Math.max(0,Math.min(sl.length-1,n));sl.forEach((s,j)=>s.classList.toggle("on",j===i));history.replaceState(null,"","#"+(i+1))}
addEventListener("keydown",e=>{if(["ArrowRight","PageDown"," "].includes(e.key))show(i+1);if(["ArrowLeft","PageUp"].includes(e.key))show(i-1);if(e.key==="Home")show(0);if(e.key==="End")show(sl.length-1)});
addEventListener("click",e=>show(e.clientX>innerWidth/2?i+1:i-1));addEventListener("resize",fit);fit();show(i);'''
page = (f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow">'
        f'<title>What are the chances of winning the bet?</title><style>{CSS}</style></head><body><div class="stage">'
        + "".join(slide_html(i, s) for i, s in enumerate(S)) + f'</div><div class="hint">Arrow keys or click to move</div><script>{JS}</script></body></html>')
HTML = OUT / "hacker-stats-story.html"; HTML.write_text(page)

# ---- PDF + slide images + cover ----
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    pg = b.new_page(viewport={"width": 1920, "height": 1080})
    pg.goto(HTML.as_uri()); pg.wait_for_timeout(500)
    pngs = []
    for i in range(N):
        pg.evaluate("document.querySelector('.hint').style.display='none'"); pg.evaluate(f"show({i})"); pg.evaluate("document.querySelectorAll('.slide').forEach(s=>s.style.transform='none')"); pg.wait_for_timeout(120)
        path = FIG / f"slide-{i + 1:02d}.png"; pg.screenshot(path=str(path)); pngs.append(path)
    pg.emulate_media(media="print"); pg.pdf(path=str(OUT / "hacker-stats-story.pdf"), width="1920px", height="1080px", print_background=True, prefer_css_page_size=True)
    b.close()
with zipfile.ZipFile(OUT / "hacker-stats-story-slides.zip", "w", zipfile.ZIP_DEFLATED) as z:
    for i, path in enumerate(pngs):
        z.write(path, f"Slide {i + 1:02d}.png")
(OUT / "cover.png").write_bytes(pngs[0].read_bytes())

# ---- PowerPoint (native text boxes; 1920 px = 13.333 in, so 1 px = 1/144 in = 0.5 pt) ----
px = lambda v: Emu(int(v * 6350))
rgb = lambda h: RGBColor.from_string(h.lstrip("#").upper())
prs = Presentation(); prs.slide_width = px(1920); prs.slide_height = px(1080)


def text(slide, x, y, w, h, paras, size, color, bold=False, bullets=False, space=0):
    tb = slide.shapes.add_textbox(px(x), px(y), px(w), px(h)); tf = tb.text_frame; tf.word_wrap = True
    for k, line in enumerate(paras):
        para = tf.paragraphs[0] if k == 0 else tf.add_paragraph(); para.space_after = Pt(space)
        if bullets:
            line = "•  " + line
        for j, part in enumerate(re.split(r"\*\*(.+?)\*\*", line)):
            if not part:
                continue
            r = para.add_run(); r.text = part; r.font.size = Pt(size / 2); r.font.name = "Inter"
            hot = j % 2 == 1; r.font.bold = bold or hot; r.font.color.rgb = rgb(INK if hot else color)
    return tb


for i, s in enumerate(S):
    sl = prs.slides.add_slide(prs.slide_layouts[6]); sl.background.fill.solid(); sl.background.fill.fore_color.rgb = rgb(BG)
    if s["kind"] == "title":
        sl.shapes.add_picture(str(FIG / s["img"]), 0, 0, px(1920), px(1080))
        text(sl, 134, 255, 1500, 50, [s["kicker"]], 27, MUTED, True); text(sl, 134, 330, 1700, 300, [s["title"]], 128, INK, True)
        text(sl, 134, 635, 1450, 120, [s["sub"]], 38, BODY); text(sl, 134, 780, 1450, 60, [s["by"]], 34, BODY)
    else:
        text(sl, 110, 70, 1700, 230, [s["title"]], 68, INK, True)
        if s["kind"] == "chart":
            text(sl, 110, 280, 630, 700, s["body"], 34, BODY, bullets=True, space=14); sl.shapes.add_picture(str(FIG / s["img"]), px(760), px(280), width=px(1050))
        else:
            n = len(s["cards"]); cw = (1700 - 28 * (n - 1)) / n
            for k, (t, x) in enumerate(s["cards"]):
                cx = 110 + k * (cw + 28)
                bx = sl.shapes.add_shape(1, px(cx), px(270), px(cw), px(440)); bx.fill.solid(); bx.fill.fore_color.rgb = rgb("#2a2622"); bx.line.color.rgb = rgb("#3a352f")
                ac = sl.shapes.add_shape(1, px(cx), px(270), px(cw), px(8)); ac.fill.solid(); ac.fill.fore_color.rgb = rgb(ACC); ac.line.fill.background()
                text(sl, cx + 24, 295, cw - 48, 110, [t], 38 if n == 4 else 42, INK, True); text(sl, cx + 24, 420 if n == 4 else 390, cw - 48, 290, [x], 30 if n == 4 else 33, BODY)
            if s.get("foot"):
                text(sl, 110, 790, 1700, 60, [s["foot"]], 36, GOLD, True)
        text(sl, 110, 1020, 1700, 40, [f"Hacker Statistics · Scott Schirkofsky        {i + 1} / {N}"], 22, MUTED)
    sl.notes_slide.notes_text_frame.text = s["notes"]
prs.save(OUT / "hacker-stats-story.pptx")
for f_ in sorted(OUT.iterdir()):
    print(f"{f_.name:38s}{f_.stat().st_size / 1e6:6.2f} MB")


# ---- keep the front page's presentation section and download buttons in step with the files ----
INDEX = ROOT / "docs" / "index.html"
mb = lambda name: f"{(OUT / name).stat().st_size / 1e6:.1f} MB"
tiles = "\n".join(
    f'      <a class="dl" href="presentation/{f}" download><span class="ext">{ext}</span><span><b>{label}</b><small>{note} &middot; {mb(f)}</small></span></a>'
    for f, ext, label, note in [("hacker-stats-story.pdf", "PDF", "PDF", "Read or print"), ("hacker-stats-story.pptx", "PPTX", "PowerPoint", "Editable, with speaker notes"),
                                ("hacker-stats-story.html", "HTML", "HTML", "One file, opens in any browser"), ("hacker-stats-story-slides.zip", "ZIP", "Slide images", "One PNG per slide")])
block = f"""<h2 id="presentation">The story, as a presentation</h2>
<div class="deck">
  <a class="deck-thumb" href="presentation/hacker-stats-story.html" target="_blank" rel="noopener"><img src="presentation/cover.png" alt="Cover slide: What are the chances of winning the bet?"><span>{N} slides</span></a>
  <div>
    <p class="note" style="margin-top:0">The whole project told as a {N}-slide story: the bet, the simulation, the exact math, how many walks are enough,
    your odds mid-game, what machine learning adds, and the verdict.</p>
    <a class="btn primary" href="presentation/hacker-stats-story.html" target="_blank" rel="noopener">View the presentation</a>
    <div class="dls">
{tiles}
    </div>
  </div>
</div>"""
page = INDEX.read_text()
page = re.sub(r"<!--PRESENTATION-->.*?<!--/PRESENTATION-->", lambda m: "<!--PRESENTATION-->\n" + block + "\n<!--/PRESENTATION-->", page, flags=re.S)
INDEX.write_text(page)
print("front page presentation section updated")
