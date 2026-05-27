# Terminal Imersivo para RPG

[English](README.en.md) · **Português**

### → [**LIVE DEMO**](https://flippelt.github.io/Immersive-Terminal-for-RPGs/demo/) ←

Um site que simula um terminal de console retrô (estilo *cool-retro-term*) para
usar como prop em mesas de RPG. Troque de "sistema" e o visual, os textos e o
conteúdo mudam por completo. O Mestre cria cenários editando só arquivos JSON.

Sistemas incluídos: **Alien** (MU/TH/UR), **Lancer** (COMP/CON), **Blade Runner**
(Esper), **Warhammer 40K** (Cogitator e Dataslate Imperial), **Fallout** (RobCo
Termlink), **Cyberpunk RED** (NetWatch) e **IBM 5151** (PC-DOS, fósforo verde —
skin neutra/retrô pra cenários próprios).

Stack: **React + Vite**, 100% estático, sem backend. Áudio sintetizado no
navegador (sem assets), fontes self-hosted (sem Google Fonts).

---

## Recursos

- **CRT em CSS puro** — scanlines, glow de fósforo, flicker, sweep, curvatura e
  vinheta. Respeita `prefers-reduced-motion`.
- **Terminal híbrido** — boot animado por typewriter + prompt interativo com
  cursor inline que segue a digitação e as setas ←/→.
- **Arquivos trancados** — `crack` (força bruta animada) e `decrypt` (modal
  cinematográfico de senha) com barra de progresso configurável.
- **Modo Mestre** (escondido) — revela senhas e conteúdo trancado sem destrancar
  pros jogadores.
- **Som sintetizado** — clique de tecla, beep de sucesso/erro e whoosh de boot,
  com volume controlável.
- **Temas + cenários** — skin reutilizável separada do conteúdo da campanha; um
  tema pode hospedar várias campanhas.

---

## Rodando localmente

```bash
npm install
npm run dev      # http://localhost:5173
```

Build de produção:

```bash
npm run build        # versão completa → dist/
npm run build:demo   # versão demo curada → dist-demo/
npm run lint         # ESLint
npm test             # Vitest (engine: parser, filesystem, autocomplete, locks)
```

### Deploy (GitHub Pages)

