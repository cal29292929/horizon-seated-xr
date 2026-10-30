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

import {
  AudioUtils,
  Color,
  createSystem,
  Entity,
  Mesh,
  MeshStandardMaterial,
  Pressed,
  Vector3,
} from '@iwsdk/core';
import { conductorState, PLAN_BPM, STEM_DEFS } from './conductor-state.js';
import { ConsentPill, StemOrb } from './seated-conductor-component.js';

const BEAT_SECONDS = 60 / PLAN_BPM;
const LOCKED_COLOR = 0x64748b;
const LOCKED_EMISSIVE = 0x334155;
const FLASH_COLOR = 0xef4444;
const PILL_WAITING_COLOR = 0xfbbf24;
const PILL_WAITING_EMISSIVE = 0xb45309;
const PILL_GRANTED_COLOR = 0x22c55e;
const PILL_GRANTED_EMISSIVE = 0x15803d;

interface OrbVisual {
  core: Mesh;
  material: MeshStandardMaterial;
  flashLeft: number;
}

/**
 * Drives the SeatedConductor stems and the one-time consent pill.
 *
 * Pinch/select (the `Pressed` state fed by RayInteractable, same pattern
 * as RobotSystem) toggles a stem once consent has been granted through
 * the pill. Toggling restyles the orb and plays feedback audio: the
 * bundled chime sample through the bell stem's AudioSource, or a
 * per-stem WebAudio tone positioned at the orb through an HRTF panner.
 * While the focus session runs, active orbs pulse on the 76 BPM beat.
 */
