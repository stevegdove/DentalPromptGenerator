# Accounting Vertical — Research & Content Plan

**Date:** 2026-07-08
**Scope:** Multi-service CPA firm incl. wealth/financial-planning-adjacent + Client Accounting Services (CAS). No attest/audit.
**Goal:** Author `verticals/accounting.json` (+ stub + manifest entry) at **dental parity** — comparable breadth and per-task richness, accurate accounting terminology, and correct, role-appropriate compliance disclaimers.
**Depends on:** the Phase 1 data engine (already shipped): pack schema, `buildPrompt`, phrasing profiles, `validatePack`.

## Parity Target (what "dental level" means)

Dental ships 13 roles / ~110 tasks with, per task: `detail`, `input` (paste noun), `fields`, `followups`, `popular`; plus per-role `contexts`, per-role `safetyKeys`, phrasing profile, and pack-level `formats`, `popularFormats`, `tones`, `examples`, `sensitiveRoles`.

Accounting parity bar:
- **~11 roles**, **~90–120 tasks** total (6–12 per role).
- Every task carries `detail` where useful, `input` where source material is pasted, `fields` where a short fill-in tailors it, `followups`, and a `popular` flag.
- Per-role `contexts` (audiences for client-facing/"patient" roles; situations for "advisor" roles).
- **3 named safety rules** (below), resolved per role — and, new for accounting, per **task** where a task crosses regimes (e.g. a partner giving wealth guidance).
- 8–12 `formats`, 6–9 `tones`, 4–6 `examples`, curated `popularFormats`/`popularTasks`.

## Role Taxonomy (backbone) → phrasing + safety mapping

| # | Role (`value`) | Phrasing | Base `safetyKeys` |
|---|---|---|---|
| 1 | Client services coordinator (`coordinator`) | patient | `[confidential]` |
| 2 | Client relationship / account manager, CAS (`accountmgr`) | patient | `[confidential]` |
| 3 | Tax preparer (`preparer`) | advisor | `[confidential, taxAdvice]` |
| 4 | Tax advisor / manager (`taxadvisor`) | advisor | `[confidential, taxAdvice]` |
| 5 | Bookkeeper / write-up (`bookkeeper`) | advisor | `[confidential]` |
| 6 | CAS controller / outsourced controller (`controller`) | advisor | `[confidential]` |
| 7 | Payroll specialist (`payroll`) | advisor | `[confidential, taxAdvice]` |
| 8 | Wealth / financial-planning advisor (`wealth`) | advisor | `[confidential, investmentAdvice]` |
| 9 | Firm partner / owner (`partner`) | advisor | `[confidential, taxAdvice]` |
| 10 | Practice / operations manager (`opsmanager`) | advisor | `[confidential]` |
| 11 | Marketing / business development (`marketing`) | patient | `[confidential]` |

- **`sensitiveRoles`:** `partner` (and optionally `wealth`) behind the courtesy gate — **blocked on Phase 2 punch-list item #4** (gate password is hardcoded in `app.js`; needs `pack.gateHash`). Until that lands, ship accounting with `sensitiveRoles: []` OR implement the per-pack gate first (decide at kickoff).
- **Task-level safety override (schema extension needed):** wealth-adjacent tasks under `partner`, or tax-planning tasks under `wealth`, need to add the *other* disclaimer. The current engine resolves safety only at role level. **Add optional `task.safetyKeys` that augment the role's** — small change to `resolveSafety`/`app.js` + a test. Captured here as a prerequisite mini-task.

## The Compliance / Safety Model (must be researched & sourced, not guessed)

Author three named safety rules; wording verified against primary sources:

1. **`confidential`** — PII/financial redaction (SSN, EIN, bank/account numbers, client names, individual figures). Grounds: AICPA Code §1.700 (confidential client info); FTC Safeguards Rule / GLBA; IRS Pub 4557 & §7216.
2. **`taxAdvice`** — "draft, not tax/accounting/legal advice; verify against current IRS guidance; licensed CPA/attorney review before filing/advising." Grounds: IRS Circular 230 norms; professional-standards disclaimer conventions.
3. **`investmentAdvice`** — "not investment/financial advice or a recommendation; not an offer; past performance ≠ future results; consult a licensed financial advisor/fiduciary; subject to SEC/state RIA rules." Grounds: SEC/state RIA advertising & disclosure norms; standard "not investment advice" disclaimer conventions.

