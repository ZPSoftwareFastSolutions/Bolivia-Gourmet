-- ============================================================================
-- 0006 · Sistema interno · Alumnos y grupos (rebanada R2)
-- ----------------------------------------------------------------------------
-- La persona (`estudiantes`, la ficha), los grupos de cada programa
-- (`cohortes`, «grupos» en pantalla), cuánto y cuándo se cobra en un grupo
-- (`planes_de_pago`), los conceptos de ingreso y gasto (`conceptos`, semilla
-- fija en la v1) y las inscripciones.
--
-- Qué decide cada capa (especificación §3, enmiendas B):
--   - RLS + GRANTS por columna → qué filas ve cada uno y qué edita directo
--     (datos de la ficha, grupos y planes de administración).
--   - RPC (fachada INVOKER en public → motor DEFINER en app) → todo lo que
--     cruza tablas: crear ficha, inscribir, aprobar una solicitud, retirar,
--     cerrar un grupo. Cada motor exige su permiso en la primera línea.
--   - DISPARADORES → reglas que no se pueden saltar por ningún camino
--     (paquete solo en la carrera, cupo, grupos cerrados, archivar).
--
-- Las cuotas (cargos) llegan con la caja (R3): aquí `app.generar_cuotas`,
-- `app.al_retirar` y `app.alumnos_que_deben` devuelven 0 y la R3 los
-- reemplaza sin tocar los motores que los llaman.
-- ============================================================================

-- ---------------------------------------------------------------- tipos

create type public.estado_de_grupo as enum ('planificado', 'abierto', 'en_curso', 'cerrado');
create type public.estado_de_inscripcion as enum ('inscrito', 'retirado', 'concluido');
create type public.naturaleza_de_concepto as enum ('ingreso', 'gasto');

-- ---------------------------------------------------------------- conceptos

create table public.conceptos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (codigo ~ '^[a-z]+(-[a-z]+)*$'),
  nombre text not null check (char_length(nombre) between 2 and 60),
  naturaleza public.naturaleza_de_concepto not null,
  grupo text not null check (char_length(grupo) between 2 and 40),
  icono text not null default 'monedas' check (icono ~ '^[a-zA-Z]+$'),
  del_sistema boolean not null default false,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.conceptos is
  'Conceptos de ingreso y de gasto (sin precio: los precios viven en los planes de pago y en los artículos).';

create trigger conceptos_actualizado
  before update on public.conceptos
  for each row execute function app.marcar_actualizado();

insert into public.conceptos (codigo, nombre, naturaleza, grupo, icono, del_sistema) values
  ('colegiatura-carrera', 'Paquete de la carrera', 'ingreso', 'Colegiaturas', 'graduacion', true),
  ('curso-capacitacion', 'Curso de capacitación', 'ingreso', 'Colegiaturas', 'gorro', true),
  ('venta-uniforme', 'Venta de uniforme', 'ingreso', 'Ventas', 'chaqueta', true),
  ('reposicion-utensilio', 'Reposición de utensilio', 'ingreso', 'Ventas', 'cubiertos', true),
  ('otro-ingreso', 'Otro ingreso', 'ingreso', 'Otros ingresos', 'monedas', true),
  ('alquiler', 'Alquiler', 'gasto', 'Local', 'casa', false),
  ('servicios-basicos', 'Servicios básicos (luz, agua, gas, internet)', 'gasto', 'Local', 'chispas', false),
  ('sueldos-y-honorarios', 'Sueldos y honorarios', 'gasto', 'Personal', 'grupo', false),
  ('mantenimiento', 'Mantenimiento', 'gasto', 'Local', 'engranaje', false),
  ('limpieza', 'Limpieza', 'gasto', 'Local', 'chispas', false),
  ('material-de-oficina', 'Material de oficina', 'gasto', 'Administración', 'documento', false),
  ('publicidad', 'Publicidad', 'gasto', 'Administración', 'campana', false),
  ('transporte', 'Transporte', 'gasto', 'Administración', 'flecha', false),
  ('tramites', 'Trámites', 'gasto', 'Administración', 'documento', false),
  ('otro-gasto', 'Otro gasto', 'gasto', 'Otros gastos', 'recibo', true);

