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

import { createComponent, Types } from '@iwsdk/core';

/**
 * A musical stem placed inside the verified seated reach envelope.
 * `stemIndex` selects the entry in STEM_DEFS (conductor-state.ts):
 * 0 = Ambient Pad Orb, 1 = Warm Pulse Node, 2 = Focus Bell Harmonics.
 * `toneHz` is the WebAudio voice frequency used when the stem toggles
 * (the bell stem additionally plays the bundled chime via AudioSource).
 */
export const StemOrb = createComponent('StemOrb', {
  stemIndex: { type: Types.Int32, default: 0 },
  active: { type: Types.Boolean, default: false },
  toneHz: { type: Types.Float32, default: 440 },
});

/**
 * The one-time headset consent gate. Mirrors the Python engine's
 * OneTimeConsentRegistry: stems stay locked until this pill has been
 * activated once, after which `granted` stays true for the session.
 */
export const ConsentPill = createComponent('ConsentPill', {
  granted: { type: Types.Boolean, default: false },
});
