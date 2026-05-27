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
  password dialog) with a configurable progress bar. Optional difficulty roll
  and unlock chains.
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

### Deploy (GitHub Pages)

Every push to `main` publishes the site via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). Vite's `base` is
set per mode (`/` in dev, `/Immersive-Terminal-for-RPGs/` for the build,
`/Immersive-Terminal-for-RPGs/demo/` for the demo). The themes shown in the demo
are listed in `DEMO_IDS` in [src/themes/index.js](src/themes/index.js).

---

## Using it at the table

**Commands available in every system:**

| Command | Action |
|---|---|
| `help` | command list |
| `ls [path]` · `cd <path>` · `cat <file>` · `pwd` | filesystem navigation |
| `grep <term> [path]` · `find <name>` | search content / filenames |
| `crack <file>` | brute-force a locked file (progress bar) |
| `decrypt <file> [key]` | unlock by password; omit `key` to open a dialog |
| `theme [id]` | switch system |
| `scenario [list\|load <id>]` | switch campaign within a system |
| `volume [0-100\|mute\|unmute]` | audio level |
| `hum [on\|off]` | ambient CRT hum (off by default) |
| `reset` | wipe this scenario's progress |
| `whoami` · `date` · `motd` · `clear` · `reboot` | utilities |

Each scenario also adds its own commands (e.g. `vk`/`enhance` in Blade Runner,
`pipboy`/`rads` in Fallout, `trace`/`deploy` in Cyberpunk).

**Shortcuts and UI:**

- ↑/↓ browse history · **Tab** completes commands and filenames · `Ctrl+L` clears.
- Theme switcher at the bottom (a `▴ <system>` button that opens the menu) ·
  audio toggle bottom-right.
- **`Ctrl+Shift+G`** (or the `gm` command) toggles **GM mode**: locked files show
  their password in `ls` and their content in `cat`, without affecting what
  players see. Session-only (resets on reload). In GM mode, each system in the
  switcher gets a `×`/`+` toggle to **disable/enable the theme for players** —
  disabled themes disappear from the switcher outside GM mode (the choice is
  saved). The `gmsheet` command (GM mode only) dumps every locked file in the
  scenario with its password/DC for quick prep.

**Load a campaign straight from the URL** (handy for a GM bookmark):

```
.../?theme=cprd&scenario=heimdall
```

---

## Authoring content

A **theme** is the skin (colors, font, banner, sound). A **scenario** is the
campaign content (text, files, commands). One theme can have several scenarios.

```
src/themes/<id>.json                     skin + defaultScenario
src/themes/scenarios/<theme>/<id>/       campaign
```

### Theme (skin)

```jsonc
{
  "id": "my-system",
  "name": "Readable name",
  "header": "text at the top of the screen",
  "prompt": "prefix",
  "user": "operator",
  "palette": { "bg": "#000", "bgSoft": "#001a00", "fg": "#33ff33",
               "accent": "#a0ffa0", "muted": "#1a661a", "error": "#ff5252" },
  "font": "'3270 Nerd Font Mono'",   // declared in src/styles/base.css
  "fontSize": "18px",
  "crt": { "glow": "8px", "typeSpeed": 14 },
  "sounds": {                         // optional — sane defaults if absent
    "keystroke": { "cutoff": 2200, "duration": 0.02 },
    "beep":      { "freq": 880,  "duration": 0.06,  "type": "sine" },
    "whoosh":    { "duration": 0.6, "freqStart": 140, "freqEnd": 1800, "tone": 0.5 }
  },
  "locks": { "crackDefault": 5000, "decryptDefault": 1500,
             "crackLabel": "BRUTE-FORCING", "decryptLabel": "DECRYPTING" },
  "banner": "optional ASCII / box-drawing art",
  "boot":  [ { "text": "boot line", "type": "ok" } ],
  "extraHelp": [ "  cmd       extra help description" ],
  "unknownHint": "fallback when a command doesn't exist",
  "defaultScenario": "my-campaign"
}
```

Register the theme by importing it in [src/themes/index.js](src/themes/index.js).

### Scenario (campaign)

A scenario is a **folder**: metadata in `scenario.json`, and the terminal files
as **real files** inside `files/`. The loader discovers everything on its own —
adding a file to the terminal = drop a file in the folder.

```
src/themes/scenarios/<theme>/<id>/
  scenario.json              ← motd, commands, overrides, login, events
  files/
    document.md              → becomes /document.md  (rendered as markdown)
    logs/report.log          → becomes /logs/report.log  (raw text)
    vault/secret.dat         → locked file (front-matter at the top)
```

**Rendering:** `.md` files go through a markdown layer in `cat` (cinematic);
any other extension (`.log`, `.dat`, ...) prints **raw**, like a data dump.
Line-level markdown support:

- `# Title` / `## Sub` → accent highlight, UPPERCASED
- `---` → divider line
- `> quote` → indented with `▌`
- `- item` → `•` bullet
- `**bold**` → UPPERCASED inline · `*italic*` / `` `code` `` → markers stripped

