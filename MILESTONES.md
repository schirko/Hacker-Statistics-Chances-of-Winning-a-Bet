# Milestones

## Done

1. **Notebook** (the original exercise): coin, dice, random walk, clumsiness, chance of reaching 60.
2. **Web simulator** (`docs/explore.html`): change walks, rolls, target, clumsiness and seed; see every walk and where they end; five-step explainer with live demos.
3. **Exact answer**: Markov-chain dynamic programming in JavaScript and Python (77.7%), tested against large simulations.
4. **Data science lab** (`docs/lab.html`): 11 statistics and machine-learning methods, each checked against the exact answer.
5. **Portfolio style**: meat-prices palette, fonts, cards, dark mode, back-to-portfolio bar, `noindex` on every page.
6. **Presentation**: 13 slides as HTML, PDF, PowerPoint (with speaker notes) and slide images, built from one slide list in `src/build_deck.py`.
7. **Python code and tests**: `src/hacker_stats.py` with `pytest`; Node tests for the browser code.
8. **Notebook 02: the exact answer and the value map** (`notebooks/02_exact_answer_and_value_map.ipynb`, also on the site): simulation vs exact, error vs sample size, value map, sensitivity.
9. **Notebook 03: statistics** (`notebooks/03_statistics.ipynb`, also on the site): four confidence intervals and their coverage, Bayesian update and prior sensitivity, goodness-of-fit, two-proportion test with power, false alarms.
10. **Notebook 04: machine learning** (`notebooks/04_machine_learning.ipynb`, also on the site): models vs the exact ceiling, history features, AUC by roll, learning curve, k-means, isolation forest.
11. **Notebook 05: learning when to stop** (`notebooks/05_q_learning_when_to_stop.ipynb`, also on the site): a stopping version of the game solved exactly and by Q-learning; code in `src/stopping.py` with tests.
12. **Roll-or-stop game** (`docs/game.html`): play the stopping game in the browser; the exact best move, your expected loss per decision and a best-move map. Logic in `docs/stopping.js`, tested against the Python numbers in `tests/test_stopping.js`.

## Next, in priority order

1. **Learn the quit zone**: Q-learning missed the small gain from quitting; try a decaying learning rate, many more games, or a neural network for the Q-values (notebook 06).

## Known limits

- The browser lab limits walks to 300 rolls so the exact calculations stay instant.
- The machine-learning models in the browser lab use one input (the current step; notebook 04 tests adding history and finds no gain), because the game is a Markov chain and that is all the rules allow them to use.
