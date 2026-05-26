# Fontes locais

Coloque arquivos `.woff2` (ou `.woff`/`.ttf`) aqui se quiser **não depender do
Google Fonts** em produção (ex: ambiente offline, autoinstalado, ou apenas para
evitar a chamada externa).

## Como ativar

1. Baixe a fonte (ex: [VT323 no Google Fonts](https://fonts.google.com/specimen/VT323)).
2. Coloque o `.woff2` aqui — vire arquivos como:
   ```
   public/fonts/VT323-Regular.woff2
   public/fonts/ShareTechMono-Regular.woff2
   public/fonts/IBMPlexMono-Regular.woff2
   public/fonts/MajorMonoDisplay-Regular.woff2
   ```
3. Declare `@font-face` em [src/styles/base.css](../../src/styles/base.css):
   ```css
   @font-face {
     font-family: 'VT323';
     src: url('/fonts/VT323-Regular.woff2') format('woff2');
     font-display: swap;
   }
   ```
4. Remova o `<link>` do Google Fonts em [index.html](../../index.html) se quiser
   ficar 100% offline.

Arquivos `.woff2` colocados em `public/` são servidos em `/fonts/<arquivo>` sem
processamento do Vite.

> Esta pasta só guarda binários de fonte. Não comite licenças de fontes
> proprietárias.
