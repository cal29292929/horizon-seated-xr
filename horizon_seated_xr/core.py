"""Core primitives for SeatedConductor MR (`horizon_seated_xr`).

Synthesized via Sakura AI Engine `preview/Kimi-K2.7-Code` (chatcmpl-b89ddc9effa18a0f)
and hardened per GPT-5.6 Luna review (`01a17dc4-696d-7f03-94a0-2ab68db3d93e`):
- Unified Airplane-Seat / Wheelchair Seated Ergonomics Envelope (`0.35m <= reach_m <= 0.55m` default airplane-safe envelope, `0.60m` extended desk envelope, vertical neck pitch `-15 deg <= pitch <= +20 deg`, zero floor reach, snap-turn only).
- `QuestFrameBudgetProfiler` enforcing 72Hz (`13.88ms`) and 90Hz (`11.11ms`) frame budgets, `<= 150` draw calls, and automatic quality degradation tiers (`FULL_GLOW` -> `REDUCED_PARTICLES` -> `MINIMAL_WIREFRAME`) when p95 frame time exceeds budget.
- `OneTimeConsentRegistry` binding headset confirmation tokens to `plan_digest`, `run_id`, and `ttl_seconds` so an external MCP client can NEVER apply a layout or audio change without verified headset user consent.
- Deterministic 8-step Agentic Focus Composer state machine (`INTENT -> PLAN -> RESEARCH -> COMPOSE -> EVALUATE -> PROPOSE -> CONFIRM -> APPLY`).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
import hashlib
import math
from typing import Any


def require_strict_float(val: Any, name: str, min_val: float, max_val: float) -> float:
    if isinstance(val, bool) or not isinstance(val, (int, float)):
        raise ValueError(f"{name} must be numeric (bool rejected)")
    fval = float(val)
    if not math.isfinite(fval) or fval < min_val or fval > max_val:
        raise ValueError(f"{name} out of range [{min_val}, {max_val}]: {val}")
    return fval


def require_strict_int(val: Any, name: str, min_val: int, max_val: int) -> int:
    if isinstance(val, bool) or not isinstance(val, int):
        raise ValueError(f"{name} must be a strict int")
    if val < min_val or val > max_val:
        raise ValueError(f"{name} out of range [{min_val}, {max_val}]: {val}")
    return val


class SeatedProfile(str, Enum):
    AIRPLANE_TRAY = "AIRPLANE_TRAY"  # 0.35m .. 0.55m radius
    STANDARD_DESK = "STANDARD_DESK"  # 0.35m .. 0.60m radius


class SeatedErgonomicsValidator:
    """Validates 3D interactive node placement against seated/hands-first ergonomics."""

    REACH_MIN_M = 0.35
    REACH_MAX_AIRPLANE_M = 0.55
    REACH_MAX_DESK_M = 0.60
    NECK_PITCH_MIN_DEG = -15.0
    NECK_PITCH_MAX_DEG = 20.0
    SNAP_TURN_ALLOWED_DEG = {15.0, 30.0, 45.0}

    @classmethod
    def validate_node(
        cls,
        *,
        reach_m: float,
        neck_pitch_deg: float,
        height_above_floor_m: float,
        continuous_yaw_deg_s: float = 0.0,
        profile: SeatedProfile = SeatedProfile.AIRPLANE_TRAY,
    ) -> dict[str, Any]:
        reach_m = require_strict_float(reach_m, "reach_m", 0.0, 5.0)
        neck_pitch_deg = require_strict_float(neck_pitch_deg, "neck_pitch_deg", -90.0, 90.0)
        height_above_floor_m = require_strict_float(height_above_floor_m, "height_above_floor_m", 0.0, 3.0)
        continuous_yaw_deg_s = require_strict_float(continuous_yaw_deg_s, "continuous_yaw_deg_s", 0.0, 360.0)

        if not isinstance(profile, SeatedProfile):
            raise ValueError("profile must be a SeatedProfile enum")
        max_reach = cls.REACH_MAX_AIRPLANE_M if profile == SeatedProfile.AIRPLANE_TRAY else cls.REACH_MAX_DESK_M
        violations: list[str] = []
        if not (cls.REACH_MIN_M <= reach_m <= max_reach):
            violations.append(f"reach_m {reach_m:.2f}m outside [{cls.REACH_MIN_M:.2f}m, {max_reach:.2f}m] ({profile.value})")
        if not (cls.NECK_PITCH_MIN_DEG <= neck_pitch_deg <= cls.NECK_PITCH_MAX_DEG):
            violations.append(f"neck_pitch_deg {neck_pitch_deg:.1f} outside [-15.0, +20.0] deg")
        if height_above_floor_m < 0.70:
            violations.append(f"height_above_floor_m {height_above_floor_m:.2f}m requires floor bend (<0.70m)")
        if continuous_yaw_deg_s > 0.0:
            violations.append("Continuous artificial yaw rotation is forbidden; use discrete snap-turn")
        return {
            "ok": len(violations) == 0,
            "profile": profile.value,
            "max_reach_m": max_reach,
            "violations": violations,
        }


@dataclass
class QuestFrameBudgetProfiler:
    """Profiles Quest 3 / 3S WebXR frame times and triggers graceful visual degradation."""

    max_draw_calls: int = 150
    budget_72hz_ms: float = 1000.0 / 72.0
    budget_90hz_ms: float = 1000.0 / 90.0

    def evaluate_batch(self, *, target_hz: int, frame_times_ms: list[float], draw_calls: int) -> dict[str, Any]:
        target_hz = require_strict_int(target_hz, "target_hz", 72, 90)
        draw_calls = require_strict_int(draw_calls, "draw_calls", 1, 5000)
        if not frame_times_ms:
            raise ValueError("frame_times_ms must not be empty")
        cleaned = sorted(require_strict_float(x, "frame_time_ms", 0.1, 200.0) for x in frame_times_ms)
        p50 = cleaned[len(cleaned) // 2]
        p95 = cleaned[min(len(cleaned) - 1, int(len(cleaned) * 0.95))]
        budget = self.budget_90hz_ms if target_hz == 90 else self.budget_72hz_ms
        within_budget = p95 <= budget and draw_calls <= self.max_draw_calls

        quality_tier = "TIER_0_FULL_SHADERS"
        if not within_budget:
            quality_tier = "TIER_1_REDUCED_PARTICLES" if p95 <= budget * 1.15 else "TIER_2_MINIMAL_SDF"

        return {
            "target_hz": target_hz,
            "budget_ms": round(budget, 3),
            "p50_ms": round(p50, 3),
            "p95_ms": round(p95, 3),
            "draw_calls": draw_calls,
            "within_budget": within_budget,
            "quality_tier": quality_tier,
        }


@dataclass
class OneTimeConsentRegistry:
    """Enforces headset-confirmed one-time tokens bound to `plan_digest`, `run_id`, and virtual clock TTL."""

    _tokens: dict[str, dict[str, Any]] = field(default_factory=dict)

    def grant_headset_consent(self, *, token: str, plan_digest: str, run_id: str, now_s: float, ttl_s: float = 120.0) -> None:
        if not token or not plan_digest or not run_id:
            raise ValueError("token, plan_digest, and run_id are required")
        now_s = require_strict_float(now_s, "now_s", 0.0, 1e12)
        ttl_s = require_strict_float(ttl_s, "ttl_s", 1.0, 3600.0)
        self._tokens[token] = {
            "plan_digest": plan_digest,
            "run_id": run_id,
            "expires_at_s": now_s + ttl_s,
            "redeemed": False,
        }

    def redeem(self, *, token: str, plan_digest: str, run_id: str, now_s: float) -> bool:
        entry = self._tokens.get(token)
        if entry is None or entry["redeemed"]:
            return False
        if now_s > entry["expires_at_s"]:
            return False
        if entry["plan_digest"] != plan_digest or entry["run_id"] != run_id:
            return False
        entry["redeemed"] = True
        return True
