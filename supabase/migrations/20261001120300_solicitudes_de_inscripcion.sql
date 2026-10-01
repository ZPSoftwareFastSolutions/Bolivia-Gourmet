-- ============================================================================
-- 0004 · Solicitudes de inscripción y de renovación (portal de estudiantes)
-- ----------------------------------------------------------------------------
-- El estudiante, con su cuenta, pide inscribirse o renovar su gestión. Ve
-- solo lo suyo y solo puede CANCELAR una solicitud pendiente. Recepción y
-- administración las leen todas y deciden (aprobar, rechazar, en revisión).
--
-- Qué decide cada capa:
--   - RLS      → qué filas ve y toca cada uno.
--   - GRANTS   → qué columnas puede escribir el cliente (el estado inicial,
--                el autor y la revisión NO están entre ellas).
--   - DISPARADORES → transiciones de estado válidas, reglas que cruzan tablas
--                (paquete solo en carrera, programa activo) y límites de abuso.
-- Las opciones del programa (turno, días, duración) las valida el dominio
-- contra el catálogo antes de llegar aquí.
-- ============================================================================

create type public.tipo_de_solicitud as enum ('inscripcion', 'renovacion');
create type public.estado_de_solicitud as enum ('pendiente', 'en_revision', 'aprobada', 'rechazada', 'cancelada');
create type public.paquete_de_pago as enum ('economico', 'ahorrador');

create table public.solicitudes (
  id uuid primary key default gen_random_uuid(),
  -- El autor sale de la sesión: no hay grant de INSERT sobre esta columna.
  estudiante_id uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  tipo public.tipo_de_solicitud not null,
  programa_codigo text not null references public.programas (codigo),
  sede_id uuid not null references public.sedes (id),
  turno text check (turno in ('manana', 'tarde', 'noche', 'especial', 'unico')),
  dias text check (dias ~ '^[a-z]{3}(-[a-z]{3})?$'),
  duracion smallint check (duracion between 1 and 12),
  modalidad text check (modalidad in ('practico', 'magistral', 'virtual')),
  paquete public.paquete_de_pago,
  gestion_anterior text check (gestion_anterior is null or char_length(trim(gestion_anterior)) between 1 and 60),
  mensaje text check (mensaje is null or char_length(mensaje) <= 500),
  estado public.estado_de_solicitud not null default 'pendiente',
  respuesta text check (respuesta is null or char_length(respuesta) <= 500),
  revisado_por uuid references public.perfiles (id),
  revisado_en timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Una renovación dice de qué gestión viene; una inscripción, no.
  constraint solicitudes_gestion_coherente check (
    (tipo = 'renovacion' and gestion_anterior is not null)
    or (tipo = 'inscripcion' and gestion_anterior is null)
  )
);

comment on table public.solicitudes is
  'Solicitudes de inscripción y renovación hechas por estudiantes desde el portal web.';

create index solicitudes_estudiante_idx on public.solicitudes (estudiante_id, created_at desc);
create index solicitudes_estado_idx on public.solicitudes (estado, created_at desc);
create index solicitudes_programa_idx on public.solicitudes (programa_codigo);
create index solicitudes_sede_idx on public.solicitudes (sede_id);
create index solicitudes_revisor_idx on public.solicitudes (revisado_por);

create trigger solicitudes_actualizado
  before update on public.solicitudes
  for each row execute function app.marcar_actualizado();

-- ---------------------------------------------------------------- alta

create or replace function app.validar_alta_de_solicitud()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_programa public.programas%rowtype;
  v_abiertas integer;
