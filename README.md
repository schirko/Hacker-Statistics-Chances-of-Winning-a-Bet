# Hacker Statistics: Chances of Winning a Bet

Use **hacker statistics** (simulate it thousands of times instead of deriving a formula) to estimate the chance of winning a bet: climb to step 60 by rolling a die 100 times, with a 0.1% chance of clumsily falling back to step 0 on every roll.

- **Notebook:** `Hacker Statistics-Chances of Winning a Bet.ipynb` (NumPy + Matplotlib, from a DataCamp exercise)
- **Interactive web version:** `docs/` (plain HTML/CSS/JavaScript, no build step)

## Web app (GitHub Pages)

Live at: https://schirko.github.io/Hacker-Statistics-Chances-of-Winning-a-Bet/

Change the number of walks, rolls, target step, clumsiness, and seed, then run the simulation to see every walk, the distribution of final steps, and the chance of winning.

Run it locally: `python -m http.server --directory docs` then open http://localhost:8000

## Rules of the game

| Die roll | Move |
|---|---|
| 1 or 2 | down one step (never below 0) |
| 3, 4 or 5 | up one step |
| 6 | roll again and climb that many steps |

Each roll there is also a clumsiness chance of falling back to step 0.

## Tests

`node tests/test_sim.js` checks the simulation logic (about 78% win chance with the default settings, seeds reproducible, steps never negative).
