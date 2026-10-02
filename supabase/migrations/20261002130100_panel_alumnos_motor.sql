-- ============================================================================
-- 0007 · Sistema interno · Alumnos y grupos: motor y API (rebanada R2)
-- ----------------------------------------------------------------------------
-- Crear ficha, inscribir, aprobar una solicitud del portal, retirar o
-- concluir, y cerrar un grupo. Cada RPC es una fachada SECURITY INVOKER en
-- public que llama a su motor DEFINER en app; el motor exige su permiso en la
-- primera línea, usa la clave del formulario para no repetir nada y valida
-- todo antes de escribir. Tablas y reglas: 20261002130000_panel_alumnos.sql.
-- ============================================================================

-- ---------------------------------------------------------------- piezas que completa la caja (R3)

-- Cuotas de una inscripción según el plan de su grupo. La R3 la reemplaza.
create or replace function app.generar_cuotas(p_inscripcion uuid, p_desde date)
returns integer
language sql
set search_path = ''
as $$
  select 0;
$$;

-- Al retirar: anula las cuotas sin cobros que aún no vencen (B.12). La R3 la reemplaza.
create or replace function app.al_retirar(p_inscripcion uuid)
returns integer
language sql
set search_path = ''
as $$
  select 0;
$$;

-- Cuántos inscritos de un grupo tienen cuotas pendientes. La R3 la reemplaza.
create or replace function app.alumnos_que_deben(p_cohorte uuid)
returns integer
language sql
set search_path = ''
as $$
  select 0;
$$;

revoke all on function app.generar_cuotas(uuid, date) from public;
revoke all on function app.al_retirar(uuid) from public;
revoke all on function app.alumnos_que_deben(uuid) from public;

-- ---------------------------------------------------------------- motor: fichas

-- Crea una ficha a partir de un jsonb {nombres, apellidos, documento?,
-- telefono?, correo?, fecha_de_nacimiento?, sede_id?, observaciones?}. Junta
-- TODOS los campos inválidos en un solo `datos_invalidos`.
create or replace function app.crear_ficha(p_ficha jsonb, p_sede uuid, p_perfil uuid)
returns public.estudiantes
language plpgsql
set search_path = ''
as $$
declare
  v_campos text[] := '{}';
  v_nombres text := regexp_replace(btrim(coalesce(p_ficha ->> 'nombres', '')), '\s+', ' ', 'g');
  v_apellidos text := regexp_replace(btrim(coalesce(p_ficha ->> 'apellidos', '')), '\s+', ' ', 'g');
  v_documento text := nullif(upper(btrim(coalesce(p_ficha ->> 'documento', ''))), '');
  v_telefono text := nullif(btrim(coalesce(p_ficha ->> 'telefono', '')), '');
  v_correo text := nullif(lower(btrim(coalesce(p_ficha ->> 'correo', ''))), '');
  v_nacimiento text := nullif(btrim(coalesce(p_ficha ->> 'fecha_de_nacimiento', '')), '');
  v_sede uuid := coalesce(nullif(p_ficha ->> 'sede_id', '')::uuid, p_sede, app.sede_de_sesion());
  v_obs text := nullif(btrim(coalesce(p_ficha ->> 'observaciones', '')), '');
  v_otro public.estudiantes%rowtype;
  v_fila public.estudiantes%rowtype;
