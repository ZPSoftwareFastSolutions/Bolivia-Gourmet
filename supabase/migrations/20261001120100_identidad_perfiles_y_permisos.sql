-- ============================================================================
-- 0002 · Identidad: perfiles, roles y permisos por rol
-- ----------------------------------------------------------------------------
-- Tres roles fijos (aclaraciones 2026-10-01 §3): administrador y recepción en
-- el sistema interno; estudiante en el portal web. Los permisos por rol viven
-- en una tabla para poder ajustar qué hace cada uno sin tocar código (ADR 0005).
--
-- INVARIANTE CRÍTICA: quien se registra en la web es SIEMPRE estudiante y
-- jamás puede cambiar su rol. El rol no sale de los metadatos del registro
-- (los escribe el propio usuario) y la columna solo la modifica quien tiene
-- `perfiles.gestionar`.
-- ============================================================================

create type public.rol_de_usuario as enum ('administrador', 'recepcion', 'estudiante');

create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  rol public.rol_de_usuario not null default 'estudiante',
  correo text,
  nombres text not null default '' check (char_length(nombres) <= 80),
  apellidos text not null default '' check (char_length(apellidos) <= 80),
  documento text check (documento is null or documento ~ '^[0-9A-Za-z-]{4,20}$'),
  telefono text check (telefono is null or telefono ~ '^[67][0-9]{7}$'),
  sede_id uuid references public.sedes (id),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.perfiles is
  'Perfil de negocio de cada cuenta de Supabase Auth. El rol lo asigna la base, nunca el registro.';

-- Sin índice ÚNICO en documento: con registro abierto, alguien podría ocupar el
-- carnet de otra persona y bloquearle el alta. Recepción resuelve duplicados.
create index perfiles_documento_idx on public.perfiles (documento) where documento is not null;
create index perfiles_rol_idx on public.perfiles (rol);
create index perfiles_sede_idx on public.perfiles (sede_id);

create trigger perfiles_actualizado
  before update on public.perfiles
  for each row execute function app.marcar_actualizado();

-- ---------------------------------------------------------------- permisos

create table public.permisos_de_rol (
  rol public.rol_de_usuario not null,
  permiso text not null check (permiso ~ '^[a-z_]+\.[a-z_]+$'),
  primary key (rol, permiso)
);

comment on table public.permisos_de_rol is
  'Qué puede hacer cada rol. El estudiante no tiene permisos de módulo: accede a lo suyo por identidad.';

insert into public.permisos_de_rol (rol, permiso) values
  ('administrador', 'perfiles.leer'),
  ('administrador', 'perfiles.gestionar'),
  ('administrador', 'sedes.gestionar'),
  ('administrador', 'programas.gestionar'),
  ('administrador', 'solicitudes.leer'),
  ('administrador', 'solicitudes.gestionar'),
  ('recepcion', 'perfiles.leer'),
  ('recepcion', 'solicitudes.leer'),
  ('recepcion', 'solicitudes.gestionar');

-- ---------------------------------------------------------------- contexto

-- SECURITY DEFINER: lee `perfiles` sin pasar por su RLS. Si fuera INVOKER, la
-- política de `perfiles` que la llama entraría en recursión. Vive en `app`,
-- fuera de la API, y no recibe columnas de la fila: se evalúa una vez por
-- consulta cuando la política la envuelve en (select …).
create or replace function app.tiene_permiso(p_permiso text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfiles p
    join public.permisos_de_rol r on r.rol = p.rol
    where p.id = (select auth.uid())
      and p.activo
      and r.permiso = p_permiso
  );
$$;

create or replace function app.rol_actual()
returns public.rol_de_usuario
language sql
stable
security definer
set search_path = ''
as $$
  select p.rol from public.perfiles p where p.id = (select auth.uid()) and p.activo;
$$;

revoke all on function app.tiene_permiso(text) from public;
revoke all on function app.rol_actual() from public;
grant execute on function app.tiene_permiso(text) to authenticated;
grant execute on function app.rol_actual() to authenticated;

-- ---------------------------------------------------------------- alta automática

