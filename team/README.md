# Bridge Dental Prompt Generator

A PHI-safe, single-page tool that helps a dental-office team member assemble a strong AI
prompt from four cascading picks using the **RCTF** framework — **R**ole → **C**ontext →
**T**ask → **F**ormat. The app writes a clean, copy-ready prompt you paste into your own AI
tool (ChatGPT, Claude, Gemini). A PHI-safety rule is baked into every prompt automatically,
so no protected health information ever needs to be typed.

## Run it

No backend, no build step, no dependencies.

**Just open the file:**

```
team/index.html
```

Double-click `index.html`, or open it in any modern browser. The `assets/` folder (the Bridge
Dental logo) must stay next to it.

> Tip: if you prefer a local server (so the font/logo load over http), run any static server
> from this folder, e.g. `python3 -m http.server` and visit http://localhost:8000.

## How it works

1. **Role** — who the AI should act as.
2. **Context** — who they're talking to / the situation. Options filter by the chosen Role
   (with a few shared options always available). Optional, but encouraged.
3. **Task** — the specific job. Options filter by the chosen Role.
4. **Format** — how the answer should be shaped (shared across roles).

Every dropdown has an **"Other…"** option that reveals a free-text box so you can type your
own value, used verbatim in the prompt.

The **preview** updates live and stitches your picks into one grammatical instruction, then
appends the safety rule:

```
Act as a front desk coordinator speaking to a busy adult overdue 12+ months. Re-engage
overdue patients. Use a caring tone. Format: 3 short text messages (under 35 words each).
Where a specific detail is needed, leave fill-in-the-blanks like [first name], [date],
[time], [booking link], or [practice name].

Safety rule: Use no patient identifiers. Never include patient names, dates of birth,
addresses, phone numbers, chart/account numbers, or insurance IDs — leave
fill-in-the-blanks like [first name] or [date] instead. This output is a first draft; review it before anyone (especially a
patient) sees it.
```

### Paste blocks for tasks that need source material

Some tasks can't be written without something to work from — responding to a review, turning
the doctor's shorthand into a note, summarizing a treatment plan, fixing a messy process into
an SOP, and so on. For those, the prompt adds a clearly marked paste section with a de-identify
reminder, so the user pastes the de-identified source in before sending it to their AI tool:

```
Here is the negative review to work from. Paste it between the lines below, with any patient
names or identifiers removed — use fill-in-the-blanks like [first name] instead:
---
[ paste the negative review here ]
---
```

This block only appears for tasks that need it; purely generative tasks (e.g. "Re-engage
overdue patients") don't get one. The set of tasks that trigger it lives in the `TASK_INPUT`
map in `index.html`.

### Quick-start examples, detail fields, and share links

- **Try an example** — three one-click starters at the top ("Re-engage overdue patients",
  "Handle sticker shock", "Reply to a negative review") fill all four picks instantly.
- **Add details (optional)** — tasks that benefit from specifics (procedure name, job position,
  open slot…) reveal a small panel under the Task dropdown; filled values are woven into the
  prompt ("The procedure is an extraction."). Definitions live in the `TASK_FIELDS` map in
  `index.html`; post-op instructions and explain-a-treatment use these instead of a paste block.
  Detail inputs get the same non-blocking PHI warning as "Other…" boxes.
- **Copy share link** — copies a URL that reopens the app with the current picks (and details)
  pre-filled, so you can text a ready-made prompt setup to a teammate. State is encoded in a
  `?p=` parameter; nothing is stored anywhere. Works best once the app is hosted (e.g. GitHub
  Pages) — a `file://` link only works on the same computer.

**Generate** is enabled once Role, Task, and Format have a value (Context is optional).
**Copy prompt** copies the full prompt and confirms with a "Copied!" state.

### Open it in your AI tool

Under the prompt is a row of one-click buttons — **ChatGPT, Claude, Gemini, Grok**. Clicking one:

1. copies the prompt to your clipboard (works for every tool), then
2. opens that tool in a new tab with the prompt **pre-filled** where the tool supports it
   (ChatGPT, Claude, and Grok accept a `?q=` URL parameter; Gemini has no reliable prefill
   param, so it opens with the prompt already on your clipboard — just paste).

A short status line confirms what happened. The prompt only ever leaves the browser at the
moment you click one of these buttons — and because the tool is PHI-safe by design, what
leaves contains placeholders, never patient data. The provider list lives in the `PROVIDERS`
array in `index.html`, so it's easy to add or change tools/URLs as their prefill support evolves.

### Optional polish
- **Tone chips** (Caring · Clear · Upbeat · Calm · Professional) — pick any number; a tone
  clause is injected into the prompt.
- **"Ask me 2–3 quick questions first"** toggle — appends that instruction (great for scripts
  and handouts).
- **Reset** clears everything.

## PHI guardrails (the product's reason to exist)

- The app **never asks for, displays, or stores PHI**. There are no patient-data fields.
- A persistent **"PHI-safe by design"** badge sits in the header.
- The **safety-rule block is appended to every prompt automatically and cannot be removed.**
- Each "Other…" box carries a reminder to swap patient detail for a fill-in-the-blank like `[first name]`.
- A lightweight, **client-side PHI warning** fires (non-blocking) if an "Other…" box looks
  like it contains a real identifier — a date (`MM/DD/YYYY`), a 7+ digit number, an email, or
  a phone-number pattern. It warns; it never blocks. Text already inside a fill-in-the-blank like `[first name]` is
  ignored so blanks don't trigger it.
- **Everything stays in the browser.** The only persistence is `localStorage` (it remembers
  your last selections); nothing is sent anywhere.

## Accessibility & responsiveness

- Real `<label>`s tied to every control, keyboard-navigable, visible rose focus rings.
- Mobile-first and fully responsive; thumb-friendly dropdowns and buttons.
- Honors `prefers-reduced-motion`.

## Brand

Built to the Bridge Dental design system — rose as the single action color, Poppins headings
with the eyebrow device, Mulish body, soft radii and hairline borders, the navy→plum→magenta
hero band with the reversed white logo.

## Assumptions

- **Context connector:** the template shows `Act as {ROLE} {CONTEXT}`. To keep it grammatical,
  context is rendered as `speaking to {context}` (e.g. "Act as a front desk coordinator
  *speaking to* a busy adult overdue 12+ months").
- **Shared contexts** ("a general patient", "a nervous adult", "a new patient") are appended to
  every role's context list, alongside the role-specific ones.
- **Placeholder hint:** the fill-in-the-blank encouragement line is added only for formats
  that imply names/dates/links (messages, emails, scripts, handouts, review replies, social,
  content tables) — not for SOPs, checklists, or plain bullets.
- **Multiple tones** can be selected; they're combined into one natural clause
  (e.g. "Use a caring and clear tone").
