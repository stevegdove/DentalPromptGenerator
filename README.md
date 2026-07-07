# Bridge Dental Prompt Builders

One deployable folder containing the landing page and both prompt-builder apps:

```
bridge-prompts/
├── index.html        ← landing page (choose team or owner)
├── team/             ← patient-communication prompts (PHI-safe)
│   ├── index.html
│   └── README.md     ← full feature docs for the team builder
├── owner/            ← run-the-practice prompts (confidential-safe)
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
A non-removable safety rule is appended to every prompt — PHI-focused in `team/`,
confidential-data-focused in `owner/` (money & deal experts also get a CPA/attorney
verify rule). Task content is curated from the practice's own prompt vaults —
~50 owner tasks across six experts and ~55 team tasks. See each app's README for details.

This folder is the single home for both apps — the original standalone folders
(`prompt-generator/`, `owner-prompt-generator/`) were retired into it in July 2026.
