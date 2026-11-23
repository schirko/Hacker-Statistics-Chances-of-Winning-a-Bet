"""Hacker statistics: chances of winning a bet (NumPy version of the website's simulation).

The game: you climb stairs by rolling a die each turn.
    1-2  -> down one step (never below step 0)
    3-5  -> up one step
    6    -> roll again and climb that many steps
After every roll there is also a small chance (clumsiness) of falling back to step 0.

Three ways to answer "what is the chance of reaching the target?":
    simulate()             many random walks, count the winners (hacker statistics)
    exact_distribution()   the exact probability of every final step (a Markov chain)
    value_map()            the exact chance of still winning from every (roll, step) position
"""
import numpy as np


def simulate(walks=10_000, rolls=100, clumsy=0.001, seed=123):
    """Return an array of shape (walks, rolls + 1): the step after each roll, for every walk."""
    rng = np.random.default_rng(seed)
    pos = np.zeros(walks, dtype=int)
    path = np.zeros((rolls + 1, walks), dtype=int)
    for t in range(rolls):
        dice = rng.integers(1, 7, walks)       # the die
        extra = rng.integers(1, 7, walks)      # the second roll after a 6
        step = np.where(dice <= 2, np.maximum(0, pos - 1), np.where(dice <= 5, pos + 1, pos + extra))
        fell = rng.random(walks) <= clumsy     # clumsiness
        pos = np.where(fell, 0, step)
        path[t + 1] = pos
    return path.T


def win_chance(paths, target=60):
    """Share of walks that finish at or above the target."""
    return float((paths[:, -1] >= target).mean())


def exact_distribution(rolls=100, clumsy=0.001):
    """Exact probability of finishing on each step, from a Markov chain (dynamic programming)."""
    size = 6 * rolls + 8
    p = np.zeros(size)
    p[0] = 1.0
    for _ in range(rolls):
        q = np.zeros(size)
        q[0] += p[0] * (2 / 6)                       # a 1-2 at step 0 stays at 0
        q[:-1] += p[1:] * (2 / 6)                    # a 1-2 moves down one
        q[1:] += p[:-1] * (3 / 6)                    # a 3-5 moves up one
        for k in range(1, 7):
            q[k:] += p[:-k] * (1 / 36)               # a 6, then a second roll of k
        p = q * (1 - clumsy)
        p[0] += clumsy                               # clumsy fall: back to step 0
    return p


def exact_win_chance(rolls=100, target=60, clumsy=0.001):
    return float(exact_distribution(rolls, clumsy)[target:].sum())


def value_map(rolls=100, target=60, clumsy=0.001):
    """V[t, s] = chance of finishing at or above target, given you are on step s after roll t.

    Computed backwards from the last roll. (In reinforcement learning this table is a value function.)
    """
    size = 6 * rolls + 8
    V = np.zeros((rolls + 1, size))
    V[rolls] = (np.arange(size) >= target).astype(float)
    for t in range(rolls - 1, -1, -1):
        nx = V[t + 1]
        w = np.zeros(size - 7)
        idx = np.arange(size - 7)
        w += (2 / 6) * nx[np.maximum(idx - 1, 0)] + (3 / 6) * nx[idx + 1]
        for k in range(1, 7):
            w += nx[idx + k] / 36
        V[t, : size - 7] = (1 - clumsy) * w + clumsy * nx[0]
    return V


def wilson_interval(wins, n, z=1.96):
    """95% confidence interval for a proportion."""
    p = wins / n
    d = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / d
    half = z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return max(0.0, centre - half), min(1.0, centre + half)
