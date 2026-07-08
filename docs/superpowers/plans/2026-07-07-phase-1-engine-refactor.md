# Phase 1 — Engine Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the duplicated dental engine into shared ES modules driven by a single JSON "pack," merge the team + owner apps into one data-driven `dental` vertical (folder-per-vertical URLs, redirect stubs for old links), with no visible regression.

**Architecture:** Pure-logic modules (`prompt.js`, `pack.js`, `state.js`, `analytics.js`, `hash.js`) hold all risk-bearing logic and are unit-tested with Node's built-in test runner (zero dependencies). A DOM module (`app.js`) wires the existing markup to a pack object. Each vertical is a folder (`/dental/`) whose stub imports the shared modules and loads its pack; `/team/` and `/owner/` become redirect stubs; the hub renders a picker from a manifest.

**Tech Stack:** Vanilla JavaScript as native ES modules (no bundler), HTML/CSS, `localStorage`, GoatCounter. Dev-only: Node ≥18 `node --test` runner.

## Global Constraints

- **Zero production dependencies / no build step.** The deployed artifact is hand-written static files served as-is (GitHub Pages). Node/`package.json` are **dev-test-only** and never shipped or required at runtime. Copied verbatim from spec non-goals.
- **ES modules require a server.** Modules + `fetch()` of pack JSON do not run over `file://`. Local dev: `python3 -m http.server 4601` then browse `http://localhost:4601/`. Double-click-to-open is no longer supported (accepted trade).
- **No visible regression.** Generated prompt text for any given selection must match today's team/owner apps byte-for-byte (the buildPrompt fixtures enforce this).
- **Safety rule is non-removable** and appended to every prompt, resolved per role.
- **Preserve:** `?p=` share links (old payloads must still decode), provider open-in buttons, favorites (localStorage, unchanged this phase — the unified Library is Phase 3), the owner courtesy password gate (djb2 hash `f36b8ed8`, case-insensitive, remembered per device), GoatCounter events.
- **GoatCounter naming:** `{vertical}-{action}[-{target}]`, closed verb set, centralized in `analytics.js`. This phase renames `team-*`/`owner-*` events to `dental-*`.
- **Preserve strings verbatim** when porting content into `dental.json` (roles, contexts, tasks, formats, detail/verify/safety copy) — no rewording.

### Testing note (honest scope)

Risk-bearing **pure logic** (prompt assembly, safety resolution, pack validation, share-state codec, analytics naming, djb2) is covered by Node unit tests — this is where regressions hide. **DOM wiring** (`app.js`, the page shells) has no headless test harness this phase (adding Playwright would violate zero-dependency scope); it is verified via the explicit scripted browser checks each DOM task ends with. A browser E2E harness is a candidate for a later phase.

### Refactor porting convention

Tasks that **port existing content** into JSON reference exact source line ranges and show the target shape + concrete examples rather than re-listing every string (the source files are the reference and may be read directly). Tasks that create **new code** (all tests, new modules) show the complete code. Tasks may be executed out of order, so interfaces are stated explicitly per task.

---

### Task 1: Test harness bootstrap

**Files:**
- Create: `package.json`
- Create: `test/smoke.test.js`

**Interfaces:**
- Produces: `npm test` → runs `node --test` over `test/**/*.test.js`. Repo root is `"type": "module"` so all `.js` files are ESM in Node.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "bridge-prompt-platform",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Write a smoke test**

`test/smoke.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";

test("node test runner works", () => {
  assert.equal(1 + 1, 2);
});
```

- [ ] **Step 3: Run it**

Run: `npm test`
Expected: PASS — `tests 1`, `pass 1`, `fail 0`.

- [ ] **Step 4: Commit**

```bash
git add package.json test/smoke.test.js
git commit -m "test: add node --test harness"
```

---

### Task 2: Grammar + safety resolution (`prompt.js`, pure)

**Files:**
- Create: `app/prompt.js`
- Create: `test/prompt-safety.test.js`

**Interfaces:**
- Produces:
  - `ensurePeriod(s: string): string` — trims; appends `.` unless it already ends in `.`/`!`/`?`; `""` → `""`.
  - `capitalize(s: string): string` — trims; uppercases first char.
  - `resolveSafety(pack, roleValue: string): string[]` — returns the ordered safety strings for a role. Uses `pack.roles[].safetyKeys` (array of keys into `pack.safety`); falls back to `pack.defaultSafety` (array of keys) for unknown/custom roles. Order preserved.
- Consumes: a `pack` object shaped `{ safety: {key: string}, defaultSafety: string[], roles: [{value, safetyKeys}] }`.

- [ ] **Step 1: Write the failing test**

`test/prompt-safety.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { ensurePeriod, capitalize, resolveSafety } from "../app/prompt.js";

const pack = {
  safety: { phi: "PHI-RULE", confidential: "CONF-RULE", verify: "VERIFY-RULE" },
  defaultSafety: ["phi"],
  roles: [
    { value: "frontdesk", safetyKeys: ["phi"] },
    { value: "cfo", safetyKeys: ["confidential", "verify"] }
  ]
};

test("ensurePeriod", () => {
  assert.equal(ensurePeriod("hello"), "hello.");
  assert.equal(ensurePeriod("hello."), "hello.");
  assert.equal(ensurePeriod("hi!"), "hi!");
  assert.equal(ensurePeriod("  "), "");
});

test("capitalize", () => {
  assert.equal(capitalize("re-engage"), "Re-engage");
  assert.equal(capitalize(""), "");
});

test("resolveSafety: single rule", () => {
  assert.deepEqual(resolveSafety(pack, "frontdesk"), ["PHI-RULE"]);
});

test("resolveSafety: money role gets confidential then verify", () => {
  assert.deepEqual(resolveSafety(pack, "cfo"), ["CONF-RULE", "VERIFY-RULE"]);
});

test("resolveSafety: unknown role falls back to defaultSafety", () => {
  assert.deepEqual(resolveSafety(pack, "__other__"), ["PHI-RULE"]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — cannot import from `../app/prompt.js` (module missing).

- [ ] **Step 3: Implement**

`app/prompt.js`:
```js
export function ensurePeriod(s) {
  s = (s || "").trim();
  if (!s) return "";
  return /[.!?]$/.test(s) ? s : s + ".";
}

