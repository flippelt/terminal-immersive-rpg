# Política de segurança

## Reportar vulnerabilidade

Use o canal privado do GitHub:
[**abrir um security advisory**](https://github.com/flippelt/Immersive-Terminal-for-RPGs/security/advisories/new).

Não abra *issue pública* para problemas de segurança — vulnerabilidades são
tratadas em advisory privado até haver patch.

Você receberá uma resposta em até **7 dias corridos**. Patches são aplicados
direto em `main` (não há branches de release).

## Escopo

Este projeto é um **site estático** sem backend, sem banco de dados, sem
autenticação. Vetores relevantes:

- **XSS via tema JSON**: `cat` renderiza conteúdo de arquivos como texto
  (cada linha vira `<p>`), sem `dangerouslySetInnerHTML`. Se você adicionar
  novos componentes, mantenha esse contrato.
- **Injeção de comando**: o parser usa `split(/\s+/)` + dispatch por
  allowlist (`COMMANDS` em `src/engine/commands.js`). Comandos customizados
  via tema retornam **linhas estáticas** — não executam JavaScript do JSON.
- **Recursos externos**: Google Fonts é a única chamada externa. Pode ser
  removida usando `.woff2` self-hosted em [public/fonts/](public/fonts/).
- **LocalStorage**: armazena apenas o ID do tema escolhido. Sem PII.

## Fora de escopo

- Ataques que requerem comprometimento prévio da máquina do jogador.
- DoS pelo próprio jogador (clicar `reboot` mil vezes).

## Dependências

`npm audit` roda em todo CI. Dependabot abre PRs semanais com correções.
