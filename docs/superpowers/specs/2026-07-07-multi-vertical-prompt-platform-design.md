# Multi-Vertical Prompt Platform — Design

**Date:** 2026-07-07
**Status:** Approved (brainstorm) — ready for implementation planning
**Branch:** `feature/multi-vertical-prompt-platform`

## Summary

Turn the current dental-only prompt generator (two duplicated, hardcoded HTML apps)
into a **data-driven, multi-vertical platform**. A single generic engine renders any
"business type" from a self-contained JSON **pack** (theme + vocabulary + safety rules +
roles + tasks + formats). A **unified prompt library** (replacing today's favorites) lets
users save the final, editable prompt text for reuse. The product stays **static,
zero-build, and hosted on GitHub Pages**. Cloud (Azure + Google auth + database) is
explicitly **designed-for but not built** — schemas are shaped to lift into it later.

## Goals

- One generic engine drives every vertical; adding a business type = adding one JSON pack.
- "Skin + vocabulary" theming per vertical: colors/logo/fonts **and** vertical-specific
  labels, safety/disclaimer rules, examples, and terminology.
- A single saved-prompt **Library** storing the final (editable) prompt text — replacing
  the existing `favorites` feature entirely (no two save systems).
- Ship 3 seed verticals: **Dental** (ported), **Church/Ministry**, **Auto Repair Shop**,
  the latter two AI-drafted.
- Preserve the zero-build / GitHub Pages / no-dependency ethos of the current app.
- Portable data model: JSON packs → future DB rows; localStorage Library → future cloud
  sync, both without a rewrite.

## Non-Goals (this project)

- No Google login, no Azure hosting, no server, no database built now (Phase 4, deferred).
- No build step or framework adoption (vanilla HTML/JS is retained).
- No admin/authoring UI (verticals are hand-authored JSON files for now).
- No change to the underlying prompt-construction philosophy (RCTF + safety rule).

## Current State (baseline)

- `index.html` (hub) + `team/index.html` (PHI-safe, patient-facing) +
  `owner/index.html` (confidential-safe, courtesy password gate). Deployed on GitHub Pages.
- Engine is **RCTF**: cascading **Role → Context → Task → Format** selects, tone chips,
  optional detail fields, `buildPrompt()` assembling a prompt with a **non-removable safety
  rule** appended. Share via `?p=` links, favorites in `localStorage`, GoatCounter events.
- **All content is hardcoded** JS (`ROLES`, `SHARED_CONTEXT`, `CONTEXT`, `TASK`, `FORMATS`,
  `POPULAR_TASKS`, `POPULAR_FORMATS`, `TASK_INPUT`, `TASK_DETAIL`, `TONE_CLAUSE`, `SAFETY`),
  and the entire engine is **duplicated** across `team/` and `owner/`.

## Chosen Approach

**A. One generic engine + JSON vertical packs.** Extract the duplicated engine into shared
JS; represent each business type as one JSON pack; the hub becomes a vertical picker; the
app loads a pack via `?type=<vertical>`.

Alternatives rejected:
- **B. Externalize data but keep separate apps** — perpetuates engine duplication, scales
  to N apps. Rejected.
- **C. Adopt a build (Vite/framework)** — breaks the zero-dependency ethos, adds tooling
  for little gain at this scope. Rejected.

### Key nuance: dental is not one safety rule

Today's `team/` vs `owner/` split is really a **role-level** distinction (PHI for
patient-facing roles; confidentiality for owner/finance roles, plus a courtesy password
gate). In the unified model, **dental is one vertical** whose **safety rule resolves per
role** (with a vertical default), and the courtesy gate becomes an **optional per-role
flag** so nothing regresses.

## Architecture

**Folder-per-vertical stubs over one shared, module-based engine.** The engine lives once
as native **ES modules** under `/app/`; each vertical is a tiny HTML stub folder that
imports those modules and loads its own pack.

