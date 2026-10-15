# Official MHS panel adaptation

Upstream: https://github.com/AgnesAI-Labs/agnes-harness
Revision: `4bc36bc4c4441206388a53bece17379c1d7be14d` (retrieved 2026-10-13).
License: Apache-2.0; upstream LICENSE and NOTICE are retained here.

Adapted source paths:
- `packages/mhs/plugin/client/src/hosts/agnes/index.tsx`
- `packages/mhs/plugin/client/src/layout/panel.tsx`
- `packages/mhs/plugin/client/src/style.css`

Modified implementation: `extensions/dashboard/client/official-shell.js` and `official-shell.css`.
Retains the upstream dock/store/slot, resizable rail, full-screen console and segmented-view approach.
Converted TSX to native browser ESM using AGH's shared React runtime. Replaced device navigation,
AgnesHub networking and controls with the existing bounded MQTT report service and current-session projection.
Added keyboard resizing, narrow-screen layout, focus containment, resize/disposal cleanup and separate storage keys.
The audit views and report semantics are project code. This is an adapted official UI shell, not an
installed unmodified @agnes/mhs plugin; it neither starts AgnesHub nor adds device or network tools.
Upstream NOTICE is retained verbatim for provenance; unrelated third-party components named in it are not bundled.
