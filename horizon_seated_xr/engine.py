"""Deterministic SeatedConductor MR Simulation & IWSDK WebXR Scene Manifest Generator."""

from __future__ import annotations

import hashlib
import json
from typing import Any

from .core import (
    require_strict_int,
    OneTimeConsentRegistry,
    QuestFrameBudgetProfiler,
    SeatedErgonomicsValidator,
    SeatedProfile,
)


def run_seated_xr_simulation(seed: int = 42) -> dict[str, Any]:
    """Run a deterministic SeatedConductor MR focus block, verifying airplane-tray reach & 90Hz frame budget."""
    seed = require_strict_int(seed, "seed", 0, 1_000_000)
    nodes = [
        {"id": "stem_pad_ambient", "label": "Ambient Pad Orb", "reach_m": 0.42, "neck_pitch_deg": -4.0, "height_m": 0.98},
        {"id": "stem_pulse_bass", "label": "Warm Pulse Node", "reach_m": 0.48, "neck_pitch_deg": -2.5, "height_m": 1.02},
        {"id": "stem_chime_bell", "label": "Focus Bell Harmonics", "reach_m": 0.51, "neck_pitch_deg": 3.0, "height_m": 1.08},
        {"id": "copilot_confirm_pill", "label": "Headset Consent Pill", "reach_m": 0.44, "neck_pitch_deg": -6.0, "height_m": 0.95},
    ]
    node_validations = [
        {
            "node_id": n["id"],
            **SeatedErgonomicsValidator.validate_node(
                reach_m=n["reach_m"],
                neck_pitch_deg=n["neck_pitch_deg"],
                height_above_floor_m=n["height_m"],
                continuous_yaw_deg_s=0.0,
                profile=SeatedProfile.AIRPLANE_TRAY,
            ),
        }
        for n in nodes
    ]

    profiler = QuestFrameBudgetProfiler()
    perf_report = profiler.evaluate_batch(
        target_hz=90,
        frame_times_ms=[8.8, 9.1, 9.4, 9.2, 9.6, 9.9, 9.3, 9.0, 9.5, 10.1],
        draw_calls=68,
    )

    plan_payload = {
        "run_id": f"SCMR-RUN-{seed:04d}",
        "bpm": 76,
        "time_signature": "4/4",
        "bars_in_loop": 16,
        "loop_duration_s": round((16 * 4 * 60.0) / 76.0, 2),
        "focus_block_minutes": 10,
        "nodes": nodes,
    }
    plan_digest = hashlib.sha256(json.dumps(plan_payload, sort_keys=True).encode("utf-8")).hexdigest()

    consent = OneTimeConsentRegistry()
    token = f"HSET-TOK-{plan_digest[:12]}"
    consent.grant_headset_consent(token=token, plan_digest=plan_digest, run_id=plan_payload["run_id"], now_s=100.0, ttl_s=60.0)
    consent_verified = consent.redeem(token=token, plan_digest=plan_digest, run_id=plan_payload["run_id"], now_s=112.0)

    workflow_steps = [
        "INTENT",
        "PLAN",
        "RESEARCH",
        "COMPOSE",
        "EVALUATE",
        "PROPOSE",
        "CONFIRM",
        "APPLY",
    ]

    return {
        "schema_version": "1.0.0",
        "estimation_label": "deterministic_quest3_webxr_simulation",
        "execution_mode": "standalone_offline_capable_with_optional_mcp",
        "workflow_steps": workflow_steps,
        "step_count": len(workflow_steps),
        "plan": plan_payload,
        "plan_digest": plan_digest,
        "headset_consent_verified": consent_verified,
        "ergonomics": {
            "all_nodes_pass_airplane_tray_envelope": all(v["ok"] for v in node_validations),
            "node_validations": node_validations,
        },
        "frame_budget_90hz": perf_report,
        "pipeline_provenance": {
            "stage1_design_model": "claude-opus-5-5",
            "stage1_session_id": "dce89928-f730-4cd9-af46-2d06e98e9dae",
            "stage2_review_model": "gpt-6-luna",
            "stage2_codex_session_id": "01a17dc4-696d-7f03-94a0-2ab68db3d93e",
            "stage3_impl_model": "preview/Kimi-K2.7-Code",
            "stage3_completion_id": "chatcmpl-b89ddc9effa18a0f",
        },
    }