begin
  if char_length(v_nombres) not between 1 and 80 then v_campos := array_append(v_campos, 'nombres'); end if;
  if char_length(v_apellidos) not between 1 and 80 then v_campos := array_append(v_campos, 'apellidos'); end if;
  if v_documento is not null and v_documento !~ '^[0-9A-Z-]{4,20}$' then v_campos := array_append(v_campos, 'documento'); end if;
  if v_telefono is not null and v_telefono !~ '^[67][0-9]{7}$' then v_campos := array_append(v_campos, 'telefono'); end if;
  if v_correo is not null and v_correo !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then v_campos := array_append(v_campos, 'correo'); end if;
  if v_nacimiento is not null and v_nacimiento !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then v_campos := array_append(v_campos, 'fecha_de_nacimiento'); end if;
  if v_obs is not null and char_length(v_obs) > 500 then v_campos := array_append(v_campos, 'observaciones'); end if;
  if cardinality(v_campos) > 0 then
    raise exception using errcode = 'P0001', message = 'datos_invalidos',
      detail = jsonb_build_object('campos', to_jsonb(v_campos))::text;
  end if;

  perform app.exigir_sede(v_sede);

  if v_documento is not null then
    select * into v_otro from public.estudiantes e
     where upper(e.documento) = v_documento and e.archivado_en is null
     limit 1;
    if found then
      raise exception using errcode = 'P0001', message = 'documento_duplicado',
        detail = jsonb_build_object('codigo', v_otro.codigo, 'nombre', v_otro.nombres || ' ' || v_otro.apellidos)::text;
    end if;
  end if;

  insert into public.estudiantes (perfil_id, nombres, apellidos, documento, telefono, correo, fecha_de_nacimiento, sede_id, observaciones, registrado_por)
  values (p_perfil, v_nombres, v_apellidos, v_documento, v_telefono, v_correo, v_nacimiento::date, v_sede, v_obs, (select auth.uid()))
  returning * into v_fila;
  return v_fila;
end;
$$;

revoke all on function app.crear_ficha(jsonb, uuid, uuid) from public;

