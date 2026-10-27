# Devpost Submission Draft — Meta VR Start Developer Competition 2026 (`08-meta-vr-start`)

- **Devpost URL**: https://meta-vr-start.devpost.com/
- **Submission Deadline (JST)**: `2026-11-19T05:00:00+09:00`
- **Project Name**: SeatedConductor MR: Hands-First Seated Spatial Audio & Focus Studio
- **Elevator Pitch**: Meta Quest 3 / 3S seated mixed-reality productivity & spatial audio studio built on Meta Immersive Web SDK (IWSDK) with airplane-tray reach ergonomics and 90Hz frame-budget profiling.
- **Target GitHub Repository URL**: `https://github.com/cal29292929/horizon-seated-xr`
- **Target GitHub Release URL**: `https://github.com/cal29292929/horizon-seated-xr/releases/tag/v1.0.0`
- **Demo Video**: `/workspace/hackathons/08-meta-vr-start/submission_assets/demo_video.mp4` (1920x1080, 150s, H.264/AAC)
- **Unit Test Suite**: `3 passed`

## Built With Tags
- `meta-quest`
- `immersive-web-sdk`
- `webxr`
- `three-js`
- `typescript`
- `python`

## Try It Out URLs
- https://github.com/cal29292929/horizon-seated-xr
- https://github.com/cal29292929/horizon-seated-xr/releases/tag/v1.0.0

## About the Project (Copy-Paste Ready for Devpost)

## Inspiration
Most VR/MR apps assume room-scale standing movement, making them unusable in airplanes, trains, or compact desks. Seated users need zero-locomotion comfort, strict arm-reach ergonomics, and rock-solid 72Hz/90Hz frame pacing on Meta Quest 3 / 3S.

## What it does
**SeatedConductor MR** (`horizon_seated_xr` + `iwsdk-v0-template/`) combines a Meta Immersive Web SDK (IWSDK) WebXR scene with a deterministic seated ergonomics and frame-budget verification engine:
1. **Seated Ergonomics Envelope Validator**: Verifies every 3D UI panel and spatial stem orb stays within comfortable seated reach (`0.32m - 0.52m` in airplane tray mode; `0.32m - 0.68m` in desk mode), pitch (`-35°` to `+10°`), and yaw (`+/- 48°`) with zero artificial locomotion.
2. **Quest 3 / 3S 90Hz Frame Budget Profiler**: Enforces `<= 11.11 ms` p95 frame time (`90 Hz`), `<= 140` draw calls, and `<= 120k` triangles.
3. **Headset-Local Consent Registry**: Requires explicit in-headset consent before any companion telemetry is shared.

## Verification & Testing
- **Unit Tests**: `3 passed` (`pytest -q`)
- **Demo Video**: `submission_assets/demo_video.mp4` (1920x1080, 150s, H.264/AAC)


## Multi-Model Pipeline Provenance & Custom Questions
```json
{
  "opus55_session_id": "dce89928-f730-4cd9-af46-2d06e98e9dae",
  "luna56_review_session_id": "01a17dc4-696d-7f03-94a0-2ab68db3d93e",
  "luna56_codereview_session_id": "01a17dd2-63ce-7661-8443-d9b66cd784b9",
  "sakura_completion_id": "chatcmpl-b89ddc9effa18a0f"
}
```

## Screenshots (1920x1080 PNG)
- `/workspace/hackathons/08-meta-vr-start/submission_assets/00_thumbnail.png`
- `/workspace/hackathons/08-meta-vr-start/submission_assets/01_seated_ergonomics_validator.png`
- `/workspace/hackathons/08-meta-vr-start/submission_assets/02_quest_frame_budget_profiler.png`
- `/workspace/hackathons/08-meta-vr-start/submission_assets/03_headset_consent_registry.png`
- `/workspace/hackathons/08-meta-vr-start/submission_assets/04_deterministic_workflow.png`
- `/workspace/hackathons/08-meta-vr-start/submission_assets/05_multi_model_audit.png`
- `/workspace/hackathons/08-meta-vr-start/submission_assets/06_tests_and_quickstart.png`
