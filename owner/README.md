# Bridge Dental Owner & Operator Prompt Generator

A confidential-safe, single-page tool that helps a **dental practice owner or operations leader** assemble a strong AI
prompt from four picks — **Expert → Situation → Task → Format**. The app writes a clean,
copy-ready prompt you run in your own AI tool (ChatGPT, Claude, Gemini, Grok). A confidential-data
safety rule is baked into every prompt automatically, so sensitive numbers never have to be typed.

It's the owner/operator companion to the patient-facing `../team/` (which uses the same
RCTF engine but is aimed at staff writing to patients). This one is aimed at running the business:
auditing statements, reviewing a P&L, vetting a location, comparing vendors, planning growth.

## Run it

No backend, no build step, no dependencies.

**Just open the file:** `owner/index.html` — double-click it, or open in any
modern browser. Keep the `assets/` folder (the Bridge Dental logo) next to it.

> Or use a local server: `python3 -m http.server 4601` and visit
> http://localhost:4601. (This is also wired into the app's play button via `.claude/launch.json`.)

## How it works

1. **Expert** — which advisor the AI should act as: Fractional CFO · Expansion analyst
   (locations & startups) · Acquisition & deal advisor (buying & financing) · Operations & HR
   consultant · Marketing & growth strategist · Business coach.
2. **Situation** — the state of the practice (optional; sharpens the answer). Filters by Expert.
3. **Task** — the specific analysis or plan. Filters by Expert.
4. **Format** — how the answer should be shaped (table, action plan, go/no-go, checklist, etc.).

Every dropdown has an **"Other…"** option that reveals a free-text box, used verbatim in the prompt.
The **preview** updates live and stitches the picks into one instruction, then appends the safety rule.

### Quick-start examples, detail fields, and share links

- **Try an example** — five one-click starters at the top ("Audit my card statements",
  "Vet a second location", "Vision organizer", "Morning huddle scorecard",
  "Standardize supply ordering") fill all four picks instantly. The last two speak to
  operations managers in larger practices.
- **Add details (optional)** — tasks that benefit from specifics (location, budget, equipment,
  patient counts…) reveal a small panel under the Task dropdown; filled values are woven into
  the prompt as sentences ("The area under consideration is Frisco, TX."). The per-task field
  definitions live in the `TASK_FIELDS` map in `index.html`. Detail inputs get the same
  non-blocking confidential-data warning as "Other…" boxes.
- **Copy share link** — copies a URL that reopens the app with the current picks (and details)
  pre-filled, so you can text a ready-made prompt setup to a partner or colleague. State is
  encoded in a `?p=` parameter; nothing is stored anywhere. Works best once the app is hosted
  (e.g. GitHub Pages) — a `file://` link only works on the same computer.

**Generate** enables once Expert, Task, and Format have a value (Situation is optional).
**Copy prompt** copies the full prompt with a "Copied!" confirmation. The **ChatGPT / Claude /
Gemini / Grok** buttons copy the prompt and open that tool with it pre-filled where supported
(Gemini opens with the prompt on your clipboard — just paste).

### Document tasks (attach or paste)

Most owner tasks start from a document (statements, P&L, invoice, A/R report). Those tasks add a
clearly marked block telling you to **attach the file in your AI tool, or paste it between the
lines**, after redacting anything confidential:

```
Attach the profit & loss statement (P&L) in your AI tool, or paste it between the lines below.
First remove anything confidential — account or card numbers, patient names, individual employee
pay, bank details — or replace it with [brackets]:
---
[ attach or paste the profit & loss statement (P&L) here ]
---
```

The set of document tasks and their labels lives in the `TASK_INPUT` map in `index.html`.

### Research tasks (need a web-connected tool)

A few tasks — evaluating a second location, screening Crexi/LoopNet properties, comparing supply
vendors — need the AI to look things up. Those add a note: *"Use a web-connected AI tool for this
(ChatGPT with search, Gemini, Grok, or Claude with web)."* Results still vary by tool. The set is
the `TASK_RESEARCH` map.

### Vision organizer

Under **Business coach**, the *Vision organizer* task builds a prompt that has the AI **interview
you** — asking what you really want (time, money, freedom, meaning), then handing back a prioritized
action list. Extra per-task instructions like this live in the `TASK_DETAIL` map.

## Confidential-data guardrails

- The app **never asks for, displays, or stores** sensitive data. There are no data-entry fields
  for it.
- A persistent **"Confidential-safe by design"** badge sits in the header.
- The **safety-rule block is appended to every prompt automatically and cannot be removed.**
- Money and deal experts (CFO, Expansion, Acquisition) also get an automatic **verify rule**:
  AI figures are a starting point — confirm against primary sources, and with your CPA and
  attorney, before any offer, purchase, or filing.
- Each "Other…" box reminds you to redact account/card numbers, patient names, and pay, or use
  `[brackets]`.
- A lightweight, **client-side warning** fires (non-blocking) if an "Other…" box looks like it
  contains a real identifier — a long number (account/card), a card/SSN/EIN pattern, an email, a
  phone number, or a date. It warns; it never blocks. Text inside `[brackets]` is ignored.
- **Everything stays in the browser.** The only persistence is `localStorage` (it remembers your
  last picks). The prompt leaves only when you click one of the "Open in…" buttons — and by design
  it carries placeholders, not sensitive data.

## Accessibility & responsiveness

Real `<label>`s on every control, keyboard-navigable, visible rose focus rings, mobile-first and
fully responsive, honors `prefers-reduced-motion`.

## Brand

Built to the Bridge Dental design system — rose as the single action color, Poppins headings with
the eyebrow device, Mulish body, soft radii and hairline borders, the navy→plum→magenta hero band
with the reversed white logo.
