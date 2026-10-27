"""CLI entrypoint for SeatedConductor MR (`horizon_seated_xr`)."""

from __future__ import annotations

import json
from pathlib import Path

from .engine import run_seated_xr_simulation


def main() -> int:
    res = run_seated_xr_simulation()
    out = Path(__file__).resolve().parent.parent / "artifacts" / "latest_seated_xr_run.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(res, indent=2), encoding="utf-8")
    print(json.dumps(res, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
