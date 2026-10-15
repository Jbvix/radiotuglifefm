# Programação SAAM · Rio de Janeiro — ponte da Praticagem RJ

Autor: Jossian Brito · SPRINT 27 · app v3.9.0 · 2026-10-15T16:40:00-03:00

| Arquivo | Papel |
|---|---|
| `index.ts` | Edge Function `saam-rj` (Supabase, Deno). Busca https://www.praticagem-rj.com.br/, guarda 60 s, filtra a empresa e responde JSON com CORS. |
| `parser.js` | Lê o HTML da praticagem: áreas, barra, colunas pelo nome do cabeçalho, fichas (tooltips) de navio, rebocadores e CTB. |
| `test.mjs` | Testes com página sintética: `node tools/saam-rj/test.mjs` (acrescente o caminho de uma página real salva para conferir também ela). |

**Por que existe:** a página da praticagem não envia o cabeçalho CORS, então o app (no navegador) não pode lê-la direto.

**Fonte e filtro:** coluna `EMP.RB` (empresa dos rebocadores). Siglas vistas em 15/10/2026: `SAA` (SAAM), `WIL` (Wilson Sons), `CAM` (Camorim), `VAL` (Vale), `N/A` (sem rebocador). O filtro casa `SAA` como palavra inteira.

**Chamada:** `GET https://udedhipgekgonnioofgk.supabase.co/functions/v1/saam-rj` (opcional `?emp=WIL` para testar outra empresa). Pública, só leitura, sem banco e sem segredo.

**Publicar** (projeto `tuglife-fm`, `udedhipgekgonnioofgk`), copiando esta pasta para `supabase/functions/saam-rj/`:
```bash
supabase functions deploy saam-rj --no-verify-jwt
```

**Se a página mudar de formato:** salve a página (`curl -o pagina.html https://www.praticagem-rj.com.br/`), rode `node tools/saam-rj/test.mjs pagina.html` e ajuste `parser.js`.
