# Hacker Statistics: Chances of Winning a Bet

You bet you can climb **60 steps** by rolling a die **100 times**. Each roll: 1-2 step down one (never below 0), 3-5 step up one, 6 roll again and climb that many. Every roll there is also a 0.1% chance of clumsily falling back to step 0.

**Hacker statistics** means answering a probability question by simulating it thousands of times instead of deriving a formula. This project does that, then checks the answer with exact math, statistics and machine learning.

**Answer:** about **78 times in 100** (exactly 77.7%). Without the clumsiness it would be 83.7%.

## What is in the project

| Part | Where | What it is |
|---|---|---|
| Original notebook | `Hacker Statistics-Chances of Winning a Bet.ipynb` | The DataCamp exercise: coin, dice, random walk, clumsiness, chance of reaching 60 (NumPy + Matplotlib) |
| Notebook 02 | `notebooks/02_exact_answer_and_value_map.ipynb` | The exact answer (Markov chain), the value map, error vs simulation size, and sensitivity to the rules; run it in PyCharm |
| Notebook 03 | `notebooks/03_statistics.ipynb` | Confidence intervals and their coverage, Bayesian update, goodness-of-fit, two-proportion test and power, false alarms (`scipy`, `statsmodels`) |
| Notebook 04 | `notebooks/04_machine_learning.ipynb` | Logistic regression, neural network, gradient boosting vs the exact answer; history features; learning curve; k-means; isolation forest (`scikit-learn`) |
| Notebook 05 | `notebooks/05_q_learning_when_to_stop.ipynb` | A stopping version of the game solved exactly (dynamic programming) and by Q-learning; code in `src/stopping.py` |
| Notebook 06 | `notebooks/06_learning_the_quit_zone.ipynb` | Why notebook 05's learner missed the quit zone: exploring starts and forgetting tested one at a time, a forgetting sweep, a learning curve, and a neural-network learner compared with the table; code in `src/stopping.py` |
| Roll-or-stop game | `docs/game.html`, `docs/stopping.js` | Browser game: decide when to stop, with the exact best move shown beside yours (same solution as notebook 05) |
| Project site | `docs/` | Overview, simulator, data science lab, notebook page and presentation (plain HTML/CSS/JS, no build step) |
| Python version | `src/hacker_stats.py` | NumPy simulation, exact Markov-chain answer, win-probability map |
| Figures and deck | `src/make_figures.py`, `src/build_deck.py` | Chart images and the presentation (HTML, PDF, PowerPoint, slide images) |
| Tests | `tests/` | `pytest` for the Python, a Node script for the JavaScript |
| Notes | `MILESTONES.md` | What is done and what comes next |

## The data science lab (`docs/lab.html`)

Eleven methods, each run on the same simulation and checked against the exact answer where one exists. Every card explains what we are looking for, how to read the result, what it means and what is next.

| # | Method | Question it answers |
|---|---|---|
| 1 | Markov chain / dynamic programming | What is the exact answer, and does the simulation agree? (KS statistic) |
| 2 | Law of large numbers, confidence interval, bootstrap | How many walks are enough? |
| 3 | Bayesian inference (Beta posterior) | What win chances are plausible given the data? |
| 4 | Value function (a reinforcement-learning idea) | What are my odds from every position mid-game? |
| 5 | Sensitivity analysis | How do target and clumsiness change the odds? |
| 6 | Linear regression and R-squared | How early is the outcome predictable? |
| 7 | Logistic regression and a neural network | Can a model learn the odds from examples? (train/test split, AUC, log loss, calibration) |
| 8 | k-means clustering (k-means++, elbow) | Are there natural kinds of climbs? |
| 9 | Outlier detection (robust z-scores) | Which walks are unusual? |
| 10 | Time-series autocorrelation | Is it really a random walk? |
| 11 | Hypothesis tests (chi-square, two-proportion z) | Is the random generator fair, and does clumsiness truly matter? |

## Run it

**Site, locally:** `python -m http.server --directory docs`, then open http://localhost:8000

**Python:**

```
pip install -r requirements.txt
python -m pytest            # Python tests
node tests/test_sim.js      # JavaScript simulation tests
node tests/test_analytics.js
node tests/test_stopping.js     # the roll-or-stop game logic
```

**Rebuild the figures and the presentation** (after changing the simulation or the slide text):

```
python -m src.make_figures   # charts and the numbers they show (figures/)
python -m src.build_deck     # docs/presentation/* and the front-page download buttons
```

`build_deck` needs Chrome for the PDF and slide images (set `CHROME` at the top of `src/build_deck.py` if it lives elsewhere).

## Publishing

- **GitHub Pages:** repo Settings, Pages, Deploy from a branch, `main`, folder `/docs`.
- **Portfolio:** every page carries `noindex` and the shared back-to-portfolio bar (`https://schirko.com/scott/backbar.css`, owned by the portfolio project). Links in the bar use full `https://schirko.com/scott/` addresses so they work from `github.io` and from `schirko.com/scott/hacker-statistics/` alike. To host it under the portfolio, copy the contents of `docs/` to `scott/hacker-statistics/`.

## Design notes

- Look and feel (palette, Fraunces/Inter type, cards, pill buttons, dark mode, presentation style) follows the `meat-prices` project so the portfolio feels consistent.
- The JavaScript uses a seedable random generator (mulberry32), so the same seed always gives the same result, like `np.random.seed` in the notebook.
- The exact answer exists because the game is a small Markov chain. It is the yardstick for every other method.
