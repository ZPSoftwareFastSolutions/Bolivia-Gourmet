-- ============================================================================
-- Convocatorias de demostración (inscripciones por convocatoria, ADR 0009)
-- ----------------------------------------------------------------------------
-- NO es una migración: son datos de prueba. Se ejecuta a mano en el editor SQL
-- de Supabase (rol postgres) DESPUÉS de `datos-demo.sql` y de
-- `datos-panel-demo.sql`.
--
-- TODO ES FICTICIO: horarios, plazos, fechas, cupos y el carnet de Diego son
-- de demostración, no del instituto. Las horas de inicio de la carrera siguen
-- el catálogo (tarde 15:00, noche 18:00); las de fin no se conocen. El único
-- precio que se usa es el confirmado del Paquete Económico (Bs 650, con la
-- nota «Periodicidad por confirmar»); los cursos van sin precio («Consultar»).
--
-- Qué hace:
--   1. Pone horario a los grupos vigentes de la demo (carrera y cursos).
--   2. Abre tres convocatorias (grupos con plazo de inscripción por el
--      portal), con fechas relativas al día de la carga:
--        - Cocina · sábados 09:00–13:00 · La Paz;
--        - Tortas · lunes a miércoles 19:00–21:00 · El Alto;
--        - Gastronomía · 2.º año · noche 18:00–21:00 · La Paz, de la gestión
--          siguiente (para renovar), con su Paquete Económico.
--      La carrera de 1.er año queda SIN convocatoria: en «Nueva inscripción»
--      Valeria ve solo los dos cursos (el caso que contó el usuario).
--   3. Diego (cuenta del portal) queda inscrito en Gastronomía · 1.er año ·
--      noche · La Paz con una ficha enlazada a su cuenta: en el portal ve
--      «Mis cursos» y «Mi horario», que Tortas se cruza con su carrera
--      (desactivado, con el motivo) y que Cocina de los sábados no.
--      Su cuota queda por cobrar: aparece en «Lo que deben».
-- No toca las solicitudes del portal (la batería del panel usa las pendientes
-- de Valeria y Diego, y las crea si faltan).
--
-- Cómo: como la semilla del panel, simulando la sesión de Carla
-- (administración) y de Rosa (recepción de La Paz), por la RLS y las RPC
-- reales. Lo único que se hace como postgres es enlazar la ficha de Diego con
-- su cuenta: en el panel eso lo hace «aprobar solicitud», y la de Diego se
-- aprobó antes de que existiera el panel.
--
-- Uso: c_simular := true (ensayo: comprueba y revierte todo) o false (carga).
-- Es idempotente: si Diego ya tiene ficha, se detiene sin cambiar nada.
-- Para volver a empezar: `borrar-datos-demo.sql` y las tres semillas.
-- ============================================================================

do $$
declare
  -- ------------------------------------------------------------ CONFIGURACIÓN
  c_simular boolean := true;
  -- ---------------------------------------------------------------------------
  v_hoy date := app.hoy();
  v_carla uuid;
  v_rosa uuid;
  v_diego uuid;
  v_valeria uuid;
  v_la_paz uuid;
  v_el_alto uuid;
  v_g_carrera_1 uuid;
  v_g_cocina uuid;
  v_g_tortas uuid;
  v_g_carrera_2 uuid;
  v_inicio_cocina date;
  v_inicio_tortas date;
  v_gestion smallint;
  v_res jsonb;
  v_ficha uuid;
  v_oferta jsonb;
  v_mios jsonb;
  v_n integer;
