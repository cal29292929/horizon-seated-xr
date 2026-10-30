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

import { createSystem, UIKit, UIKitMLAsset, VisibilityState } from '@iwsdk/core';
import {
  conductorState,
  FOCUS_BLOCK_SECONDS,
  STEM_DEFS,
} from './conductor-state.js';

const STEM_ELEMENT_IDS = ['stem-pad-state', 'stem-bass-state', 'stem-chime-state'];

/**
 * Owns the conductor panel: the template's Enter/Exit XR buttons, plus
 * the SeatedConductor surface - one-time consent status, per-stem toggle
 * state, the focus-session start/stop button, and the session clock.
 * Musical state itself lives in conductor-state.ts; this system only
 * renders it and forwards the session button's clicks.
 */
export class PanelSystem extends createSystem({}) {
  private textEls: Record<string, UIKit.Text> = {};
  private textCache: Record<string, string> = {};
  private sessionLabel: UIKit.Text | null = null;
  private lastTimerSecond = -1;

  init(): void {
    const panel = this.world.getSceneObject<UIKitMLAsset>('welcome-panel');
    if (panel == null) {
      return;
    }

    for (const id of ['consent-state', 'session-state', ...STEM_ELEMENT_IDS]) {
      const element = panel.getElementById<UIKit.Text>(id);
      if (element != null) {
        this.textEls[id] = element;
      }
    }
    this.sessionLabel = panel.getElementById<UIKit.Text>('session-label');

    const sessionButton = panel.getElementById('session-button');
    if (sessionButton != null) {
      const onSessionClick = () => conductorState.toggleSession();
      sessionButton.addEventListener('click', onSessionClick);
      this.cleanupFuncs.push(() =>
        sessionButton.removeEventListener('click', onSessionClick),
      );
    }

    this.cleanupFuncs.push(conductorState.subscribe(() => this.refreshPanel()));
    this.refreshPanel();

    const xrButton = panel.getElementById('xr-button');
    const exitButton = panel.getElementById('exit-button');
    if (xrButton == null || exitButton == null) {
      return;
    }
    if (!this.world.xrEnabled) {
      xrButton.setProperties({ display: 'none' });
      exitButton.setProperties({ display: 'none' });
      return;
    }

    const launchXR = () => this.world.launchXR();
    const exitXR = () => this.world.exitXR();
    xrButton.addEventListener('click', launchXR);
    exitButton.addEventListener('click', exitXR);
    this.cleanupFuncs.push(
      () => xrButton.removeEventListener('click', launchXR),
      () => exitButton.removeEventListener('click', exitXR),
      this.world.visibilityState.subscribe((visibilityState) => {
        const is2D = visibilityState === VisibilityState.NonImmersive;
        xrButton.setProperties({ display: is2D ? 'flex' : 'none' });
        exitButton.setProperties({ display: is2D ? 'none' : 'flex' });
      }),
    );
  }

  update(delta: number): void {
    if (!conductorState.sessionRunning) {
      return;
    }
    conductorState.sessionElapsedS += delta;
    if (conductorState.sessionElapsedS >= FOCUS_BLOCK_SECONDS) {
      conductorState.completeSession();
      return;
    }
    const second = Math.floor(conductorState.sessionElapsedS);
    if (second !== this.lastTimerSecond) {
      this.lastTimerSecond = second;
      this.refreshSessionLine();
    }
  }

  private refreshPanel(): void {
    if (conductorState.consentGranted) {
      this.setText('consent-state', 'Consent granted - stems unlocked.');
    } else if (conductorState.lockedAttempt) {
      this.setText(
        'consent-state',
        'Stems are locked. Pinch the amber Headset Consent Pill (front-left) once to unlock.',
      );
    } else {
      this.setText(
        'consent-state',
        'Stems locked - pinch the amber Headset Consent Pill (front-left) once to unlock.',
      );
    }

    STEM_DEFS.forEach((def, i) => {
      const id = STEM_ELEMENT_IDS[i];
      if (id == null) {
        return;
      }
      const state = conductorState.stemActive[i]
        ? 'ON'
        : conductorState.consentGranted
          ? 'OFF'
          : 'OFF (locked)';
      this.setText(id, `${def.label}: ${state}`);
    });

    if (this.sessionLabel != null) {
      this.setLabel(
        conductorState.sessionRunning
          ? 'Stop Focus Session'
          : conductorState.sessionComplete
            ? 'Start New Focus Session'
            : 'Start Focus Session',
      );
    }
    this.lastTimerSecond = -1;
    this.refreshSessionLine();
  }

  private refreshSessionLine(): void {
    if (conductorState.sessionRunning) {
      this.setText(
        'session-state',
        `Focus session ${formatClock(conductorState.sessionElapsedS)} / ${formatClock(FOCUS_BLOCK_SECONDS)} - active stems pulse on the beat.`,
      );
    } else if (conductorState.sessionComplete) {
      this.setText(
        'session-state',
        'Focus block complete. Nice conducting - start a new one any time.',
      );
    } else {
      this.setText(
        'session-state',
        'Focus session idle - 10 min block, seated, no locomotion needed.',
      );
    }
  }

  private setText(id: string, text: string): void {
    if (this.textCache[id] === text) {
      return;
    }
    this.textCache[id] = text;
    this.textEls[id]?.setProperties({ text });
  }

  private setLabel(text: string): void {
    if (this.textCache['session-label'] === text) {
      return;
    }
    this.textCache['session-label'] = text;
    this.sessionLabel?.setProperties({ text });
  }
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}
