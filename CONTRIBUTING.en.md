# Contributing

**English** · [Português](CONTRIBUTING.md)

Thanks for your interest! The most welcome contribution is **adding a new
theme** (skin) and/or **scenario** (campaign). This guide focuses on that.

## Before you start

- **Node 22+** (see [`.nvmrc`](.nvmrc)).
- **Fork** the repository, then:

```bash
git clone https://github.com/<your-username>/Immersive-Terminal-for-RPGs.git
cd Immersive-Terminal-for-RPGs
npm install
npm run dev        # http://localhost:5173
```

## Adding a new theme

A **theme** is the skin (colors, font, banner, sound). A **scenario** is the
campaign content (text, files, commands). The full schema is in the
[*Authoring content*](README.en.md#authoring-content) section of the README.

1. **Skin** — create `src/themes/<id>.json` with `palette`, `font`, `crt`,
   `banner`, `boot`, `locks`, `defaultScenario`, etc.
2. **Scenario** — create the folder `src/themes/scenarios/<id>/<scenario>/`:
   - `scenario.json` — `motd`, `commands`, and optionally `login` / `events`.
   - `files/` — the terminal files as **real files**:
     - `.md` → rendered as markdown (cinematic)
     - `.log` / `.dat` / others → raw text
     - locked files carry a `---` front-matter block at the top
       (`locked`, `password`, `crackDC`, `reveals`, …)
3. **Register** the theme by importing it in
   [`src/themes/index.js`](src/themes/index.js) and adding it to `THEME_LIST`.
4. **Do not** add it to `DEMO_IDS` — the demo lineup is curated by the
   maintainer.

Use the existing themes in `src/themes/` as a template.

## Before opening the PR

Run and make sure everything passes:

```bash
npm run lint
npm test
npm run build
```

## Fan content and rights

- Keep content **transformative and short** (original flavor) — don't paste
  long copyrighted text.
- Don't include proprietary assets (images, fonts without a free license).
- Themes based on third-party universes are *fan content*; see the README
  disclaimer. By contributing, you agree to license your code under
  [MIT](LICENSE).

## Opening the Pull Request

1. Create a branch off `main`, commit, and push to **your fork**.
2. Open a PR against this repository's `main`.
3. Describe the theme/scenario and **how to test** it (which theme, which
   commands, passwords for any locked files).

`main` is protected by a *ruleset*. For a PR to merge:

- **CI must pass** (lint + tests + build) — it runs automatically on the PR;
- it needs **at least one approval from a maintainer** (code owner) — review
  may request changes first;
- linear history (use *squash*/*rebase*) and resolved conversations.

Maintainers can help refine the PR during review. Thanks for contributing — and
happy sessions! 🖖
