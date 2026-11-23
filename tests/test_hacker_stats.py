import numpy as np
from src import hacker_stats as hs


def test_distribution_sums_to_one():
    assert abs(hs.exact_distribution(100, 0.001).sum() - 1) < 1e-9


def test_exact_matches_simulation():
    paths = hs.simulate(walks=100_000, rolls=100, clumsy=0.001, seed=1)
    assert abs(hs.win_chance(paths, 60) - hs.exact_win_chance(100, 60, 0.001)) < 0.005


def test_known_answer_is_about_78_percent():
    assert abs(hs.exact_win_chance(100, 60, 0.001) - 0.7767) < 1e-3


def test_clumsiness_lowers_the_odds():
    assert hs.exact_win_chance(100, 60, 0.0) > hs.exact_win_chance(100, 60, 0.001)


def test_walks_never_go_below_zero():
    assert hs.simulate(walks=500, rolls=200, seed=3).min() >= 0


def test_same_seed_same_result():
    assert np.array_equal(hs.simulate(50, 20, seed=9), hs.simulate(50, 20, seed=9))


def test_value_map_start_equals_exact_answer():
    V = hs.value_map(100, 60, 0.001)
    assert abs(V[0, 0] - hs.exact_win_chance(100, 60, 0.001)) < 1e-9
    assert V[100, 60] == 1 and V[100, 59] == 0


def test_wilson_interval():
    lo, hi = hs.wilson_interval(50, 100)
    assert abs(lo - 0.4038) < 1e-3 and abs(hi - 0.5962) < 1e-3
