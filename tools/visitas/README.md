# Contador de visitas — banco (Supabase · tuglife-fm)

Versão 3.10.0 (SPRINT 29) · 2026-10-15T18:45:00-03:00 · Jossian Brito

`migracao.sql` é a cópia da migração `v3_10_contador_visitas`, **já aplicada** no projeto `tuglife-fm`.
Fica aqui para registro e para recriar o banco do zero, se um dia for preciso.

- `visitas_aparelhos`: um código aleatório por aparelho (UUID sorteado no app), primeiro e último dia, hora da última visita e total de visitas. Sem IP, nome ou localização.
- `visitas_diarias`: visitas e aparelhos distintos por dia (fuso de Brasília).
- `registrar_visita(p_aparelho uuid)`: única porta de entrada do app. Conta a visita só se a última daquele aparelho tiver mais de 30 min e devolve `{visitas, aparelhos, hoje}`.

As duas tabelas têm RLS ligado e nenhuma política: o público não lê nem grava nelas diretamente.

Consulta útil (SQL Editor do Supabase), visitas dos últimos 30 dias:

```sql
select dia, visitas, aparelhos from public.visitas_diarias
where dia > current_date - 30 order by dia desc;
```
