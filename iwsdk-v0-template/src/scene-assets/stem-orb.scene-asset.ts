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

import { Group, Mesh, MeshStandardMaterial, SphereGeometry } from '@iwsdk/core';

/**
 * Stem orb prototype: a 6 cm visible sphere (per the design doc) plus an
 * invisible 10 cm-radius hit shell, so pinch/ray selection stays forgiving
 * for tremor without enlarging the visual. Placements clone the hierarchy
 * but share geometry/material; SeatedConductorSystem clones the core
 * material per placement before restyling it.
 */
const orb = new Group();
orb.name = 'Stem Orb';

const core = new Mesh(
  new SphereGeometry(0.03, 24, 18),
  new MeshStandardMaterial({
    color: 0x64748b,
    emissive: 0x475569,
    emissiveIntensity: 0.25,
    roughness: 0.35,
    metalness: 0.1,
  }),
);
core.name = 'orb-core';
core.castShadow = false;
orb.add(core);

const hitShell = new Mesh(
  new SphereGeometry(0.1, 12, 8),
  new MeshStandardMaterial(),
);
hitShell.name = 'orb-hit';
hitShell.visible = false;
orb.add(hitShell);

export default orb;