alter table public.conceptos enable row level security;
revoke all on table public.conceptos from anon, authenticated;
grant select on table public.conceptos to authenticated;
-- La pantalla de conceptos pasa a la v1.1 (enmiendas A.2): sin escritura por la API.

create policy conceptos_lectura
  on public.conceptos for select
  to authenticated
  using ((select app.tiene_permiso('caja.leer')) or (select app.tiene_permiso('cohortes.leer')));

-- ---------------------------------------------------------------- estudiantes (fichas)

create table public.estudiantes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (codigo ~ '^BG-[0-9]{4}-[0-9]{4,}$'),
  perfil_id uuid unique references public.perfiles (id) on delete set null,
  nombres text not null check (char_length(nombres) between 1 and 80),
  apellidos text not null check (char_length(apellidos) between 1 and 80),
  documento text check (documento is null or documento ~ '^[0-9A-Za-z-]{4,20}$'),
  telefono text check (telefono is null or telefono ~ '^[67][0-9]{7}$'),
  correo text check (correo is null or (correo = lower(correo) and correo ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  fecha_de_nacimiento date check (fecha_de_nacimiento is null or fecha_de_nacimiento between date '1920-01-01' and date '2020-12-31'),
  sede_id uuid not null references public.sedes (id),
  observaciones text check (observaciones is null or char_length(observaciones) <= 500),
  nombre_busqueda text generated always as (
    lower(translate(nombres || ' ' || apellidos, 'ÁÉÍÓÚáéíóúÑñÜü', 'AEIOUaeiouNnUu'))
  ) stored,
  archivado_en timestamptz,
  archivado_por uuid references public.perfiles (id),
  archivado_motivo text check (archivado_motivo is null or char_length(archivado_motivo) between 3 and 300),
  registrado_por uuid not null default auth.uid() references public.perfiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.estudiantes is
  'Ficha de cada alumno, tenga o no cuenta del portal. No se borra: se archiva.';

-- Un carnet no se repite entre fichas vivas (las archivadas no estorban).
create unique index estudiantes_documento_unico on public.estudiantes (upper(documento))
  where documento is not null and archivado_en is null;
create index estudiantes_sede_idx on public.estudiantes (sede_id);
create index estudiantes_busqueda_idx on public.estudiantes (nombre_busqueda);
create index estudiantes_archivado_por_idx on public.estudiantes (archivado_por);
create index estudiantes_registrado_por_idx on public.estudiantes (registrado_por);

create trigger estudiantes_actualizado
  before update on public.estudiantes
  for each row execute function app.marcar_actualizado();

-- Código correlativo por año («BG-2026-0007») con candado consultivo: dos
-- altas simultáneas nunca reciben el mismo número (enmiendas B.13, 42).
create or replace function app.siguiente_codigo_de_estudiante()
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_anio text := to_char(app.hoy(), 'YYYY');
  v_ultimo integer;
begin
  perform pg_advisory_xact_lock(hashtext('codigo_estudiante:' || v_anio));
  select coalesce(max(substring(e.codigo from 9)::integer), 0) into v_ultimo
    from public.estudiantes e
   where e.codigo like 'BG-' || v_anio || '-%';
  return 'BG-' || v_anio || '-' || lpad((v_ultimo + 1)::text, 4, '0');
end;
$$;

revoke all on function app.siguiente_codigo_de_estudiante() from public;

-- INVOKER a propósito: `current_user = 'authenticated'` es la edición directa
-- desde la API; dentro de un motor DEFINER, `current_user` es su dueño.
create or replace function app.preparar_estudiante()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Sin espacios sobrantes; el correo en minúsculas; el carnet en mayúsculas.
  new.nombres := regexp_replace(btrim(new.nombres), '\s+', ' ', 'g');
  new.apellidos := regexp_replace(btrim(new.apellidos), '\s+', ' ', 'g');
  new.documento := nullif(upper(btrim(coalesce(new.documento, ''))), '');
  new.telefono := nullif(btrim(coalesce(new.telefono, '')), '');
  new.correo := nullif(lower(btrim(coalesce(new.correo, ''))), '');
  new.observaciones := nullif(btrim(coalesce(new.observaciones, '')), '');

  if tg_op = 'INSERT' then
    new.codigo := app.siguiente_codigo_de_estudiante();
    new.archivado_en := null;
    new.archivado_por := null;
    new.archivado_motivo := null;
    return new;
  end if;

  new.codigo := old.codigo;
  if new.archivado_en is distinct from old.archivado_en then
    if current_user = 'authenticated' and not app.tiene_permiso('estudiantes.archivar') then
      raise exception using errcode = '42501', message = 'sin_permiso',
        detail = jsonb_build_object('permiso', 'estudiantes.archivar')::text;
    end if;
    if new.archivado_en is not null then
      if app.tiene_inscripcion_vigente(new.id) then
        raise exception using errcode = 'P0001', message = 'alumno_con_inscripcion';
      end if;
      if new.archivado_motivo is null or char_length(btrim(new.archivado_motivo)) < 3 then
        raise exception using errcode = 'P0001', message = 'motivo_requerido';
      end if;
      new.archivado_en := now();
      new.archivado_por := (select auth.uid());
    else
      new.archivado_por := null;
      new.archivado_motivo := null;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function app.preparar_estudiante() from public;

-- ---------------------------------------------------------------- cohortes (grupos)

create table public.cohortes (
  id uuid primary key default gen_random_uuid(),
  programa_codigo text not null references public.programas (codigo),
  sede_id uuid not null references public.sedes (id),
  gestion smallint not null check (gestion between 2020 and 2100),
  anio_de_carrera smallint check (anio_de_carrera between 1 and 3),
  turno text check (turno in ('manana', 'tarde', 'noche', 'especial', 'unico')),
  dias text check (dias ~ '^[a-z]{3}(-[a-z]{3})?$'),
  duracion smallint check (duracion between 1 and 12),
  modalidad text check (modalidad in ('practico', 'magistral', 'virtual')),
  fecha_inicio date not null,
  fecha_fin date,
  capacidad integer check (capacidad > 0),
  estado public.estado_de_grupo not null default 'planificado',
  registrado_por uuid not null default auth.uid() references public.perfiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cohortes_fechas check (fecha_fin is null or fecha_fin >= fecha_inicio)
);

comment on table public.cohortes is
  'Grupos de cada programa (en pantalla, «grupos»): sede, gestión, turno, días, cupos y estado.';

create index cohortes_programa_idx on public.cohortes (programa_codigo, gestion);
create index cohortes_sede_idx on public.cohortes (sede_id, estado);
create index cohortes_registrado_por_idx on public.cohortes (registrado_por);

create trigger cohortes_actualizado
  before update on public.cohortes
  for each row execute function app.marcar_actualizado();

-- ---------------------------------------------------------------- planes de pago

create table public.planes_de_pago (
  id uuid primary key default gen_random_uuid(),
  cohorte_id uuid not null references public.cohortes (id) on delete cascade,
  paquete public.paquete_de_pago,
  concepto_id uuid not null references public.conceptos (id),
  monto_cuota bigint not null check (monto_cuota > 0),
  cuotas smallint not null check (cuotas between 1 and 24),
  primer_vencimiento date not null,
  cada_meses smallint not null default 1 check (cada_meses between 1 and 12),
  nota text check (nota is null or char_length(nota) <= 200),
  registrado_por uuid not null default auth.uid() references public.perfiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.planes_de_pago is
  'Cuánto y cuándo se cobra en un grupo (uno por paquete en la carrera). Sin plan, el grupo no tiene precio.';

-- Un plan por paquete en la carrera; uno solo (sin paquete) en los cursos.
create unique index planes_de_pago_paquete_unico on public.planes_de_pago (cohorte_id, paquete) where paquete is not null;
create unique index planes_de_pago_sin_paquete_unico on public.planes_de_pago (cohorte_id) where paquete is null;
create index planes_de_pago_concepto_idx on public.planes_de_pago (concepto_id);
create index planes_de_pago_registrado_por_idx on public.planes_de_pago (registrado_por);

create trigger planes_de_pago_actualizado
  before update on public.planes_de_pago
  for each row execute function app.marcar_actualizado();

-- ---------------------------------------------------------------- inscripciones

create table public.inscripciones (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique,
  operacion_id uuid not null references public.operaciones (clave),
  estudiante_id uuid not null references public.estudiantes (id),
  cohorte_id uuid not null references public.cohortes (id),
  fecha date not null,
  estado public.estado_de_inscripcion not null default 'inscrito',
  paquete public.paquete_de_pago,
  documentos_entregados text[] not null default '{}' check (cardinality(documentos_entregados) <= 20),
  solicitud_id uuid unique references public.solicitudes (id) on delete set null,
  renueva_a uuid unique references public.inscripciones (id),
  motivo_de_retiro text check (motivo_de_retiro is null or char_length(motivo_de_retiro) between 3 and 500),
  observaciones text check (observaciones is null or char_length(observaciones) <= 500),
  registrado_por uuid not null default auth.uid() references public.perfiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inscripciones_retiro_con_motivo check (estado <> 'retirado' or motivo_de_retiro is not null)
);

comment on table public.inscripciones is
  'Inscripción de un alumno en un grupo: inscrito, retirado o concluido. Las cuotas salen del plan del grupo.';

-- Regla E1: una persona no está inscrita dos veces en el mismo grupo.
create unique index inscripciones_vigente_unica on public.inscripciones (estudiante_id, cohorte_id)
  where estado = 'inscrito';
create index inscripciones_estudiante_idx on public.inscripciones (estudiante_id, fecha desc);
create index inscripciones_cohorte_idx on public.inscripciones (cohorte_id, estado);
create index inscripciones_operacion_idx on public.inscripciones (operacion_id);
create index inscripciones_registrado_por_idx on public.inscripciones (registrado_por);

create trigger inscripciones_actualizado
  before update on public.inscripciones
  for each row execute function app.marcar_actualizado();

-- Cuentan sin pasar por la RLS de quien edita: los disparadores de edición
-- directa corren como `authenticated` (INVOKER) para distinguirla del motor.
create or replace function app.contar_inscritos(p_cohorte uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.inscripciones i where i.cohorte_id = p_cohorte and i.estado = 'inscrito';
$$;

create or replace function app.tiene_inscripcion_vigente(p_estudiante uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.inscripciones i where i.estudiante_id = p_estudiante and i.estado = 'inscrito');
$$;

create or replace function app.grupo_tiene_inscripciones(p_cohorte uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.inscripciones i where i.cohorte_id = p_cohorte);
$$;

revoke all on function app.contar_inscritos(uuid) from public;
revoke all on function app.tiene_inscripcion_vigente(uuid) from public;
revoke all on function app.grupo_tiene_inscripciones(uuid) from public;
grant execute on function app.contar_inscritos(uuid) to authenticated;
grant execute on function app.tiene_inscripcion_vigente(uuid) to authenticated;
grant execute on function app.grupo_tiene_inscripciones(uuid) to authenticated;

-- ---------------------------------------------------------------- reglas de grupo, plan e inscripción

-- INVOKER a propósito (ver app.preparar_estudiante).
create or replace function app.validar_grupo()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_tipo public.tipo_de_programa;
  v_activo boolean;
  v_inscritos integer := 0;
  v_directo boolean := current_user = 'authenticated';
begin
  select p.tipo, p.activo into v_tipo, v_activo from public.programas p where p.codigo = new.programa_codigo;

  new.dias := nullif(new.dias, '');
  new.turno := nullif(new.turno, '');
  new.modalidad := nullif(new.modalidad, '');

  if v_tipo = 'carrera' and new.anio_de_carrera is null then
    raise exception using errcode = 'P0001', message = 'anio_de_carrera_invalido';
  end if;
  if v_tipo <> 'carrera' and new.anio_de_carrera is not null then
    raise exception using errcode = 'P0001', message = 'anio_de_carrera_invalido';
  end if;

  if tg_op = 'INSERT' then
    if not coalesce(v_activo, false) then
      raise exception using errcode = 'P0001', message = 'programa_inactivo';
    end if;
    if new.estado = 'cerrado' then
      raise exception using errcode = 'P0001', message = 'usa_cerrar_grupo';
    end if;
    return new;
  end if;

  -- Un grupo cerrado ya no cambia; cerrarlo es `cerrar_grupo` (concluye a sus
  -- inscritos). El motor DEFINER corre como su dueño, no como `authenticated`.
  if old.estado = 'cerrado' and v_directo then
    raise exception using errcode = 'P0001', message = 'grupo_cerrado';
  end if;
  if new.estado = 'cerrado' and old.estado <> 'cerrado' and v_directo then
    raise exception using errcode = 'P0001', message = 'usa_cerrar_grupo';
  end if;

  v_inscritos := app.contar_inscritos(new.id);
  if new.capacidad is not null and new.capacidad < v_inscritos then
    raise exception using errcode = 'P0001', message = 'capacidad_menor_que_inscritos',
      detail = jsonb_build_object('inscritos', v_inscritos)::text;
  end if;
  if (new.programa_codigo <> old.programa_codigo or new.sede_id <> old.sede_id or new.anio_de_carrera is distinct from old.anio_de_carrera)
     and app.grupo_tiene_inscripciones(new.id) then
    raise exception using errcode = 'P0001', message = 'grupo_con_inscripciones';
  end if;
  return new;
end;
$$;

revoke all on function app.validar_grupo() from public;

create trigger cohortes_validar
  before insert or update on public.cohortes
  for each row execute function app.validar_grupo();

create or replace function app.validar_plan_de_pago()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo public.tipo_de_programa;
  v_estado public.estado_de_grupo;
  v_naturaleza public.naturaleza_de_concepto;
begin
  select p.tipo, c.estado into v_tipo, v_estado
    from public.cohortes c join public.programas p on p.codigo = c.programa_codigo
   where c.id = new.cohorte_id;
  if v_estado = 'cerrado' then
    raise exception using errcode = 'P0001', message = 'grupo_cerrado';
  end if;
  if v_tipo = 'carrera' and new.paquete is null then
    raise exception using errcode = 'P0001', message = 'paquete_requerido';
  end if;
  if v_tipo <> 'carrera' and new.paquete is not null then
    raise exception using errcode = 'P0001', message = 'paquete_no_admitido';
  end if;

  -- El concepto por defecto sale del tipo de programa.
  if new.concepto_id is null then
    select k.id into new.concepto_id from public.conceptos k
     where k.codigo = case when v_tipo = 'carrera' then 'colegiatura-carrera' else 'curso-capacitacion' end;
  end if;
  select k.naturaleza into v_naturaleza from public.conceptos k where k.id = new.concepto_id;
  if v_naturaleza is distinct from 'ingreso' then
    raise exception using errcode = 'P0001', message = 'concepto_no_es_ingreso';
  end if;
  new.nota := nullif(btrim(coalesce(new.nota, '')), '');
  return new;
end;
$$;

revoke all on function app.validar_plan_de_pago() from public;

create trigger planes_de_pago_validar
  before insert or update on public.planes_de_pago
  for each row execute function app.validar_plan_de_pago();

-- Regla E5 (la repite el motor antes de escribir): paquete obligatorio en la
-- carrera y nulo en los cursos.
create or replace function app.validar_inscripcion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo public.tipo_de_programa;
begin
  select p.tipo into v_tipo
    from public.cohortes c join public.programas p on p.codigo = c.programa_codigo
   where c.id = new.cohorte_id;
  if v_tipo = 'carrera' and new.paquete is null then
    raise exception using errcode = 'P0001', message = 'paquete_requerido';
  end if;
  if v_tipo <> 'carrera' and new.paquete is not null then
    raise exception using errcode = 'P0001', message = 'paquete_no_admitido';
  end if;
  new.documentos_entregados := coalesce(new.documentos_entregados, '{}');
  new.observaciones := nullif(btrim(coalesce(new.observaciones, '')), '');
  return new;
end;
$$;

revoke all on function app.validar_inscripcion() from public;

create trigger inscripciones_validar
  before insert or update on public.inscripciones
  for each row execute function app.validar_inscripcion();

create trigger estudiantes_preparar
  before insert or update on public.estudiantes
  for each row execute function app.preparar_estudiante();

-- ---------------------------------------------------------------- nombre visible del grupo

-- Gemela de `etiquetaCortaDeDias()` del dominio: `sab` → «Sábados»,
-- `jue-vie` → «Jue–Vie»; un código desconocido se muestra tal cual.
create or replace function app.etiqueta_de_dias(p_codigo text)
returns text
language sql
immutable
set search_path = ''
as $$
  with partes as (select string_to_array(p_codigo, '-') as a),
  completo (c, n) as (values ('lun', 'Lunes'), ('mar', 'Martes'), ('mie', 'Miércoles'), ('jue', 'Jueves'),
                             ('vie', 'Viernes'), ('sab', 'Sábados'), ('dom', 'Domingos')),
  corto (c, n) as (values ('lun', 'Lun'), ('mar', 'Mar'), ('mie', 'Mié'), ('jue', 'Jue'),
                          ('vie', 'Vie'), ('sab', 'Sáb'), ('dom', 'Dom'))
  select case
    when p_codigo is null or p_codigo = '' then null
    when cardinality(partes.a) = 1 then coalesce((select completo.n from completo where completo.c = partes.a[1]), p_codigo)
    when cardinality(partes.a) = 2 then coalesce(
      (select x.n || '–' || y.n from corto x, corto y where x.c = partes.a[1] and y.c = partes.a[2]), p_codigo)
    else p_codigo
  end
  from partes;
$$;

-- Gemela de `nombreDeGrupo()` del dominio (enmiendas B.13, 36: las dos se
-- prueban con los mismos casos).
--   Carrera: programa · año · turno · gestión · sede
--   Cursos:  programa · días · turno · modalidad · mes de inicio · sede
create or replace function app.nombre_de_grupo(
  p_programa text,
  p_tipo public.tipo_de_programa,
  p_anio smallint,
  p_turno text,
  p_dias text,
  p_modalidad text,
  p_gestion smallint,
  p_inicio date,
  p_sede text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select array_to_string(
    case when p_tipo = 'carrera' then
      array[
        p_programa,
        case when p_anio is null then null when p_anio in (1, 3) then p_anio || '.er año' else p_anio || '.º año' end,
        case p_turno when 'manana' then 'Mañana' when 'tarde' then 'Tarde' when 'noche' then 'Noche'
                     when 'especial' then 'Horario especial' when 'unico' then 'Único turno' end,
        p_gestion::text,
        p_sede
      ]
    else
      array[
        p_programa,
        app.etiqueta_de_dias(p_dias),
        case p_turno when 'manana' then 'Mañana' when 'tarde' then 'Tarde' when 'noche' then 'Noche'
                     when 'especial' then 'Horario especial' when 'unico' then 'Único turno' end,
        case p_modalidad when 'practico' then 'Curso práctico' when 'magistral' then 'Clase magistral'
                         when 'virtual' then 'Virtual' end,
        (array['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'])[extract(month from p_inicio)::int]
          || ' ' || extract(year from p_inicio)::int,
        p_sede
      ]
    end,
    ' · '
  );
$$;

revoke all on function app.etiqueta_de_dias(text) from public;
revoke all on function app.nombre_de_grupo(text, public.tipo_de_programa, smallint, text, text, text, smallint, date, text) from public;
grant execute on function app.etiqueta_de_dias(text) to authenticated;
grant execute on function app.nombre_de_grupo(text, public.tipo_de_programa, smallint, text, text, text, smallint, date, text) to authenticated;

-- ---------------------------------------------------------------- RLS y grants

alter table public.estudiantes enable row level security;
alter table public.cohortes enable row level security;
alter table public.planes_de_pago enable row level security;
alter table public.inscripciones enable row level security;

revoke all on table public.estudiantes from anon, authenticated;
revoke all on table public.cohortes from anon, authenticated;
revoke all on table public.planes_de_pago from anon, authenticated;
revoke all on table public.inscripciones from anon, authenticated;

-- Fichas: el alta va por `crear_estudiante` o `inscribir` (código, carnet
-- repetido con frase clara); la edición de datos, directa y por columna.
grant select on table public.estudiantes to authenticated;
grant update (nombres, apellidos, documento, telefono, correo, fecha_de_nacimiento, sede_id, observaciones, archivado_en, archivado_motivo)
  on table public.estudiantes to authenticated;

create policy estudiantes_lectura
  on public.estudiantes for select
  to authenticated
  using ((select app.tiene_permiso('estudiantes.leer')));

create policy estudiantes_edicion
  on public.estudiantes for update
  to authenticated
  using ((select app.tiene_permiso('estudiantes.gestionar')))
  with check ((select app.tiene_permiso('estudiantes.gestionar')));

-- Grupos: los lee quien informa cupos y precios; los abre y edita administración.
grant select on table public.cohortes to authenticated;
grant insert (programa_codigo, sede_id, gestion, anio_de_carrera, turno, dias, duracion, modalidad, fecha_inicio, fecha_fin, capacidad, estado)
  on table public.cohortes to authenticated;
grant update (gestion, anio_de_carrera, turno, dias, duracion, modalidad, fecha_inicio, fecha_fin, capacidad, estado)
  on table public.cohortes to authenticated;

create policy cohortes_lectura
  on public.cohortes for select
  to authenticated
  using ((select app.tiene_permiso('cohortes.leer')));

create policy cohortes_alta
  on public.cohortes for insert
  to authenticated
  with check ((select app.tiene_permiso('cohortes.gestionar')));

create policy cohortes_edicion
  on public.cohortes for update
  to authenticated
  using ((select app.tiene_permiso('cohortes.gestionar')))
  with check ((select app.tiene_permiso('cohortes.gestionar')));

-- Planes: precio del grupo; lo carga administración. El congelamiento al
-- primer cargo (A2) llega con los cargos (R3).
grant select on table public.planes_de_pago to authenticated;
grant insert (cohorte_id, paquete, concepto_id, monto_cuota, cuotas, primer_vencimiento, cada_meses, nota)
  on table public.planes_de_pago to authenticated;
grant update (paquete, monto_cuota, cuotas, primer_vencimiento, cada_meses, nota)
  on table public.planes_de_pago to authenticated;
grant delete on table public.planes_de_pago to authenticated;

create policy planes_de_pago_lectura
  on public.planes_de_pago for select
  to authenticated
  using ((select app.tiene_permiso('cohortes.leer')));

create policy planes_de_pago_alta
  on public.planes_de_pago for insert
  to authenticated
  with check ((select app.tiene_permiso('contabilidad.gestionar')));

create policy planes_de_pago_edicion
  on public.planes_de_pago for update
  to authenticated
  using ((select app.tiene_permiso('contabilidad.gestionar')))
  with check ((select app.tiene_permiso('contabilidad.gestionar')));

create policy planes_de_pago_baja
  on public.planes_de_pago for delete
  to authenticated
  using ((select app.tiene_permiso('contabilidad.gestionar')));

-- Inscripciones: nacen y cambian de estado solo por RPC; directo, solo los
-- requisitos entregados y las observaciones (enmiendas B.13, 32).
grant select on table public.inscripciones to authenticated;
grant update (documentos_entregados, observaciones) on table public.inscripciones to authenticated;

create policy inscripciones_lectura
  on public.inscripciones for select
  to authenticated
  using ((select app.tiene_permiso('estudiantes.leer')));

create policy inscripciones_edicion
  on public.inscripciones for update
  to authenticated
  using ((select app.tiene_permiso('inscripciones.gestionar')))
  with check ((select app.tiene_permiso('inscripciones.gestionar')));

-- ---------------------------------------------------------------- vistas

create or replace view public.v_grupos with (security_invoker = true) as
select
  c.id,
  c.programa_codigo,
  p.nombre as programa_nombre,
  p.tipo as programa_tipo,
  c.sede_id,
  s.nombre as sede_nombre,
  c.gestion,
  c.anio_de_carrera,
  c.turno,
  c.dias,
  c.duracion,
  c.modalidad,
  c.fecha_inicio,
  c.fecha_fin,
  c.capacidad,
  c.estado,
  app.nombre_de_grupo(p.nombre, p.tipo, c.anio_de_carrera, c.turno, c.dias, c.modalidad, c.gestion, c.fecha_inicio, s.nombre) as nombre,
  (select count(*) from public.inscripciones i where i.cohorte_id = c.id and i.estado = 'inscrito')::integer as inscritos,
  (select count(*) from public.planes_de_pago pl where pl.cohorte_id = c.id)::integer as planes,
  c.created_at
from public.cohortes c
join public.programas p on p.codigo = c.programa_codigo
join public.sedes s on s.id = c.sede_id;

create or replace view public.v_alumnos with (security_invoker = true) as
select
  e.id,
  e.codigo,
  e.nombres,
  e.apellidos,
  e.documento,
  e.telefono,
  e.correo,
  e.sede_id,
  s.nombre as sede_nombre,
  e.perfil_id,
  e.nombre_busqueda,
  e.archivado_en,
  e.created_at,
  vig.programa_codigo,
  vig.programa_tipo,
  vig.programa_nombre,
  vig.anio_de_carrera,
  vig.grupo_nombre,
  coalesce(vig.vigentes, 0)::integer as inscripciones_vigentes
from public.estudiantes e
join public.sedes s on s.id = e.sede_id
left join lateral (
  -- La inscripción que se muestra: la de la carrera primero, luego la más reciente.
  select
    c.programa_codigo,
    p.tipo as programa_tipo,
    p.nombre as programa_nombre,
    c.anio_de_carrera,
    app.nombre_de_grupo(p.nombre, p.tipo, c.anio_de_carrera, c.turno, c.dias, c.modalidad, c.gestion, c.fecha_inicio, sg.nombre) as grupo_nombre,
    count(*) over () as vigentes
  from public.inscripciones i
  join public.cohortes c on c.id = i.cohorte_id
  join public.programas p on p.codigo = c.programa_codigo
  join public.sedes sg on sg.id = c.sede_id
  where i.estudiante_id = e.id and i.estado = 'inscrito'
  order by (p.tipo = 'carrera') desc, i.fecha desc, i.numero desc
  limit 1
) vig on true;

revoke all on public.v_grupos from anon, authenticated;
revoke all on public.v_alumnos from anon, authenticated;
grant select on public.v_grupos to authenticated;
grant select on public.v_alumnos to authenticated;
