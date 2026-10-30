/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Shared, runtime-only session state for SeatedConductor MR.
 *
 * The musical plan mirrors the deterministic Python engine run
 * `SCMR-RUN-0042` (artifacts/latest_seated_xr_run.json): BPM 76, 4/4,
 * a 10-minute focus block, and three stems placed inside the verified
 * 0.55 m seated reach envelope. StemOrb entities own their own `active`
 * flag; this module is the single place the panel and the stem system
 * rendezvous (consent gate, per-stem UI state, focus-session clock).
 */

export interface StemDef {
  /** Plan node id from the verified run. */
  id: string;
  label: string;
  /** WebAudio voice frequency for toggle feedback. */
  toneHz: number;
  /** Emissive/base colour used while the stem is on. */
  colorHex: number;
}

export const STEM_DEFS: readonly StemDef[] = [
  { id: 'stem_pad_ambient', label: 'Ambient Pad Orb', toneHz: 220, colorHex: 0x2dd4bf },
  { id: 'stem_pulse_bass', label: 'Warm Pulse Node', toneHz: 55, colorHex: 0xf59e0b },
  { id: 'stem_chime_bell', label: 'Focus Bell Harmonics', toneHz: 1318.5, colorHex: 0xa78bfa },
];

export const PLAN_BPM = 76;
export const PLAN_TIME_SIGNATURE = '4/4';
export const FOCUS_BLOCK_SECONDS = 10 * 60;
export const PLAN_RUN_ID = 'SCMR-RUN-0042';

type Listener = () => void;

class ConductorState {
  /** One-time consent: false until the Headset Consent Pill is pinched. */
  consentGranted = false;
  /** Set when a locked stem is pinched, so the panel can explain why. */
  lockedAttempt = false;
  readonly stemActive: boolean[] = STEM_DEFS.map(() => false);

  sessionRunning = false;
  sessionComplete = false;
  sessionElapsedS = 0;

  private readonly listeners = new Set<Listener>();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  emit(): void {
    for (const fn of this.listeners) {
      fn();
    }
  }

  grantConsent(): void {
    if (this.consentGranted) {
      return;
    }
    this.consentGranted = true;
    this.lockedAttempt = false;
    this.emit();
  }

  noteLockedAttempt(): void {
    if (!this.lockedAttempt) {
      this.lockedAttempt = true;
      this.emit();
    }
  }

  setStemActive(index: number, active: boolean): void {
    if (this.stemActive[index] === active) {
      return;
    }
    this.stemActive[index] = active;
    this.emit();
  }

  toggleSession(): void {
    if (this.sessionRunning) {
      this.sessionRunning = false;
    } else {
      this.sessionRunning = true;
      if (this.sessionComplete) {
        this.sessionComplete = false;
        this.sessionElapsedS = 0;
      }
    }
    this.emit();
  }

  completeSession(): void {
    this.sessionRunning = false;
    this.sessionComplete = true;
    this.sessionElapsedS = FOCUS_BLOCK_SECONDS;
    this.emit();
  }
}

export const conductorState = new ConductorState();