begin
  -- Estado inicial y revisión los fija la base, no el cliente.
  new.estado := 'pendiente';
  new.respuesta := null;
  new.revisado_por := null;
  new.revisado_en := null;

  if new.estudiante_id is distinct from (select auth.uid()) then
    raise exception 'Solo puedes crear solicitudes a tu nombre.' using errcode = '42501';
  end if;

  select * into v_programa from public.programas where codigo = new.programa_codigo;
  if not found or not v_programa.activo then
    raise exception 'El programa elegido no está disponible.' using errcode = '23514';
  end if;

  if not exists (select 1 from public.sedes where id = new.sede_id and activa) then
    raise exception 'La sede elegida no está disponible.' using errcode = '23514';
  end if;

  if v_programa.tipo = 'carrera' and new.tipo = 'inscripcion' and new.paquete is null then
    raise exception 'La inscripción a la carrera debe indicar el paquete.' using errcode = '23514';
  end if;
  if v_programa.tipo <> 'carrera' and new.paquete is not null then
    raise exception 'Solo la carrera se inscribe por paquete.' using errcode = '23514';
  end if;

  -- Una solicitud abierta por programa y tipo: evita duplicados por doble envío.
  if exists (
    select 1 from public.solicitudes
    where estudiante_id = new.estudiante_id
      and programa_codigo = new.programa_codigo
      and tipo = new.tipo
      and estado in ('pendiente', 'en_revision')
  ) then
    raise exception 'Ya tienes una solicitud abierta para este programa.' using errcode = '23505';
  end if;

  -- Límite de abuso: un registro abierto no puede inundar la bandeja de recepción.
  select count(*) into v_abiertas from public.solicitudes
  where estudiante_id = new.estudiante_id and estado in ('pendiente', 'en_revision');
  if v_abiertas >= 5 then
    raise exception 'Tienes demasiadas solicitudes en curso. Espera la respuesta de la institución.'
      using errcode = '54000';
  end if;

  return new;
end;
$$;

revoke all on function app.validar_alta_de_solicitud() from public;

create trigger solicitudes_validar_alta
  before insert on public.solicitudes
  for each row execute function app.validar_alta_de_solicitud();

-- ---------------------------------------------------------------- cambios de estado

create or replace function app.validar_cambio_de_solicitud()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gestiona boolean := app.tiene_permiso('solicitudes.gestionar');
begin
  if new.estado = old.estado and new.respuesta is not distinct from old.respuesta then
    return new;
  end if;

  if old.estado in ('cancelada', 'rechazada', 'aprobada') and not v_gestiona then
    raise exception 'Esta solicitud ya está cerrada.' using errcode = '23514';
  end if;

  if v_gestiona then
    if new.estado = 'cancelada' and old.estudiante_id <> (select auth.uid()) then
      raise exception 'Solo el estudiante cancela su solicitud; la institución la rechaza.' using errcode = '23514';
    end if;
    new.revisado_por := (select auth.uid());
    new.revisado_en := now();
    return new;
  end if;

  -- El estudiante solo puede retirar una solicitud que nadie ha empezado a revisar.
  if old.estudiante_id = (select auth.uid())
     and old.estado = 'pendiente'
     and new.estado = 'cancelada'
     and new.respuesta is not distinct from old.respuesta
  then
    return new;
  end if;

  raise exception 'No puedes hacer ese cambio en la solicitud.' using errcode = '42501';
end;
$$;

revoke all on function app.validar_cambio_de_solicitud() from public;

create trigger solicitudes_validar_cambio
  before update on public.solicitudes
  for each row execute function app.validar_cambio_de_solicitud();

-- ---------------------------------------------------------------- RLS y grants

alter table public.solicitudes enable row level security;

revoke all on table public.solicitudes from anon, authenticated;
grant select on table public.solicitudes to authenticated;
grant insert (tipo, programa_codigo, sede_id, turno, dias, duracion, modalidad, paquete, gestion_anterior, mensaje)
  on table public.solicitudes to authenticated;
grant update (estado, respuesta) on table public.solicitudes to authenticated;

create policy solicitudes_lectura
  on public.solicitudes for select
  to authenticated
  using (estudiante_id = (select auth.uid()) or (select app.tiene_permiso('solicitudes.leer')));

create policy solicitudes_alta_propia
  on public.solicitudes for insert
  to authenticated
  with check (estudiante_id = (select auth.uid()));

create policy solicitudes_cambio
  on public.solicitudes for update
  to authenticated
  using (estudiante_id = (select auth.uid()) or (select app.tiene_permiso('solicitudes.gestionar')))
  with check (estudiante_id = (select auth.uid()) or (select app.tiene_permiso('solicitudes.gestionar')));

-- Sin política de DELETE: una solicitud no se borra, se cancela o se rechaza.
