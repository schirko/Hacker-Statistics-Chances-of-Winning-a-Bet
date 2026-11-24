"""Tests for the optimal-stopping game (src/stopping.py)."""
import numpy as np
from src.hacker_stats import exact_win_chance
from src.stopping import (optimal_stopping, evaluate_policy, occupancy, q_learn, greedy_roll_mask,
                          q_learn_batch, fit_network, score_rule)


def test_free_stopping_beats_playing_to_the_end():
    # with no fee, being allowed to stop on the target must be at least as good as finishing on it
    W, cont, stop = optimal_stopping(rolls=100, fee=0.0)
    assert W[0, 0] >= exact_win_chance(100, 60, 0.001)
    assert W[0, 0] <= 1.0


def test_policy_evaluation_matches_optimal_value():
    W, cont, stop = optimal_stopping()
    mask = cont[:100] > stop[None, :]
    assert abs(evaluate_policy(mask) - W[0, 0]) < 1e-12


def test_any_rule_is_no_better_than_the_optimal_rule():
    W, cont, stop = optimal_stopping()
    always_roll = np.ones_like(cont[:100], dtype=bool)
    assert evaluate_policy(always_roll) <= W[0, 0] + 1e-12


def test_higher_fee_never_raises_the_value():
    values = [optimal_stopping(fee=f)[0][0, 0] for f in (0.0, 0.002, 0.005, 0.01)]
    assert all(a >= b for a, b in zip(values, values[1:]))


def test_occupancy_is_a_probability():
    W, cont, stop = optimal_stopping()
    occ = occupancy(cont[:100] > stop[None, :])
    assert occ.sum(axis=1).max() <= 1.0 + 1e-9


def test_q_learning_learns_something_useful():
    Q, snaps = q_learn(episodes=60_000, seed=0)
    value = evaluate_policy(greedy_roll_mask(Q))
    W, cont, stop = optimal_stopping()
    assert value > 0.2              # far better than quitting at once (0)
    assert value <= W[0, 0] + 1e-9  # and, of course, never better than the exact optimum


SMALL = dict(rolls=30, target=15, clumsy=0.001, fee=0.005)


def test_scoring_the_exact_rule_finds_every_quit_cell():
    W, cont, stop = optimal_stopping(**SMALL)
    score = score_rule(cont[:30] >= stop, **SMALL)
    assert score["quit_found"] == score["quit_cells"] > 0
    assert score["false_quits"] == 0
    assert abs(score["payoff"] - score["best"]) < 1e-12


def test_batch_q_learning_approaches_the_exact_payoff_and_never_beats_it():
    Q, N, snaps = q_learn_batch(games=400_000, batch=10_000, cap=40, seed=0, checkpoint_every=200_000, **SMALL)
    score = score_rule(greedy_roll_mask(Q, 30), **SMALL)
    assert score["payoff"] <= score["best"] + 1e-9
    assert score["best"] - score["payoff"] < 0.02
    assert len(snaps) == 2 and N.sum() > 0


def test_batch_q_learning_is_repeatable_for_a_seed():
    a, _, _ = q_learn_batch(games=40_000, batch=10_000, cap=40, seed=3, **SMALL)
    b, _, _ = q_learn_batch(games=40_000, batch=10_000, cap=40, seed=3, **SMALL)
    assert np.array_equal(a, b)


def test_network_learns_a_useful_rule():
    net, mask, snaps = fit_network(rounds=40, n=4000, hidden=(32, 32), seed=0, average_last=5, **SMALL)
    score = score_rule(mask, **SMALL)
    assert 0.1 < score["payoff"] <= score["best"] + 1e-9
