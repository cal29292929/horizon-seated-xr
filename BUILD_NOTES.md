# SeatedConductor MR — Build Notes

Implemented 2026-10-31 inside the stock IWSDK v0 template at
`iwsdk-v0-template/`. The template app is now a minimal but genuine
SeatedConductor MR experience: a seated, hands-first focus / spatial-audio
studio for Meta Quest 3/3S, built from the verified plan run
`SCMR-RUN-0042` (`artifacts/latest_seated_xr_run.json`) and
`DESIGN_OPUS55.md`.

## What was implemented

### Scene (public/scenes/main.iwsdk.scene.json)
- Kept the template's desk environment, plant, robot, and WebXR banner;
  removed the demo cube and the controller-input HUD (demo content).
- Added four interactables at the plan's verified ergonomics values
  (y = plan `height_m`; horizontal distance = plan `reach_m`, spread on an
  arc at azimuth -40/-16/+10/+36 degrees, all inside the +/-50 deg
  envelope). Resulting 3D distances from the seated head origin
  (0, 1.15, 0): 0.45-0.52 m, i.e. every target passes the 0.55 m
  airplane-tray reach envelope:
  - `consent-pill` — Headset Consent Pill, reach 0.44 m, pos (-0.283, 0.95, -0.337)
  - `stem-pad-ambient` — Ambient Pad Orb, reach 0.42 m, pos (-0.116, 0.98, -0.404)
  - `stem-pulse-bass` — Warm Pulse Node, reach 0.48 m, pos (0.083, 1.02, -0.473)
  - `stem-chime-bell` — Focus Bell Harmonics, reach 0.51 m, pos (0.300, 1.08, -0.413),
    with an `AudioSource` for `public/audio/chime.mp3` (same pattern as the robot)
- Zero artificial locomotion: everything is reachable from the seated
  spawn; the experience never asks the user to move.

### Procedural assets (src/scene-assets/, registered in src/assets.ts)
- `stem-orb`: 6 cm visible sphere (design spec) + invisible 10 cm-radius
  hit shell (tremor-tolerant pinch target). Sphere 24x18 segments.
- `consent-pill`: small horizontal capsule + invisible hit shell.
- Geometry/materials are shared prototypes; the system clones the core
  material per placement before restyling (template pattern).

### ECS (src/seated-conductor-component.ts, src/components.ts)
- `StemOrb { stemIndex, active, toneHz }` and `ConsentPill { granted }`,
  declared in a system-free module and exported via `defineComponents()`.

### Interaction + audio (src/seated-conductor.ts)
- `SeatedConductorSystem` follows the template's RobotSystem pattern:
  a `{ required: [StemOrb, Pressed] }` query, so IWSDK ray/pinch select
  (and mouse/touch in the browser) toggles a stem.
- Consent flow mirrors the Python `OneTimeConsentRegistry`: stems are
  locked (grey, red flash + dull 110 Hz buzz + panel explanation on a
  locked attempt) until the consent pill is pinched once; the pill then
  turns green and stays granted for the session. Granting plays a
  two-note C5-G5 confirmation.
- Toggle feedback: bell stem plays the bundled chime via
  `AudioUtils.play` (its AudioSource); pad/bass play per-stem WebAudio
  tones (220 Hz triangle swell / 55 Hz sine pulse; half-frequency blip on
  toggle-off) through an HRTF `PannerNode` positioned at the orb, with
  the listener seated at the design head origin (0, 1.15, 0).
- While the focus session runs, active orbs pulse (emissive + scale) on
  the 76 BPM beat; idle active orbs breathe gently. No per-frame
  allocations (pooled Vector3, materials cached per entity).

### Panel UI (public/ui/welcome.uikitml + src/panel.ts)
- The template welcome panel was adapted in place (same asset/node id
  `welcome-panel`, same `xr-button`/`exit-button` contract): title
  "SeatedConductor MR", plan readout "BPM 76, 4/4, D dorian", a consent
  status line, one state line per stem, a session status line, and an
  ergonomics readout ("all targets within the 0.55 m seated reach
  envelope - frame budget 90 Hz, p95 10.1 ms - Plan SCMR-RUN-0042").
- New `session-button` starts/stops the 10-minute focus block from the
  plan; `PanelSystem` renders shared state from
  `src/conductor-state.ts` (single rendezvous for consent, stem states,
  and the session clock), shows a mm:ss countdown, and auto-completes
  the block at 10:00. Panel text glyphs stay within the bundled font
  atlas (the build's UIKitML font warning was fixed by avoiding
  middle-dot/em-dash characters).

## Design mapping
- Verified ergonomics positions, BPM 76 / 4/4, 10-minute focus block,
  and plan id all come from `artifacts/latest_seated_xr_run.json`.
- One-time in-headset consent maps the Python engine's
  `OneTimeConsentRegistry` / CONFIRM step of the copilot workflow.
- Hands-first pinch/select with inflated hit targets and zero locomotion
  maps the design's seated reach-envelope and airplane-seat test.

## Verification (2026-10-31)
- `npm install` — OK (276 packages; registry via environment proxy).
- `npm run typecheck` — clean, zero errors.
- `npm run build` — OK. Output in `iwsdk-v0-template/dist/` (~19 MB,
  includes the injected Quest 3 emulator runtime).
- `npm run preview` + curl — index serves HTTP 200 with title
  "SeatedConductor MR"; the built scene JSON lists all four conductor
  nodes; the panel UIKitML and `audio/chime.mp3` serve correctly.
- Managed-browser scene render was attempted (`iwsdk dev up`), but the
  managed Chromium install did not finish within its 10-minute window in
  this sandbox, so editor/runtime screenshot validation remains a
  follow-up on a workstation with Playwright Chromium preinstalled
  (`npx @iwsdk/cli scene render-file` against
  `public/scenes/main.iwsdk.scene.json`, checking `valid: true` and that
  `renderStats.visibleNodeIds` includes the four conductor nodes).
  The dev server was shut down again afterwards (`iwsdk dev down`).

## Run / deploy
- Dev (plain Vite): `cd iwsdk-v0-template && npm run dev:runtime`
  (or `npm run dev` for the managed IWSDK dev browser with the Quest 3
  emulator; LAN headset testing needs `IWSDK_DEV_HTTPS=1`).
- Production: `npm run build`, then serve `dist/` statically
  (`npm run preview` locally; `vercel.json` already pins the Vite
  output directory and SPA rewrite for deployment).
- On device: open the served URL in Quest Browser and choose
  "Enter XR" on the panel. Pinch the amber consent pill (front-left),
  then pinch orbs to toggle stems; start the focus block from the panel.

## Known limits of this slice
- The three stems are toggle voices with beat-synced visuals, not the
  full procedural 16-bar sequencer from the design doc; the Python
  engine remains the reference implementation of composition.
- Beat conducting (tempo from hand ictus), intent cards, and the MCP
  surface are design-doc scope beyond this minimal client slice.