export function capitalize(s) {
  s = (s || "").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

export function resolveSafety(pack, roleValue) {
  const role = (pack.roles || []).find((r) => r.value === roleValue);
  const keys = (role && role.safetyKeys) || pack.defaultSafety || [];
  return keys.map((k) => pack.safety[k]).filter(Boolean);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS — all 5 tests in this file green.

- [ ] **Step 5: Commit**

```bash
git add app/prompt.js test/prompt-safety.test.js
git commit -m "feat: add grammar helpers and per-role safety resolution"
```

---

### Task 3: `buildPrompt` (`prompt.js`, pure) — the regression guard

**Files:**
- Modify: `app/prompt.js` (add `buildPrompt`, `PLACEHOLDER_LINE`)
- Create: `test/prompt-build.test.js`

**Interfaces:**
- Produces: `buildPrompt(pack, sel): string` where `sel` is:
  ```
  {
    rolePrompt: string,      // e.g. "a front desk coordinator" ("" if none)
    roleValue: string,       // role key, for safety resolution ("__other__" for custom)
    context: string,         // resolved context text ("" if none)
    task: string,            // resolved task text ("" if none)
    taskDetail: string,      // per-task extra instruction ("" if none)
    taskInput: string,       // "paste source" noun ("" if none)
    detailSentences: string[], // already-formed sentences from detail fields
    tones: string[],         // tone clause words, e.g. ["caring","clear"]
    format: { text: string, ph: boolean } | null,
    ask: boolean
  }
  ```
  Returns the full prompt including the role-resolved safety section(s). Mirrors today's `buildPrompt` exactly.
- Consumes: `ensurePeriod`, `capitalize`, `resolveSafety` (Task 2).

**Behavior (ported from `team/index.html:1089-1155` and `owner/index.html:…-1298`):**
1. `s1 = "Act as " + (rolePrompt || "[role]")`; if `context`, append `" speaking to " + context`; `ensurePeriod`.
2. `s2 = ensurePeriod(capitalize(task || "[task]"))`.
3. If `taskDetail`, push `ensurePeriod(taskDetail)`.
4. Push each of `detailSentences` (already period-terminated) joined by `" "`.
5. If `tones.length`, push `"Use a " + joinWithAnd(tones) + " tone."` where `joinWithAnd` = `a` / `a and b` / `a, b, and c`.
6. Push `"Format: " + ensurePeriod(format.text)` (or `"Format: [format]."` if null).
7. If `format && format.ph`, push the `PLACEHOLDER_LINE` constant.
8. If `ask`, push `"Before you write, ask me 2–3 quick questions to get the details right."`.
9. `body = parts.join(" ")`. `sections = [body]`.
10. If `taskInput`, push the paste block: `"Here is the " + taskInput + " to work from. Paste it between the lines below, with any patient names or identifiers removed — use [brackets] instead:\n---\n[ paste the " + taskInput + " here ]\n---"`.
11. Append each string from `resolveSafety(pack, roleValue)` as its own section, in order.
12. Return `sections.join("\n\n")`.

`PLACEHOLDER_LINE = "Where a specific detail is needed, use bracketed placeholders like [first name], [date], [time], [booking link], or [practice name]."`

> Note: the owner app's paste block wording differs ("Attach … in your AI tool"). In this phase the `dental` pack drives paste-block wording via `taskInput` using the **team** phrasing above; owner-origin tasks that used the attach-wording are ported to the same paste block. This is an intentional unification, not a regression of generated safety content. If exact owner paste wording must be preserved, extend `sel` with an optional `pasteTemplate` — deferred unless review requires it.

- [ ] **Step 1: Write the failing test** (locks today's output)

`test/prompt-build.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPrompt } from "../app/prompt.js";

const PHI = "Safety rule: Use no patient identifiers. Never include patient names, dates of birth, addresses, phone numbers, chart/account numbers, or insurance IDs — use [bracket] placeholders instead. This output is a first draft; review it before anyone (especially a patient) sees it.";
const CONF = "Safety rule: Keep confidential data out of this prompt. Don't include account or card numbers, bank details, patient names, individual employee pay, EINs, or other sensitive specifics — redact them or use [bracket] placeholders. Treat the output as a first draft and sanity-check the numbers before acting on them.";
const VERIFY = "Verify rule: AI-found figures and estimates are a starting point — confirm against primary sources, and with your CPA and attorney, before any offer, purchase, or filing.";
const PLACEHOLDER = "Where a specific detail is needed, use bracketed placeholders like [first name], [date], [time], [booking link], or [practice name].";

const pack = {
  safety: { phi: PHI, confidential: CONF, verify: VERIFY },
  defaultSafety: ["phi"],
  roles: [
    { value: "frontdesk", safetyKeys: ["phi"] },
    { value: "cfo", safetyKeys: ["confidential", "verify"] }
  ]
};

test("team-style prompt matches legacy output", () => {
  const out = buildPrompt(pack, {
    rolePrompt: "a front desk coordinator",
    roleValue: "frontdesk",
    context: "a busy adult overdue 12+ months",
    task: "Re-engage overdue patients",
    taskDetail: "", taskInput: "", detailSentences: [],
    tones: ["caring"],
    format: { text: "3 short text messages (under 35 words each)", ph: true },
    ask: false
  });
  const expected =
    "Act as a front desk coordinator speaking to a busy adult overdue 12+ months. " +
    "Re-engage overdue patients. Use a caring tone. " +
    "Format: 3 short text messages (under 35 words each). " +
    PLACEHOLDER +
    "\n\n" + PHI;
  assert.equal(out, expected);
});

test("owner money role appends confidential then verify", () => {
  const out = buildPrompt(pack, {
    rolePrompt: "a fractional CFO for a dental practice",
    roleValue: "cfo",
    context: "", task: "Compare lease vs buy", taskDetail: "", taskInput: "",
    detailSentences: [], tones: [],
    format: { text: "Short labeled bullet points", ph: false },
    ask: false
  });
  const expected =
    "Act as a fractional CFO for a dental practice. Compare lease vs buy. " +
    "Format: Short labeled bullet points." +
    "\n\n" + CONF + "\n\n" + VERIFY;
  assert.equal(out, expected);
});

test("three tones use oxford-comma join", () => {
  const out = buildPrompt(pack, {
    rolePrompt: "a dental hygienist", roleValue: "frontdesk",
    context: "", task: "X", taskDetail: "", taskInput: "", detailSentences: [],
    tones: ["calm", "clear", "warm"],
    format: { text: "An email (short and warm)", ph: true }, ask: false
  });
  assert.match(out, /Use a calm, clear, and warm tone\./);
});

test("paste block appears for taskInput", () => {
  const out = buildPrompt(pack, {
    rolePrompt: "a marketing and reputation manager", roleValue: "frontdesk",
    context: "", task: "Respond to a negative review (safe)", taskDetail: "",
    taskInput: "negative review", detailSentences: [], tones: [],
    format: { text: "A public review reply (under 70 words)", ph: true }, ask: true
  });
  assert.match(out, /Before you write, ask me 2–3 quick questions/);
  assert.match(out, /Here is the negative review to work from/);
  assert.match(out, /\[ paste the negative review here \]/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `buildPrompt` is not exported.

- [ ] **Step 3: Implement `buildPrompt`**

Append to `app/prompt.js`:
```js
export const PLACEHOLDER_LINE =
  "Where a specific detail is needed, use bracketed placeholders like [first name], [date], [time], [booking link], or [practice name].";

function joinWithAnd(words) {
  if (words.length === 1) return words[0];
  if (words.length === 2) return words[0] + " and " + words[1];
  return words.slice(0, -1).join(", ") + ", and " + words[words.length - 1];
}

export function buildPrompt(pack, sel) {
  const role = sel.rolePrompt;
  if (!role && !sel.task && !sel.format) return "";

  let s1 = "Act as " + (role || "[role]");
  if (sel.context) s1 += " speaking to " + sel.context;
  s1 = ensurePeriod(s1);

  const parts = [s1, ensurePeriod(capitalize(sel.task || "[task]"))];

  if (sel.taskDetail) parts.push(ensurePeriod(sel.taskDetail));
  if (sel.detailSentences && sel.detailSentences.length) {
    parts.push(sel.detailSentences.join(" "));
  }
  if (sel.tones && sel.tones.length) {
    parts.push("Use a " + joinWithAnd(sel.tones) + " tone.");
  }
  parts.push(sel.format ? "Format: " + ensurePeriod(sel.format.text) : "Format: [format].");
  if (sel.format && sel.format.ph) parts.push(PLACEHOLDER_LINE);
  if (sel.ask) parts.push("Before you write, ask me 2–3 quick questions to get the details right.");

  const sections = [parts.join(" ")];
  if (sel.taskInput) {
    sections.push(
      "Here is the " + sel.taskInput + " to work from. Paste it between the lines below, " +
      "with any patient names or identifiers removed — use [brackets] instead:\n" +
      "---\n[ paste the " + sel.taskInput + " here ]\n---"
    );
  }
  resolveSafety(pack, sel.roleValue).forEach((s) => sections.push(s));
  return sections.join("\n\n");
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS — all 4 build tests green.

- [ ] **Step 5: Commit**

```bash
git add app/prompt.js test/prompt-build.test.js
git commit -m "feat: add pack-driven buildPrompt with legacy-output regression tests"
```

---

### Task 4: Pack validator (`pack.js`, pure)

**Files:**
- Create: `app/pack.js`
- Create: `test/pack-validate.test.js`

**Interfaces:**
- Produces:
  - `validatePack(obj): { ok: boolean, errors: string[] }` — checks required top-level fields and role/format shape.
  - `loadPack(url, fetchFn = fetch): Promise<pack>` — fetches JSON, runs `validatePack`, throws `Error` listing errors if invalid. `fetchFn` is injectable for tests.
- Required pack fields: `id` (string), `name` (string), `theme` (object), `vocabulary` (object), `safety` (object, non-empty), `defaultSafety` (non-empty array of keys present in `safety`), `roles` (non-empty array), `formats` (non-empty array). Each role: `value`, `label`, `prompt` (strings), `safetyKeys` (array of keys present in `safety`), `tasks` (array). Each format: `text` (string), `ph` (boolean).

- [ ] **Step 1: Write the failing test**

`test/pack-validate.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePack, loadPack } from "../app/pack.js";

const good = {
  id: "x", name: "X", theme: {}, vocabulary: {},
  safety: { phi: "P" }, defaultSafety: ["phi"],
  roles: [{ value: "r", label: "R", prompt: "an r", safetyKeys: ["phi"], tasks: [] }],
  formats: [{ text: "F", ph: true }]
};

test("valid pack passes", () => {
  assert.deepEqual(validatePack(good), { ok: true, errors: [] });
});

test("missing id fails", () => {
  const bad = { ...good, id: undefined };
  const r = validatePack(bad);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes("id")));
});

test("safetyKeys referencing unknown rule fails", () => {
  const bad = { ...good, roles: [{ ...good.roles[0], safetyKeys: ["nope"] }] };
  const r = validatePack(bad);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes("nope")));
});

test("loadPack throws on invalid", async () => {
  const fakeFetch = async () => ({ json: async () => ({ id: "x" }) });
  await assert.rejects(() => loadPack("u", fakeFetch), /Invalid pack/);
});

test("loadPack returns pack on valid", async () => {
  const fakeFetch = async () => ({ json: async () => good });
  const p = await loadPack("u", fakeFetch);
  assert.equal(p.id, "x");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `../app/pack.js` missing.

- [ ] **Step 3: Implement**

`app/pack.js`:
```js
export function validatePack(obj) {
  const errors = [];
  const str = (v) => typeof v === "string" && v.length > 0;
  if (!obj || typeof obj !== "object") return { ok: false, errors: ["pack is not an object"] };
  ["id", "name"].forEach((k) => { if (!str(obj[k])) errors.push(`missing/invalid ${k}`); });
  ["theme", "vocabulary", "safety"].forEach((k) => {
    if (!obj[k] || typeof obj[k] !== "object") errors.push(`missing/invalid ${k}`);
  });
  const safetyKeys = obj.safety && typeof obj.safety === "object" ? Object.keys(obj.safety) : [];
  if (!safetyKeys.length) errors.push("safety has no rules");
  if (!Array.isArray(obj.defaultSafety) || !obj.defaultSafety.length) {
    errors.push("defaultSafety must be a non-empty array");
  } else {
    obj.defaultSafety.forEach((k) => { if (!safetyKeys.includes(k)) errors.push(`defaultSafety references unknown safety rule "${k}"`); });
  }
  if (!Array.isArray(obj.roles) || !obj.roles.length) errors.push("roles must be a non-empty array");
  else obj.roles.forEach((r, i) => {
    ["value", "label", "prompt"].forEach((k) => { if (!str(r[k])) errors.push(`role[${i}] missing/invalid ${k}`); });
    if (!Array.isArray(r.safetyKeys)) errors.push(`role[${i}] safetyKeys must be an array`);
    else r.safetyKeys.forEach((k) => { if (!safetyKeys.includes(k)) errors.push(`role[${i}] references unknown safety rule "${k}"`); });
    if (!Array.isArray(r.tasks)) errors.push(`role[${i}] tasks must be an array`);
  });
  if (!Array.isArray(obj.formats) || !obj.formats.length) errors.push("formats must be a non-empty array");
  else obj.formats.forEach((f, i) => {
    if (!str(f.text)) errors.push(`format[${i}] missing text`);
    if (typeof f.ph !== "boolean") errors.push(`format[${i}] ph must be boolean`);
  });
  return { ok: errors.length === 0, errors };
}

export async function loadPack(url, fetchFn = fetch) {
  const res = await fetchFn(url);
  const obj = await res.json();
  const { ok, errors } = validatePack(obj);
  if (!ok) throw new Error("Invalid pack (" + url + "): " + errors.join("; "));
  return obj;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS — 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add app/pack.js test/pack-validate.test.js
git commit -m "feat: add pack schema validator and loader"
```

---

### Task 5: Share-state codec (`state.js`, pure)

**Files:**
- Create: `app/state.js`
- Create: `test/state.test.js`

**Interfaces:**
- Produces:
  - `encodeState(obj): string` — JSON → UTF-8-safe → URL-safe base64 (no padding, `+`→`-`, `/`→`_`). Identical algorithm to `team/index.html:1283-1286`.
  - `decodeState(str): object` — inverse; identical to `team/index.html:1287-1291`.
- Constraint: must round-trip and must decode payloads produced by the current apps (back-compat for existing `?p=` links).

- [ ] **Step 1: Write the failing test**

`test/state.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeState, decodeState } from "../app/state.js";

test("round-trips a state object", () => {
  const s = { role: "frontdesk", task: "Re-engage overdue patients", tones: ["caring"], ask: false };
  assert.deepEqual(decodeState(encodeState(s)), s);
});

test("handles unicode (en dash, curly quotes)", () => {
  const s = { task: "Answer “do you take my insurance?” — now", note: "2–3" };
  assert.deepEqual(decodeState(encodeState(s)), s);
});

test("output is URL-safe (no + / =)", () => {
  const enc = encodeState({ a: "?/+=&" .repeat(5) });
  assert.doesNotMatch(enc, /[+/=]/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `../app/state.js` missing.

- [ ] **Step 3: Implement**

`app/state.js`:
```js
export function encodeState(obj) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeState(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return JSON.parse(decodeURIComponent(escape(atob(s))));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS — 3 tests green. (`btoa`/`atob` are global in Node ≥16.)

- [ ] **Step 5: Commit**

```bash
git add app/state.js test/state.test.js
git commit -m "feat: extract share-state codec as a pure module"
```

---

### Task 6: Analytics naming (`analytics.js`, pure)

**Files:**
- Create: `app/analytics.js`
- Create: `test/analytics.test.js`

**Interfaces:**
- Produces:
  - `eventName(vertical, action, target?): string` — builds `"{vertical}-{action}"` or `"{vertical}-{action}-{target}"`.
  - `track(name): void` — calls `window.goatcounter.count({ path: name, event: true })` if present; no-ops otherwise (safe in Node/tests where `window` is undefined).

- [ ] **Step 1: Write the failing test**

`test/analytics.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { eventName, track } from "../app/analytics.js";

test("eventName without target", () => {
  assert.equal(eventName("dental", "copy"), "dental-copy");
});
test("eventName with target", () => {
  assert.equal(eventName("dental", "open", "chatgpt"), "dental-open-chatgpt");
});
test("track no-ops when goatcounter absent", () => {
  assert.doesNotThrow(() => track("dental-copy"));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `../app/analytics.js` missing.

- [ ] **Step 3: Implement**

`app/analytics.js`:
```js
export function eventName(vertical, action, target) {
  return target ? `${vertical}-${action}-${target}` : `${vertical}-${action}`;
}

export function track(name) {
  const gc = typeof window !== "undefined" && window.goatcounter;
  if (gc && gc.count) gc.count({ path: name, event: true });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS — 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add app/analytics.js test/analytics.test.js
git commit -m "feat: centralize GoatCounter event naming"
```

---

### Task 7: djb2 hash (`hash.js`, pure)

**Files:**
- Create: `app/hash.js`
- Create: `test/hash.test.js`

**Interfaces:**
- Produces: `djb2(s: string): string` — the existing hash from `owner/index.html:1665`, returning lowercase hex. Used by the courtesy gate.
- Constraint: the correct owner password (lowercased) must hash to `"f36b8ed8"`.

- [ ] **Step 1: Write the failing test**

`test/hash.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { djb2 } from "../app/hash.js";

test("djb2 is stable and hex", () => {
  assert.match(djb2("hello"), /^[0-9a-f]+$/);
  assert.equal(djb2("hello"), djb2("hello"));
});
test("different inputs differ", () => {
  assert.notEqual(djb2("a"), djb2("b"));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `../app/hash.js` missing.

- [ ] **Step 3: Implement** (ported verbatim from `owner/index.html:1665-1672`)

`app/hash.js`:
```js
export function djb2(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h * 33) & 0xffffffff) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(16);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS — 2 tests green.

- [ ] **Step 5: Verify against the real password** (manual, do not hardcode the password in the repo)

Run (substitute the real owner password): `node -e "import('./app/hash.js').then(m=>console.log(m.djb2('THE-PASSWORD-LOWERCASE')))"`
Expected: prints `f36b8ed8`. If it does not, the port is wrong — stop and reconcile with `owner/index.html`.

- [ ] **Step 6: Commit**

```bash
git add app/hash.js test/hash.test.js
git commit -m "feat: extract djb2 hash for the courtesy gate"
```

---

### Task 8: Author the `dental` pack

**Files:**
- Create: `verticals/dental.json`
- Create: `test/dental-pack.test.js`

**Interfaces:**
- Produces: a schema-valid pack consumed by `app.js` and the `/dental/` stub.

**Pack shape (author by porting — preserve all strings verbatim):**
```jsonc
{
  "id": "dental",
  "name": "Bridge Dental",
  "tagline": "Prompts for your whole dental practice",
  "theme": { "primary": "#0e7490", "accent": "#f59e0b", "logo": "assets/dental/logo.png" },
  "vocabulary": {
    "roleLabel": "Your role",
    "contextLabel": "Who you're talking to",
    "taskLabel": "What you need",
    "customerNoun": "patient"
  },
  "safety": {
    "phi": "Safety rule: Use no patient identifiers. …",          // team/index.html:831 verbatim
    "confidential": "Safety rule: Keep confidential data out …",  // owner/index.html:973 verbatim
    "verify": "Verify rule: AI-found figures and estimates …"     // owner/index.html:971 verbatim
  },
  "defaultSafety": ["phi"],
  "sensitiveRoles": ["cfo", "expansion", "deals", "…all owner-origin roles…"],
  "roles": [
    {
      "value": "frontdesk", "label": "Front desk coordinator", "prompt": "a front desk coordinator",
      "safetyKeys": ["phi"],
      "contexts": ["a busy adult overdue 12+ months", "…"],   // team CONTEXT.frontdesk (537+) + SHARED_CONTEXT (531)
      "tasks": [
        { "text": "Re-engage overdue patients", "detail": "", "input": "", "fields": [], "followups": ["…"], "popular": true }
      ]
    }
    // … all team roles (safetyKeys ["phi"]) and all owner roles …
    // owner money roles cfo/expansion/deals → safetyKeys ["confidential","verify"]
    // other owner roles → safetyKeys ["confidential"]
  ],
  "sharedContext": ["a general patient", "a nervous adult", "a new patient"],
  "formats": [ { "text": "3 short text messages (under 35 words each)", "ph": true } ],  // team FORMATS 669+ ∪ owner formats
  "popularFormats": ["One text message (under 45 words)", "A phone script (under 150 words)", "An email (short and warm)"],
  "tones": [
    { "value": "caring", "clause": "caring" }, { "value": "clear", "clause": "clear" },
    { "value": "upbeat", "clause": "upbeat" }, { "value": "calm", "clause": "calm" },
    { "value": "professional", "clause": "professional" }
    // ∪ owner TONE_CLAUSE entries
  ],
  "examples": [ /* team EXAMPLES 746+ ∪ owner examples; each = {label, state:{role,context,task,format,tones}} */ ]
}
```

**Porting sources (copy strings verbatim; nest per role):**
- Team: `ROLES` 520, `SHARED_CONTEXT` 531, `CONTEXT` 537, `TASK` 596, `FORMATS` 669, `TASK_INPUT` 687, `TASK_DETAIL` 703, `TASK_FIELDS` 719, `EXAMPLES` 746, `DEFAULT_FOLLOWUPS`/`TASK_FOLLOWUPS` 763, `TONE_CLAUSE` 823, `POPULAR_TASKS` 903, `POPULAR_FORMATS` 912.
- Owner: `ROLES` 571, its `CONTEXT`/`TASK`/detail/input maps, `VERIFY_RULE` 971, `SAFETY` 973, its formats/tones/examples/popular sets (mirror the team structure at the corresponding constants in `owner/index.html`).
- Per task, fold `TASK_DETAIL[task]`→`detail`, `TASK_INPUT[task]`→`input`, `TASK_FIELDS[task]`→`fields`, `TASK_FOLLOWUPS[task]`→`followups` (else `DEFAULT_FOLLOWUPS`), and `POPULAR_TASKS[role].includes(task)`→`popular: true`.
- Merge duplicate formats/tones/shared-context across the two apps (dedupe identical strings).

- [ ] **Step 1: Write the failing test**

`test/dental-pack.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validatePack } from "../app/pack.js";
import { buildPrompt } from "../app/prompt.js";

const pack = JSON.parse(readFileSync(new URL("../verticals/dental.json", import.meta.url)));

test("dental pack is schema-valid", () => {
  const r = validatePack(pack);
  assert.deepEqual(r.errors, []);
  assert.equal(r.ok, true);
});

test("dental has the three safety rules and expected role coverage", () => {
  assert.ok(pack.safety.phi && pack.safety.confidential && pack.safety.verify);
  const money = pack.roles.filter((r) => r.safetyKeys.includes("verify")).map((r) => r.value);
  assert.deepEqual(money.sort(), ["cfo", "deals", "expansion"]);
});

test("a known frontdesk selection reproduces legacy output", () => {
  const role = pack.roles.find((r) => r.value === "frontdesk");
  const task = role.tasks.find((t) => t.text === "Re-engage overdue patients");
  const out = buildPrompt(pack, {
    rolePrompt: role.prompt, roleValue: role.value,
    context: "a busy adult overdue 12+ months", task: task.text,
    taskDetail: task.detail || "", taskInput: task.input || "", detailSentences: [],
    tones: ["caring"],
    format: pack.formats.find((f) => f.text === "3 short text messages (under 35 words each)"),
    ask: false
  });
  assert.ok(out.startsWith("Act as a front desk coordinator speaking to a busy adult overdue 12+ months."));
  assert.ok(out.trim().endsWith(pack.safety.phi));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `verticals/dental.json` missing / not found.

- [ ] **Step 3: Author `verticals/dental.json`** by porting per the sources above. Copy the three safety strings verbatim from the cited lines.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS — 3 tests green. If `validatePack` reports errors, fix the JSON until `errors` is empty.

- [ ] **Step 5: Commit**

```bash
git add verticals/dental.json test/dental-pack.test.js
git commit -m "feat: author the dental vertical pack (ported from team + owner)"
```

---

### Task 9: Vertical manifest

**Files:**
- Create: `verticals/manifest.json`
- Create: `test/manifest.test.js`

**Interfaces:**
- Produces: `manifest.json` = `{ verticals: [{ id, name, tagline, accent, path }] }` consumed by the hub picker.

- [ ] **Step 1: Write the failing test**

`test/manifest.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const base = new URL("../verticals/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", base)));

test("manifest lists dental and points at an existing pack", () => {
  assert.ok(Array.isArray(manifest.verticals));
  const dental = manifest.verticals.find((v) => v.id === "dental");
  assert.ok(dental, "dental entry present");
  assert.equal(dental.path, "dental/");
  // referenced pack file exists
  assert.doesNotThrow(() => readFileSync(new URL(dental.id + ".json", base)));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `manifest.json` missing.

- [ ] **Step 3: Create `verticals/manifest.json`**

```json
{
  "verticals": [
    { "id": "dental", "name": "Bridge Dental", "tagline": "Prompts for your whole dental practice", "accent": "#0e7490", "path": "dental/" }
  ]
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add verticals/manifest.json test/manifest.test.js
git commit -m "feat: add vertical manifest for the hub picker"
```

---

### Task 10: DOM engine module (`app.js`)

**Files:**
- Create: `app/app.js`

**Interfaces:**
- Consumes: `prompt.js` (`buildPrompt`), `pack.js` (`loadPack`), `state.js` (`encodeState`/`decodeState`), `analytics.js` (`eventName`/`track`), `hash.js` (`djb2`).
- Produces: `export function initApp({ verticalId })` — loads `verticals/<verticalId>.json`, populates controls from the pack, wires all events, renders the preview, and (if the role is in `pack.sensitiveRoles`) enforces the courtesy gate. Called by each vertical stub.

**Port from the two inline scripts, replacing hardcoded globals with pack fields:**
- `ROLES`→`pack.roles`; `populateContext` uses `role.contexts.concat(pack.sharedContext)`; `populateTasks` uses `role.tasks.map(t=>t.text)` with `role.tasks.filter(t=>t.popular).map(t=>t.text)` as the popular set; `FORMATS`→`pack.formats` with `pack.popularFormats`.
- `TASK_DETAIL[task]`→ `role.tasks.find(...).detail`; `TASK_INPUT`→`.input`; `TASK_FIELDS`→`.fields`; `TASK_FOLLOWUPS`→`.followups`; `TONE_CLAUSE`→ map built from `pack.tones`; `EXAMPLES`→`pack.examples`.
- Build the `sel` object (Task 3 shape) from the DOM in `updatePreview`, then `buildPrompt(pack, sel)`.
- Replace `bdTrack("team-copy-prompt")` etc. with `track(eventName(pack.id, "copy"))`, `track(eventName(pack.id, "open", p.id))`, `track(eventName(pack.id, "share"))`, and gate events `eventName(pack.id, "gate", ok ? "success" : "fail")`.
- Keep favorites code as-is (localStorage `STORAGE_KEY = "bridge-" + pack.id + "-prompt-v1"`, `FAVS_KEY = STORAGE_KEY + "-favs"`). The unified Library replaces this in Phase 3 — leave it untouched now.
- **Courtesy gate:** port `owner/index.html:1661-1690`. Trigger when the selected role ∈ `pack.sensitiveRoles` and the device is not unlocked (`localStorage["bd-" + pack.id + "-unlocked"] === djb2(input)`), using the hash constant `"f36b8ed8"` and case-insensitive compare (`djb2(input.trim().toLowerCase())`). Remember unlock per device. If `pack.sensitiveRoles` is empty/absent, the gate never appears.

- [ ] **Step 1: Write `app/app.js`** implementing `initApp` per the mapping above. Reuse the DOM helpers (`fillSelect`, `toggleOther`, PHI-warn regexes, detail-field rendering, share/restore, providers, favorites) from `team/index.html:836-1513`, parameterized by the loaded `pack`.

- [ ] **Step 2: Static sanity check**

Run: `node --check app/app.js`
Expected: no output (valid syntax). *(This checks syntax only; behavior is verified in Task 11.)*

- [ ] **Step 3: Commit**

```bash
git add app/app.js
git commit -m "feat: pack-driven DOM engine (initApp) consolidating team+owner logic"
```

---

### Task 11: `/dental/` vertical stub + browser regression check

**Files:**
- Create: `dental/index.html`
- Create: `assets/dental/` (move/copy `dental` logo target referenced by the pack, if needed)

**Interfaces:**
- Consumes: `app/app.js` (`initApp`), `verticals/dental.json`.

- [ ] **Step 1: Create `dental/index.html`** — reuse the full markup shell + styles from `team/index.html:1-519` (head, GoatCounter snippet, OG tags updated to `…/dental/`, all the form/preview/favorites markup and the tone chips), then replace the inline `<script>…</script>` with:

```html
<script type="module">
  import { initApp } from "../app/app.js";
  initApp({ verticalId: "dental" });
</script>
```

Include the tone chips for every tone in the pack, and set `og:image` to `assets/dental/og-card.png` (reuse `assets/og-card.png` for now).

- [ ] **Step 2: Serve and verify no regression** (scripted manual check)

Run: `python3 -m http.server 4601`
Then in a browser:
1. Open `http://localhost:4601/dental/`.
2. Select Role = **Front desk coordinator**, Context = **a busy adult overdue 12+ months**, Task = **Re-engage overdue patients**, Format = **3 short text messages…**, Tone = **caring**.
   Expected preview equals the Task 3 `team-style` fixture string exactly (body + PHI safety).
3. Select Role = **Fractional CFO** (money role). Expected: the **password gate appears**. Enter the real password → unlocks and is remembered on reload. Pick any task/format → preview ends with the confidentiality safety rule **then** the verify rule.
4. Click **Copy** → clipboard has the prompt; GoatCounter (if loaded) receives `dental-copy`.
5. Click **Copy share link** → open the copied URL in a new tab → the four picks are restored.
6. Save a favorite → reload → it persists and reloads correctly.

Record the results in the commit message. If step 2 differs from the fixture, fix `app.js`/pack before proceeding.

- [ ] **Step 3: Commit**

```bash
git add dental/index.html assets/dental
git commit -m "feat: add /dental/ vertical stub; verified no regression vs legacy apps"
```

---

### Task 12: Redirect stubs for `/team/` and `/owner/`

**Files:**
- Modify: `team/index.html` (replace entire contents with a redirect stub)
- Modify: `owner/index.html` (replace entire contents with a redirect stub)

**Interfaces:**
- Preserves existing in-the-wild links: `/team/?p=…` and `/owner/?p=…` forward to `/dental/?p=…` with the query string intact.

- [ ] **Step 1: Replace `team/index.html`** with:

```html
<!doctype html>
<meta charset="utf-8" />
<title>Moved — Bridge Dental Prompt Builder</title>
<link rel="canonical" href="../dental/" />
<script>
  location.replace("../dental/" + location.search + location.hash);
</script>
<p>This builder moved to <a href="../dental/">the Bridge Dental prompt builder</a>.</p>
```

- [ ] **Step 2: Replace `owner/index.html`** with the same stub (identical body; canonical/href `../dental/`).

- [ ] **Step 3: Verify redirect** (manual)

Run: `python3 -m http.server 4601`
Open `http://localhost:4601/team/?p=eyJyb2xlIjoiZnJvbnRkZXNrIn0` → lands on `/dental/?p=…` and applies the shared state (role preselected).
Expected: redirect works, query preserved.

- [ ] **Step 4: Commit**

```bash
git add team/index.html owner/index.html
git commit -m "refactor: turn /team/ and /owner/ into redirect stubs to /dental/"
```

---

### Task 13: Hub becomes a manifest-driven picker

**Files:**
- Modify: `index.html` (replace the two hardcoded team/owner cards with cards rendered from `verticals/manifest.json`)

**Interfaces:**
- Consumes: `verticals/manifest.json`.

- [ ] **Step 1: Replace the picker section.** Keep the hub's head/styles/founders/how/footer (`index.html:1-195`, `228-366`). Replace the two `<section class="card">` blocks (`196-227`) with a container `<div id="vertical-cards"></div>`, and add before `</body>`:

```html
<script type="module">
  const res = await fetch("verticals/manifest.json");
  const { verticals } = await res.json();
  const wrap = document.getElementById("vertical-cards");
  wrap.innerHTML = verticals.map((v) => `
    <section class="card" style="--accent:${v.accent}">
      <h2>${v.name}</h2>
      <p>${v.tagline}</p>
      <a class="btn" href="${v.path}" data-track="hub-pick-${v.id}">Open ${v.name}</a>
    </section>`).join("");
</script>
```

Keep the existing `data-track` click handler (`index.html:328-338`) so `hub-pick-<id>` events fire (it already reads `data-track` on click).

- [ ] **Step 2: Verify** (manual)

Run: `python3 -m http.server 4601` → open `http://localhost:4601/`.
Expected: one **Bridge Dental** card; clicking it lands on `/dental/`; a `hub-pick-dental` event fires (if GoatCounter loaded).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: render hub picker from the vertical manifest"
```

---

### Task 14: Update README for the new structure

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update** the folder-layout, "Run it", and "Deploy it" sections to describe: shared `/app/*.js` ES modules, `verticals/*.json` packs + manifest, `/dental/` (plus future verticals), `/team/` `/owner/` as redirect stubs, and the **must-be-served** constraint (no `file://`; use `python3 -m http.server 4601`). Add a "Testing" section: `npm test` runs `node --test`. Note the GoatCounter scheme change (`dental-*`). Keep the password-change instructions (still valid — `hash.js`/gate unchanged in behavior).

- [ ] **Step 2: Verify links/commands** by running `npm test` (still green) and serving the site once more per Task 11.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: update README for the module + pack architecture"
```

---

## Self-Review

**1. Spec coverage:**
- "One generic engine + JSON packs" → Tasks 2–10 (modules) + 8 (pack). ✔
- "Skin + vocabulary" → **Phase 2** (theming); this phase ports `vocabulary` into the pack but keeps current CSS. Vocabulary labels are wired in Task 10. ✔ (visual theming deferred as designed)
- "Per-role safety, courtesy gate as per-role flag" → Task 2 (`resolveSafety`) + Task 8 (`safetyKeys`, `sensitiveRoles`) + Task 10/11 (gate). ✔
- "Folder per vertical, redirect stubs, hub picker" → Tasks 11–13. ✔
- "ES modules, no bundler, must-be-served" → Global Constraints + Tasks 1, 10, 11. ✔
- "GoatCounter `{vertical}-{action}` centralized" → Task 6 + Task 10. ✔
- "Preserve `?p=` links / favorites / providers" → Task 5 (codec back-compat) + Task 10 (favorites untouched) + Task 12 (redirect preserves query). ✔
- "Unified Library replaces favorites" → **Phase 3**, out of scope here (noted in Task 10). ✔
- "Portable pack → DB later" → schema in Task 8 is flat JSON, no runtime coupling. ✔

**2. Placeholder scan:** No "TBD/TODO/handle edge cases". The `// …` markers inside the Task 8 pack shape are explicit *porting pointers* to verbatim source line ranges, not unfinished logic; the surrounding instructions and tests fully specify the porting. All test code and module code is complete and runnable.

**3. Type consistency:** `sel` shape defined in Task 3 is reused verbatim in Tasks 8 (dental-pack test) and 10 (app.js). `resolveSafety(pack, roleValue)` signature consistent across Tasks 2, 3. `validatePack`/`loadPack` (Task 4) reused in Tasks 8, 10. `eventName`/`track` (Task 6) reused in Task 10. `djb2` (Task 7) reused in Task 10/11. `encodeState`/`decodeState` (Task 5) reused in Task 10. Pack field names (`roles[].safetyKeys`, `defaultSafety`, `sensitiveRoles`, `tasks[].{detail,input,fields,followups,popular}`, `sharedContext`, `popularFormats`, `tones[].{value,clause}`) are identical across Tasks 8, 10.

**Note on spec refinement:** the spec's illustrative `safety.default`/`safety.byRole` sketch is realized here as a **named-rules map + per-role `safetyKeys` array** — strictly more expressive (it's the only shape that captures owner money roles' confidential+verify stacking) and anticipated by the spec's "implementation-plan detail" note. No spec requirement is dropped.