begin
  select id into v_carla from auth.users where email = 'carla.gutierrez@boliviagourmet.test';
  select id into v_rosa from auth.users where email = 'rosa.condori@boliviagourmet.test';
  select id into v_diego from auth.users where email = 'diego.mamani@boliviagourmet.test';
  select id into v_valeria from auth.users where email = 'valeria.choque@boliviagourmet.test';
  select id into v_la_paz from public.sedes where codigo = 'la-paz';
  select id into v_el_alto from public.sedes where codigo = 'el-alto';
  if v_carla is null or v_rosa is null or v_diego is null or v_valeria is null then
    raise exception 'Faltan las cuentas de demostración: carga antes datos-demo.sql.';
  end if;
  if exists (select 1 from public.estudiantes where perfil_id = v_diego) then
    raise exception 'Las convocatorias de demostración ya están cargadas (Diego tiene ficha). No se cambió nada.';
  end if;
  select id into v_g_carrera_1 from public.cohortes
   where programa_codigo = 'gastronomia' and sede_id = v_la_paz and anio_de_carrera = 1 and turno = 'noche' and estado in ('abierto', 'en_curso')
   order by fecha_inicio desc limit 1;
  if v_g_carrera_1 is null then
    raise exception 'Falta el grupo de Gastronomía · 1.er año · noche · La Paz: carga antes datos-panel-demo.sql.';
  end if;

  -- El próximo sábado y el próximo lunes desde dentro de 45 días: el plazo
  -- dura unas seis semanas desde hoy.
  v_inicio_cocina := (v_hoy + 45) + ((6 - extract(isodow from v_hoy + 45)::integer + 7) % 7);
  v_inicio_tortas := (v_hoy + 45) + ((8 - extract(isodow from v_hoy + 45)::integer) % 7);
  v_gestion := (extract(year from v_hoy)::integer + 1)::smallint;

  -- ------------------------------------------------------------ 1 y 2 · Carla: horarios y convocatorias
  perform set_config('request.jwt.claims', json_build_object('sub', v_carla, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  update public.cohortes set hora_inicio = '18:00', hora_fin = '21:00'
   where programa_codigo = 'gastronomia' and turno = 'noche' and estado <> 'cerrado' and hora_inicio is null;
  update public.cohortes set hora_inicio = '15:00', hora_fin = '18:00'
   where programa_codigo = 'gastronomia' and turno = 'tarde' and estado <> 'cerrado' and hora_inicio is null;
  update public.cohortes set hora_inicio = '09:00', hora_fin = '13:00'
   where programa_codigo = 'cocina' and dias = 'sab' and estado <> 'cerrado' and hora_inicio is null;
  update public.cohortes set hora_inicio = '14:00', hora_fin = '17:00'
   where programa_codigo = 'tortas' and dias = 'sab' and estado <> 'cerrado' and hora_inicio is null;

  insert into public.cohortes (programa_codigo, sede_id, gestion, dias, duracion, fecha_inicio, fecha_fin, capacidad, estado,
                               hora_inicio, hora_fin, inscripcion_desde, inscripcion_hasta)
  values ('cocina', v_la_paz, extract(year from v_inicio_cocina)::smallint, 'sab', 2, v_inicio_cocina,
          (v_inicio_cocina + interval '2 months' - interval '1 day')::date, 15, 'abierto',
          '09:00', '13:00', v_hoy - 2, v_inicio_cocina - 3)
  returning id into v_g_cocina;

  insert into public.cohortes (programa_codigo, sede_id, gestion, dias, duracion, fecha_inicio, fecha_fin, capacidad, estado,
                               hora_inicio, hora_fin, inscripcion_desde, inscripcion_hasta)
  values ('tortas', v_el_alto, extract(year from v_inicio_tortas)::smallint, 'lun-mie', 2, v_inicio_tortas,
          (v_inicio_tortas + interval '2 months' - interval '1 day')::date, 12, 'abierto',
          '19:00', '21:00', v_hoy - 2, v_inicio_tortas - 3)
  returning id into v_g_tortas;

  insert into public.cohortes (programa_codigo, sede_id, gestion, anio_de_carrera, turno, dias, duracion, fecha_inicio, capacidad, estado,
                               hora_inicio, hora_fin, inscripcion_desde, inscripcion_hasta)
  values ('gastronomia', v_la_paz, v_gestion, 2, 'noche', 'lun-vie', 3, make_date(v_gestion, 2, 1), 30, 'abierto',
          '18:00', '21:00', v_hoy - 2, v_hoy + 60)
  returning id into v_g_carrera_2;
  insert into public.planes_de_pago (cohorte_id, paquete, monto_cuota, cuotas, primer_vencimiento, nota)
  values (v_g_carrera_2, 'economico', 65000, 1, make_date(v_gestion, 2, 15), 'Periodicidad por confirmar');
  execute 'reset role';

  -- ------------------------------------------------------------ 3 · Rosa inscribe a Diego (su 1.er año)
  if exists (select 1 from public.estudiantes where upper(documento) = '7348215' and archivado_en is null) then
    raise exception 'El carnet de demostración 7348215 ya está en otra ficha: cambia el de Diego en este script.';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_rosa, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_res := public.inscribir(gen_random_uuid(), null,
    jsonb_build_object('nombres', 'Diego', 'apellidos', 'Mamani Flores', 'documento', '7348215', 'fecha_de_nacimiento', '2005-08-19'),
    v_g_carrera_1, 'economico', array['Fotocopia de carnet de identidad'], null, null, null);
  execute 'reset role';
  v_ficha := (v_res ->> 'estudiante')::uuid;

  -- Su cuenta del portal y su ficha son la misma persona (lo que hace «aprobar solicitud»).
  perform set_config('request.jwt.claims', '', true);
  update public.estudiantes set perfil_id = v_diego where id = v_ficha;

  -- ------------------------------------------------------------ comprobaciones
  -- Valeria: la oferta abierta tiene los tres grupos nuevos y no la carrera de 1.er año.
  perform set_config('request.jwt.claims', json_build_object('sub', v_valeria, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_oferta := public.oferta_abierta();
  execute 'reset role';
  select count(*) into v_n from jsonb_array_elements(v_oferta) g where (g ->> 'id')::uuid in (v_g_cocina, v_g_tortas, v_g_carrera_2);
  if v_n <> 3 then raise exception 'FALLO: % de 3 convocatorias en la oferta', v_n; end if;
  if exists (select 1 from jsonb_array_elements(v_oferta) g where (g ->> 'anio_de_carrera')::integer = 1) then
    raise exception 'FALLO: la carrera de 1.er año no debía tener convocatoria';
  end if;

  -- Diego: ve su 1.er año; Tortas se cruza con él y Cocina de los sábados no.
  perform set_config('request.jwt.claims', json_build_object('sub', v_diego, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_mios := public.mis_grupos();
  execute 'reset role';
  if jsonb_array_length(v_mios -> 'inscripciones') <> 1 or (v_mios -> 'inscripciones' -> 0 -> 'grupo' ->> 'id')::uuid <> v_g_carrera_1 then
    raise exception 'FALLO: Diego ve %', v_mios;
  end if;
  if app.cruce_de_grupos((select c from public.cohortes c where c.id = v_g_carrera_1), (select c from public.cohortes c where c.id = v_g_tortas)) <> 'se_cruza'
     or app.cruce_de_grupos((select c from public.cohortes c where c.id = v_g_carrera_1), (select c from public.cohortes c where c.id = v_g_cocina)) <> 'no_se_cruza' then
    raise exception 'FALLO: los cruces de Diego no son los esperados';
  end if;

  if c_simular then
    raise exception 'OK · simulación correcta: horarios, 3 convocatorias (Cocina %, Tortas %, 2.º año %) y Diego inscrito (todo revertido)',
      v_inicio_cocina, v_inicio_tortas, v_gestion;
  end if;
  raise notice 'Convocatorias de demostración cargadas: Cocina desde el %, Tortas desde el %, 2.º año %; Diego inscrito en su 1.er año.',
    v_inicio_cocina, v_inicio_tortas, v_gestion;
end;
$$;
