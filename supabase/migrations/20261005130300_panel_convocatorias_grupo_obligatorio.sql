-- ============================================================================
-- 0026 · Convocatorias: el grupo vuelve a ser obligatorio (ADR 0009 §2)
-- ----------------------------------------------------------------------------
-- Cierra la transición de 20261005130200: el portal nuevo ya elige un grupo
-- en convocatoria, así que una solicitud SIN grupo se rechaza otra vez
-- («Elige un grupo con inscripciones abiertas.»), salvo en modo mantenimiento
-- (historial de demostración). Lo demás queda igual que en la transición:
-- con grupo, convocatoria, cupos, ya inscrito, cruces de horario y
-- renovación solo de la carrera; el año de la carrera lo revisa
-- `app.validar_anio_de_solicitud` (20261005130100).
-- ============================================================================

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

  -- Convocatoria (ADR 0009): toda solicitud nueva pide un grupo. Sin grupo,
  -- solo en modo mantenimiento (el historial de demostración).
  if new.cohorte_id is null then
    if not app.en_mantenimiento() then
      raise exception 'Elige un grupo con inscripciones abiertas.' using errcode = '23514';
    end if;
  else
    -- El grupo manda y se valida la convocatoria.
    select * into v_grupo from public.cohortes where id = new.cohorte_id;
    if not found then
      raise exception 'Ese grupo no existe.' using errcode = '23514';
    end if;
    if v_grupo.programa_codigo <> new.programa_codigo then
      raise exception 'El grupo elegido no es de ese programa.' using errcode = '23514';
    end if;
    if new.tipo = 'renovacion' and v_programa.tipo <> 'carrera' then
      raise exception 'La renovación es para la carrera.' using errcode = '23514';
    end if;
    -- Lo que mande el navegador no cuenta.
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