Plus the advisor-phrasing **`researchNote`** for tasks needing current-year figures (contribution limits, brackets, mileage rates).

**Research sources (primary-first):**
- IRS: Circular 230, Pub 4557 (Safeguarding Taxpayer Data), §7216, current-year figures pages.
- FTC: Safeguards Rule / GLBA; AICPA: Code of Professional Conduct (confidentiality, integrity, CAS/advisory practice aids), PCPS/CAS guidance.
- SEC / NASAA / state boards: RIA advertising & "not advice" disclosure norms.
- Firm-operations reality: CAS/advisory service-line descriptions, practice-management workflows, real firm role charts (for the task inventory).

## Method (phased execution)

**Prereq mini-task (engine):** add optional `task.safetyKeys` augmentation to `resolveSafety` + `app.js` + a unit test (keeps dental green; enables wealth/tax overlap). ~1 small TDD task.

**Phase A — Research & compliance grounding.** Use the deep-research skill (web search + fetch) to (a) confirm the role/service-line taxonomy, (b) author the three safety-rule texts with sourced, accurate language, and (c) settle the RIA/tax-overlap disclaimer rules. Output: a short sourced decisions memo + the three safety strings.

**Phase B — Per-role task inventory (fan-out).** One research+drafting pass per role (11 roles), each producing 6–12 tasks with `detail`/`input`/`fields`/`followups`/`popular` and the role's `contexts`. Reuse dental task archetypes where they transfer (reminders, explainers, SOPs, notice/response, review replies) and add accounting-native ones (IRS notice response, month-end close, cash-flow narrative, entity-choice explainer, payroll-tax notice, planning checklists). Run as a Workflow fan-out (one agent per role) for speed, or sequentially.

**Phase C — Author `verticals/accounting.json`.** Assemble to schema with both phrasing profiles (accounting-adapted, `placeholderLine:false` until punch-list #2 is fixed), formats, tones, examples, popular curation. Preserve the pack↔DB-portable shape.

**Phase D — Validate & spot-check.** `validatePack` clean; `buildPrompt` spot-checks for a patient role, an advisor role, a task with a task-level safety override (wealth+tax), and a research-note task; add a `test/accounting-pack.test.js` mirroring the dental-pack test.

**Phase E — Domain-accuracy adversarial review.** A CPA/RIA-lens pass (independent agent) checking: no task invites unauthorized practice or a specific recommendation; disclaimers attach to the right roles/tasks; terminology is correct; wealth+tax conflict/independence notes present where needed. Findings → fix loop.

**Phase F — Stub, manifest, browser check.** Copy the dental stub → `accounting/`, set `verticalId`, title/OG, tone chips from `pack.tones`; add manifest entry; drive it in a browser (hub shows both cards; sample prompts correct).

## Deliverables
- `verticals/accounting.json` (dental parity) + `test/accounting-pack.test.js`.
- `accounting/index.html` stub + `verticals/manifest.json` entry.
- Engine: optional `task.safetyKeys` augmentation (+ test).
- A short **sources & decisions memo** (compliance wording provenance).

## Quality Bar
- Counts: ~11 roles, ~90–120 tasks, ≥3 examples, popular flags present.
- Every advisor role uses situation framing; every client-facing role uses audience framing.
- Disclaimers accurate and role/task-correct; **no task produces a specific tax or investment recommendation** — all are drafts/explainers/comms with the right "not advice + verify" framing.
- Validator clean; browser-verified; domain review passed.

## Risks & Mitigations
- **Improper advice / unauthorized practice** → disclaimers + Phase E adversarial review; frame wealth/tax tasks as education/communication, never a recommendation.
- **Compliance inaccuracy** → Phase A primary-source research; cite in the memo.
- **Scope creep** → cap at ~11 roles / ~120 tasks; audit/assurance explicitly out.
- **Gate password limitation (punch-list #4)** → either ship `sensitiveRoles:[]` or land `pack.gateHash` first; decide at kickoff.
- **Cost** → Phases A–B are research-heavy; run as a bounded Workflow fan-out and checkpoint.

## Open Decisions (kickoff)
1. Implement `pack.gateHash` now (to gate `partner`/`wealth`) or ship ungated for v1?
2. Add `task.safetyKeys` augmentation now (recommended — wealth/tax overlap needs it) or keep safety role-only for v1?
3. Execution: run Phases A–B as a multi-agent **Workflow** (faster, higher token cost) or sequential single-agent research (cheaper, slower)?
