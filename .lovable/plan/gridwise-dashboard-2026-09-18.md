# GridWise Dashboard

## Goal

Build the primary desktop-first energy operations dashboard from the supplied challenge specification and ASCII design, with responsive behavior for smaller screens.

## Interface

- Create the fixed GridWise sidebar and compact scenario/API status header.
- Build the dashboard overview with four operational metrics, active directive chips, and operator-note interpretation states.
- Add a 24-hour energy chart, detailed hourly schedule, battery state chart, validation checklist, and optimization summary.
- Preserve the specified green, yellow, blue-purple, and neutral energy color roles with compact professional typography.
- Add clear mobile navigation and responsive stacking without removing information.

## Interaction

- Make sidebar sections switch between focused dashboard views for scenarios, directives, schedule, analytics, validation, API status, and settings.
- Add working chart/table and visual/JSON view controls.
- Add scenario selection, schedule filters, JSON copy/download actions, and a simulated re-optimization status flow.
- Provide detailed directive and note interpretation panels so the human-note-to-validated-plan relationship is visible.

## Technical details

- Implement in the existing TanStack Start route using React, Recharts, and Lucide icons.
- Define the complete visual system as semantic tokens in the global stylesheet.
- Keep all challenge data as deterministic demo data in the frontend; no live optimization API or persistence is included.
- Add route-specific page metadata and verify desktop and mobile rendering plus interaction behavior.
