# Bridge Dental Prompt Builders

One deployable folder containing the landing page and both prompt-builder apps:

```
bridge-prompts/
├── index.html        ← landing page (choose team or owner)
├── team/             ← patient-communication prompts (PHI-safe)
│   ├── index.html
│   └── README.md     ← full feature docs for the team builder
├── owner/            ← owner & operator prompts (confidential-safe)
│   ├── index.html
│   └── README.md     ← full feature docs for the owner builder
└── assets/           ← shared Bridge Dental logos
```

No backend, no build step, no dependencies. Each app is a single self-contained HTML file.

## Run it

- **Just open it:** double-click `index.html` (the folder structure must stay intact).
- **Local server:** `python3 -m http.server 4601 --directory bridge-prompts` →
  http://localhost:4601 (also wired to the play button via `.claude/launch.json`).

## Deploy it (GitHub Pages)

Upload the **contents** of this folder (`index.html`, `team/`, `owner/`, `assets/`) to a
GitHub repo and enable Pages. You get one URL to share:

- `https://<user>.github.io/<repo>/` — the landing page
- `…/team/` — the team builder
- `…/owner/` — the owner builder

Share links (`?p=…`) and the hub breadcrumbs work automatically under this layout.

## What's inside each app

Both share the same engine: four cascading RCTF picks → live prompt preview → Copy /
open-in-ChatGPT/Claude/Gemini/Grok, plus quick-start examples, optional per-task detail
fields, share links, follow-up suggestions after copying, and saved favorites (localStorage).
Task and Format dropdowns open with a **"★ Most popular"** group above the full list —
the curated sets live in `POPULAR_TASKS` / `POPULAR_FORMATS` in each app's `index.html`;
update them from GoatCounter task data once real usage accumulates.

The team builder opens with a **one-tap "Everyday tasks" tray** — the 6–8 highest-frequency
front-desk/chairside jobs (fill a cancellation, confirm tomorrow, re-engage overdue, insurance
question, ask for a review, balance reminder, calm an upset caller, explain a deep cleaning).
One tap fills all four picks, ready to copy; the full builder below covers the custom cases.
The set lives in the `EXAMPLES` array in `team/index.html`.

Both builders open with a **"Make prompts sound like your office" practice profile** — a
quick, one-time onboarding at the top of the page. A practice fills in its own details once
(office name, doctor(s), phone, website, online booking link, address, office hours, Google
review link, and a sign-off) and every prompt is then personalized two ways: the office's own
fill-in-the-blanks (`[practice name]`, `[phone]`, `[website]`, `[booking link]`, `[address]`,
`[office hours]`, `[review link]`, and common variants) are swapped for the real values, and a
short **"Practice details you can use directly"** reference block is appended above the safety
rule so the AI uses them wherever a message needs them. **Patient / confidential blanks are
never touched** — `[first name]`, `[date]`, `[account #]`, etc. always stay blank. Details are
saved on-device under the shared `bd-practice-v1` key, so they're entered **once** and reused
across both builders. The card collapses to summary chips with Edit / Clear all. Field list and
placeholder matching live in `PROFILE_FIELDS` / `fillPracticePlaceholders()` in each `index.html`.

Both builders have a **guided tour** — a spotlight walkthrough of every step with a
recommendation per stop (hand-rolled, no libraries). It launches from the "Take the
60-second tour" button in the hero, and first-time visitors get a one-time dismissible
toast offering it (never re-shown once dismissed).
Esc exits, arrow keys navigate. `{page}-tour-start / -complete / -skip` events land in
GoatCounter, so completion rates are measurable. Step copy lives in the `STEPS` array in
each app's tour script.

The **"Ask me 2–3 quick questions first" toggle auto-checks** for tasks where clarifying
questions pay off (scripts, handouts, SOPs, plans, tough conversations — and all custom
"Other…" tasks) and stays off for quick single-output tasks; the user can always flip it.
The curated sets live in `ASK_FIRST` in each app's `index.html`.