-- Cada cuenta nueva de Auth recibe su perfil de ESTUDIANTE. De los metadatos
-- del registro solo se toman datos de contacto, saneados: si un teléfono o un
-- documento no cumplen el formato se guardan vacíos en vez de tumbar el alta.
-- El rol NO se lee de ahí: lo escribe el usuario y sería autoasignarse.
create or replace function app.crear_perfil_de_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_telefono text := regexp_replace(coalesce(new.raw_user_meta_data ->> 'telefono', ''), '\s', '', 'g');
  v_documento text := upper(trim(coalesce(new.raw_user_meta_data ->> 'documento', '')));
begin
  insert into public.perfiles (id, correo, nombres, apellidos, telefono, documento)
  values (
    new.id,
    new.email,
    left(trim(coalesce(new.raw_user_meta_data ->> 'nombres', '')), 80),
    left(trim(coalesce(new.raw_user_meta_data ->> 'apellidos', '')), 80),
    case when v_telefono ~ '^[67][0-9]{7}$' then v_telefono end,
    case when v_documento ~ '^[0-9A-Z-]{4,20}$' then v_documento end
  );
  return new;
end;
$$;

revoke all on function app.crear_perfil_de_usuario() from public;

create trigger perfiles_alta_automatica
  after insert on auth.users
  for each row execute function app.crear_perfil_de_usuario();

-- Si la cuenta cambia de correo, el perfil lo refleja (recepción lo usa).
create or replace function app.sincronizar_correo_de_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.perfiles set correo = new.email where id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function app.sincronizar_correo_de_perfil() from public;

create trigger perfiles_correo_sincronizado
  after update of email on auth.users
  for each row execute function app.sincronizar_correo_de_perfil();

-- ---------------------------------------------------------------- guarda de columnas sensibles

-- Rol, estado y sede solo los cambia quien gestiona perfiles; y el instituto
-- nunca se queda sin un administrador activo.
create or replace function app.proteger_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.rol is distinct from old.rol
      or new.activo is distinct from old.activo
      or new.sede_id is distinct from old.sede_id
      or new.correo is distinct from old.correo)
     and not app.tiene_permiso('perfiles.gestionar')
     -- El disparador de Auth sincroniza el correo sin sesión de usuario.
     and (select auth.uid()) is not null
  then
    raise exception 'No tienes permiso para cambiar el rol, el estado, la sede o el correo de un perfil.'
      using errcode = '42501';
  end if;

  if old.rol = 'administrador' and old.activo
     and (new.rol <> 'administrador' or not new.activo)
     and not exists (
       select 1 from public.perfiles
       where rol = 'administrador' and activo and id <> old.id
     )
  then
    raise exception 'El instituto no puede quedarse sin un administrador activo.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function app.proteger_perfil() from public;

create trigger perfiles_proteccion
  before update on public.perfiles
  for each row execute function app.proteger_perfil();

-- ---------------------------------------------------------------- RLS y grants

alter table public.perfiles enable row level security;
alter table public.permisos_de_rol enable row level security;

revoke all on table public.perfiles from anon, authenticated;
revoke all on table public.permisos_de_rol from anon, authenticated;

grant select on table public.perfiles to authenticated;
-- Lo que el propio usuario puede editar de sí mismo. Rol, activo, sede y
-- correo se conceden aparte y los vigila `app.proteger_perfil`.
grant update (nombres, apellidos, documento, telefono, rol, activo, sede_id) on table public.perfiles to authenticated;
grant select on table public.permisos_de_rol to authenticated;

create policy perfiles_lectura
  on public.perfiles for select
  to authenticated
  using (id = (select auth.uid()) or (select app.tiene_permiso('perfiles.leer')));

create policy perfiles_edicion
  on public.perfiles for update
  to authenticated
  using (id = (select auth.uid()) or (select app.tiene_permiso('perfiles.gestionar')))
  with check (id = (select auth.uid()) or (select app.tiene_permiso('perfiles.gestionar')));

-- Cada cuenta ve los permisos de su propio rol (la interfaz decide qué mostrar).
create policy permisos_lectura_propia
  on public.permisos_de_rol for select
  to authenticated
  using (rol = (select app.rol_actual()));

-- Sin políticas de INSERT ni DELETE: el perfil lo crea el disparador y se
-- borra en cascada con la cuenta. Sin política = denegado.
