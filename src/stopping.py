"""Optimal stopping version of the game, solved exactly and by Q-learning.

The rules (a variation on the original bet):
    * You may stop after any roll. Stopping on step TARGET or higher collects a prize of 1.
      Stopping on a lower step gets nothing (you quit).
    * Every roll costs a small fee. The game ends by itself after ROLLS rolls.
    * You choose after every roll: ROLL again or STOP.

Two ways to find the best rule:
    optimal_stopping()   exact dynamic programming (backwards from the last roll)
    q_learn()            Q-learning: learn from thousands of played games, with no knowledge of the rules' probabilities
"""
import numpy as np

ROLL, STOP = 0, 1


def _size(rolls):
    return 6 * rolls + 8


def _expected_next(nx, size, clumsy):
    """Expected value of next-roll values `nx` from each step (the game's transition rule)."""
    idx = np.arange(size - 7)
    w = (2 / 6) * nx[np.maximum(idx - 1, 0)] + (3 / 6) * nx[idx + 1]
    for k in range(1, 7):
        w += nx[idx + k] / 36
    return (1 - clumsy) * w + clumsy * nx[0]


def optimal_stopping(rolls=100, target=60, clumsy=0.001, fee=0.005):
    """Exact best value and rule. Returns (W, cont, stop):
    W[t, s]    best expected payoff from step s after roll t
    cont[t, s] expected payoff of rolling once more and then playing best
    stop[s]    payoff of stopping on step s (1 if s >= target, else 0)
    The best action is ROLL where cont > stop, otherwise STOP.
    """
    size = _size(rolls)
    stop = (np.arange(size) >= target).astype(float)
    W = np.zeros((rolls + 1, size))
    W[rolls] = stop
    cont = np.full((rolls + 1, size), -9.0)
    for t in range(rolls - 1, -1, -1):
        cont[t, : size - 7] = -fee + _expected_next(W[t + 1], size, clumsy)
        W[t] = np.maximum(stop, cont[t])
    return W, cont, stop


def evaluate_policy(roll_mask, rolls=100, target=60, clumsy=0.001, fee=0.005):
    """Exact expected payoff of any rule. roll_mask[t, s] is True where the rule says ROLL (t < rolls)."""
    size = _size(rolls)
    stop = (np.arange(size) >= target).astype(float)
    Wp = np.zeros((rolls + 1, size))
    Wp[rolls] = stop
    for t in range(rolls - 1, -1, -1):
        c = np.full(size, -9.0)
        c[: size - 7] = -fee + _expected_next(Wp[t + 1], size, clumsy)
        Wp[t] = np.where(roll_mask[t], c, stop)
    return float(Wp[0, 0])


def occupancy(roll_mask, rolls=100, clumsy=0.001):
    """Chance of being on each (roll, step) while still playing, when following the rule. Shape (rolls, size)."""
    size = _size(rolls)
    occ = np.zeros((rolls, size))
    p = np.zeros(size)
    p[0] = 1.0
    for t in range(rolls):
        occ[t] = p
        p = p * roll_mask[t]                       # only climbers who roll continue
        q = np.zeros(size)
        q[0] += p[0] * (2 / 6)
        q[:-1] += p[1:] * (2 / 6)
        q[1:] += p[:-1] * (3 / 6)
        for k in range(1, 7):
            q[k:] += p[:-k] / 36
        p = q * (1 - clumsy)
        p[0] += clumsy * q.sum()
    return occ


def q_learn(episodes=300_000, rolls=100, target=60, clumsy=0.001, fee=0.005, cap=101, seed=0,
            eps_start=0.3, eps_end=0.02, checkpoint_every=None):
    """Tabular Q-learning with epsilon-greedy exploration and optimistic starting values.

    Q[t, s, ROLL] and Q[t, s, STOP] estimate the payoff of each action. Steps above `cap` share one entry.
    Returns (Q, checkpoints) where checkpoints is a list of (episodes_done, roll_mask) snapshots.
    """
    rng = np.random.default_rng(seed)
    Q = np.ones((rolls, cap, 2))                   # optimistic: every action looks great until tried
    N = np.zeros((rolls, cap, 2))
    dice = rng.integers(1, 7, (episodes, rolls))
    dice2 = rng.integers(1, 7, (episodes, rolls))
    fall = rng.random((episodes, rolls))
    explore = rng.random((episodes, rolls))
    coin = rng.integers(0, 2, (episodes, rolls))
    snaps = []
    for ep in range(episodes):
        eps = eps_start + (eps_end - eps_start) * min(1.0, ep / (0.8 * episodes))
        s = 0
        for t in range(rolls):
            si = s if s < cap else cap - 1
            q = Q[t, si]
            a = coin[ep, t] if explore[ep, t] < eps else (ROLL if q[ROLL] >= q[STOP] else STOP)
            N[t, si, a] += 1
            lr = max(0.02, 1.0 / N[t, si, a] ** 0.6)
            if a == STOP:
                Q[t, si, STOP] += lr * ((1.0 if s >= target else 0.0) - Q[t, si, STOP])
                break
            d = dice[ep, t]
            s2 = max(0, s - 1) if d <= 2 else (s + 1 if d <= 5 else s + dice2[ep, t])
            if fall[ep, t] <= clumsy:
                s2 = 0
            if t + 1 == rolls:
                future = 1.0 if s2 >= target else 0.0           # the game ends: payoff settles
            else:
                future = Q[t + 1, s2 if s2 < cap else cap - 1].max()
            Q[t, si, ROLL] += lr * (-fee + future - Q[t, si, ROLL])
            s = s2
        if checkpoint_every and (ep + 1) % checkpoint_every == 0:
            snaps.append((ep + 1, greedy_roll_mask(Q, rolls)))
    return Q, snaps


def greedy_roll_mask(Q, rolls=100):
    """Turn Q-values into a rule: ROLL wherever rolling looks at least as good as stopping."""
    size = _size(rolls)
    cap = Q.shape[1]
    idx = np.minimum(np.arange(size), cap - 1)
    return Q[:, idx, ROLL] >= Q[:, idx, STOP]
