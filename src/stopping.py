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


# ---------------------------------------------------------------------------------------------
# Notebook 06: learning the quit zone
# ---------------------------------------------------------------------------------------------

def _step(s, rng, clumsy):
    """One roll for an array of steps `s`: returns the new steps (the game's rules, sampled)."""
    n = len(s)
    d, d2 = rng.integers(1, 7, n), rng.integers(1, 7, n)
    s2 = np.where(d <= 2, np.maximum(s - 1, 0), np.where(d <= 5, s + 1, s + d2))
    return np.where(rng.random(n) <= clumsy, 0, s2)


def q_learn_batch(games=5_000_000, batch=20_000, rolls=100, target=60, clumsy=0.001, fee=0.005, cap=101,
                  seed=0, exploring_starts=True, forget=0.05, eps=0.1, checkpoint_every=None):
    """Q-learning that plays many games at once (fast), with three knobs that matter for the quit zone.

    exploring_starts  start each game at a random (roll number, step) instead of always at step 0,
                      so the rarely visited quit zone gets practice.
    forget            each update moves an estimate at least this fraction of the way to the newest
                      average, so old, optimistic guesses fade. 0 means plain averaging (1/N).
    eps               chance of trying a random action instead of the best-looking one.

    Learns only from sampled rolls (no probabilities from the rules). Returns (Q, N, snaps): Q the learned
    scores, N how many times each (roll, step, action) was tried (N.sum() is the number of decisions seen),
    and snaps a list of (games_done, roll_mask) taken every `checkpoint_every` games.
    """
    rng = np.random.default_rng(seed)
    Q = np.ones((rolls, cap, 2))                  # optimistic start: every action looks great until tried
    N = np.zeros((rolls, cap, 2))
    snaps = []
    for b in range(games // batch):
        if exploring_starts:
            t = rng.integers(0, rolls, batch)
            s = rng.integers(0, cap, batch)
        else:
            t = np.zeros(batch, dtype=int)
            s = np.zeros(batch, dtype=int)
        live = np.ones(batch, dtype=bool)
        while live.any():
            i = np.where(live)[0]
            ti, si_raw = t[i], s[i]
            si = np.minimum(si_raw, cap - 1)
            q = Q[ti, si]
            a = np.where(q[:, ROLL] >= q[:, STOP], ROLL, STOP)
            a = np.where(rng.random(len(i)) < eps, rng.integers(0, 2, len(i)), a)
            s2 = _step(si_raw, rng, clumsy)
            last = ti + 1 == rolls
            future = np.where(last, (s2 >= target).astype(float),
                              Q[np.minimum(ti + 1, rolls - 1), np.minimum(s2, cap - 1)].max(axis=1))
            goal = np.where(a == STOP, (si_raw >= target).astype(float), -fee + future)
            cell = (ti * cap + si) * 2 + a
            count = np.bincount(cell, minlength=Q.size).astype(float)
            total = np.bincount(cell, weights=goal, minlength=Q.size)
            hit = count > 0
            lr = np.maximum(count[hit] / (N.reshape(-1)[hit] + count[hit]), forget)
            Qf = Q.reshape(-1)
            Qf[hit] += lr * (total[hit] / count[hit] - Qf[hit])
            N.reshape(-1)[hit] += count[hit]
            go = (a == ROLL) & ~last
            live[i[~go]] = False
            t[i[go]] += 1
            s[i[go]] = s2[go]
        if checkpoint_every and ((b + 1) * batch) % checkpoint_every == 0:
            snaps.append(((b + 1) * batch, greedy_roll_mask(Q, rolls)))
    return Q, N, snaps


def fit_network(rounds=100, n=40_000, rolls=100, target=60, clumsy=0.001, fee=0.005, hidden=(64, 64),
                seed=0, checkpoint_every=None, average_last=20):
    """Neural-network Q-values ("fitted Q iteration").

    One small network learns the value of rolling, from two inputs: the roll number and the step.
    Every round we sample random positions, roll the dice once from each, and teach the network
    "value of rolling here = -fee + best value of where you land", using the network's own current
    guesses for the landing spots. Information about the end of the game spreads back by about one
    roll per round, so `rounds` should be at least about `rolls`.
    The network keeps shifting a little from round to round, so the final rule is built from the average of
    its predictions over the last `average_last` rounds (set to 1 to use only the final round).
    Returns (net, roll_mask, snaps). Steps at or above the target always stop (collect).
    """
    import warnings
    from sklearn.neural_network import MLPRegressor
    warnings.filterwarnings("ignore")
    rng = np.random.default_rng(seed)
    net = MLPRegressor(hidden_layer_sizes=hidden, activation="relu", learning_rate_init=3e-3,
                       max_iter=1, warm_start=True, batch_size=1024, random_state=seed)

    def feat(t, s):
        return np.c_[t / rolls, np.minimum(s, target) / target]

    net.partial_fit(feat(np.array([0, 1]), np.array([0, 1])), np.array([0.0, 0.0]))

    def best_value(t, s):
        guess = np.maximum(0.0, net.predict(feat(np.minimum(t, rolls - 1), s)))
        v = np.where(s >= target, 1.0, guess)
        return np.where(t >= rolls, (s >= target) * 1.0, v)

    snaps = []
    grid = _network_grid(rolls, target)
    total, kept = 0.0, 0
    for k in range(rounds):
        t = rng.integers(0, rolls, n)
        s = rng.integers(0, target, n)
        goal = -fee + best_value(t + 1, _step(s, rng, clumsy))
        for _ in range(3):
            net.partial_fit(feat(t, s), goal)
        if k >= rounds - average_last:
            total = total + net.predict(grid)
            kept += 1
        if checkpoint_every and (k + 1) % checkpoint_every == 0:
            snaps.append((k + 1, network_roll_mask(net, rolls, target)))
    return net, _mask_from_values((total / kept).reshape(rolls, -1), rolls, target), snaps


def _network_grid(rolls, target):
    tt, ss = np.meshgrid(np.arange(rolls), np.arange(_size(rolls)), indexing="ij")
    return np.c_[tt.ravel() / rolls, np.minimum(ss.ravel(), target) / target]


def _mask_from_values(c, rolls, target):
    ss = np.arange(_size(rolls))[None, :]
    return np.where(ss >= target, False, c >= 0)


def network_roll_mask(net, rolls=100, target=60):
    """Turn a trained network into a rule: roll wherever it says rolling is worth at least 0 (quitting pays 0)."""
    c = net.predict(_network_grid(rolls, target)).reshape(rolls, _size(rolls))
    return _mask_from_values(c, rolls, target)


def score_rule(roll_mask, rolls=100, target=60, clumsy=0.001, fee=0.005):
    """How good is a rule, measured against the exact best? Returns a dict."""
    W, cont, stop = optimal_stopping(rolls, target, clumsy, fee)
    best = cont[:rolls] >= stop
    below = np.arange(_size(rolls)) < target
    quit_exact = (~best) & below
    got = (~roll_mask) & quit_exact
    false_quit = (~roll_mask) & best & below
    return dict(payoff=evaluate_policy(roll_mask, rolls, target, clumsy, fee), best=float(W[0, 0]),
                quit_cells=int(quit_exact.sum()), quit_found=int(got.sum()), false_quits=int(false_quit.sum()))
