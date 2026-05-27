# Immersive Terminal for RPGs

**English** · [Português](README.md)

### → [**LIVE DEMO**](https://flippelt.github.io/Immersive-Terminal-for-RPGs/demo/) ←

A website that simulates a retro console terminal (*cool-retro-term* style) to
use as a prop at the tabletop. Switch "system" and the look, the text, and the
content change completely. The GM authors scenarios by editing plain files.

Included systems: **Alien** (MU/TH/UR), **Lancer** (COMP/CON), **Blade Runner**
(Esper), **Warhammer 40K** (Cogitator and Imperial Dataslate), **Fallout** (RobCo
Termlink), **Cyberpunk RED** (NetWatch), and **IBM 5151** (PC-DOS, green
phosphor — a neutral retro skin for your own scenarios).

Stack: **React + Vite**, fully static, no backend. Audio is synthesized in the
browser (no assets); fonts are self-hosted (no Google Fonts).

---

## Features

- **Pure-CSS CRT** — scanlines, phosphor glow, flicker, sweep, curvature, and
  vignette. Honors `prefers-reduced-motion`.
- **Hybrid terminal** — typewriter boot animation + an interactive prompt with
  an inline cursor that follows typing and the ←/→ keys.
- **Locked files** — `crack` (animated brute force) and `decrypt` (cinematic
  password dialog) with a configurable progress bar, optional difficulty roll,
  and unlock chains.
- **GM cinematics** — unlock events, a self-destruct popup with OVERRIDE, and a
  Cyberpunk-style tracer.
- **GM mode** (hidden) — reveals passwords and locked content without unlocking
  it for the players.
- **Synthesized sound** — keystroke clicks, success/error beeps, boot whoosh,
  plus an optional ambient hum. Volume-controllable.
- **Themes + scenarios** — a reusable skin separated from campaign content; one
  theme can host many campaigns.

---

## Running locally

```bash
npm install
npm run dev      # http://localhost:5173
```

Production build:

```bash
npm run build        # full version → dist/
npm run build:demo   # curated demo version → dist-demo/
npm run lint         # ESLint
npm test             # Vitest (engine: parser, filesystem, autocomplete, locks)
```

### Deploy

Every push to `main` publishes to **GitHub Pages** via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) (Vite's `base` is
set per mode). To serve at the domain root via **Netlify**,
[`netlify.toml`](netlify.toml) is preconfigured — connect the repo and deploy.

---

## Documentation (Wiki)

The detailed reference lives in the **[Wiki](https://github.com/flippelt/Immersive-Terminal-for-RPGs/wiki)**:

- **[Commands](https://github.com/flippelt/Immersive-Terminal-for-RPGs/wiki/Commands)** — every command, shortcuts, GM mode, loading a campaign from the URL.
- **[Authoring: Themes](https://github.com/flippelt/Immersive-Terminal-for-RPGs/wiki/Authoring-Themes)** — the skin JSON (palette, font, CRT, sounds, banner, boot).
- **[Authoring: Scenarios](https://github.com/flippelt/Immersive-Terminal-for-RPGs/wiki/Authoring-Scenarios)** — scenario folder, `scenario.json`, the `files/` tree, markdown, login.
- **[Locked Files](https://github.com/flippelt/Immersive-Terminal-for-RPGs/wiki/Locked-Files)** — front-matter, `crack` vs `decrypt`, difficulty rolls, chains.
- **[Cinematics](https://github.com/flippelt/Immersive-Terminal-for-RPGs/wiki/Cinematics)** — events, countdowns, self-destruct, the tracer.
- **[Architecture](https://github.com/flippelt/Immersive-Terminal-for-RPGs/wiki/Architecture)** — source layout and the fonts.

Quick recap: navigate with `ls`/`cd`/`cat`, open locked files with `crack`/
`decrypt`, switch system with `theme` and campaign with `scenario`. Toggle **GM
mode** with `Ctrl+Shift+G`. Load a campaign straight from the URL:
`.../?theme=cprd&scenario=heimdall`.

---

## Contributing

Want to add a new theme? See the [contribution guide](CONTRIBUTING.en.md).
Every PR runs through CI and needs maintainer approval before merging.

---

## License

Code under [MIT](LICENSE) © 2026 Felipe Lippelt.

> **Unofficial fan content.** The themes reference third-party universes (Alien,
> Lancer, Blade Runner, Warhammer 40,000, Fallout, Cyberpunk) for tabletop use
> only. This project is not affiliated with or endorsed by the rights holders of
> those marks, which remain the property of their respective owners. The MIT
> license covers only the original source code in this repository.
