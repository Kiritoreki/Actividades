-- ============================================================
-- Actividades · Actividades compartidas entre los dispositivos aprobados
-- Pegar TODO este archivo en Supabase → SQL Editor → New query → Run.
-- Requiere haber ejecutado antes acceso.sql. Se puede volver a ejecutar sin perder nada.
-- ============================================================

create table if not exists public.act_actividades (
  id          text primary key,
  data        jsonb not null default '{}',
  upd         bigint not null default 0,          -- hora del último cambio (en el teléfono, ms)
  borrado     boolean not null default false,
  creado_por  text,
  editado_por text,
  srv_ts      timestamptz not null default clock_timestamp()  -- hora en que llegó al servidor
);
create index if not exists act_actividades_srv_idx on public.act_actividades (srv_ts);

create or replace function public.act_aprobado() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.act_mi_rol() in ('admin','tecnico'), false)
$$;

-- Guarda varios cambios a la vez; si dos editan lo mismo, gana el cambio más reciente.
create or replace function public.act_guardar(p jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare r jsonb; n int := 0;
begin
  if not public.act_aprobado() then raise exception 'sin acceso'; end if;
  for r in select * from jsonb_array_elements(p) loop
    insert into public.act_actividades as t (id, data, upd, borrado, creado_por, editado_por, srv_ts)
    values (r->>'id', coalesce(r->'data','{}'::jsonb), coalesce((r->>'upd')::bigint,0), coalesce((r->>'borrado')::boolean,false),
            r->>'creado_por', r->>'editado_por', clock_timestamp())
    on conflict (id) do update
      set data = excluded.data, upd = excluded.upd, borrado = excluded.borrado,
          creado_por = coalesce(t.creado_por, excluded.creado_por), editado_por = excluded.editado_por, srv_ts = clock_timestamp()
      where t.upd <= excluded.upd;
    n := n + 1;
  end loop;
  return n;
end $$;

alter table public.act_actividades enable row level security;
drop policy if exists act_act_leer on public.act_actividades;
create policy act_act_leer on public.act_actividades for select using (public.act_aprobado());

grant select on public.act_actividades to authenticated;
grant execute on function public.act_aprobado(), public.act_guardar(jsonb) to authenticated;
revoke all on public.act_actividades from anon;