```
/index.html            ← hub: vertical picker (reads the manifest)
/app/engine.js         ← buildPrompt(), cascading selects, tone, details, share, providers
/app/pack.js           ← pack loader + schema validator (fails loudly)
/app/library.js        ← unified saved-prompt store (localStorage backend, swappable)
/app/theme.js          ← applies theme tokens → CSS custom properties
/app/analytics.js      ← GoatCounter event helper (enforces the naming scheme)
/dental/index.html     ← tiny stub: imports /app/*.js, loads verticals/dental.json
/church/index.html     ← tiny stub → verticals/church.json
/auto-shop/index.html  ← tiny stub → verticals/auto-shop.json
/team/index.html       ← redirect stub → /dental/  (preserves old share links)
/owner/index.html      ← redirect stub → /dental/
/verticals/manifest.json   ← list of packs (id, name, tagline, theme accent)
/verticals/dental.json
/verticals/church.json
/verticals/auto-shop.json
/assets/<vertical>/...     ← per-vertical logos / og:image cards
```

**Decisions (resolved from earlier open questions):**
- **Engine split:** native **ES modules** (`<script type="module">` + `import`/`export`),
  **no bundler** — standards-based and de-duplicated. Trade-off, stated intentionally: ES
  modules and `fetch()` of pack JSON **do not run over `file://`**, so the app **must be
  served** (GitHub Pages, or the `python3 -m http.server` command already in the README).
  Double-click-to-open is no longer supported; this is an accepted cost of external packs +
  modules.
- **URL layout:** **folder per vertical** (`/dental/`, `/church/`, `/auto-shop/`). Clean
  readable URLs, per-vertical `og:image`, and existing `?p=` share links keep working as
  `/dental/?p=…`. Legacy `/team/` and `/owner/` become **redirect stubs** to `/dental/`
  (query string preserved) so links already in the wild don't break.
- **Per-vertical stubs** are near-identical and can be generated; each sets its own
  `og:image`/title and names its pack.

### Data flow

1. Hub reads `verticals/manifest.json` → renders picker cards (themed by accent).
2. User picks a vertical → navigates to `/<vertical>/` (e.g. `/dental/`).
3. The stub imports the `/app/` modules; `pack.js` fetches `verticals/<id>.json`,
   validates it, hands it to the engine.
4. `theme.js` maps `pack.theme` → CSS custom properties (the "skin").
5. Engine renders vocabulary labels + cascading Role → Context → Task → Format from the
   pack; `buildPrompt()` assembles the prompt and appends the **role-resolved safety rule**.
6. Save → `library.js` persists the final editable text + metadata to localStorage.

## The Vertical Pack Schema

One JSON file per vertical. Shaped 1:1 to a future DB row.

```jsonc
{
  "id": "dental",
  "name": "Bridge Dental",
  "tagline": "Prompts for your whole dental practice",
  "theme": {
    "primary": "#0e7490",
    "accent": "#f59e0b",
    "font": "system",
    "logo": "assets/dental/logo.png",
    "bg": "..."
  },
  "vocabulary": {
    "roleLabel": "Your role",
    "contextLabel": "Who you're talking to",
    "taskLabel": "What you need",
    "customerNoun": "patient"
  },
  "safety": {
    "default": "Confidentiality rule: …",
    "byRole": { "frontdesk": "PHI rule: …", "hygienist": "PHI rule: …" }
  },
  "sensitiveRoles": ["owner", "money-expert"],   // optional courtesy gate; [] = none
  "roles": [
    {
      "value": "frontdesk",
      "label": "Front desk coordinator",
      "prompt": "a front desk coordinator",
      "contexts": ["a busy adult overdue 12+ months", "a price-shopper"],
      "tasks": [
        {
          "text": "Re-engage overdue patients",
          "detail": "…optional extra instruction appended to the prompt…",
          "input": "…optional 'paste source material' noun, e.g. 'negative review'…"
        }
      ],
      "popularTasks": ["Re-engage overdue patients"]
    }
  ],
  "sharedContext": ["a general patient", "a new patient"],
  "formats": [ { "text": "One text message (under 45 words)", "ph": true } ],
  "popularFormats": ["One text message (under 45 words)"],
  "tones": [ { "value": "warm", "clause": "warm" } ]   // optional; engine default if absent
}
```