create or replace function app.crear_estudiante(p_clave uuid, p_ficha jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previo jsonb;
  v_fila public.estudiantes%rowtype;
  v_resultado jsonb;
begin
  perform app.exigir_permiso('estudiantes.gestionar');
  v_previo := app.iniciar_operacion(p_clave, 'crear_estudiante');
  if v_previo is not null then return v_previo; end if;

  v_fila := app.crear_ficha(p_ficha, null, null);
  v_resultado := jsonb_build_object('estudiante', v_fila.id, 'codigo', v_fila.codigo,
                                    'nombre', v_fila.nombres || ' ' || v_fila.apellidos);
  return app.terminar_operacion(p_clave, v_resultado);
end;
$$;

-- ---------------------------------------------------------------- motor: inscribir

-- La inscripción en sí, compartida por `inscribir` y `aprobar_solicitud`.
-- Bloquea el grupo (cupos) antes de contar; valida TODO antes de escribir.
create or replace function app.inscribir_en_grupo(
  p_estudiante uuid,
  p_cohorte uuid,
  p_paquete public.paquete_de_pago,
  p_documentos text[],
  p_renueva_a uuid,
  p_observaciones text,
  p_desde date,
  p_solicitud uuid,
  p_operacion uuid
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_grupo public.cohortes%rowtype;
  v_tipo public.tipo_de_programa;
  v_programa text;
  v_sede text;
  v_alumno public.estudiantes%rowtype;
  v_inscritos integer;
  v_ant_estudiante uuid;
  v_ant_programa text;
  v_ant_anio smallint;
  v_ant_gestion smallint;
  v_documentos text[];
  v_obs text := nullif(btrim(coalesce(p_observaciones, '')), '');
  v_id uuid;
  v_numero bigint;
  v_cuotas integer;
begin
  select * into v_grupo from public.cohortes c where c.id = p_cohorte for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'grupo_no_encontrado';
  end if;
  perform app.exigir_sede(v_grupo.sede_id);
  select p.tipo, p.nombre into v_tipo, v_programa from public.programas p where p.codigo = v_grupo.programa_codigo;
  select s.nombre into v_sede from public.sedes s where s.id = v_grupo.sede_id;

  if v_grupo.estado not in ('abierto', 'en_curso') then
    raise exception using errcode = 'P0001', message = 'grupo_no_disponible',
      detail = jsonb_build_object('estado', v_grupo.estado)::text;
  end if;

  select * into v_alumno from public.estudiantes e where e.id = p_estudiante;
  if not found then
    raise exception using errcode = 'P0001', message = 'alumno_no_encontrado';
  end if;
  if v_alumno.archivado_en is not null then
    raise exception using errcode = 'P0001', message = 'alumno_archivado';
  end if;

  if v_tipo = 'carrera' and p_paquete is null then
    raise exception using errcode = 'P0001', message = 'paquete_requerido';
  end if;
  if v_tipo <> 'carrera' and p_paquete is not null then
    raise exception using errcode = 'P0001', message = 'paquete_no_admitido';
  end if;

  if exists (select 1 from public.inscripciones i where i.estudiante_id = p_estudiante and i.cohorte_id = p_cohorte and i.estado = 'inscrito') then
    raise exception using errcode = 'P0001', message = 'ya_inscrito';
  end if;

  select count(*) into v_inscritos from public.inscripciones i where i.cohorte_id = p_cohorte and i.estado = 'inscrito';
  if v_grupo.capacidad is not null and v_inscritos >= v_grupo.capacidad then
    raise exception using errcode = 'P0001', message = 'grupo_lleno',
      detail = jsonb_build_object('capacidad', v_grupo.capacidad)::text;
  end if;

  -- Renovar (B.3): solo enlaza con el año anterior del mismo programa; la
  -- inscripción anterior sigue `inscrito` hasta que se cierre su grupo.
  if p_renueva_a is not null then
    select i.estudiante_id, c.programa_codigo, c.anio_de_carrera, c.gestion
      into v_ant_estudiante, v_ant_programa, v_ant_anio, v_ant_gestion
      from public.inscripciones i join public.cohortes c on c.id = i.cohorte_id
     where i.id = p_renueva_a and i.estado <> 'retirado';
    if v_ant_estudiante is null
       or v_ant_estudiante <> p_estudiante
       or v_ant_programa <> v_grupo.programa_codigo
       or v_tipo <> 'carrera'
       or v_grupo.anio_de_carrera is distinct from v_ant_anio + 1
       or v_grupo.gestion <> v_ant_gestion + 1
       or exists (select 1 from public.inscripciones r where r.renueva_a = p_renueva_a)
    then
      raise exception using errcode = 'P0001', message = 'renovacion_no_corresponde';
    end if;
  end if;

  select coalesce(array_agg(distinct d order by d), '{}') into v_documentos
    from (select btrim(x) as d from unnest(coalesce(p_documentos, '{}')) as x) t
   where d <> '';
  if cardinality(v_documentos) > 20 or exists (select 1 from unnest(v_documentos) d where char_length(d) > 80)
     or char_length(coalesce(v_obs, '')) > 500 then
    raise exception using errcode = 'P0001', message = 'datos_invalidos',
      detail = jsonb_build_object('campos', jsonb_build_array('documentos'))::text;
  end if;

  insert into public.inscripciones (operacion_id, estudiante_id, cohorte_id, fecha, paquete, documentos_entregados,
                                    solicitud_id, renueva_a, observaciones, registrado_por)
  values (p_operacion, p_estudiante, p_cohorte, app.hoy(), p_paquete, v_documentos,
          p_solicitud, p_renueva_a, v_obs, (select auth.uid()))
  returning id, numero into v_id, v_numero;

  v_cuotas := app.generar_cuotas(v_id, p_desde);

  return jsonb_build_object(
    'inscripcion', v_id,
    'numero', v_numero,
    'estudiante', v_alumno.id,
    'codigo', v_alumno.codigo,
    'alumno', v_alumno.nombres || ' ' || v_alumno.apellidos,
    'grupo', p_cohorte,
    'grupo_nombre', app.nombre_de_grupo(v_programa, v_tipo, v_grupo.anio_de_carrera, v_grupo.turno, v_grupo.dias,
                                         v_grupo.modalidad, v_grupo.gestion, v_grupo.fecha_inicio, v_sede),
    'cuotas', v_cuotas,
    'sin_plan', not exists (select 1 from public.planes_de_pago pl where pl.cohorte_id = p_cohorte
                              and pl.paquete is not distinct from p_paquete)
  );
end;
$$;

revoke all on function app.inscribir_en_grupo(uuid, uuid, public.paquete_de_pago, text[], uuid, text, date, uuid, uuid) from public;

create or replace function app.inscribir(
  p_clave uuid,
  p_estudiante uuid,
  p_ficha jsonb,
  p_cohorte uuid,
  p_paquete public.paquete_de_pago,
  p_documentos text[],
  p_renueva_a uuid,
  p_observaciones text,
  p_desde date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previo jsonb;
  v_estudiante uuid := p_estudiante;
  v_ficha public.estudiantes%rowtype;
  v_sede uuid;
begin
  perform app.exigir_permiso('inscripciones.gestionar');
  v_previo := app.iniciar_operacion(p_clave, 'inscribir');
  if v_previo is not null then return v_previo; end if;

  if v_estudiante is null then
    perform app.exigir_permiso('estudiantes.gestionar');
    select c.sede_id into v_sede from public.cohortes c where c.id = p_cohorte;
    v_ficha := app.crear_ficha(coalesce(p_ficha, '{}'::jsonb), v_sede, null);
    v_estudiante := v_ficha.id;
  end if;

  return app.terminar_operacion(p_clave,
    app.inscribir_en_grupo(v_estudiante, p_cohorte, p_paquete, p_documentos, p_renueva_a, p_observaciones, p_desde, null, p_clave)
    || jsonb_build_object('ficha_nueva', p_estudiante is null));
end;
$$;

-- ---------------------------------------------------------------- motor: aprobar una solicitud del portal

-- B.8: si el perfil ya tiene ficha, se usa; si no, el personal elige entre
-- «ficha nueva» (p_estudiante nulo) y una ficha existente SIN cuenta. La base
-- nunca enlaza sola. B.9: aprobar = inscribir, en una sola transacción.
create or replace function app.aprobar_solicitud(
  p_clave uuid,
  p_solicitud uuid,
  p_cohorte uuid,
  p_paquete public.paquete_de_pago,
  p_documentos text[],
  p_respuesta text,
  p_estudiante uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previo jsonb;
  v_sol public.solicitudes%rowtype;
  v_perfil public.perfiles%rowtype;
  v_grupo public.cohortes%rowtype;
  v_estudiante uuid;
  v_ficha public.estudiantes%rowtype;
  v_renueva uuid;
  v_respuesta text := nullif(btrim(coalesce(p_respuesta, '')), '');
  v_resultado jsonb;
begin
  perform app.exigir_permiso('solicitudes.gestionar');
  perform app.exigir_permiso('inscripciones.gestionar');
  v_previo := app.iniciar_operacion(p_clave, 'aprobar_solicitud');
  if v_previo is not null then return v_previo; end if;

  select * into v_sol from public.solicitudes s where s.id = p_solicitud for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'solicitud_no_encontrada';
  end if;
  if v_sol.estado not in ('pendiente', 'en_revision') then
    raise exception using errcode = 'P0001', message = 'solicitud_cerrada';
  end if;
  if char_length(coalesce(v_respuesta, '')) > 500 then
    raise exception using errcode = 'P0001', message = 'datos_invalidos',
      detail = jsonb_build_object('campos', jsonb_build_array('respuesta'))::text;
  end if;

  select * into v_grupo from public.cohortes c where c.id = p_cohorte;
  if not found then
    raise exception using errcode = 'P0001', message = 'grupo_no_encontrado';
  end if;
  if v_grupo.programa_codigo <> v_sol.programa_codigo then
    raise exception using errcode = 'P0001', message = 'grupo_no_corresponde';
  end if;

  select e.id into v_estudiante from public.estudiantes e where e.perfil_id = v_sol.estudiante_id;
  if v_estudiante is null then
    if p_estudiante is not null then
      select * into v_ficha from public.estudiantes e where e.id = p_estudiante for update;
      if not found then
        raise exception using errcode = 'P0001', message = 'alumno_no_encontrado';
      end if;
      if v_ficha.perfil_id is not null then
        raise exception using errcode = 'P0001', message = 'ficha_con_cuenta',
          detail = jsonb_build_object('codigo', v_ficha.codigo)::text;
      end if;
      update public.estudiantes set perfil_id = v_sol.estudiante_id where id = p_estudiante;
      v_estudiante := p_estudiante;
    else
      select * into v_perfil from public.perfiles p where p.id = v_sol.estudiante_id;
      v_ficha := app.crear_ficha(
        jsonb_build_object('nombres', v_perfil.nombres, 'apellidos', v_perfil.apellidos, 'documento', v_perfil.documento,
                           'telefono', v_perfil.telefono, 'correo', v_perfil.correo),
        v_sol.sede_id, v_sol.estudiante_id);
      v_estudiante := v_ficha.id;
    end if;
  end if;

  -- Renovación: enlaza con la última inscripción del mismo programa que aún
  -- no se renovó (si el alumno tiene historia en el sistema).
  if v_sol.tipo = 'renovacion' then
    select i.id into v_renueva
      from public.inscripciones i join public.cohortes c on c.id = i.cohorte_id
     where i.estudiante_id = v_estudiante and c.programa_codigo = v_sol.programa_codigo
       and i.estado <> 'retirado'
       and not exists (select 1 from public.inscripciones r where r.renueva_a = i.id)
     order by c.gestion desc, i.fecha desc
     limit 1;
  end if;

  v_resultado := app.inscribir_en_grupo(v_estudiante, p_cohorte, p_paquete, p_documentos, v_renueva, null, null, p_solicitud, p_clave);

  update public.solicitudes set estado = 'aprobada', respuesta = v_respuesta where id = p_solicitud;

  return app.terminar_operacion(p_clave, v_resultado || jsonb_build_object('solicitud', p_solicitud));
end;
$$;

-- ---------------------------------------------------------------- motor: retirar o concluir

create or replace function app.cambiar_estado_de_inscripcion(
  p_clave uuid,
  p_inscripcion uuid,
  p_estado public.estado_de_inscripcion,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previo jsonb;
  v_ins public.inscripciones%rowtype;
  v_sede uuid;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_anuladas integer := 0;
begin
  perform app.exigir_permiso('inscripciones.gestionar');
  v_previo := app.iniciar_operacion(p_clave, 'estado_de_inscripcion');
  if v_previo is not null then return v_previo; end if;

  select * into v_ins from public.inscripciones i where i.id = p_inscripcion for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'inscripcion_no_encontrada';
  end if;
  select c.sede_id into v_sede from public.cohortes c where c.id = v_ins.cohorte_id;
  perform app.exigir_sede(v_sede);

  if v_ins.estado <> 'inscrito' or p_estado not in ('retirado', 'concluido') then
    raise exception using errcode = 'P0001', message = 'transicion_no_valida',
      detail = jsonb_build_object('de', v_ins.estado, 'a', p_estado)::text;
  end if;
  if p_estado = 'retirado' and (v_motivo is null or char_length(v_motivo) < 3) then
    raise exception using errcode = 'P0001', message = 'motivo_requerido';
  end if;

  update public.inscripciones
     set estado = p_estado,
         motivo_de_retiro = case when p_estado = 'retirado' then left(v_motivo, 500) else null end
   where id = p_inscripcion;

  if p_estado = 'retirado' then
    v_anuladas := app.al_retirar(p_inscripcion);
  end if;

  return app.terminar_operacion(p_clave, jsonb_build_object(
    'inscripcion', p_inscripcion, 'estado', p_estado, 'antes', v_ins.estado, 'cuotas_anuladas', v_anuladas));
end;
$$;

-- ---------------------------------------------------------------- motor: cerrar un grupo (B.3)

create or replace function app.cerrar_grupo(p_clave uuid, p_cohorte uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previo jsonb;
  v_grupo public.cohortes%rowtype;
  v_concluidos integer;
begin
  perform app.exigir_permiso('cohortes.gestionar');
  v_previo := app.iniciar_operacion(p_clave, 'cerrar_grupo');
  if v_previo is not null then return v_previo; end if;

  select * into v_grupo from public.cohortes c where c.id = p_cohorte for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'grupo_no_encontrado';
  end if;
  if v_grupo.estado = 'cerrado' then
    raise exception using errcode = 'P0001', message = 'grupo_cerrado';
  end if;

  update public.cohortes set estado = 'cerrado' where id = p_cohorte;
  update public.inscripciones set estado = 'concluido' where cohorte_id = p_cohorte and estado = 'inscrito';
  get diagnostics v_concluidos = row_count;

  return app.terminar_operacion(p_clave, jsonb_build_object(
    'grupo', p_cohorte, 'antes', v_grupo.estado, 'concluidos', v_concluidos,
    'con_deuda', app.alumnos_que_deben(p_cohorte)));
end;
$$;

revoke all on function app.crear_estudiante(uuid, jsonb) from public;
revoke all on function app.inscribir(uuid, uuid, jsonb, uuid, public.paquete_de_pago, text[], uuid, text, date) from public;
revoke all on function app.aprobar_solicitud(uuid, uuid, uuid, public.paquete_de_pago, text[], text, uuid) from public;
revoke all on function app.cambiar_estado_de_inscripcion(uuid, uuid, public.estado_de_inscripcion, text) from public;
revoke all on function app.cerrar_grupo(uuid, uuid) from public;
grant execute on function app.crear_estudiante(uuid, jsonb) to authenticated;
grant execute on function app.inscribir(uuid, uuid, jsonb, uuid, public.paquete_de_pago, text[], uuid, text, date) to authenticated;
grant execute on function app.aprobar_solicitud(uuid, uuid, uuid, public.paquete_de_pago, text[], text, uuid) to authenticated;
grant execute on function app.cambiar_estado_de_inscripcion(uuid, uuid, public.estado_de_inscripcion, text) to authenticated;
grant execute on function app.cerrar_grupo(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------- fachadas (API)

create or replace function public.crear_estudiante(p_clave uuid, p_ficha jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select app.crear_estudiante(p_clave, p_ficha);
$$;

create or replace function public.inscribir(
  p_clave uuid,
  p_estudiante uuid,
  p_ficha jsonb,
  p_cohorte uuid,
  p_paquete public.paquete_de_pago,
  p_documentos text[],
  p_renueva_a uuid,
  p_observaciones text,
  p_desde date
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select app.inscribir(p_clave, p_estudiante, p_ficha, p_cohorte, p_paquete, p_documentos, p_renueva_a, p_observaciones, p_desde);
$$;

create or replace function public.aprobar_solicitud(
  p_clave uuid,
  p_solicitud uuid,
  p_cohorte uuid,
  p_paquete public.paquete_de_pago,
  p_documentos text[],
  p_respuesta text,
  p_estudiante uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select app.aprobar_solicitud(p_clave, p_solicitud, p_cohorte, p_paquete, p_documentos, p_respuesta, p_estudiante);
$$;

create or replace function public.cambiar_estado_de_inscripcion(
  p_clave uuid,
  p_inscripcion uuid,
  p_estado public.estado_de_inscripcion,
  p_motivo text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select app.cambiar_estado_de_inscripcion(p_clave, p_inscripcion, p_estado, p_motivo);
$$;

create or replace function public.cerrar_grupo(p_clave uuid, p_cohorte uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select app.cerrar_grupo(p_clave, p_cohorte);
$$;

revoke all on function public.crear_estudiante(uuid, jsonb) from public, anon;
revoke all on function public.inscribir(uuid, uuid, jsonb, uuid, public.paquete_de_pago, text[], uuid, text, date) from public, anon;
revoke all on function public.aprobar_solicitud(uuid, uuid, uuid, public.paquete_de_pago, text[], text, uuid) from public, anon;
revoke all on function public.cambiar_estado_de_inscripcion(uuid, uuid, public.estado_de_inscripcion, text) from public, anon;
revoke all on function public.cerrar_grupo(uuid, uuid) from public, anon;
grant execute on function public.crear_estudiante(uuid, jsonb) to authenticated;
grant execute on function public.inscribir(uuid, uuid, jsonb, uuid, public.paquete_de_pago, text[], uuid, text, date) to authenticated;
grant execute on function public.aprobar_solicitud(uuid, uuid, uuid, public.paquete_de_pago, text[], text, uuid) to authenticated;
grant execute on function public.cambiar_estado_de_inscripcion(uuid, uuid, public.estado_de_inscripcion, text) to authenticated;
grant execute on function public.cerrar_grupo(uuid, uuid) to authenticated;
