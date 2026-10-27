 ```python
# horizon_seated_xr/core.py
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Dict, Optional


class SeatedErgonomicsValidator:
    REACH_MIN = 0.35
    REACH_MAX = 0.75
    NECK_PITCH_MIN = -15.0
    NECK_PITCH_MAX = 20.0
    SNAP_TURN_MAX = 45.0

    def validate_reach(self, reach_m: float) -> bool:
        return self.REACH_MIN <= reach_m <= self.REACH_MAX

    def validate_neck_pitch(self, pitch_deg: float) -> bool:
        return self.NECK_PITCH_MIN <= pitch_deg <= self.NECK_PITCH_MAX

    def validate_snap_turn(self, turn_deg: float) -> bool:
        return abs(turn_deg) <= self.SNAP_TURN_MAX

    def validate_pose(
        self,
        reach_m: float,
        neck_pitch_deg: float,
        snap_turn_deg: Optional[float] = None,
    ) -> Dict[str, bool]:
        result = {
            "reach_ok": self.validate_reach(reach_m),
            "neck_pitch_ok": self.validate_neck_pitch(neck_pitch_deg),
        }
        if snap_turn_deg is not None:
            result["snap_turn_ok"] = self.validate_snap_turn(snap_turn_deg)
        return result

    def is_comfortable(
        self,
        reach_m: float,
        neck_pitch_deg: float,
        snap_turn_deg: Optional[float] = None,
    ) -> bool:
        return all(self.validate_pose(reach_m, neck_pitch_deg, snap_turn_deg).values())


@dataclass
class QuestFrameBudgetProfiler:
    max_draw_calls: int = 150
    budget_72hz_ms: float = 1000.0 / 72.0
    budget_90hz_ms: float = 1000.0 / 90.0
    history: list = field(default_factory=list)

    def frame_within_budget(
        self, hz: int, frame_time_ms: float, draw_calls: int
    ) -> bool:
        budget = self.budget_90hz_ms if hz == 90 else self.budget_72hz_ms
        ok = frame_time_ms <= budget and draw_calls <= self.max_draw_calls
        self.history.append(
            {
                "hz": hz,
                "frame_time_ms": frame_time_ms,
                "draw_calls": draw_calls,
                "within_budget": ok,
            }
        )
        return ok

    def last_report(self) -> Optional[Dict]:
        return self.history[-1] if self.history else None


@dataclass
class OneTimeConsentRegistry:
    ttl_seconds: float = 300.0
    _entries: Dict[str, Dict] = field(default_factory=dict, repr=False)

    def grant(
        self,
        token: str,
        plan_digest: str,
        run_id: str,
        ttl_seconds: Optional[float] = None,
    ) -> None:
        if not token or not plan_digest or not run_id:
            raise ValueError("token, plan_digest, and run_id are required")
        ttl = ttl_seconds if ttl_seconds is not None else self.ttl_seconds
        self._entries[token] = {
            "plan_digest": plan_digest,
            "run_id": run_id,
            "expires_at": time.monotonic() + ttl,
        }

    def verify(self, token: str, plan_digest: str, run_id: str) -> bool:
        entry = self._entries.get(token)
        if entry is None:
            return False
        if time.monotonic() > entry["expires_at"]:
            del self._entries[token]
            return False
        if entry["plan_digest"] != plan_digest or entry["run_id"] != run_id:
            return False
        del self._entries[token]
        return True
```