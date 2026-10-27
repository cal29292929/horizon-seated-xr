# SeatedConductor MR (`horizon_seated_xr`) — Meta VR Start Developer Competition 2026

**SeatedConductor MR** is a hands-first, seated-ergonomics Mixed Reality focus and spatial stem-conducting experience designed for **Meta Quest 3 / 3S (WebXR / IWSDK)** with a deterministic Python 3.11 ergonomics, frame-budget, and headset-consent verification engine.

- **Public GitHub Repository (Target)**: `https://github.com/cal29292929/horizon-seated-xr`
- **Author**: Kazutoshi Hayashi (`cal29292929 <cal29292929@users.noreply.github.com>`)
- **License**: MIT

## Multi-Model Pipeline Provenance
1. **Stage 1 — Architecture Design (`claude-opus-5-5`)**: [`DESIGN_OPUS55.md`](DESIGN_OPUS55.md) (Session `dce89928-f730-4cd9-af46-2d06e98e9dae`)
2. **Stage 2 — Adversarial Architecture Review (`gpt-6-luna`)**: [`REVIEW_LUNA56.md`](REVIEW_LUNA56.md) (Codex Session `01a17dc4-696d-7f03-94a0-2ab68db3d93e`)
3. **Stage 3 — Core Implementation (`preview/Kimi-K2.7-Code` @ Sakura AI Engine)**: `pipeline_logs/03_impl_sakura_kimi.json` (`chatcmpl-b89ddc9effa18a0f`) + [`horizon_seated_xr/`](horizon_seated_xr/)
4. **Stage 4 — Post-Implementation Code Review (`gpt-6-luna`)**: [`CODE_REVIEW_LUNA56.md`](CODE_REVIEW_LUNA56.md)

## Quickstart
```bash
PYTHONPATH=. pytest -v
PYTHONPATH=. python3 -m horizon_seated_xr.cli
```
