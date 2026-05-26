# Terminal Immersivo para RPG

Site que simula um terminal de console (estilo *cool-retro-term*) com skins
trocáveis para sistemas de RPG: **Alien (MU/TH/UR)**, **Lancer (COMP/CON)**,
**Blade Runner (Esper)** e **Warhammer 40K (Cogitator)**.

Stack: React + Vite. Sem backend. Conteúdo (textos, arquivos, NPCs) vive em
JSON — Mestres editam só os temas.

## Rodando

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`.

Build estático para hospedar (Netlify, GitHub Pages, etc.):

```bash
npm run build
# saída em ./dist
```

## Como usar na mesa

- O switcher embaixo da tela troca de sistema (também via comando `theme <id>`).
- Comandos básicos disponíveis em todos os sistemas: `help`, `ls`, `cd`, `cat`,
  `pwd`, `whoami`, `date`, `clear`, `motd`, `theme`, `reboot`.
- ↑/↓ navegam histórico de comandos. `Ctrl+L` limpa a tela.
- Cada tema adiciona comandos próprios (ex: `vk`, `enhance` no Blade Runner,
  `litany`, `bless` no WH40K, `status`, `core`, `hail` no Lancer).
- Boot sequence, banner ASCII, prompt, paleta, fonte e MOTD são todos por tema.

## Criando um sistema novo

1. Copie um arquivo em `src/themes/` (`alien.json` é um bom modelo).
2. Edite `id`, `name`, `palette`, `font`, `boot`, `motd`, `filesystem`,
   `commands` (comandos customizados retornam linhas estáticas).
3. Adicione o import em `src/themes/index.js`.

### Schema mínimo

```jsonc
{
  "id": "meu-sistema",
  "name": "Nome legível",
  "header": "texto no topo da tela",
  "prompt": "prefixo>",
  "palette": { "bg": "#000", "fg": "#33ff33", "accent": "#a0ffa0",
               "muted": "#1a661a", "error": "#ff5252" },
  "font": "'VT323'",
  "fontSize": "20px",
  "crt": { "glow": "8px", "typeSpeed": 14 },
  "banner": "ASCII art opcional",
  "boot":  [ { "text": "linha 1", "type": "ok" }, ... ],
  "motd":  [ "linhas mostradas após o banner" ],
  "extraHelp": [ "  cmd       descrição extra no help" ],
  "unknownHint": "fallback quando comando não existe",
  "commands": {
    "meu-comando": [ "linha 1", { "text": "linha 2", "type": "err" } ]
  },
  "filesystem": {
    "/":       { "type": "dir",  "children": ["arquivo.txt"] },
    "/arquivo.txt": { "type": "file", "content": "..." }
  }
}
```

Arquivos com `"locked": true` retornam `ACCESS DENIED` em `cat`.

## Estrutura

```
src/
  App.jsx                  estado global de tema + CSS vars
  styles/
    base.css               reset + tipografia base
    crt.css                CRT (scanlines, glow, flicker, sweep, vignette)
  engine/
    filesystem.js          path resolver + listDir
    commands.js            parser e built-ins
  components/
    Terminal.jsx           histórico, fila de typewriter, prompt
    Prompt.jsx             input + histórico ↑↓
    OutputLine.jsx         linha animada (typewriter) ou banner
    ThemeSwitcher.jsx
  hooks/
    useTypewriter.js
  themes/
    index.js               registry
    *.json                 um por sistema
```

## Notas

- O efeito CRT é só CSS — sem WebGL. `prefers-reduced-motion` desliga
  flicker/sweep.
- O tema escolhido fica salvo em `localStorage` (chave `tirpg.theme`).
