"""Unit tests for SeatedConductor MR (`horizon_seated_xr`)."""

from __future__ import annotations

import pytest

from horizon_seated_xr.core import (
    OneTimeConsentRegistry,
    QuestFrameBudgetProfiler,
    SeatedErgonomicsValidator,
    SeatedProfile,
)
from horizon_seated_xr.engine import run_seated_xr_simulation


def test_seated_ergonomics_validator_and_airplane_envelope() -> None:
    ok = SeatedErgonomicsValidator.validate_node(
        reach_m=0.45,
        neck_pitch_deg=-5.0,
        height_above_floor_m=0.95,
        continuous_yaw_deg_s=0.0,
        profile=SeatedProfile.AIRPLANE_TRAY,
    )
    assert ok["ok"] is True

    # 0.58m fails AIRPLANE_TRAY (<= 0.55m) but passes STANDARD_DESK (<= 0.60m)
    tray_fail = SeatedErgonomicsValidator.validate_node(
        reach_m=0.58,
        neck_pitch_deg=0.0,
        height_above_floor_m=0.95,
        profile=SeatedProfile.AIRPLANE_TRAY,
    )
    assert tray_fail["ok"] is False
    desk_ok = SeatedErgonomicsValidator.validate_node(
        reach_m=0.58,
        neck_pitch_deg=0.0,
        height_above_floor_m=0.95,
        profile=SeatedProfile.STANDARD_DESK,
    )
    assert desk_ok["ok"] is True

    with pytest.raises(ValueError, match="bool rejected"):
        SeatedErgonomicsValidator.validate_node(
            reach_m=True,  # type: ignore[arg-type]
            neck_pitch_deg=0.0,
            height_above_floor_m=1.0,
        )


def test_one_time_consent_token_single_redemption_and_expiry() -> None:
    reg = OneTimeConsentRegistry()
    reg.grant_headset_consent(token="TOK-1", plan_digest="DIG-A", run_id="RUN-1", now_s=10.0, ttl_s=30.0)
    # Wrong plan_digest fails without burning token
    assert reg.redeem(token="TOK-1", plan_digest="DIG-WRONG", run_id="RUN-1", now_s=15.0) is False
    # Valid redemption succeeds once
    assert reg.redeem(token="TOK-1", plan_digest="DIG-A", run_id="RUN-1", now_s=15.0) is True
    # Second redemption fails (one-time token)
    assert reg.redeem(token="TOK-1", plan_digest="DIG-A", run_id="RUN-1", now_s=16.0) is False


def test_frame_budget_profiler_and_simulation() -> None:
    prof = QuestFrameBudgetProfiler()
    rep = prof.evaluate_batch(target_hz=90, frame_times_ms=[9.0, 9.5, 10.2], draw_calls=75)
    assert rep["within_budget"] is True
    assert rep["quality_tier"] == "TIER_0_FULL_SHADERS"

    sim = run_seated_xr_simulation(seed=42)
    assert sim["ergonomics"]["all_nodes_pass_airplane_tray_envelope"] is True
    assert sim["headset_consent_verified"] is True
    assert sim["step_count"] == 8