export class SeatedConductorSystem extends createSystem({
  stems: { required: [StemOrb] },
  stemsPressed: { required: [StemOrb, Pressed] },
  pill: { required: [ConsentPill] },
  pillPressed: { required: [ConsentPill, Pressed] },
}) {
  private readonly orbVisuals = new Map<Entity, OrbVisual>();
  private readonly pillMaterials = new Map<Entity, MeshStandardMaterial>();
  private readonly stemColors: Color[] = [];
  private readonly stemDimColors: Color[] = [];
  private readonly worldPos = new Vector3();
  private audioCtx: AudioContext | null = null;

  init(): void {
    for (const def of STEM_DEFS) {
      const color = new Color(def.colorHex);
      this.stemColors.push(color);
      this.stemDimColors.push(color.clone().multiplyScalar(0.4));
    }

    this.queries.stems.subscribe('qualify', (entity) => {
      const core = entity.object3D?.getObjectByName('orb-core') as
        | Mesh
        | undefined;
      if (core == null) {
        return;
      }
      // Placements share the prototype material; clone before restyling.
      const material = (core.material as MeshStandardMaterial).clone();
      core.material = material;
      this.orbVisuals.set(entity, { core, material, flashLeft: 0 });
      this.restyleStem(entity, material, 0);
    });
    this.queries.stems.subscribe('disqualify', (entity) => {
      const visual = this.orbVisuals.get(entity);
      if (visual != null) {
        visual.material.dispose();
        this.orbVisuals.delete(entity);
      }
    });

    this.queries.stemsPressed.subscribe('qualify', (entity) => {
      this.toggleStem(entity);
    });

    this.queries.pill.subscribe('qualify', (entity) => {
      const core = entity.object3D?.getObjectByName('pill-core') as
        | Mesh
        | undefined;
      if (core == null) {
        return;
      }
      const material = (core.material as MeshStandardMaterial).clone();
      core.material = material;
      this.pillMaterials.set(entity, material);
    });
    this.queries.pill.subscribe('disqualify', (entity) => {
      this.pillMaterials.get(entity)?.dispose();
      this.pillMaterials.delete(entity);
    });

    this.queries.pillPressed.subscribe('qualify', (entity) => {
      this.grantConsent(entity);
    });

    this.cleanupFuncs.push(() => {
      if (this.audioCtx != null) {
        void this.audioCtx.close();
        this.audioCtx = null;
      }
    });
  }

  update(delta: number, time: number): void {
    for (const entity of this.queries.stems.entities) {
      const visual = this.orbVisuals.get(entity);
      if (visual == null) {
        continue;
      }
      if (visual.flashLeft > 0) {
        visual.flashLeft = Math.max(0, visual.flashLeft - delta);
      }
      this.restyleStem(entity, visual.material, time);
    }
    for (const entity of this.queries.pill.entities) {
      const material = this.pillMaterials.get(entity);
      if (material == null) {
        continue;
      }
      if (conductorState.consentGranted) {
        material.color.setHex(PILL_GRANTED_COLOR);
        material.emissive.setHex(PILL_GRANTED_EMISSIVE);
        material.emissiveIntensity = 0.7;
      } else {
        material.color.setHex(PILL_WAITING_COLOR);
        material.emissive.setHex(PILL_WAITING_EMISSIVE);
        material.emissiveIntensity = 0.4 + 0.25 * Math.sin(time * 2.4);
      }
    }
  }

  private toggleStem(entity: Entity): void {
    const visual = this.orbVisuals.get(entity);
    const stemIndex = Number(entity.getValue(StemOrb, 'stemIndex') ?? 0);
    const def = STEM_DEFS[stemIndex];
    if (def == null) {
      return;
    }

    if (!conductorState.consentGranted) {
      // Locked: red flash, a dull low buzz, and the panel explains why.
      if (visual != null) {
        visual.flashLeft = 0.35;
      }
      conductorState.noteLockedAttempt();
      this.playTone(entity, 110, { duration: 0.18, type: 'square', gain: 0.08 });
      return;
    }

    const active = !(entity.getValue(StemOrb, 'active') as boolean);
    entity.setValue(StemOrb, 'active', active);
    conductorState.setStemActive(stemIndex, active);

    if (stemIndex === 2 && active) {
      // Focus Bell Harmonics plays the bundled chime through its
      // scene-authored AudioSource, like the template robot does.
      AudioUtils.play(entity);
    } else {
      const toneHz = Number(entity.getValue(StemOrb, 'toneHz') ?? def.toneHz);
      this.playTone(entity, active ? toneHz : toneHz / 2, {
        duration: stemIndex === 1 ? 0.5 : 0.9,
        type: stemIndex === 1 ? 'sine' : 'triangle',
        gain: active ? 0.16 : 0.08,
      });
    }
  }

  private grantConsent(entity: Entity): void {
    if (conductorState.consentGranted) {
      return; // one-time registry: later presses are no-ops
    }
    entity.setValue(ConsentPill, 'granted', true);
    conductorState.grantConsent();
    // Two-note confirmation (C5 -> G5), then the bell sample as a reward.
    this.playTone(entity, 523.25, { duration: 0.25, type: 'sine', gain: 0.12 });
    this.playTone(entity, 783.99, {
      duration: 0.4,
      type: 'sine',
      gain: 0.12,
      delay: 0.12,
    });
  }

  private restyleStem(
    entity: Entity,
    material: MeshStandardMaterial,
    time: number,
  ): void {
    const stemIndex = Number(entity.getValue(StemOrb, 'stemIndex') ?? 0);
    const active = entity.getValue(StemOrb, 'active') as boolean;
    const visual = this.orbVisuals.get(entity);

    if (visual != null && visual.flashLeft > 0) {
      material.color.setHex(FLASH_COLOR);
      material.emissive.setHex(FLASH_COLOR);
      material.emissiveIntensity = 1.1;
      return;
    }

    if (!conductorState.consentGranted) {
      material.color.setHex(LOCKED_COLOR);
      material.emissive.setHex(LOCKED_EMISSIVE);
      material.emissiveIntensity = 0.25;
      visual?.core.scale.setScalar(1);
      return;
    }

    const color = this.stemColors[stemIndex];
    if (color == null) {
      return;
    }
    if (!active) {
      material.color.copy(this.stemDimColors[stemIndex]);
      material.emissive.copy(color);
      material.emissiveIntensity = 0.3;
      visual?.core.scale.setScalar(1);
      return;
    }

    material.color.copy(color);
    material.emissive.copy(color);
    if (conductorState.sessionRunning) {
      const beatPhase = (time % BEAT_SECONDS) / BEAT_SECONDS;
      const pulse = (1 - beatPhase) * (1 - beatPhase);
      material.emissiveIntensity = 0.55 + 0.75 * pulse;
      visual?.core.scale.setScalar(1 + 0.12 * pulse);
    } else {
      material.emissiveIntensity =
        0.75 + 0.15 * Math.sin(time * 1.6 + stemIndex * 1.3);
      visual?.core.scale.setScalar(1);
    }
  }

  private ensureAudio(): AudioContext | null {
    if (typeof window === 'undefined') {
      return null;
    }
    if (this.audioCtx == null) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (Ctor == null) {
        return null;
      }
      this.audioCtx = new Ctor();
      // Seat the listener at the design's seated head origin (y ~ 1.15 m);
      // the default listener orientation already faces -Z.
      const listener = this.audioCtx.listener;
      if (listener.positionX != null) {
        listener.positionX.value = 0;
        listener.positionY.value = 1.15;
        listener.positionZ.value = 0;
      }
    }
    if (this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  private playTone(
    entity: Entity,
    frequency: number,
    options: { duration: number; type: OscillatorType; gain: number; delay?: number },
  ): void {
    const ctx = this.ensureAudio();
    if (ctx == null) {
      return;
    }
    const start = ctx.currentTime + (options.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = options.type;
    osc.frequency.value = frequency;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.0001, start);
    gainNode.gain.exponentialRampToValueAtTime(options.gain, start + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(
      0.0001,
      start + options.duration,
    );

    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 0.4;
    if (entity.object3D != null) {
      entity.object3D.getWorldPosition(this.worldPos);
      if (panner.positionX != null) {
        panner.positionX.value = this.worldPos.x;
        panner.positionY.value = this.worldPos.y;
        panner.positionZ.value = this.worldPos.z;
      }
    }

    osc.connect(gainNode);
    gainNode.connect(panner);
    panner.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + options.duration + 0.05);
  }
}
