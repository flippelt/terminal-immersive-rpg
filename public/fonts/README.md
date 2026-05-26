# Fontes locais

Self-hosted, sem chamadas externas (Google Fonts foi removido).

## Fontes em uso

| Arquivo | `font-family` | Tema(s) |
|---|---|---|
| `3270NerdFontMono-Regular.ttf` | `'3270 Nerd Font Mono'` | Alien (MU/TH/UR) |
| `3270NerdFontMono-SemiCondensed.ttf` | `'3270 Nerd Font Mono SemiCondensed'` | Lancer (COMP/CON) |
| `terminal-grotesque.ttf` | `'Terminal Grotesque'` | WH40K (Cogitator) |
| `terminal-grotesque_open.otf` | `'Terminal Grotesque Open'` | Blade Runner (Esper) |

## Adicionar uma fonte nova

1. Coloque o `.ttf`/`.otf`/`.woff2` aqui.
2. Declare `@font-face` em [src/styles/base.css](../../src/styles/base.css).
3. Use o `font-family` declarado no campo `font` do JSON do tema
   (em `src/themes/*.json`).

Arquivos em `public/` são servidos direto, sem processamento do Vite. O
caminho `/fonts/<arquivo>` é reescrito pelo Vite no build com base no
`base` do `vite.config.js`.

## Licenças

- **3270 Nerd Font**: BSD-2-Clause (3270 original) + MIT (Nerd Font addons).
- **Terminal Grotesque** (Raphaël Bastide): SIL Open Font License.

Mantenha esses créditos se redistribuir.
