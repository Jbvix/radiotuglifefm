# Programação SAAM · Suape — coletor e regras

Autor: Jossian Brito · SPRINT 18 · 2026-10-12

| Arquivo | Papel |
|---|---|
| `index.ts` | Edge Function `saam-suape-sync` (Supabase). Baixa a planilha, compara, grava, envia push. |
| `parser.js` | Lê o .xlsx (sem bibliotecas pesadas): abas visíveis, colunas pelo nome do cabeçalho. |
| `regras.js` | Casa manobras entre leituras (IMO + tipo + horário mais próximo) e gera os 3 alertas. |
| `test.mjs` | Testes com planilha sintética: `npm i xlsx fflate && node test.mjs` |

Agendamento: `pg_cron` a cada 2 min (`saam-suape-sync`) chama a função com o cabeçalho `x-cron-token`.
Leitura de teste sem gravar: `POST .../functions/v1/saam-suape-sync?dry=1` com o mesmo cabeçalho.

Banco (projeto `tuglife-fm`): `saam_manobras`, `saam_eventos`, `saam_push`, `saam_config` (PIN em hash,
chaves VAPID, link da planilha, token do cron), `saam_sync`, `saam_pin_falhas`. Nenhuma tabela é legível
pela API pública; o app usa as funções `saam_programacao(pin)`, `saam_push_registrar(...)` e
`saam_push_desligar(endpoint)`.

Trocar o PIN (SQL Editor do Supabase):
```sql
update saam_config set valor = extensions.crypt('NOVO_PIN', extensions.gen_salt('bf', 10)) where chave = 'pin_hash';
```