**Design decisions:**
- **Tasks and contexts nest under their role** (replaces today's parallel `CONTEXT`/`TASK`/
  `POPULAR_TASKS`/`TASK_INPUT`/`TASK_DETAIL` maps keyed by role). One place per role.
- **Safety resolves per role**: `safety.byRole[role]` if present, else `safety.default`.
  The safety rule remains **non-removable** in the generated output.
- **Formats are vertical-level** (shared across roles), matching today's behavior.
- **`ph` flag** on a format still drives the "use [bracketed placeholders]" line.
- **`sensitiveRoles`** drives the optional courtesy gate (off when empty). Gate remains a
  courtesy lock only (public repo), consistent with today's documented stance.
- **Validation:** `pack.js` validates required fields and types on load and surfaces a
  clear error rather than rendering a broken UI.

## The Unified Library

Replaces the existing `favorites` feature entirely.

**Saved item shape:**
```jsonc
{
  "id": "…",
  "title": "…",          // user-editable, defaults from task
  "text": "…",           // the final generated prompt, user-editable
  "vertical": "dental",
  "role": "frontdesk",
  "task": "Re-engage overdue patients",
  "createdAt": 0,
  "updatedAt": 0
}
```

**Behavior:**
- **Save** captures the current generated prompt text; the user may edit title and text
  before/after saving. The **text is the source of truth** (saved "after editing or not").
- **Library view**: lists saved items across **all** verticals; filter by vertical/role;
  search title/text. Each item: copy, open-in-(ChatGPT/Claude/Gemini/Grok), edit, delete.
- **Storage**: `library.js` exposes `list() / get(id) / save(item) / remove(id)` over a
  localStorage backend. The interface is storage-agnostic so a future cloud backend swaps
  in without UI changes.
- **Migration**: on first load, existing `favorites` localStorage entries are read and
  folded into the Library once, then the legacy key is retired. Exactly one save system
  exists thereafter.

## Seed Verticals & AI-Assisted Generation

- **Dental** — ported from today's `team/` + `owner/`, merged into one pack. All roles,
  contexts, tasks, formats, tones, per-role safety rules, and `sensitiveRoles` for the
  owner/finance roles (preserving the courtesy gate).
- **Church/Ministry** and **Auto Repair Shop** — AI-drafted, then hand-edited. Chosen for
  maximally different vocabulary and safety tone, stress-testing the schema.
- **Pack-generation aid**: a documented prompt that takes an industry + role list and emits
  a **schema-valid** JSON pack for hand-editing. This is an **authoring aid**, not a runtime
  feature. No AI runs in the app.

## Analytics (GoatCounter) — event-naming scheme

GoatCounter's free tier has no custom properties, so the **event name carries every
dimension**. Rules: never put user/prompt content in a name (privacy + cardinality); use a
**fixed, closed vocabulary of action verbs reused identically across every vertical** so
verticals are directly comparable; **vertical first**, hyphen-delimited, lowercase.

**Pattern:** `{vertical}-{action}[-{target}]`

| Event | Fires on |
|---|---|
| `{vertical}-copy` | Copy prompt |
| `{vertical}-open-{chatgpt\|claude\|gemini\|grok}` | Open-in provider |
| `{vertical}-save` | Save to Library |
| `{vertical}-share` | Create `?p=` share link |
| `{vertical}-library-open` | Open the Library view |
| `{vertical}-gate-{success\|fail}` | Courtesy gate (sensitive roles) |
| `{vertical}-outbound-bridgedental` | Footer link |
| `hub-pick-{vertical}` | Vertical chosen on the hub |

`/app/analytics.js` centralizes emission so names can't drift per vertical. This renames
today's ad-hoc `team-*`/`owner-*` events into one system; historical data stays under the
old names (a one-time, accepted discontinuity).

## Phased Roadmap