The assembled **prompt is an editable text box** — users can tweak it before copying or
sending. Hand edits stick until a pick changes (or Generate is hit), which rebuilds it.
The safety rule (and the owner builder's verify rule for money roles) is silently
re-appended on copy/send if an edit removed it. Document tasks (reviews, shorthand, P&L…)
show a **paste panel under Task** that weaves the pasted text straight into the prompt —
important because ChatGPT/Gemini/Grok run a prefilled prompt immediately on open. If a
prompt still contains an empty `[ paste/attach … ]` slot, the provider buttons warn on the
first click and open on the second. Pasted document text is never saved to localStorage.
A non-removable safety rule is appended to every prompt — PHI-focused in `team/`,
confidential-data-focused in `owner/` (money & deal experts also get a CPA/attorney
verify rule). Task content is curated from the practice's own prompt vaults —
~50 owner tasks across six experts and ~55 team tasks. See each app's README for details.

This folder is the single home for both apps — the original standalone folders
(`prompt-generator/`, `owner-prompt-generator/`) were retired into it in July 2026.

## Growth plumbing (added July 2026)

### Analytics — GoatCounter (one setup step required)
All three pages carry a privacy-friendly [GoatCounter](https://www.goatcounter.com) snippet
(no cookies, no consent banner, prompt content never touched). Pageviews are automatic;
custom events fire on the actions that matter:
`team-copy-prompt`, `team-open-<chatgpt|claude|gemini|grok>`, same for `owner-…`,
`hub-open-team`, `hub-open-owner`, and `…-outbound-bridgedental` (footer link clicks).

The dashboard lives at **https://bridgedental.goatcounter.com** (site code `bridgedental`
— the snippet in each page must match it). If the script is blocked or unreachable, the
snippet quietly no-ops; nothing breaks.

### Social sharing
Every page has Open Graph / Twitter meta tags pointing at `assets/og-card.png` (1200×630),
so links shared in Facebook groups, LinkedIn, or texts render a branded card. The image
URLs are absolute (`https://stevegdove.github.io/DentalPromptGenerator/...`) — update them
if the site moves to a custom domain. After deploying changes, paste the URL into a share
debugger (e.g. LinkedIn Post Inspector) to refresh the cached preview.

### Custom domain (recommended): prompts.bridgedental.ai
1. In the DNS for bridgedental.ai, add a **CNAME** record: `prompts` → `stevegdove.github.io`.
2. In the GitHub repo → Settings → Pages → **Custom domain**, enter
   `prompts.bridgedental.ai`, save, and tick **Enforce HTTPS** once the check passes.
3. Update the `og:url` / `og:image` absolute URLs in all three HTML files to the new domain.

### Email capture (hidden until enabled)
The hub has a "Get new prompts monthly" card that is **hidden by default**. To enable:
create a free form endpoint (e.g. formspree.io), then set `FORM_ENDPOINT` in the script at
the bottom of `index.html` to its POST URL. The builders themselves are never gated.

## Installable app (PWA, added July 2026)

The whole site is an installable Progressive Web App — visitors can add it to the
home screen on **iPhone (Safari)** and **Android (Chrome/Edge)** and it launches
full-screen, works offline, and shows the Bridge bridge-mark icon. Still no build
step: it's four plain files plus icons.

- `manifest.webmanifest` (root) — app name, colors, and icons. All paths are
  **relative** (`start_url: "."`, `scope: "./"`), so the same files work on the
  GitHub Pages subpath today *and* on `prompts.bridgedental.ai` later with no edits.
- `service-worker.js` (root) — offline shell. **Network-first for HTML** so prompt
  and content edits ship immediately (users never get stuck on a stale page),
  stale-while-revalidate for images, cache-first for Google Fonts. Bump
  `CACHE_VERSION` at the top when you change the SW to retire old caches.
- `assets/pwa-install.js` — registers the SW and shows the custom install prompt.
  Included on all three pages; it self-resolves the app root from its own URL.
- `assets/icons/…` — the icon set (192/512 standard + maskable, and a 180px
  apple-touch-icon), generated from `assets/bridge-logo-color.png`.

### The install prompt ("after brief usage")
A branded bottom banner appears only **after the visitor has actually used a
tool** — never on first paint. It opens when any of these is true (tracked in
`localStorage`): they copied a prompt or opened a provider tab, **or** they've
viewed 2+ pages, **or** they've spent ~45s on a page.

- **Android/Chromium** uses the native `beforeinstallprompt` flow — the banner's
  **Install** button triggers the real OS install sheet.
- **iPhone/iPad Safari** has no install event, so the banner shows the manual
  steps instead: *tap Share → Add to Home Screen*.
- **Anti-nag:** never shown once installed, dismissal snoozes for 14 days, hard
  cap of 3 lifetime shows.

### Analytics
The install funnel lands in GoatCounter alongside the existing events:
`pwa-prompt-shown`, `pwa-install-accepted`, `pwa-install-dismissed`,
`pwa-installed`, and `pwa-launch` (fired when the app is opened in standalone mode).

### Regenerating icons
The icons are built from the color logo. To rebuild (e.g. after a logo change):
```bash
python3 - <<'PY'
from PIL import Image
mark = Image.open('assets/bridge-logo-color.png').convert('RGBA').crop((0,0,230,198))
def make(size, frac, out):
    c = Image.new('RGBA', (size, size), (255,255,255,255))
    w = int(size*frac); m = mark.resize((w, int(mark.height*w/mark.width)), Image.LANCZOS)
    c.alpha_composite(m, ((size-m.width)//2, (size-m.height)//2))
    c.convert('RGB').save(out)
make(192,0.72,'assets/icons/icon-192.png');  make(512,0.72,'assets/icons/icon-512.png')
make(192,0.58,'assets/icons/icon-192-maskable.png'); make(512,0.58,'assets/icons/icon-512-maskable.png')
make(180,0.70,'assets/icons/apple-touch-icon.png')
PY
```

### Custom domain reminder
When moving to `prompts.bridgedental.ai`, the manifest and SW need **no changes**
(relative paths). Only the absolute `og:`/`twitter:` image URLs need updating, as
already noted above.
