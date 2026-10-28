-- ============================================================
-- Actividades · Acceso por dispositivo (mismo proyecto de Visitas)
-- Pegar TODO este archivo en Supabase → SQL Editor → Run.
-- No toca las tablas de Visitas. Se puede volver a ejecutar sin perder nada.
-- ============================================================

create table if not exists public.act_dispositivos (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  nombre  text not null default 'Dispositivo',
  codigo  text not null,
  rol     text not null default 'pendiente' check (rol in ('pendiente','admin','tecnico','bloqueado')),
  creado  timestamptz not null default now()
);

create table if not exists public.act_ajustes (
  id int primary key default 1 check (id = 1),
  solicitudes_abiertas boolean not null default true
);
insert into public.act_ajustes (id) values (1) on conflict (id) do nothing;

create or replace function public.act_mi_rol() returns text
language sql stable security definer set search_path = public as $$
  select rol from public.act_dispositivos where user_id = auth.uid()
$$;
create or replace function public.act_es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.act_mi_rol() = 'admin', false)
$$;
create or replace function public.act_hay_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.act_dispositivos where rol = 'admin')
$$;
create or replace function public.act_solicitudes_abiertas() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select solicitudes_abiertas from public.act_ajustes where id = 1), true)
$$;
-- El primer dispositivo que lo pida queda como administrador (solo si aún no hay ninguno).
create or replace function public.act_reclamar_admin() returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.act_dispositivos where rol = 'admin') then return false; end if;
  update public.act_dispositivos set rol = 'admin' where user_id = auth.uid();
  return found;
end $$;

alter table public.act_dispositivos enable row level security;
alter table public.act_ajustes      enable row level security;

drop policy if exists act_disp_ver   on public.act_dispositivos;
drop policy if exists act_disp_pedir on public.act_dispositivos;
drop policy if exists act_disp_up    on public.act_dispositivos;
drop policy if exists act_disp_de    on public.act_dispositivos;
create policy act_disp_ver   on public.act_dispositivos for select using (user_id = auth.uid() or public.act_es_admin());
create policy act_disp_pedir on public.act_dispositivos for insert with check (user_id = auth.uid() and rol = 'pendiente' and public.act_solicitudes_abiertas());
create policy act_disp_up    on public.act_dispositivos for update using (public.act_es_admin()) with check (public.act_es_admin());
create policy act_disp_de    on public.act_dispositivos for delete using (public.act_es_admin());

drop policy if exists act_aj_leer   on public.act_ajustes;
drop policy if exists act_aj_editar on public.act_ajustes;
create policy act_aj_leer   on public.act_ajustes for select using (public.act_es_admin());
create policy act_aj_editar on public.act_ajustes for update using (public.act_es_admin()) with check (public.act_es_admin());

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.act_dispositivos to authenticated;
grant select, update on public.act_ajustes to authenticated;
grant execute on function public.act_mi_rol(), public.act_es_admin(), public.act_hay_admin(), public.act_solicitudes_abiertas(), public.act_reclamar_admin() to authenticated;
revoke all on public.act_dispositivos, public.act_ajustes from anon;