| Phase | Scope | Ships on |
|---|---|---|
| **1. Engine refactor** | Extract generic engine from the two dental apps; dental as one pack; pack validator; hub → vertical picker. No visible feature change vs today. | GitHub Pages |
| **2. Multi-vertical + themes** | Skin+vocabulary theming applied per pack; add Church + Auto Shop packs (AI-drafted, hand-edited); document the pack-gen prompt. | GitHub Pages |
| **3. Unified Library** | Editable-text saves; filter/search; migrate favorites; localStorage module with swappable backend. | GitHub Pages |
| **4. Cloud (deferred / optional — NOT built now)** | Azure Static Web Apps + built-in Google auth + Functions API + tiny DB (Table Storage or Cosmos serverless). Packs move JSON→DB; Library localStorage→cloud sync. | Azure SWA |

Phases 1–3 are the near-term product; each is independently shippable and preserves the
zero-build / GitHub Pages simplicity. Phase 4 is documented only so the Phase 1–3 schemas
are built to lift into it later — none of Phase 4 is implemented in this project.

## Preserved Behaviors (must not regress)

- RCTF flow, tone chips, optional detail fields, "ask me 2–3 questions first" toggle,
  "paste source material" blocks for tasks that need input.
- Non-removable safety rule appended to every prompt (now role-resolved).
- `?p=` share links, provider open-in buttons, GoatCounter custom events.
- Owner/finance courtesy gate (now the optional `sensitiveRoles` mechanism).
- Runs by opening files on a static host; folder structure must stay intact.

## Risks & Mitigations

- **Regression during de-duplication** — the engine is currently copy-pasted; extracting it
  risks subtle behavior drift. *Mitigation:* port dental to a pack that reproduces today's
  output byte-for-byte where practical; spot-check generated prompts against the live apps.
- **Malformed packs** — hand-authored JSON is error-prone. *Mitigation:* schema validator
  fails loudly with a clear message.
- **Analytics event names** — GoatCounter events are currently vertical-prefixed
  (`team-*`, `owner-*`). *Mitigation:* define a consistent event-naming scheme across
  verticals during Phase 1 (implementation-planning detail).

## Resolved Decisions (formerly open questions)

- **Engine file split** → native **ES modules** under `/app/`, no bundler; app must be
  served (no `file://`). See Architecture.
- **GoatCounter naming** → `{vertical}-{action}[-{target}]` with a closed verb set,
  centralized in `/app/analytics.js`. See Analytics.
- **URL layout** → **folder per vertical** (`/dental/`, `/church/`, `/auto-shop/`) over
  shared `/app/` modules; `/team/` and `/owner/` become redirect stubs. See Architecture.

## Open Questions (for implementation planning)

- None outstanding at the design level. Remaining choices (e.g. exact stub-generation
  approach, `og:image` card production per vertical) are implementation-plan details.

## Phase 2 punch-list — validated 2026-07-08

A throwaway **Accounting Firm** vertical was authored, browser-tested (hub showed 2
cards; the app generated correct accounting prompts via advisor phrasing + a
confidential/advice safety stack), then reverted. It confirmed the Phase 1 data engine is
generic (a new vertical = pack JSON + stub + manifest line, zero engine changes) and
surfaced these concrete Phase 2 items:

1. **Vocabulary not applied to the DOM.** The pack's `vocabulary.*` labels are loaded but
   not wired to the visible form labels (still show the static dental copy). Phase 2 should
   apply them alongside the theme skin.
2. **`PLACEHOLDER_LINE` is a dental-flavored constant** in `app/prompt.js` (mentions
   `[booking link]`, `[practice name]`). Move it into the phrasing profile so it is
   pack-driven; until then a vertical must use `placeholderLine: false` to avoid leakage.
3. **Tone chips are hardcoded per stub.** Each vertical stub duplicates its tone-chip
   markup. Render chips dynamically from `pack.tones` so stubs stay vertical-agnostic.
4. **Courtesy-gate password is global.** The djb2 hash is hardcoded in `app/app.js`, so
   every vertical's sensitive roles share one password. Move it to the pack (e.g.
   `pack.gateHash`) for per-vertical gating.
5. **Static shell chrome is dental-branded.** The stub's hero/founders/how copy is
   dental-specific; Phase 2 theming should drive it from the pack (or neutralize it).
