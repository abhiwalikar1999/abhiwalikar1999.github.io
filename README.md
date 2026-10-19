# Portfolio: Abhishek Ningappa Walikar

Personal portfolio site: AI/ML engineering projects with problem, architecture,
evaluation and results.

Plain HTML, CSS and JavaScript. No framework, no build step, no dependencies,
no cookies, no third-party requests (fonts are self-hosted).

## Structure

```
site/                         <- the deployable website (publish this folder)
  index.html                  home: hero, about, projects, experience, skills, education, contact
  projects/
    llm-context-assistant/          project detail pages
    explainable-kg-classification/
    machine-unlearning/
  404.html
  assets/
    css/style.css             all styles; colour tokens at the top (light + dark)
    js/main.js                theme toggle, menu, project filters, scroll-spy, reveal
    js/charts.js              SVG charts drawn from the <table> inside each chart
    js/widgets.js             LangGraph loop and decision-tree explainers
    fonts/                    IBM Plex Sans / Mono (SIL Open Font License)
    img/                      favicon, icon sprite, projects/ (real screenshots, WebP)
    docs/                     CV PDF
*.pdf (project root)          reference material, not published (see .gitignore)
```

## Run locally

```bash
cd site
python -m http.server 8000
# open http://localhost:8000
```

A local server is needed (rather than opening the file directly) because the
icon sprite and the directory-style project URLs only resolve over HTTP.

## Editing

- **Text**: edit the HTML directly. Each section is commented.
- **Charts**: change the numbers in the chart's `<table>`. The chart redraws from
  the table, and the same table is the accessible "View data as table" view.
  Options live in `data-*` attributes on the `<figure>` (see the top of `charts.js`).
- **New project**: copy one folder under `site/projects/`, then add a card to the
  project list in `index.html`. Tag it with `data-tags` (`llm`, `ml`, `xai`, `cv`)
  so the filters pick it up.
- **Colours**: tokens at the top of `style.css` (navy brand, cobalt links, amber accent);
  dark mode values are defined twice (system preference and manual toggle) and must stay in sync.
- **Sizing**: everything is in `rem`, and the root font size grows from 16px (≤1440px wide)
  to 19px (2560px), so the whole layout scales up on large monitors.

## Deployment

Live at **https://abhiwalikar1999.github.io/**. GitHub Pages serves the `gh-pages` branch,
which holds only the contents of `site/` and is updated with `git subtree push`. See [DEPLOY.md](DEPLOY.md).

- `tools/check_links.py` checks every internal link and asset before publishing.
- `tools/set_base_url.py` writes the public address into the pages (canonical URL, link-preview tags).
