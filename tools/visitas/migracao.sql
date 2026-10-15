-- TugLife FM v3.10.0 (SPRINT 29) · 2026-10-15T18:45:00-03:00 · Jossian Brito
-- Migração v3_10_contador_visitas (já aplicada no projeto tuglife-fm).
-- Contador de visitas anônimo: nenhum IP, nome ou localização.
create table public.visitas_aparelhos (
  id uuid primary key,                       -- código aleatório sorteado no aparelho
  primeiro_dia date not null,
  ultimo_dia date not null,
  ultima_visita timestamptz not null default now(),
  visitas integer not null default 1
);
create table public.visitas_diarias (
  dia date primary key,
  visitas integer not null default 0,
  aparelhos integer not null default 0       -- aparelhos distintos naquele dia
);
alter table public.visitas_aparelhos enable row level security;
alter table public.visitas_diarias enable row level security;
revoke all on public.visitas_aparelhos, public.visitas_diarias from anon, authenticated;

-- Registra a abertura do app e devolve os totais.
-- Regra da visita: no máximo 1 a cada 30 min por aparelho (o servidor decide):
--   conta = (agora − ultima_visita) > 30 min
create or replace function public.registrar_visita(p_aparelho uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_agora timestamptz := now();
  v_dia date := (v_agora at time zone 'America/Sao_Paulo')::date;
  v_ant public.visitas_aparelhos%rowtype;
  v_conta boolean := false;
  v_novo_no_dia boolean := false;
begin
  if p_aparelho is not null then
    select * into v_ant from public.visitas_aparelhos where id = p_aparelho for update;
    if not found then
      insert into public.visitas_aparelhos (id, primeiro_dia, ultimo_dia, ultima_visita, visitas)
      values (p_aparelho, v_dia, v_dia, v_agora, 1);
      v_conta := true; v_novo_no_dia := true;
    elsif v_ant.ultima_visita < v_agora - interval '30 minutes' then
      v_novo_no_dia := v_ant.ultimo_dia < v_dia;
      update public.visitas_aparelhos
         set ultimo_dia = v_dia, ultima_visita = v_agora, visitas = visitas + 1
       where id = p_aparelho;
      v_conta := true;
    end if;
    if v_conta then
      insert into public.visitas_diarias as d (dia, visitas, aparelhos)
      values (v_dia, 1, case when v_novo_no_dia then 1 else 0 end)
      on conflict (dia) do update
        set visitas = d.visitas + 1,
            aparelhos = d.aparelhos + case when v_novo_no_dia then 1 else 0 end;
    end if;
  end if;
  return jsonb_build_object(
    'visitas',   (select coalesce(sum(visitas), 0) from public.visitas_diarias),
    'aparelhos', (select count(*) from public.visitas_aparelhos),
    'hoje',      (select coalesce(max(visitas), 0) from public.visitas_diarias where dia = v_dia)
  );
end;
$$;
revoke all on function public.registrar_visita(uuid) from public;
grant execute on function public.registrar_visita(uuid) to anon, authenticated;
