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
  cinematográfico de senha) com barra de progresso configurável, teste de
  dificuldade opcional e cadeias de desbloqueio.
- **Cinematografia do Mestre** — eventos ao destrancar, popup de autodestruição
  com OVERRIDE e o rastreador estilo Cyberpunk.
- **Modo Mestre** (escondido) — revela senhas e conteúdo trancado sem destrancar
  pros jogadores.
- **Som sintetizado** — clique de tecla, beep de sucesso/erro, whoosh de boot e
  hum ambiente opcional, com volume controlável.
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

### Deploy

A cada push em `main`, [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
publica no **GitHub Pages** (o `base` do Vite é ajustado por modo). Pra servir na
raiz do domínio via **Netlify**, [`netlify.toml`](netlify.toml) já está pronto —
conecte o repo e dê deploy.

---

## Documentação (Wiki)

A referência detalhada vive na **[Wiki](https://github.com/flippelt/Immersive-Terminal-for-RPGs/wiki)**:

- **[Comandos](https://github.com/flippelt/Immersive-Terminal-for-RPGs/wiki/Commands)** — todos os comandos, atalhos, Modo Mestre, carregar campanha pela URL.
- **[Autoria: Temas](https://github.com/flippelt/Immersive-Terminal-for-RPGs/wiki/Authoring-Themes)** — o JSON da skin (paleta, fonte, CRT, sons, banner, boot).
- **[Autoria: Cenários](https://github.com/flippelt/Immersive-Terminal-for-RPGs/wiki/Authoring-Scenarios)** — pasta do cenário, `scenario.json`, árvore `files/`, markdown, login.
- **[Arquivos Trancados](https://github.com/flippelt/Immersive-Terminal-for-RPGs/wiki/Locked-Files)** — front-matter, `crack` vs `decrypt`, teste de dificuldade, cadeias.
- **[Cinematografia](https://github.com/flippelt/Immersive-Terminal-for-RPGs/wiki/Cinematics)** — eventos, contagens, autodestruição, o rastreador.
- **[Arquitetura](https://github.com/flippelt/Immersive-Terminal-for-RPGs/wiki/Architecture)** — layout do código e as fontes.

Resumo rápido: navegue com `ls`/`cd`/`cat`, abra arquivos trancados com `crack`/
`decrypt`, troque de sistema com `theme` e de campanha com `scenario`. Ligue o
**Modo Mestre** com `Ctrl+Shift+G`. Carregue uma campanha direto pela URL:
`.../?theme=cprd&scenario=heimdall`.

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
