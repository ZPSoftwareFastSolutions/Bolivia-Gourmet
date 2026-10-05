-- ============================================================================
-- 0023 · Inscripciones por convocatoria (ADR 0009)
-- ----------------------------------------------------------------------------
-- La institución abre un GRUPO con horario y un plazo de inscripción; el
-- estudiante solo pide un grupo en convocatoria y sin cruce de horario con lo
-- que ya cursa o ya pidió.
--
-- - cohortes: hora_inicio/hora_fin y inscripcion_desde/inscripcion_hasta.
-- - solicitudes.cohorte_id: el grupo pedido; la base copia de él sede, turno,
--   días, duración y modalidad.
-- - app.cruce_de_grupos: gemela de `cruceDeHorarios` (core/domain/academico/
--   horario.ts), con los mismos casos de prueba.
-- - oferta_abierta() y mis_grupos(): lo único que el estudiante lee de los
--   grupos, con columnas seguras (DEFINER en app, fachada INVOKER).
-- ============================================================================

-- ---------------------------------------------------------------- grupos

alter table public.cohortes
  add column hora_inicio time,
  add column hora_fin time,
  add column inscripcion_desde date,
  add column inscripcion_hasta date,
  add constraint cohortes_horario check (
    (hora_inicio is null) = (hora_fin is null) and (hora_fin is null or hora_fin > hora_inicio)
  ),
  add constraint cohortes_plazo check (
    (inscripcion_desde is null) = (inscripcion_hasta is null) and (inscripcion_hasta is null or inscripcion_hasta >= inscripcion_desde)
  ),
  -- Un grupo con plazo tiene horario: el estudiante sabe a qué se compromete
  -- y el cruce se puede calcular.
  add constraint cohortes_plazo_con_horario check (inscripcion_desde is null or hora_inicio is not null);

create index cohortes_convocatoria_idx on public.cohortes (inscripcion_desde, inscripcion_hasta) where inscripcion_desde is not null;

grant insert (hora_inicio, hora_fin, inscripcion_desde, inscripcion_hasta) on table public.cohortes to authenticated;
grant update (hora_inicio, hora_fin, inscripcion_desde, inscripcion_hasta) on table public.cohortes to authenticated;

-- Igual que en 20261002130000 con las cuatro columnas nuevas al final.
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
  c.created_at,
  c.hora_inicio,
  c.hora_fin,
  c.inscripcion_desde,
  c.inscripcion_hasta
from public.cohortes c
join public.programas p on p.codigo = c.programa_codigo
join public.sedes s on s.id = c.sede_id;

-- ---------------------------------------------------------------- solicitudes

alter table public.solicitudes add column cohorte_id uuid references public.cohortes (id);
create index solicitudes_cohorte_idx on public.solicitudes (cohorte_id);
grant insert (cohorte_id) on table public.solicitudes to authenticated;

-- ---------------------------------------------------------------- cruce de horarios

