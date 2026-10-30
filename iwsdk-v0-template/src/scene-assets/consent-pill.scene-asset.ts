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
  CapsuleGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from '@iwsdk/core';

/**
 * Headset Consent Pill prototype: a small horizontal capsule the user
 * pinches once to unlock the stems (one-time consent). The invisible
 * sphere shell inflates the hit target like the stem orbs' shell.
 */
const pill = new Group();
pill.name = 'Headset Consent Pill';

const core = new Mesh(
  new CapsuleGeometry(0.02, 0.045, 6, 14),
  new MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0xb45309,
    emissiveIntensity: 0.35,
    roughness: 0.4,
    metalness: 0.05,
  }),
);
core.name = 'pill-core';
core.rotation.z = Math.PI / 2;
core.castShadow = false;
pill.add(core);

const hitShell = new Mesh(
  new SphereGeometry(0.09, 12, 8),
  new MeshStandardMaterial(),
);
hitShell.name = 'pill-hit';
hitShell.visible = false;
pill.add(hitShell);

export default pill;