Directories are inferred from the tree. The scenario shows up automatically in
`scenario list`.

**`scenario.json`:**

```jsonc
{
  "name": "Campaign label",
  "motd": [ "lines shown after the banner" ],
  "commands": {                       // custom commands return static lines
    "my-command": [ "line 1", { "text": "line 2", "type": "err" } ]
  }
}
```

A scenario can override `boot`, `user`, `header`, `prompt`, and `locks`. Line
`type`: `normal` · `ok` · `err` · `muted` · `user`.

**Login (optional):** a scenario can require authentication before the terminal
unlocks — a masked dialog appears after boot, and the `motd` is withheld until
access is granted.

```jsonc
"login": {
  "title": "HALDEN CYBERNETICS // AUTHORIZED USERS ONLY",
  "label": "password:",
  "password": "HALDEN",
  "granted": "Welcome back, Dr. Halden.",
  "denied": "ACCESS DENIED."
}
```

### Terminal files

- **Open file** = just the text. Create `files/note.md` with the content.
- **Locked file** = a front-matter block (`---`) at the top + content:

```
---
locked: true
password: swordfish            # enables decrypt
crackable: true                # false = decrypt only
crackTime: 8000                # ms (per-file override)
decryptTime: 1500
lockLabel: BYPASSING ICE       # crack progress-bar label
decryptLabel: RESOLVING KEY
crackSuccessMessage: ACCESS GRANTED.
crackFailMessage: encryption too strong   # if crackable=false
crackDC: 12                    # difficulty check: crack opens a roll dialog
crackAttempts: 3               # lives before lockout (default 3)
reveals: /vault/other.dat      # chain: on unlock, reveals another file's key
---
Content revealed after unlocking.
```

**Difficulty check (`crackDC`)**: if a file has `crackDC`, `crack` opens a dialog
asking for the **player's roll** (a number). If the roll is **greater** than the
DC, the crack runs. Otherwise it fails and spends one of `crackAttempts`
(default 3). Once attempts run out the file is in **lockout** — only the password
(`decrypt`) opens it. The DC is hidden from players (visible only in GM mode).

Front-matter values coerce to boolean/number automatically; quote a value to
force a string (e.g. a numeric password `password: "12345"`). `reveals` accepts
multiple comma-separated paths.

**Unlock events (`events`):** in `scenario.json`, map a path to a list of lines
that play when that file is unlocked (crack or decrypt). Lines can be any type —
text, `progress`, `countdown`.

```jsonc
"events": {
  "/blackbox.dat": [
    { "text": ">>> TRACE INITIATED", "type": "err" },
    { "type": "countdown", "from": 5, "label": "TRACE IN", "alarm": true },
    { "text": ">>> you are flagged.", "type": "err" }
  ]
}
```

Unlocks persist per scenario (saved to localStorage); `reset` wipes them. `ls`
marks locked files with `[LOCKED]`.

---

## Structure

```
src/
  App.jsx                  theme/scenario state, GM mode, CSS vars, URL params, idle
  audio/sfx.js             Web Audio synthesis (keystroke/beep/whoosh/hum)
  styles/{base,crt}.css    @font-face fonts + CRT effect
  engine/
    commands.js            parser + built-in commands
    filesystem.js          path resolver + listDir
    complete.js            Tab autocomplete
    markdown.js            line-level markdown renderer
  components/
    Terminal.jsx           history, typewriter queue, command ctx
    Prompt.jsx             input with inline cursor
    OutputLine.jsx         line (typewriter / banner / progress / countdown)
    ProgressLine.jsx       animated bar (crack/decrypt)
    CountdownLine.jsx      self-destruct / event countdown
    InputModal.jsx         password / roll dialog
    Screensaver.jsx        idle matrix-rain
    ThemeSwitcher.jsx · AudioToggle.jsx
  themes/
    index.js                       registry + loader (glob + front-matter) + composeTheme
    <id>.json                      skins
    scenarios/<theme>/<id>/
      scenario.json                motd + commands + login + events
      files/**                     terminal files (text / front-matter)
public/fonts/              self-hosted fonts (.ttf/.otf)
```

---

## Fonts

Self-hosted in [public/fonts/](public/fonts/) — no external calls.

- **3270 Nerd Font** — BSD-2-Clause (3270) + MIT (Nerd Font).
- **Terminal Grotesque** (Raphaël Bastide) — SIL Open Font License.

---

## License

Code under [MIT](LICENSE) © 2026 Felipe Lippelt.

> **Unofficial fan content.** The themes reference third-party universes (Alien,
> Lancer, Blade Runner, Warhammer 40,000, Fallout, Cyberpunk) for tabletop use
> only. This project is not affiliated with or endorsed by the rights holders of
> those marks, which remain the property of their respective owners. The MIT
> license covers only the original source code in this repository.
