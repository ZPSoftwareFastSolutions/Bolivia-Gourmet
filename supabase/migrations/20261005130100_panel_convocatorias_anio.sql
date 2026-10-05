-- ============================================================================
-- 0024 · Año de la carrera en las solicitudes del portal (ADR 0009 §2)
-- ----------------------------------------------------------------------------
-- Por el portal, la carrera se empieza en el 1.er año («Nueva inscripción») y
-- se pasa al 2.º o al 3.er año con «Renovar». Lo demás (convalidar un año,
-- repetirlo) se atiende en la sede, donde recepción inscribe en cualquier
-- grupo.
--
-- Va en un disparador aparte: los disparadores del mismo momento corren por
-- orden alfabético y `solicitudes_validar_alta` (dueño, grupo, convocatoria,
-- cruces) ya corrió cuando llega este.
-- ============================================================================

create or replace function app.validar_anio_de_solicitud()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo public.tipo_de_programa;
  v_anio smallint;
begin
  if new.cohorte_id is null then
    return new;
  end if;
  select p.tipo, c.anio_de_carrera into v_tipo, v_anio
    from public.cohortes c
    join public.programas p on p.codigo = c.programa_codigo
   where c.id = new.cohorte_id;
  if v_tipo is distinct from 'carrera' then
    return new;
  end if;
  if new.tipo = 'inscripcion' and v_anio <> 1 then
    raise exception 'Por el portal, la carrera empieza en el 1.er año. Para pasar de año, pide tu renovación.'
      using errcode = '23514';
  end if;
  if new.tipo = 'renovacion' and v_anio < 2 then
    raise exception 'La renovación es para el 2.º o el 3.er año de la carrera.' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function app.validar_anio_de_solicitud() from public;

create trigger solicitudes_validar_anio
  before insert on public.solicitudes
  for each row execute function app.validar_anio_de_solicitud();
