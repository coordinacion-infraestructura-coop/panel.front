# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Single React SPA for the Ministerio de Cooperativas y Mutuales de Córdoba portal — one frontend
serving every secretaría, talking to per-secretaría FastAPI microservices through a single GCP
API Gateway. This folder (`frontend/`) is its own git checkout: repo `panel.front`, remote
`origin` (legacy `origin_front` → `panel`). The parent `../CLAUDE.md` holds the full-system
architecture and the **Spec Driven Development hard rule** (no screen without an `approved` spec
in `../docs/files/spec-*.md`) — read it; it governs this repo too.

## Commands

```bash
npm run dev        # Vite dev server on :5173, proxies /api → the gateway (vite.config.ts)
npm run build      # tsc -b && vite build — this IS the check. No separate typecheck/lint script.
npm run preview    # serve the built dist/
```

- **No test framework, no linter/formatter.** `npm run build` (type-check + bundle) is the only
  automated verification. UI changes must be checked in the browser.
- TS config is strict with `noUnusedLocals` + `noUnusedParameters` — an unused import or var
  **fails the build**, not just warns.
- Deploy: Firebase Hosting (`firebase deploy`), project `gestorcooperativo`, serves `dist/`,
  SPA rewrite of `**` → `/index.html` (`firebase.json`).
- `scripts/prepare_departamentos_geojson.py` is a one-off Python script (needs `pyproj`,
  `shapely`) that regenerates `public/geo/departamentos_cba.json` — **not** part of the build,
  re-run by hand only if the departamento cartography changes.

## Architecture

### Stack & state model

Vite + React 18 + React Router v6 (`App.tsx` holds every route; v7 future flags on).
**All server state is TanStack Query; all UI state is local `useState`.** `zustand` is in
`package.json` but used nowhere — don't reach for it.

### Auth & authorization — two separate layers

1. **Identity (Firebase):** Google popup sign-in in `shared/auth/AuthContext.tsx`. The axios
   instance in `shared/api/client.ts` attaches `Authorization: Bearer <firebase idToken>` on
   every request via interceptor; a `401` response hard-redirects to `/login`.
2. **Permissions (portal):** `shared/hooks/usePortalUser.ts` queries `/api/v1/portal/me` for
   `{ rol, secretarias }`. Roles: `Admin` > `Supervisor` > `Operador` > `Consulta`, plus the
   module-scoped `TecnicoDGV`. `ProtectedRoute roles={[...]}` gates the `/admin/*` routes.
   - **Pass `usePortalUser(false)` while Firebase is still resolving** (as `ProtectedRoute`
     does). Firing `/portal/me` without a token returns a 401 that the gateway sends back
     *without CORS headers*, which surfaces as an opaque network error.
   - **Permission gates are recomputed by hand in every page** (`canManage`/`canEdit`/…),
     no shared hook — a permission-logic change usually needs replicating across pages.
   - `TecnicoDGV` nav filtering is hand-mirrored in **two** places: `Layout.tsx` `navItemsFor`
     and `DashboardPage.tsx` `SecretariaCard` (both limit the role to Tablero + Checklist
     Técnico; see `../docs/files/spec-checklist-tecnico-dgv.md` §8). Backend enforces the real
     403 — these filters are navigation-only.

### API layer

`VITE_API_GATEWAY_URL` (both `.env.development` and `.env.production` point at
`https://ministerio-gateway-3j5k00ma.uc.gateway.dev`). One `*.api.ts` module per secretaría
(`modules/vivienda/api/vivienda.api.ts`, `modules/privada/api/gestiones.api.ts`) — thin
`apiClient.get(...).then(r => r.data)` wrappers grouped by resource. Firebase config in the
`.env` files is committed (public web config, expected).

### Module structure

- `src/modules/{secretaria}/` each with `api/`, `pages/`, `types/`. Shared code in `src/shared/`.
- `infraestructura/`, `territorial/`, `desarrollo/`, `gasifera/` folders exist but are **empty** —
  no `approved` spec yet; they show only as inactive cards on the dashboard.
- `vivienda/pages/BeneficiariosListPage` + `ExpedientesListPage` (generic-core screens) are
  routed but **hidden from nav** ("en desarrollo" — commented out in `Layout.tsx`, `hidden:true`
  in `DashboardPage.tsx`).

### The three panel pages are monolithic near-duplicates

`CordonCunetaPage.tsx`, `CordobaHogarPage.tsx`, `MiLugarPage.tsx` — 1400–1650 lines each, no
internal `components/` folder (the `hooks/` and `components/` dirs under `modules/vivienda/` are
empty). Modals (`EditModal`, `AgregarModal` with 409-duplicate "ir a editar" recovery,
`DetailPanel` with Comunicaciones/Historial tabs) are inline functions in the same file. They
share one skeleton: KPI strip → client-side filters → sortable table → modals. **When changing
one, check whether the same change belongs in its siblings.**

`ChecklistTecnicoPage.tsx` is the área-técnica-DGV editor over CC + CH + ML with **autosave per
field — no "Guardar" button** (the spec rejects that pattern).

### Client-side vs server-side lists — two deliberate paradigms

`vivienda` panels load the **entire** dataset once and filter/sort/paginate in the browser.
`privada` (`GestionesListPage.tsx`) is **server-side paginated** (`limit`/`offset` + filter
params in the request). Not an inconsistency — don't "harmonize" them.

### Styling

- Tailwind v4 via the `@tailwindcss/vite` plugin. Config lives **in CSS**: `src/index.css`
  `@theme { ... }` block defines the palette and font.
- The Google Fonts `@import` **must come before** `@import "tailwindcss"` in `index.css` or the
  build silently drops it.
- Palette: `gov-navy` #172c3f, `gov-blue` #398ebd, `gov-cyan` #01aae3, `gov-orange` #d17612.
  Font: Poppins. Tokens are also usable as CSS vars (`var(--color-gov-navy)`) in inline styles,
  which the panel pages do for sticky-column backgrounds.

### Charts & maps (informe pages)

- Chart.js — components are tree-shaken, so `shared/components/informe/chartSetup.ts` does the
  one-time `Chart.register(...)` of every controller/element used. Import from there, not
  `chart.js` directly, or you get "X is not a registered controller".
- Informe pages (`ProgramaInformePage`) render **cached backend snapshots** — reports exist for
  `cordon_cuneta` / `cordoba_hogar` only (not `mi_lugar`).
- Leaflet for maps. `shared/utils/normalizeName.ts` intentionally mirrors the backend's
  `app/geo/matching.py` for matching departamento names against the static GeoJSON.
- `shared/utils/exportTable.ts` wraps `xlsx` for the "exportar a Excel" buttons.