-- `lun-vie` → {lun, mar, mie, jue, vie}; `sab` → {sab}; sin días → {}.
create or replace function app.dias_de_clase(p_dias text)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_semana constant text[] := array['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];
  v_desde integer;
  v_hasta integer;
begin
  if p_dias is null or p_dias = '' then
    return '{}'::text[];
  end if;
  v_desde := array_position(v_semana, split_part(p_dias, '-', 1));
  v_hasta := coalesce(array_position(v_semana, nullif(split_part(p_dias, '-', 2), '')), v_desde);
  if v_desde is null or v_hasta is null or v_hasta < v_desde then
    return '{}'::text[];
  end if;
  return v_semana[v_desde:v_hasta];
end;
$$;

-- 'se_cruza', 'no_se_cruza' o 'sin_horario' (ADR 0009 §3, en este orden):
-- fechas, días, horas y, sin horas, el turno.
create or replace function app.cruce_de_grupos(a public.cohortes, b public.cohortes)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_dias_a text[] := app.dias_de_clase(a.dias);
  v_dias_b text[] := app.dias_de_clase(b.dias);
begin
  if a.fecha_inicio > coalesce(b.fecha_fin, 'infinity'::date) or b.fecha_inicio > coalesce(a.fecha_fin, 'infinity'::date) then
    return 'no_se_cruza';
  end if;
  if cardinality(v_dias_a) = 0 or cardinality(v_dias_b) = 0 then
    return 'sin_horario';
  end if;
  if not (v_dias_a && v_dias_b) then
    return 'no_se_cruza';
  end if;
  if a.hora_inicio is not null and b.hora_inicio is not null then
    return case when a.hora_inicio < b.hora_fin and b.hora_inicio < a.hora_fin then 'se_cruza' else 'no_se_cruza' end;
  end if;
  if a.turno in ('manana', 'tarde', 'noche') and b.turno in ('manana', 'tarde', 'noche') then
    return case when a.turno = b.turno then 'se_cruza' else 'no_se_cruza' end;
  end if;
  return 'sin_horario';
end;
$$;

revoke all on function app.dias_de_clase(text) from public;
revoke all on function app.cruce_de_grupos(public.cohortes, public.cohortes) from public;

-- ---------------------------------------------------------------- alta de una solicitud

-- Reemplaza la de 20261001120300: lo de antes más el grupo pedido.
create or replace function app.validar_alta_de_solicitud()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_programa public.programas%rowtype;
  v_grupo public.cohortes%rowtype;
  v_abiertas integer;
  v_estudiante uuid;
  v_choque text;
begin
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

  -- Convocatoria (ADR 0009): se pide un grupo. Sin grupo solo en modo
  -- mantenimiento (historial de demostración).
  if new.cohorte_id is null then
    if not app.en_mantenimiento() then
      raise exception 'Elige un grupo con inscripciones abiertas.' using errcode = '23514';
    end if;
  else
    select * into v_grupo from public.cohortes where id = new.cohorte_id;
    if not found then
      raise exception 'Ese grupo no existe.' using errcode = '23514';
    end if;
    if v_grupo.programa_codigo <> new.programa_codigo then
      raise exception 'El grupo elegido no es de ese programa.' using errcode = '23514';
    end if;
    -- El grupo manda: lo que mande el navegador no cuenta.
    new.sede_id := v_grupo.sede_id;
    new.turno := v_grupo.turno;
    new.dias := v_grupo.dias;
    new.duracion := v_grupo.duracion;
    new.modalidad := v_grupo.modalidad;

    if not app.en_mantenimiento() then
      if v_grupo.estado not in ('abierto', 'en_curso')
         or v_grupo.inscripcion_desde is null
         or app.hoy() < v_grupo.inscripcion_desde
         or app.hoy() > v_grupo.inscripcion_hasta then
        raise exception 'Las inscripciones de ese grupo no están abiertas.' using errcode = '23514';
      end if;
      if v_grupo.capacidad is not null and app.contar_inscritos(v_grupo.id) >= v_grupo.capacidad then
        raise exception 'Ese grupo ya no tiene cupos.' using errcode = '23514';
      end if;
      select e.id into v_estudiante from public.estudiantes e where e.perfil_id = new.estudiante_id;
      if v_estudiante is not null and exists (
        select 1 from public.inscripciones i
         where i.estudiante_id = v_estudiante and i.cohorte_id = v_grupo.id and i.estado = 'inscrito'
      ) then
        raise exception 'Ya estás inscrito en ese grupo.' using errcode = '23505';
      end if;
      -- Cruce con lo que cursa (en una renovación, no con su propia carrera:
      -- pasa de un año al siguiente) y con los grupos que ya pidió.
      if v_estudiante is not null then
        select app.nombre_de_grupo(p.nombre, p.tipo, c.anio_de_carrera, c.turno, c.dias, c.modalidad, c.gestion, c.fecha_inicio, s.nombre)
          into v_choque
          from public.inscripciones i
          join public.cohortes c on c.id = i.cohorte_id
          join public.programas p on p.codigo = c.programa_codigo
          join public.sedes s on s.id = c.sede_id
         where i.estudiante_id = v_estudiante and i.estado = 'inscrito'
           and not (new.tipo = 'renovacion' and c.programa_codigo = new.programa_codigo)
           and app.cruce_de_grupos(c, v_grupo) = 'se_cruza'
         limit 1;
        if v_choque is not null then
          raise exception 'Ese horario se cruza con tu curso «%».', v_choque using errcode = '23514';
        end if;
      end if;
      select app.nombre_de_grupo(p.nombre, p.tipo, c.anio_de_carrera, c.turno, c.dias, c.modalidad, c.gestion, c.fecha_inicio, s.nombre)
        into v_choque
        from public.solicitudes x
        join public.cohortes c on c.id = x.cohorte_id
        join public.programas p on p.codigo = c.programa_codigo
        join public.sedes s on s.id = c.sede_id
       where x.estudiante_id = new.estudiante_id and x.estado in ('pendiente', 'en_revision')
         and app.cruce_de_grupos(c, v_grupo) = 'se_cruza'
       limit 1;
      if v_choque is not null then
        raise exception 'Ese horario se cruza con el grupo que ya pediste: «%».', v_choque using errcode = '23514';
      end if;
    end if;
  end if;

  if not exists (select 1 from public.sedes where id = new.sede_id and activa) then
    raise exception 'La sede elegida no está disponible.' using errcode = '23514';
  end if;
  if new.tipo = 'renovacion' and v_programa.tipo <> 'carrera' then
    raise exception 'La renovación es para la carrera.' using errcode = '23514';
  end if;
  if v_programa.tipo = 'carrera' and new.tipo = 'inscripcion' and new.paquete is null then
    raise exception 'La inscripción a la carrera debe indicar el paquete.' using errcode = '23514';
  end if;
  if v_programa.tipo <> 'carrera' and new.paquete is not null then
    raise exception 'Solo la carrera se inscribe por paquete.' using errcode = '23514';
  end if;

  if exists (
    select 1 from public.solicitudes
    where estudiante_id = new.estudiante_id
      and programa_codigo = new.programa_codigo
      and tipo = new.tipo
      and estado in ('pendiente', 'en_revision')
  ) then
    raise exception 'Ya tienes una solicitud abierta para este programa.' using errcode = '23505';
  end if;

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

-- ---------------------------------------------------------------- lecturas del portal

-- Un grupo con la forma que ve el portal (sin inscritos ni datos de nadie).
create or replace function app.grupo_para_portal(p_cohorte uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id,
    'programa_codigo', c.programa_codigo,
    'programa_nombre', p.nombre,
    'programa_tipo', p.tipo,
    'sede_id', c.sede_id,
    'sede_nombre', s.nombre,
    'nombre', app.nombre_de_grupo(p.nombre, p.tipo, c.anio_de_carrera, c.turno, c.dias, c.modalidad, c.gestion, c.fecha_inicio, s.nombre),
    'gestion', c.gestion,
    'anio_de_carrera', c.anio_de_carrera,
    'turno', c.turno,
    'dias', c.dias,
    'hora_inicio', left(c.hora_inicio::text, 5),
    'hora_fin', left(c.hora_fin::text, 5),
    'duracion', c.duracion,
    'modalidad', c.modalidad,
    'fecha_inicio', c.fecha_inicio,
    'fecha_fin', c.fecha_fin,
    'inscripcion_desde', c.inscripcion_desde,
    'inscripcion_hasta', c.inscripcion_hasta,
    'capacidad', c.capacidad,
    'libres', case when c.capacidad is null then null else greatest(c.capacidad - app.contar_inscritos(c.id), 0) end,
    'precios', coalesce((
      select jsonb_agg(jsonb_build_object('paquete', pl.paquete, 'monto_cuota', pl.monto_cuota, 'cuotas', pl.cuotas, 'cada_meses', pl.cada_meses) order by pl.paquete nulls first)
        from public.planes_de_pago pl where pl.cohorte_id = c.id), '[]'::jsonb))
    from public.cohortes c
    join public.programas p on p.codigo = c.programa_codigo
    join public.sedes s on s.id = c.sede_id
   where c.id = p_cohorte;
$$;

-- Los grupos en convocatoria hoy (ADR 0009 §1).
create or replace function app.oferta_abierta()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(app.grupo_para_portal(c.id) order by p.tipo, p.nombre, c.fecha_inicio, c.hora_inicio), '[]'::jsonb)
    from public.cohortes c
    join public.programas p on p.codigo = c.programa_codigo
    join public.sedes s on s.id = c.sede_id
   where c.estado in ('abierto', 'en_curso')
     and c.inscripcion_desde is not null
     and app.hoy() between c.inscripcion_desde and c.inscripcion_hasta
     and p.activo and s.activa
     and (c.capacidad is null or app.contar_inscritos(c.id) < c.capacidad);
