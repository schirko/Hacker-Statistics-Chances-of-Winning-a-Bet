# Milestones

## Done

1. **Notebook** (the original exercise): coin, dice, random walk, clumsiness, chance of reaching 60.
2. **Web simulator** (`docs/explore.html`): change walks, rolls, target, clumsiness and seed; see every walk and where they end; five-step explainer with live demos.
3. **Exact answer**: Markov-chain dynamic programming in JavaScript and Python (77.7%), tested against large simulations.
4. **Data science lab** (`docs/lab.html`): 11 statistics and machine-learning methods, each checked against the exact answer.
5. **Portfolio style**: meat-prices palette, fonts, cards, dark mode, back-to-portfolio bar, `noindex` on every page.
6. **Presentation**: 12 slides as HTML, PDF, PowerPoint (with speaker notes) and slide images, built from one slide list in `src/build_deck.py`.
7. **Python code and tests**: `src/hacker_stats.py` with `pytest`; Node tests for the browser code.

## Next, in priority order

1. **Notebook 02: the exact answer and the value map** in Python (code, result, how to read it, what it means, what is next), so the Python path is as visible as the web one.
2. **Notebook 03: statistics** (intervals, bootstrap, Bayesian update, hypothesis tests) with `scipy` and `statsmodels` for comparison with the browser results.
3. **Notebook 04: machine learning** with `scikit-learn` (logistic regression, neural network, k-means, isolation forest) on the same walks.
4. **Portfolio card**: screenshot (`docs/images/headline.png` works) and card text for `scott/index.html`.
5. **Richer ML features**: add roll history (not just the current step) to see whether anything beats the one-number model; the Markov property says it should not.
6. **Reinforcement-learning demo**: let a player choose to stop at any roll and learn the best stopping rule with Q-learning.

## Known limits

- The browser lab limits walks to 300 rolls so the exact calculations stay instant.
- The machine-learning models use one input (the current step), because the game is a Markov chain and that is all the rules allow them to use.
