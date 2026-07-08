# Bridge Dental Prompt Builders

One deployable folder containing a modular multi-vertical platform for prompt builders:

```
bridge-prompts/
├── index.html              ← hub landing page (renders picker from manifest)
├── app/                    ← shared ES modules
│   ├── prompt.js           ← prompt builder logic
│   ├── pack.js             ← pack validation & loading
│   ├── state.js            ← encode/decode selection state
│   ├── analytics.js        ← GoatCounter event centralization
│   ├── hash.js             ← djb2 password hashing
│   └── app.js              ← main application controller
├── verticals/              ← JSON packs + manifest
│   ├── manifest.json       ← list of available verticals
│   └── dental.json         ← Bridge Dental pack
├── dental/                 ← first vertical (prompt builder app)
│   └── index.html
├── team/                   ← redirect stub to dental/
│   └── index.html
├── owner/                  ← redirect stub to dental/
│   └── index.html
└── assets/                 ← shared Bridge Dental logos
```

No backend, no build step, no npm dependencies in production. Each vertical loads its pack via fetch and uses shared ES modules.

## Run it

**IMPORTANT:** This app must be served, not opened via `file://`. ES modules and pack fetching do not work over file:// protocol.

```bash
# From the project directory:
python3 -m http.server 4601
```

Then open http://localhost:4601 in your browser. (Also wired to the play button via `.claude/launch.json`.)

## Testing

Development uses Node's built-in test runner:

```bash
npm test
```

This runs all tests in the `test/` directory. No external test dependencies.

## Deploy it (GitHub Pages)

Upload the **contents** of this folder to a GitHub repo and enable Pages:

- `https://<user>.github.io/<repo>/` — the hub landing page
- `…/dental/` — the Bridge Dental prompt builder
- `…/team/` and `…/owner/` redirect to `…/dental/`

Share links (`?p=…`) and the hub breadcrumbs work automatically under this layout.

## Adding a vertical

To add a new vertical (e.g., `veterinary`):

1. **Create the pack:** Add `verticals/veterinary.json` — must validate against the schema in `app/pack.js`. See `verticals/dental.json` for the required shape: `id`, `name`, `theme`, `vocabulary`, `safety` (rules map), `defaultSafety` (array), `sensitiveRoles`, `roles` (array with `value`, `label`, `prompt`, `safetyKeys`, `tasks`), `formats`.

2. **Add the vertical stub:** Create folder `veterinary/` with `index.html`. Copy `dental/index.html` and update:
   - `<title>` and meta tags (og:url, og:title, og:description, twitter tags)
   - The `verticalId` and initial theme/styling if desired
   - og:image URL to point to your assets (or reuse `assets/og-card.png`)

3. **Register in manifest:** Add an entry to `verticals/manifest.json`:
   ```json
   { "id": "veterinary", "name": "Vet Prompt Builder", "tagline": "…", "accent": "#color", "path": "veterinary/" }
   ```

The hub will auto-discover and render the new vertical on next load.

## What's inside each vertical

Each vertical loads its pack (JSON) and uses the shared engine: four cascading RCTF picks → live prompt preview → Copy / open-in-ChatGPT/Claude/Gemini/Grok, plus quick-start examples, optional per-task detail fields, share links, follow-up suggestions after copying, and saved favorites (localStorage).
Task and Format dropdowns open with a **"★ Most popular"** group above the full list.
A non-removable safety rule is appended to every prompt — determined by the pack's `safety` rules and per-role `safetyKeys`.

The Bridge Dental vertical ships with task content curated from the practice's own prompt vaults — ~50 owner tasks across six experts and ~55 team tasks.

## Growth plumbing

### Analytics — GoatCounter (one setup step required)
All pages carry a privacy-friendly [GoatCounter](https://www.goatcounter.com) snippet
(no cookies, no consent banner, prompt content never touched). Pageviews are automatic;
custom events are centralized in `app/analytics.js` and fire on the actions that matter:

- `{vertical}-copy` — copy-to-clipboard (e.g., `dental-copy`)
- `{vertical}-open-{target}` — open in AI tool (e.g., `dental-open-chatgpt`, `dental-open-claude`)
- `hub-pick-{id}` — picker click to open a vertical
- `{vertical}-unlock-{status}` — password gate result (e.g., `dental-unlock-success`)
- `…-outbound-bridgedental` — footer link clicks

The dashboard lives at **https://bridgedental.goatcounter.com** (site code `bridgedental`
— the snippet in each page must match it). If the script is blocked or unreachable, the
snippet quietly no-ops; nothing breaks.

Prior event names (e.g., `team-copy-prompt`) are superseded by the new vertical-aware scheme.

### Social sharing
Every page has Open Graph / Twitter meta tags pointing at a branded card (`assets/og-card.png`, 1200×630).
Links shared in Facebook groups, LinkedIn, or texts render the preview automatically. The image
URLs in each vertical stub are absolute (`https://stevegdove.github.io/DentalPromptGenerator/assets/og-card.png`) — update them
in each vertical's `<head>` if the site moves to a custom domain. After deploying changes, paste the URL into a share
debugger (e.g. LinkedIn Post Inspector) to refresh the cached preview.

### Custom domain (recommended): prompts.bridgedental.ai
1. In the DNS for bridgedental.ai, add a **CNAME** record: `prompts` → `stevegdove.github.io`.
2. In the GitHub repo → Settings → Pages → **Custom domain**, enter
   `prompts.bridgedental.ai`, save, and tick **Enforce HTTPS** once the check passes.
3. Update the `og:url` and `og:image` absolute URLs in:
   - `index.html` (hub)
   - Each vertical stub (e.g., `dental/index.html`, `team/index.html`, `owner/index.html`)

### Vertical password gates (e.g., owner)
Verticals can be gated behind a password prompt. It's a **courtesy lock, not security** —
the site is a public repo, so a technically-inclined visitor can read the content regardless;
it filters honest people, which is the point. The password is checked as a djb2 hash (never
stored in plain text in the source), unlock is remembered per device (`localStorage`), and
`{vertical}-unlock-{status}` events land in GoatCounter. Passwords are case-insensitive.

**To gate a vertical (e.g., owner):** 
- Add `sensitiveRoles: true` to the pack (`verticals/<id>.json`)
- In the vertical's stub (`owner/index.html`), wire the gate: import and call the gating logic from `app/app.js`, passing the gate key `bd-{vertical}-unlocked` (e.g., `bd-owner-unlocked`)
- Compute the hash using the djb2 algorithm in `app/hash.js`:
```bash
node -e "
import { djb2 } from './app/hash.js';
console.log(djb2('your-new-password-lowercase'));"
```
- Store the hash in your vertical's configuration or gate logic

Check the Bridge Dental `dental/index.html` implementation for a concrete example of the gate integration pattern.

### Email capture (hidden until enabled)
The hub has a "Get new prompts monthly" card that is **hidden by default**. To enable:
create a free form endpoint (e.g. formspree.io), then set `FORM_ENDPOINT` in the script at
the bottom of `index.html` to its POST URL. The builders themselves are never gated.