A cada push em `main`, [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
publica o site. O `base` do Vite é ajustado por modo (`/` em dev,
`/Immersive-Terminal-for-RPGs/` no build, `/Immersive-Terminal-for-RPGs/demo/` no demo).
A lista de temas que aparecem no demo fica em `DEMO_IDS` em
[src/themes/index.js](src/themes/index.js).

**Netlify** (alternativa, na raiz do domínio): já configurado em
[`netlify.toml`](netlify.toml) — conecte o repo e dê deploy, sem ajustar nada.
Ele sobrescreve o `base` pra `/` (o build padrão mira a subpasta do Pages).

---

## Usando na mesa

**Comandos disponíveis em todos os sistemas:**

| Comando | Ação |
|---|---|
| `help` | lista de comandos |
| `ls [path]` · `cd <path>` · `cat <file>` · `pwd` | navegação no filesystem |
| `grep <termo> [path]` · `find <nome>` | busca conteúdo / nomes de arquivo |
| `crack <file>` | força bruta em arquivo trancado (barra de progresso) |
| `decrypt <file> [key]` | desbloqueia por senha; sem `key` abre um modal |
| `theme [id]` | troca de sistema |
| `scenario [list\|load <id>]` | troca de campanha dentro do sistema |
| `volume [0-100\|mute\|unmute]` | nível de áudio |
| `hum [on\|off]` | hum ambiente de CRT (desligado por padrão) |
| `whoami` · `date` · `motd` · `clear` · `reboot` | utilitários |

Cada cenário ainda adiciona comandos próprios (ex.: `vk`/`enhance` no Blade
Runner, `pipboy`/`rads` no Fallout, `trace`/`deploy` no Cyberpunk).

**Atalhos e UI:**

- ↑/↓ navegam o histórico · **Tab** completa comandos e nomes de arquivo · `Ctrl+L` limpa a tela.
- Switcher de tema embaixo (botão `▴ <sistema>` que abre o menu) · toggle de
  áudio no canto inferior direito.
- **`Ctrl+Shift+G`** (ou o comando `gm`) liga o **Modo Mestre**: arquivos
  trancados mostram a senha no `ls` e o conteúdo no `cat`, sem afetar o que os
  jogadores veem. Sessão-only (reseta ao recarregar). No Modo Mestre, cada
  sistema no switcher ganha um `×`/`+` pra **desativar/ativar o tema para os
  jogadores** — temas desativados somem do switcher fora do Modo Mestre (a
  escolha fica salva). O comando `gmsheet` (só no Modo Mestre) despeja todos os
  arquivos trancados do cenário com senha/DC pra prep rápida.

**Carregar uma campanha direto por URL** (útil pra bookmark do GM):

```
.../?theme=cprd&scenario=heimdall
```

---

## Criando conteúdo

Um **tema** é a skin (cores, fonte, banner, som). Um **cenário** é o conteúdo da
campanha (textos, arquivos, comandos). Um tema pode ter vários cenários.

```
src/themes/<id>.json                     skin + defaultScenario
src/themes/scenarios/<id>/<nome>.json    campanha
```

### Tema (skin)

```jsonc
{
  "id": "meu-sistema",
  "name": "Nome legível",
  "header": "texto no topo da tela",
  "prompt": "prefixo",
  "user": "operador",
  "palette": { "bg": "#000", "bgSoft": "#001a00", "fg": "#33ff33",
               "accent": "#a0ffa0", "muted": "#1a661a", "error": "#ff5252" },
  "font": "'3270 Nerd Font Mono'",   // declarada em src/styles/base.css
  "fontSize": "18px",
  "crt": { "glow": "8px", "typeSpeed": 14 },
  "screensaver": "starfield",          // matrix | starfield | rain | sweep | static | bounce
  "sounds": {                         // opcional — defaults sensatos se ausente
    "keystroke": { "freq": 1400, "duration": 0.012, "type": "square" },
    "beep":      { "freq": 880,  "duration": 0.06,  "type": "sine" },
    "whoosh":    { "duration": 0.7, "freqStart": 80, "freqEnd": 1400 }
  },
  "locks": { "crackDefault": 5000, "decryptDefault": 1500,
             "crackLabel": "BRUTE-FORCING", "decryptLabel": "DECRYPTING" },
  "banner": "ASCII art / box-drawing opcional",
  "boot":  [ { "text": "linha de boot", "type": "ok" } ],
  "extraHelp": [ "  cmd       descrição extra no help" ],
  "unknownHint": "fallback quando o comando não existe",
  "defaultScenario": "minha-campanha"
}
```

Registre o tema importando-o em [src/themes/index.js](src/themes/index.js).

### Cenário (campanha)

Um cenário é uma **pasta**: metadata num `scenario.json` e os arquivos do
terminal como **arquivos reais** dentro de `files/`. O loader descobre tudo
sozinho — adicionar um arquivo ao terminal = soltar um arquivo na pasta.

```
src/themes/scenarios/<tema>/<id>/
  scenario.json              ← motd, commands, overrides
  files/
    documento.md             → vira /documento.md  (renderizado como markdown)
    logs/relatorio.log       → vira /logs/relatorio.log  (texto cru)
    cofre/segredo.dat        → arquivo trancado (front-matter no topo)
```

**Renderização:** arquivos `.md` passam por um renderizador de markdown no
`cat` (cinematográfico); qualquer outra extensão (`.log`, `.dat`, ...) imprime
**cru**, como um dump de dados. Suporte de markdown (nível de linha):

- `# Título` / `## Sub` → destaque em accent, MAIÚSCULO
- `---` → linha divisória
- `> citação` → recuo com `▌`
- `- item` → bullet `•`
- `**negrito**` → MAIÚSCULO inline · `*itálico*` / `` `código` `` → marcadores removidos

Diretórios são inferidos da árvore. O cenário aparece automaticamente em
`scenario list`.

**`scenario.json`:**

```jsonc
{
  "name": "Rótulo da campanha",
  "motd": [ "linhas mostradas após o banner" ],
  "commands": {                       // comandos custom retornam linhas estáticas
    "meu-comando": [ "linha 1", { "text": "linha 2", "type": "err" } ]
  }
}
```

Um cenário pode sobrescrever `boot`, `user`, `header`, `prompt` e `locks` do
tema. `type` de linha: `normal` · `ok` · `err` · `muted` · `user`.

**Login (opcional):** um cenário pode exigir autenticação antes de liberar o
terminal — abre um diálogo mascarado após o boot, e o `motd` só aparece depois
do acesso concedido.

```jsonc
"login": {
  "title": "HALDEN CYBERNETICS // AUTHORIZED USERS ONLY",
  "label": "password:",
  "password": "HALDEN",
  "granted": "Welcome back, Dr. Halden.",
  "denied": "ACCESS DENIED."
}
```

**Autodestruição (`selfDestruct`):** o comando `selfdestruct` (alias `destruct`)
abre um popup grande com contagem regressiva e uma área **OVERRIDE** — digitar o
código (definido pelo Mestre) aborta; chegar a zero detona.

```jsonc
"selfDestruct": {
  "from": 10, "interval": 800,
  "override": "OVERRIDE-937",        // código do Mestre pra abortar
  "armed": "EMERGENCY DESTRUCT SYSTEM ARMED",
  "aborted": ["destruct aborted."],  // linhas após abortar
  "detonate": ["DETONATION."]        // linhas ao detonar
}
```

### Arquivos do terminal

- **Arquivo aberto** = só o texto. Crie `files/nota.txt` com o conteúdo.
- **Arquivo trancado** = bloco de front-matter (`---`) no topo + conteúdo:

```
---
locked: true
password: swordfish            # habilita decrypt
crackable: true                # false = só decrypt
crackTime: 8000                # ms (override por arquivo)
decryptTime: 1500
lockLabel: BYPASSING ICE       # label da barra de crack
decryptLabel: RESOLVING KEY
crackSuccessMessage: ACCESS GRANTED.
crackFailMessage: encryption too strong   # se crackable=false
crackDC: 12                    # teste de dificuldade: crack abre um diálogo pedindo a rolagem
crackAttempts: 3               # vidas antes do lockout (padrão 3)
reveals: /cofre/outro.dat      # cadeia: ao destrancar, revela a senha de outro arquivo
---
Conteúdo revelado após o desbloqueio.
```

**Teste de dificuldade (`crackDC`)**: se um arquivo tem `crackDC`, o `crack`
abre um diálogo pedindo o resultado da **rolagem do jogador** (um número). Se a
rolagem for **maior** que o DC, o crack roda. Senão, falha e gasta uma das
`crackAttempts` (padrão 3). Esgotadas as tentativas, o arquivo fica em
**lockout** — só abre com a senha (`decrypt`). O DC fica oculto pros jogadores
(visível só no Modo Mestre).

Valores do front-matter coagem pra boolean/número automaticamente; use aspas
pra forçar string (ex.: senha numérica `password: "12345"`). `reveals` aceita
vários paths separados por vírgula.

**Eventos ao destrancar (`events`):** no `scenario.json`, mapeie um path pra
uma lista de linhas que tocam quando aquele arquivo é destrancado (crack ou
decrypt). Pode incluir qualquer tipo de linha — texto, `progress`, `countdown`.

```jsonc
"events": {
  "/blackbox.dat": [
    { "text": ">>> TRACE INITIATED", "type": "err" },
    { "type": "countdown", "from": 5, "label": "TRACE IN", "alarm": true },
    { "text": ">>> you are flagged.", "type": "err" }
  ]
}
```

**Rastreador (`tracer`):** estilo Cyberpunk. Quando o jogador inicia um `crack`
com teste de rolagem (arquivo com `crackDC`), abre um popup no **canto superior
direito** com uma contagem regressiva silenciosa — só pra mostrar que ele está
sendo rastreado. Cada rolagem falha **adianta** o rastreador. Tempo e punição
são definidos pelo Mestre (no `scenario.json` ou no skin do tema).

```jsonc
"tracer": {
  "seconds": 30,                          // tempo total da contagem
  "penalty": 7,                           // segundos removidos por erro
  "label": "ICE TRACE",                   // prefixo do contador
  "active": "ICE TRACE ACTIVE",           // título enquanto rastreia
  "complete": "TRACE COMPLETE — LOCATION FIXED"  // título ao zerar
}
```

Desbloqueios duram até `reboot` ou troca de tema. `ls` marca `[LOCKED]`.

---

## Estrutura

```
src/
  App.jsx                  estado de tema/cenário, GM mode, CSS vars, URL params
  audio/sfx.js             síntese Web Audio (keystroke/beep/whoosh)
  styles/{base,crt}.css    fontes @font-face + efeito CRT
  engine/
    commands.js            parser + comandos built-in
    filesystem.js          resolver de path + listDir
  components/
    Terminal.jsx           histórico, fila de typewriter, ctx dos comandos
    Prompt.jsx             input com cursor inline
    OutputLine.jsx         linha (typewriter / banner / progress)
    ProgressModal.jsx      popup com a barra animada (crack/decrypt)
    PasswordModal.jsx      diálogo de senha do decrypt
    ThemeSwitcher.jsx · AudioToggle.jsx
  themes/
    index.js                       registry + loader (glob + front-matter) + composeTheme
    <id>.json                      skins
    scenarios/<tema>/<id>/
      scenario.json                motd + commands
      files/**                     arquivos do terminal (texto / front-matter)
public/fonts/              fontes self-hosted (.ttf/.otf)
```

---

## Fontes

Self-hosted em [public/fonts/](public/fonts/) — sem chamadas externas.

- **3270 Nerd Font** — BSD-2-Clause (3270) + MIT (Nerd Font).
- **Terminal Grotesque** (Raphaël Bastide) — SIL Open Font License.

---

## Contribuindo

Quer adicionar um tema novo? Veja o [guia de contribuição](CONTRIBUTING.md).
Todo PR passa pelo CI e precisa de aprovação da manutenção antes do merge.

---

## Licença

Código sob [MIT](LICENSE) © 2026 Felipe Lippelt.

> **Conteúdo de fã, não-oficial.** Os temas referenciam universos de terceiros
> (Alien, Lancer, Blade Runner, Warhammer 40,000, Fallout, Cyberpunk) apenas
> para uso em mesas de RPG. Este projeto não é afiliado nem endossado pelos
> detentores dessas marcas, que permanecem propriedade de seus respectivos
> donos. A licença MIT cobre apenas o código-fonte original deste repositório.