$$;

-- Lo propio de quien pregunta: sus inscripciones vigentes y concluidas (por
-- su ficha vinculada) y los grupos de sus solicitudes.
create or replace function app.mis_grupos()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_estudiante uuid;
  v_inscripciones jsonb;
  v_solicitudes jsonb;
begin
  select e.id into v_estudiante from public.estudiantes e where e.perfil_id = (select auth.uid());
  select coalesce(jsonb_agg(jsonb_build_object('inscripcion_id', i.id, 'estado', i.estado, 'paquete', i.paquete, 'grupo', app.grupo_para_portal(i.cohorte_id))
                            order by c.fecha_inicio desc), '[]'::jsonb)
    into v_inscripciones
    from public.inscripciones i
    join public.cohortes c on c.id = i.cohorte_id
   where v_estudiante is not null and i.estudiante_id = v_estudiante and i.estado in ('inscrito', 'concluido');
  select coalesce(jsonb_agg(jsonb_build_object('solicitud_id', s.id, 'grupo', app.grupo_para_portal(s.cohorte_id))), '[]'::jsonb)
    into v_solicitudes
    from public.solicitudes s
   where s.estudiante_id = (select auth.uid()) and s.cohorte_id is not null;
  return jsonb_build_object('inscripciones', v_inscripciones, 'solicitudes', v_solicitudes);
end;
$$;

create or replace function public.oferta_abierta()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select app.oferta_abierta();
$$;

create or replace function public.mis_grupos()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select app.mis_grupos();
$$;

revoke all on function app.grupo_para_portal(uuid) from public;
revoke all on function app.oferta_abierta() from public;
revoke all on function app.mis_grupos() from public;
revoke all on function public.oferta_abierta() from public, anon;
revoke all on function public.mis_grupos() from public, anon;
grant execute on function app.oferta_abierta() to authenticated;
grant execute on function app.mis_grupos() to authenticated;
grant execute on function public.oferta_abierta() to authenticated;
grant execute on function public.mis_grupos() to authenticated;
