"""Tests for the optimal-stopping game (src/stopping.py)."""
import numpy as np
from src.hacker_stats import exact_win_chance
from src.stopping import optimal_stopping, evaluate_policy, occupancy, q_learn, greedy_roll_mask


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
