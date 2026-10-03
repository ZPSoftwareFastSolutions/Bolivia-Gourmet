-- ============================================================================
-- Batería del panel interno v1 (crece con cada rebanada)
-- ----------------------------------------------------------------------------
-- Cómo se ejecuta: en el editor SQL de Supabase (o con `execute_sql`). Corre
-- como `postgres`, simula sesiones con `set local role` + `request.jwt.claims`
-- y TERMINA LANZANDO UNA EXCEPCIÓN a propósito, para que la transacción se
-- revierta entera: no deja ninguna fila de prueba.
--
-- Requiere las cuentas de demostración (supabase/seed/datos-demo.sql):
-- Carla (administración), Rosa (recepción, La Paz), Valeria (estudiante, con
-- su solicitud pendiente) y Diego (con su renovación pendiente).
--
-- Resultado esperado:  ERROR:  OK · N pruebas superadas (todo revertido)
-- Cualquier mensaje que empiece por «FALLO» dice qué regla se rompió.
-- ============================================================================

do $$
declare
  v_carla uuid;
  v_rosa uuid;
  v_valeria uuid;
  v_la_paz uuid;
  v_el_alto uuid;
  v_ctx jsonb;
  v_res jsonb;
  v_clave uuid := gen_random_uuid();
  v_ok integer := 0;
begin
  select id into v_carla from auth.users where email = 'carla.gutierrez@boliviagourmet.test';
  select id into v_rosa from auth.users where email = 'rosa.condori@boliviagourmet.test';
  select id into v_valeria from auth.users where email = 'valeria.choque@boliviagourmet.test';
  select id into v_la_paz from public.sedes where codigo = 'la-paz';
  select id into v_el_alto from public.sedes where codigo = 'el-alto';
  if v_carla is null or v_rosa is null or v_valeria is null then
    raise exception 'FALLO P00: faltan las cuentas de demostración (supabase/seed/datos-demo.sql)';
  end if;

  -- ============================================================ R1 · núcleo

  -- N01 · anon no ejecuta mi_contexto ni el motor
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  begin
    perform public.mi_contexto();
    raise exception 'FALLO N01a: anon ejecutó mi_contexto';
  exception when insufficient_privilege then v_ok := v_ok + 1;
  end;
  begin
    perform app.iniciar_operacion(gen_random_uuid(), 'prueba');
    raise exception 'FALLO N01b: anon ejecutó app.iniciar_operacion';
  exception when insufficient_privilege then v_ok := v_ok + 1;
  end;
  execute 'reset role';

  -- N02 · el estudiante no tiene ningún permiso del panel
  perform set_config('request.jwt.claims', json_build_object('sub', v_valeria, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_ctx := public.mi_contexto();
  if jsonb_array_length(v_ctx -> 'permisos') <> 0 then
    raise exception 'FALLO N02a: el estudiante tiene permisos %', v_ctx -> 'permisos';
  end if;
  v_ok := v_ok + 1;
  begin
    perform app.exigir_permiso('panel.entrar');
    raise exception 'FALLO N02b: el estudiante pasó exigir_permiso';
  exception when insufficient_privilege then v_ok := v_ok + 1;
  end;
  execute 'reset role';

  -- N03 · recepción: permisos de su rol, una sola sede, no anula
  perform set_config('request.jwt.claims', json_build_object('sub', v_rosa, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_ctx := public.mi_contexto();
  if not (v_ctx -> 'permisos') ? 'panel.entrar' or not (v_ctx -> 'permisos') ? 'caja.cobrar' then
    raise exception 'FALLO N03a: a recepción le faltan permisos %', v_ctx -> 'permisos';
  end if;
  if (v_ctx -> 'permisos') ? 'caja.anular' or (v_ctx -> 'permisos') ? 'contabilidad.leer' or (v_ctx -> 'permisos') ? 'sedes.todas' then
    raise exception 'FALLO N03b: recepción tiene permisos de administración %', v_ctx -> 'permisos';
  end if;
  if jsonb_array_length(v_ctx -> 'sedes') <> 1 or (v_ctx -> 'sedes' -> 0 ->> 'codigo') <> 'la-paz' then
    raise exception 'FALLO N03c: recepción ve sedes %', v_ctx -> 'sedes';
  end if;
  v_ok := v_ok + 1;

  -- N04 · recepción opera en su sede y no en la otra
  perform app.exigir_sede(v_la_paz);
  begin
    perform app.exigir_sede(v_el_alto);
    raise exception 'FALLO N04: recepción de La Paz pudo operar en El Alto';
  exception when others then
    if sqlerrm <> 'sede_no_operable' then raise; end if;
    v_ok := v_ok + 1;
  end;

  -- N05 · nadie lee ni escribe operaciones por la API
  begin
    perform 1 from public.operaciones limit 1;
    raise exception 'FALLO N05: recepción leyó operaciones';
  exception when insufficient_privilege then v_ok := v_ok + 1;
  end;

  -- N06 · idempotencia: la misma clave devuelve lo guardado
  v_res := app.iniciar_operacion(v_clave, 'prueba');
  if v_res is not null then raise exception 'FALLO N06a: una clave nueva devolvió %', v_res; end if;
  perform app.terminar_operacion(v_clave, '{"numero": 7}'::jsonb);
  v_res := app.iniciar_operacion(v_clave, 'prueba');
  if (v_res ->> 'numero') <> '7' or (v_res ->> 'repetida') <> 'true' then
    raise exception 'FALLO N06b: la clave repetida devolvió %', v_res;
  end if;
  v_ok := v_ok + 1;
  begin
    perform app.iniciar_operacion(v_clave, 'otra_cosa');
    raise exception 'FALLO N06c: la clave se reutilizó para otra operación';
  exception when others then
    if sqlerrm <> 'clave_reutilizada' then raise; end if;
    v_ok := v_ok + 1;
  end;
  execute 'reset role';

  -- N07 · otra persona no puede reutilizar la clave de Rosa
  perform set_config('request.jwt.claims', json_build_object('sub', v_carla, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    perform app.iniciar_operacion(v_clave, 'prueba');
    raise exception 'FALLO N07: administración reutilizó la clave de recepción';
  exception when others then
    if sqlerrm <> 'clave_reutilizada' then raise; end if;
    v_ok := v_ok + 1;
  end;

  -- N08 · administración ve las dos sedes y opera en ambas
  v_ctx := public.mi_contexto();
  if jsonb_array_length(v_ctx -> 'sedes') <> 2 then
    raise exception 'FALLO N08: administración ve % sedes', jsonb_array_length(v_ctx -> 'sedes');
  end if;
  perform app.exigir_sede(v_el_alto);
  v_ok := v_ok + 1;

  -- N09 · la fecha simulada NO se aplica fuera del modo mantenimiento
  perform set_config('app.hoy_simulada', '2026-01-15', true);
  if app.hoy() = date '2026-01-15' then
    raise exception 'FALLO N09a: se simuló la fecha sin modo mantenimiento';
  end if;
  v_ok := v_ok + 1;
  execute 'reset role';

  -- N10 · en modo mantenimiento (solo postgres, desde el editor) sí se aplica
  perform set_config('app.mantenimiento', 'si', true);
  if app.hoy() <> date '2026-01-15' then
    raise exception 'FALLO N10: el modo mantenimiento no simuló la fecha (%)', app.hoy();
  end if;
  perform set_config('app.mantenimiento', 'no', true);
  perform set_config('app.hoy_simulada', '', true);
  if app.hoy() <> (now() at time zone 'America/La_Paz')::date then
    raise exception 'FALLO N10b: app.hoy() no volvió a la fecha real';
  end if;
  v_ok := v_ok + 1;


  -- ============================================================ R2 · alumnos y grupos
  declare
    v_g1 uuid;          -- Gastronomía 1.er año · Noche · 2026 · La Paz (cupo 2)
    v_g2 uuid;          -- Gastronomía 2.º año · Noche · 2027 · La Paz
    v_g_tarde uuid;     -- Gastronomía 1.er año · Tarde · 2027 · La Paz (solicitudes)
    v_g2_tarde uuid;    -- Gastronomía 2.º año · Tarde · 2027 · La Paz (renovación del portal)
    v_g_cocina uuid;    -- Cocina · Sábados · El Alto
    v_a uuid;
    v_b uuid;
    v_ins_a uuid;
    v_ins_b uuid;
    v_ins_renov uuid;
    v_sol_valeria uuid;
    v_sol_diego uuid;
    v_n integer;
    v_texto text;
    v_clave_ins uuid := gen_random_uuid();
  begin
    -- N11 · administración abre grupos (escritura directa con su permiso)
    perform set_config('request.jwt.claims', json_build_object('sub', v_carla, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    insert into public.cohortes (programa_codigo, sede_id, gestion, anio_de_carrera, turno, dias, duracion, fecha_inicio, capacidad, estado)
    values ('gastronomia', v_la_paz, 2026, 1, 'noche', 'lun-vie', 3, date '2026-02-02', 2, 'abierto') returning id into v_g1;
    insert into public.cohortes (programa_codigo, sede_id, gestion, anio_de_carrera, turno, dias, duracion, fecha_inicio, estado)
    values ('gastronomia', v_la_paz, 2027, 2, 'noche', 'lun-vie', 3, date '2027-02-01', 'abierto') returning id into v_g2;
    insert into public.cohortes (programa_codigo, sede_id, gestion, anio_de_carrera, turno, dias, duracion, fecha_inicio, estado)
    values ('gastronomia', v_la_paz, 2027, 1, 'tarde', 'lun-vie', 3, date '2027-02-01', 'abierto') returning id into v_g_tarde;
    insert into public.cohortes (programa_codigo, sede_id, gestion, anio_de_carrera, turno, dias, duracion, fecha_inicio, estado)
    values ('gastronomia', v_la_paz, 2027, 2, 'tarde', 'lun-vie', 3, date '2027-02-01', 'abierto') returning id into v_g2_tarde;
    insert into public.cohortes (programa_codigo, sede_id, gestion, dias, duracion, fecha_inicio, estado)
    values ('cocina', v_el_alto, 2026, 'sab', 1, date '2026-10-03', 'abierto') returning id into v_g_cocina;
    v_ok := v_ok + 1;

    -- N12 · un grupo de la carrera exige el año; uno de curso no lo admite
    begin
      insert into public.cohortes (programa_codigo, sede_id, gestion, turno, dias, duracion, fecha_inicio)
      values ('gastronomia', v_la_paz, 2026, 'noche', 'lun-vie', 3, date '2026-02-02');
      raise exception 'FALLO N12a: grupo de la carrera sin año';
    exception when others then
      if sqlerrm <> 'anio_de_carrera_invalido' then raise exception 'FALLO N12a: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    begin
      insert into public.cohortes (programa_codigo, sede_id, gestion, anio_de_carrera, dias, duracion, fecha_inicio)
      values ('cocina', v_la_paz, 2026, 1, 'sab', 1, date '2026-10-03');
      raise exception 'FALLO N12b: grupo de curso con año';
    exception when others then
      if sqlerrm <> 'anio_de_carrera_invalido' then raise exception 'FALLO N12b: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;

    -- N13 · plan de pagos: la carrera exige paquete; el concepto se pone solo
    begin
      insert into public.planes_de_pago (cohorte_id, monto_cuota, cuotas, primer_vencimiento) values (v_g1, 65000, 1, date '2026-02-10');
      raise exception 'FALLO N13a: plan de la carrera sin paquete';
    exception when others then
      if sqlerrm <> 'paquete_requerido' then raise exception 'FALLO N13a: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    insert into public.planes_de_pago (cohorte_id, paquete, monto_cuota, cuotas, primer_vencimiento, nota)
    values (v_g1, 'economico', 65000, 1, date '2026-02-10', 'Periodicidad por confirmar');
    select k.codigo into v_texto from public.planes_de_pago pl join public.conceptos k on k.id = pl.concepto_id where pl.cohorte_id = v_g1;
    if v_texto <> 'colegiatura-carrera' then raise exception 'FALLO N13b: concepto por defecto %', v_texto; end if;
    v_ok := v_ok + 1;
    execute 'reset role';

    -- N14 · recepción no abre grupos ni carga precios
    perform set_config('request.jwt.claims', json_build_object('sub', v_rosa, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    begin
      insert into public.cohortes (programa_codigo, sede_id, gestion, dias, duracion, fecha_inicio) values ('cocina', v_la_paz, 2026, 'sab', 1, date '2026-10-03');
      raise exception 'FALLO N14a: recepción abrió un grupo';
    exception when insufficient_privilege then v_ok := v_ok + 1;
    end;
    begin
      insert into public.planes_de_pago (cohorte_id, paquete, monto_cuota, cuotas, primer_vencimiento) values (v_g2, 'economico', 1, 1, date '2027-02-10');
      raise exception 'FALLO N14b: recepción cargó un precio';
    exception when insufficient_privilege then v_ok := v_ok + 1;
    end;

    -- N15 · recepción inscribe a una persona nueva (ficha + inscripción)
    v_res := public.inscribir(v_clave_ins, null,
      '{"nombres":"  Ana   María ","apellidos":"Prueba Uno","documento":"9999901","telefono":"71234567"}'::jsonb,
      v_g1, 'economico', array['Fotocopia de carnet', ' ', 'Fotocopia de carnet'], null, null, null);
    v_a := (v_res ->> 'estudiante')::uuid;
    v_ins_a := (v_res ->> 'inscripcion')::uuid;
    if v_res ->> 'codigo' !~ '^BG-[0-9]{4}-[0-9]{4}$' or (v_res ->> 'sin_plan')::boolean or not (v_res ->> 'ficha_nueva')::boolean then
      raise exception 'FALLO N15a: resultado %', v_res;
    end if;
    if v_res ->> 'grupo_nombre' <> 'Gastronomía · 1.er año · Noche · 2026 · La Paz' then
      raise exception 'FALLO N15b: nombre del grupo %', v_res ->> 'grupo_nombre';
    end if;
    select e.nombres || '|' || array_to_string(i.documentos_entregados, ',') into v_texto
      from public.estudiantes e join public.inscripciones i on i.estudiante_id = e.id where i.id = v_ins_a;
    if v_texto <> 'Ana María|Fotocopia de carnet' then raise exception 'FALLO N15c: datos normalizados %', v_texto; end if;
    v_ok := v_ok + 1;

    -- N16 · el mismo envío dos veces no inscribe dos veces
    v_res := public.inscribir(v_clave_ins, null, '{"nombres":"Ana","apellidos":"Prueba Uno"}'::jsonb, v_g1, 'economico', null, null, null, null);
    if (v_res ->> 'inscripcion')::uuid <> v_ins_a or not (v_res ->> 'repetida')::boolean then
      raise exception 'FALLO N16: el reenvío devolvió %', v_res;
    end if;
    v_ok := v_ok + 1;

    -- N17 · carnet repetido, paquete, persona ya inscrita
    begin
      perform public.inscribir(gen_random_uuid(), null, '{"nombres":"Otra","apellidos":"Persona","documento":"9999901"}'::jsonb, v_g1, 'economico', null, null, null, null);
      raise exception 'FALLO N17a: carnet repetido aceptado';
    exception when others then
      if sqlerrm <> 'documento_duplicado' then raise exception 'FALLO N17a: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    begin
      perform public.inscribir(gen_random_uuid(), v_a, null, v_g1, null, null, null, null, null);
      raise exception 'FALLO N17b: carrera sin paquete';
    exception when others then
      if sqlerrm <> 'paquete_requerido' then raise exception 'FALLO N17b: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    begin
      perform public.inscribir(gen_random_uuid(), v_a, null, v_g1, 'economico', null, null, null, null);
      raise exception 'FALLO N17c: inscrito dos veces';
    exception when others then
      if sqlerrm <> 'ya_inscrito' then raise exception 'FALLO N17c: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;

    -- N18 · cupo: el segundo entra, el tercero no
    v_res := public.inscribir(gen_random_uuid(), null, '{"nombres":"Beto","apellidos":"Prueba Dos"}'::jsonb, v_g1, 'economico', null, null, null, null);
    v_b := (v_res ->> 'estudiante')::uuid;
    v_ins_b := (v_res ->> 'inscripcion')::uuid;
    begin
      perform public.inscribir(gen_random_uuid(), null, '{"nombres":"Ceci","apellidos":"Prueba Tres"}'::jsonb, v_g1, 'economico', null, null, null, null);
      raise exception 'FALLO N18: el grupo lleno aceptó a otra persona';
    exception when others then
      if sqlerrm <> 'grupo_lleno' then raise exception 'FALLO N18: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;

    -- N18b · el cupo no baja de los inscritos (administración)
    execute 'reset role';
    perform set_config('request.jwt.claims', json_build_object('sub', v_carla, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    begin
      update public.cohortes set capacidad = 1 where id = v_g1;
      raise exception 'FALLO N18b: el cupo bajó de los inscritos';
    exception when others then
      if sqlerrm <> 'capacidad_menor_que_inscritos' then raise exception 'FALLO N18b: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    execute 'reset role';
    perform set_config('request.jwt.claims', json_build_object('sub', v_rosa, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';

    -- N19 · recepción de La Paz no inscribe en El Alto (pero ve el grupo)
    begin
      perform public.inscribir(gen_random_uuid(), v_a, null, v_g_cocina, null, null, null, null, null);
      raise exception 'FALLO N19a: recepción inscribió en otra sede';
    exception when others then
      if sqlerrm <> 'sede_no_operable' then raise exception 'FALLO N19a: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    select count(*) into v_n from public.v_grupos where id = v_g_cocina;
    if v_n <> 1 then raise exception 'FALLO N19b: recepción no ve los grupos de la otra sede'; end if;
    v_ok := v_ok + 1;

    -- N20 · renovar enlaza con el año anterior; no dos veces ni a un año que no sigue
    v_res := public.inscribir(gen_random_uuid(), v_a, null, v_g2, 'economico', null, v_ins_a, null, null);
    v_ins_renov := (v_res ->> 'inscripcion')::uuid;
    select estado::text into v_texto from public.inscripciones where id = v_ins_a;
    if v_texto <> 'inscrito' then raise exception 'FALLO N20a: renovar cambió la anterior a %', v_texto; end if;
    v_ok := v_ok + 1;
    begin
      perform public.inscribir(gen_random_uuid(), v_b, null, v_g_tarde, 'economico', null, v_ins_b, null, null);
      raise exception 'FALLO N20b: renovó a un grupo de 1.er año';
    exception when others then
      if sqlerrm <> 'renovacion_no_corresponde' then raise exception 'FALLO N20b: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;

    -- N21 · retirar exige motivo; lo retirado no vuelve a cambiar
    begin
      perform public.cambiar_estado_de_inscripcion(gen_random_uuid(), v_ins_b, 'retirado', ' ');
      raise exception 'FALLO N21a: retiro sin motivo';
    exception when others then
      if sqlerrm <> 'motivo_requerido' then raise exception 'FALLO N21a: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    v_res := public.cambiar_estado_de_inscripcion(gen_random_uuid(), v_ins_b, 'retirado', 'Viaje por trabajo');
    if v_res ->> 'estado' <> 'retirado' or v_res ->> 'antes' <> 'inscrito' then raise exception 'FALLO N21b: %', v_res; end if;
    v_ok := v_ok + 1;
    begin
      perform public.cambiar_estado_de_inscripcion(gen_random_uuid(), v_ins_b, 'concluido', null);
      raise exception 'FALLO N21c: un retirado pasó a concluido';
    exception when others then
      if sqlerrm <> 'transicion_no_valida' then raise exception 'FALLO N21c: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;

    -- N22 · recepción no archiva fichas
    begin
      update public.estudiantes set archivado_en = now(), archivado_motivo = 'Prueba' where id = v_b;
      raise exception 'FALLO N22: recepción archivó una ficha';
    exception when others then
      if sqlerrm <> 'sin_permiso' then raise exception 'FALLO N22: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    execute 'reset role';

    -- N23 · administración archiva solo sin inscripción vigente y con motivo
    perform set_config('request.jwt.claims', json_build_object('sub', v_carla, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    begin
      update public.estudiantes set archivado_en = now(), archivado_motivo = 'Prueba' where id = v_a;
      raise exception 'FALLO N23a: archivó a alguien inscrito';
    exception when others then
      if sqlerrm <> 'alumno_con_inscripcion' then raise exception 'FALLO N23a: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    update public.estudiantes set archivado_en = now(), archivado_motivo = 'Se retiró y no volverá' where id = v_b;
    select archivado_por::text into v_texto from public.estudiantes where id = v_b;
    if v_texto <> v_carla::text then raise exception 'FALLO N23b: archivado_por = %', v_texto; end if;
    v_ok := v_ok + 1;

    -- N24 · cerrar un grupo es una RPC: concluye a sus inscritos; cerrado no cambia
    begin
      update public.cohortes set estado = 'cerrado' where id = v_g1;
      raise exception 'FALLO N24a: se cerró un grupo por escritura directa';
    exception when others then
      if sqlerrm <> 'usa_cerrar_grupo' then raise exception 'FALLO N24a: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    v_res := public.cerrar_grupo(gen_random_uuid(), v_g1);
    if (v_res ->> 'concluidos')::int <> 1 then raise exception 'FALLO N24c: %', v_res; end if;
    select estado::text into v_texto from public.inscripciones where id = v_ins_a;
    if v_texto <> 'concluido' then raise exception 'FALLO N24d: la inscripción quedó %', v_texto; end if;
    begin
      update public.cohortes set capacidad = 30 where id = v_g1;
      raise exception 'FALLO N24e: se editó un grupo cerrado';
    exception when others then
      if sqlerrm <> 'grupo_cerrado' then raise exception 'FALLO N24e: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    v_ok := v_ok + 1;
    execute 'reset role';

    -- N25 · aprobar e inscribir una solicitud del portal (Valeria): ficha nueva enlazada a su cuenta
    select id into v_sol_valeria from public.solicitudes where estudiante_id = v_valeria and estado = 'pendiente' order by created_at limit 1;
    select s.id into v_sol_diego from public.solicitudes s join auth.users u on u.id = s.estudiante_id
     where u.email = 'diego.mamani@boliviagourmet.test' and s.estado = 'pendiente' and s.tipo = 'renovacion' limit 1;
    if v_sol_valeria is null or v_sol_diego is null then
      raise exception 'FALLO N25: faltan las solicitudes pendientes de la demostración';
    end if;
    perform set_config('request.jwt.claims', json_build_object('sub', v_rosa, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    begin
      perform public.aprobar_solicitud(gen_random_uuid(), v_sol_valeria, v_g_cocina, null, null, 'Bienvenida', null);
      raise exception 'FALLO N25a: aprobó en un grupo de otro programa';
    exception when others then
      if sqlerrm <> 'grupo_no_corresponde' then raise exception 'FALLO N25a: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    v_res := public.aprobar_solicitud(gen_random_uuid(), v_sol_valeria, v_g_tarde, 'economico', array['Fotocopia de carnet'],
                                      'Te damos la bienvenida a Gastronomía, gestión 2027', null);
    select s.estado::text || '|' || (e.perfil_id = v_valeria)::text || '|' || (i.solicitud_id = v_sol_valeria)::text into v_texto
      from public.solicitudes s
      join public.inscripciones i on i.id = (v_res ->> 'inscripcion')::uuid
      join public.estudiantes e on e.id = i.estudiante_id
     where s.id = v_sol_valeria;
    if v_texto <> 'aprobada|true|true' then raise exception 'FALLO N25b: %', v_texto; end if;
    v_ok := v_ok + 1;
    begin
      perform public.aprobar_solicitud(gen_random_uuid(), v_sol_valeria, v_g_tarde, 'economico', null, null, null);
      raise exception 'FALLO N25c: aprobó dos veces';
    exception when others then
      if sqlerrm <> 'solicitud_cerrada' then raise exception 'FALLO N25c: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;

    -- N26 · renovación del portal (Diego, sin historia en el sistema): inscribe sin enlace
    v_res := public.aprobar_solicitud(gen_random_uuid(), v_sol_diego, v_g2_tarde, 'economico', null, 'Renovación aprobada', null);
    select (renueva_a is null)::text into v_texto from public.inscripciones where id = (v_res ->> 'inscripcion')::uuid;
    if v_texto <> 'true' then raise exception 'FALLO N26: renovación enlazada a algo que no existe'; end if;
    v_ok := v_ok + 1;
    execute 'reset role';

    -- N27 · el estudiante no ve nada del panel ni ejecuta sus RPC
    perform set_config('request.jwt.claims', json_build_object('sub', v_valeria, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select (select count(*) from public.estudiantes) + (select count(*) from public.cohortes) + (select count(*) from public.inscripciones)
         + (select count(*) from public.planes_de_pago) + (select count(*) from public.conceptos) + (select count(*) from public.v_alumnos)
      into v_n;
    if v_n <> 0 then raise exception 'FALLO N27a: el estudiante ve % filas del panel', v_n; end if;
    v_ok := v_ok + 1;
    begin
      perform public.inscribir(gen_random_uuid(), null, '{"nombres":"Yo","apellidos":"Mismo"}'::jsonb, v_g_tarde, 'economico', null, null, null, null);
      raise exception 'FALLO N27b: el estudiante inscribió';
    exception when insufficient_privilege then v_ok := v_ok + 1;
    end;
    execute 'reset role';

    -- N28 · anon no llega a las RPC de alumnos
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    execute 'set local role anon';
    begin
      perform public.inscribir(gen_random_uuid(), null, null, v_g_tarde, null, null, null, null, null);
      raise exception 'FALLO N28: anon ejecutó inscribir';
    exception when insufficient_privilege then v_ok := v_ok + 1;
    end;
    execute 'reset role';

    -- N29 · el nombre del grupo en la base es el mismo que arma el dominio (B.13, 36)
    if app.nombre_de_grupo('Gastronomía', 'carrera', 1::smallint, 'noche', 'lun-vie', null, 2026::smallint, date '2026-02-02', 'La Paz')
         <> 'Gastronomía · 1.er año · Noche · 2026 · La Paz'
       or app.nombre_de_grupo('Gastronomía', 'carrera', 2::smallint, 'especial', null, null, 2027::smallint, date '2027-02-01', 'El Alto')
         <> 'Gastronomía · 2.º año · Horario especial · 2027 · El Alto'
       or app.nombre_de_grupo('Tortas', 'curso', null, null, 'sab', null, 2026::smallint, date '2026-10-03', 'La Paz')
         <> 'Tortas · Sábados · oct 2026 · La Paz'
       or app.nombre_de_grupo('Repostería y Panadería', 'curso', null, 'manana', 'jue-vie', null, 2027::smallint, date '2027-03-04', 'La Paz')
         <> 'Repostería y Panadería · Jue–Vie · Mañana · mar 2027 · La Paz'
       or app.nombre_de_grupo('Cursos de Temporada', 'curso_de_temporada', null, null, null, 'magistral', 2026::smallint, date '2026-12-05', 'El Alto')
         <> 'Cursos de Temporada · Clase magistral · dic 2026 · El Alto'
    then
      raise exception 'FALLO N29: app.nombre_de_grupo no coincide con el dominio';
    end if;
    v_ok := v_ok + 1;
  end;


  -- ============================================================ R3 · caja
  declare
    v_g uuid;
    v_g_sin uuid;
    v_x uuid;
    v_y uuid;
    v_z uuid;
    v_ins_x uuid;
    v_ins_y uuid;
    v_ins_z uuid;
    v_c1 uuid;
    v_c2 uuid;
    v_pago_efectivo uuid;
    v_recibo text;
    v_numero_1 integer;
    v_numero_2 integer;
    v_clave_cobro uuid := gen_random_uuid();
    v_caja jsonb;
    v_n integer;
    v_texto text;
    v_concepto_luz uuid;
    v_otro_ingreso uuid;
  begin
    select id into v_concepto_luz from public.conceptos where codigo = 'servicios-basicos';

    -- Grupo de Cocina en La Paz con plan de 2 cuotas de Bs 300 (la 1.ª ya venció).
    perform set_config('request.jwt.claims', json_build_object('sub', v_carla, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    insert into public.cohortes (programa_codigo, sede_id, gestion, dias, duracion, fecha_inicio, estado)
    values ('cocina', v_la_paz, 2026, 'sab', 2, app.hoy() - 20, 'en_curso') returning id into v_g;
    insert into public.planes_de_pago (cohorte_id, monto_cuota, cuotas, primer_vencimiento, cada_meses)
    values (v_g, 30000, 2, app.hoy() - 10, 1);
    insert into public.cohortes (programa_codigo, sede_id, gestion, dias, duracion, fecha_inicio, estado)
    values ('tortas', v_la_paz, 2026, 'sab', 2, app.hoy(), 'abierto') returning id into v_g_sin;
    execute 'reset role';

    -- N30 · inscribir genera las cuotas del plan; los saldos las suman
    perform set_config('request.jwt.claims', json_build_object('sub', v_rosa, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    v_res := public.inscribir(gen_random_uuid(), null, '{"nombres":"Xime","apellidos":"Caja Uno"}'::jsonb, v_g, null, null, null, null, null);
    v_x := (v_res ->> 'estudiante')::uuid;
    v_ins_x := (v_res ->> 'inscripcion')::uuid;
    if (v_res ->> 'cuotas')::int <> 2 or (v_res ->> 'sin_plan')::boolean then raise exception 'FALLO N30a: %', v_res; end if;
    select id into v_c1 from public.cargos where inscripcion_id = v_ins_x and numero_de_cuota = 1;
    select id into v_c2 from public.cargos where inscripcion_id = v_ins_x and numero_de_cuota = 2;
    select total_pendiente::text || '|' || total_vencido::text into v_texto from public.v_saldos_de_alumno where estudiante_id = v_x;
    if v_texto <> '60000|30000' then raise exception 'FALLO N30b: saldos %', v_texto; end if;
    v_ok := v_ok + 1;
    execute 'reset role';

    -- N31 · con cargos, el precio del grupo queda congelado
    perform set_config('request.jwt.claims', json_build_object('sub', v_carla, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    begin
      update public.planes_de_pago set monto_cuota = 1 where cohorte_id = v_g;
      raise exception 'FALLO N31: se cambió un precio con cuotas';
    exception when others then
      if sqlerrm <> 'plan_congelado' then raise exception 'FALLO N31: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    execute 'reset role';

    perform set_config('request.jwt.claims', json_build_object('sub', v_rosa, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';

    -- N32 · no se cobra más de lo que se debe en un cargo
    begin
      perform public.registrar_cobro(gen_random_uuid(), v_la_paz, v_x, 'efectivo', null,
        jsonb_build_array(jsonb_build_object('cargo', v_c1, 'monto', 40000)), null, null, null);
      raise exception 'FALLO N32: cobró de más';
    exception when others then
      if sqlerrm <> 'aplicacion_excede_saldo' then raise exception 'FALLO N32: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;

    -- N33 · sin cargos indicados, del más antiguo al más nuevo; recibo LP-AAAA-NNNNNN
    v_res := public.registrar_cobro(v_clave_cobro, v_la_paz, v_x, 'efectivo', null, null, 40000, null, null);
    v_pago_efectivo := (v_res ->> 'pago')::uuid;
    v_recibo := v_res ->> 'recibo';
    if v_recibo !~ '^LP-[0-9]{4}-[0-9]{6}$' or (v_res ->> 'saldo_pendiente')::bigint <> 20000 then
      raise exception 'FALLO N33a: %', v_res;
    end if;
    if (select pendiente from public.v_saldos_de_cargo where id = v_c1) <> 0 or (select pendiente from public.v_saldos_de_cargo where id = v_c2) <> 20000 then
      raise exception 'FALLO N33b: la aplicación no siguió el orden de vencimiento';
    end if;
    select numero into v_numero_1 from public.pagos where id = v_pago_efectivo;
    v_ok := v_ok + 1;

    -- N34 · el mismo envío no cobra dos veces
    v_res := public.registrar_cobro(v_clave_cobro, v_la_paz, v_x, 'efectivo', null, null, 40000, null, null);
    if v_res ->> 'recibo' <> v_recibo or not (v_res ->> 'repetida')::boolean then raise exception 'FALLO N34: %', v_res; end if;
    select count(*) into v_n from public.pagos where estudiante_id = v_x;
    if v_n <> 1 then raise exception 'FALLO N34b: hay % cobros', v_n; end if;
    v_ok := v_ok + 1;

    -- N35 · QR: número de operación obligatorio y no repetido; recibo correlativo sin huecos
    begin
      perform public.registrar_cobro(gen_random_uuid(), v_la_paz, v_x, 'qr', '  ', null, 20000, null, null);
      raise exception 'FALLO N35a: QR sin número de operación';
    exception when others then
      if sqlerrm <> 'referencia_requerida' then raise exception 'FALLO N35a: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    v_res := public.registrar_cobro(gen_random_uuid(), v_la_paz, v_x, 'qr', 'op-998877', null, 20000, null, null);
    select numero into v_numero_2 from public.pagos where id = (v_res ->> 'pago')::uuid;
    if v_numero_2 <> v_numero_1 + 1 then raise exception 'FALLO N35b: recibo % tras %', v_numero_2, v_numero_1; end if;
    v_ok := v_ok + 1;
    begin
      perform public.registrar_cobro(gen_random_uuid(), v_la_paz, null, 'qr', 'OP-998877', null, null,
        '{"concepto":"otro-ingreso","descripcion":"Prueba","monto":100,"cliente":"Alguien"}'::jsonb, null);
      raise exception 'FALLO N35c: número de operación repetido';
    exception when others then
      if sqlerrm <> 'referencia_repetida' then raise exception 'FALLO N35c: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;

    -- N36 · nadie escribe la caja por la API, ni anula desde recepción
    begin
      update public.pagos set monto = 1 where id = v_pago_efectivo;
      raise exception 'FALLO N36a: recepción editó un cobro';
    exception when insufficient_privilege then v_ok := v_ok + 1;
    end;
    begin
      perform public.anular(gen_random_uuid(), 'cobro', v_pago_efectivo, 'Prueba');
      raise exception 'FALLO N36b: recepción anuló un cobro';
    exception when insufficient_privilege then v_ok := v_ok + 1;
    end;
    begin
      perform public.registrar_gasto(gen_random_uuid(), v_la_paz, null, v_concepto_luz, 'Luz', 100, 'efectivo', null, null, null, null);
      raise exception 'FALLO N36c: recepción registró un gasto';
    exception when insufficient_privilege then v_ok := v_ok + 1;
    end;

    -- N37 · venta directa a alguien de fuera, con su propio recibo
    v_res := public.registrar_cobro(gen_random_uuid(), v_la_paz, null, 'efectivo', null, null, null,
      '{"concepto":"otro-ingreso","descripcion":"Recetario de cocina","monto":5000,"cliente":"Juan Pérez"}'::jsonb, null);
    select p.cliente || '|' || p.monto into v_texto from public.pagos p where p.id = (v_res ->> 'pago')::uuid;
    if v_texto <> 'Juan Pérez|5000' then raise exception 'FALLO N37: %', v_texto; end if;
    v_ok := v_ok + 1;

    -- N38 · lo que hay por arquear es la misma cuenta que hace el cierre
    v_caja := public.caja_por_cerrar(v_la_paz);
    if (v_caja ->> 'entradas_efectivo')::bigint <> 45000 or (v_caja ->> 'cobros_qr')::bigint <> 20000
       or (v_caja ->> 'esperado')::bigint <> (v_caja ->> 'saldo_inicial')::bigint + 45000 then
      raise exception 'FALLO N38: %', v_caja;
    end if;
    v_ok := v_ok + 1;

    -- N39 · si no cuadra, se explica; el arqueo marca lo contado
    begin
      perform public.cerrar_caja(gen_random_uuid(), v_la_paz, (v_caja ->> 'esperado')::bigint - 500, 0, null,
        case when (v_caja ->> 'primer_arqueo')::boolean then 0 end);
      raise exception 'FALLO N39a: cerró sin explicar la diferencia';
    exception when others then
      if sqlerrm <> 'observacion_requerida' then raise exception 'FALLO N39a: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    v_res := public.cerrar_caja(gen_random_uuid(), v_la_paz, (v_caja ->> 'esperado')::bigint - 500, 10000, 'Faltó cambio',
      case when (v_caja ->> 'primer_arqueo')::boolean then 0 end);
    if (v_res ->> 'diferencia')::bigint <> -500 or (v_res ->> 'queda')::bigint <> (v_res ->> 'contado')::bigint - 10000 then
      raise exception 'FALLO N39b: %', v_res;
    end if;
    if exists (select 1 from public.pagos where sede_id = v_la_paz and cierre_id is null) then
      raise exception 'FALLO N39c: quedaron cobros sin marcar';
    end if;
    begin
      perform public.cerrar_caja(gen_random_uuid(), v_la_paz, 0, 0, null, null);
      raise exception 'FALLO N39d: cerró sin movimientos';
    exception when others then
      if sqlerrm <> 'nada_que_arquear' then raise exception 'FALLO N39d: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    v_ok := v_ok + 1;
    execute 'reset role';

    -- N40 · administración anula un cobro en efectivo ya arqueado: sale en el arqueo siguiente
    perform set_config('request.jwt.claims', json_build_object('sub', v_carla, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    v_res := public.anular(gen_random_uuid(), 'cobro', v_pago_efectivo, 'Se devolvió el dinero');
    if v_res ->> 'recibo' <> v_recibo then raise exception 'FALLO N40a: %', v_res; end if;
    v_caja := public.caja_por_cerrar(v_la_paz);
    if (v_caja ->> 'salidas_efectivo')::bigint <> 40000 or (v_caja ->> 'registros')::int <> 1 then
      raise exception 'FALLO N40b: %', v_caja;
    end if;
    if (select pendiente from public.v_saldos_de_cargo where id = v_c1) <> 30000 then raise exception 'FALLO N40c: la cuota no volvió a quedar pendiente'; end if;
    begin
      perform public.anular(gen_random_uuid(), 'cobro', v_pago_efectivo, 'Otra vez');
      raise exception 'FALLO N40d: anuló dos veces';
    exception when others then
      if sqlerrm <> 'ya_anulado' then raise exception 'FALLO N40d: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    v_ok := v_ok + 1;

    -- N41 · un cargo con cobros vigentes no se anula; uno sin cobros, sí
    begin
      perform public.anular(gen_random_uuid(), 'cargo', v_c2, 'Prueba');
      raise exception 'FALLO N41a: anuló un cargo cobrado';
    exception when others then
      if sqlerrm <> 'cargo_con_cobros' then raise exception 'FALLO N41a: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    perform public.anular(gen_random_uuid(), 'cargo', v_c1, 'Beca de la primera cuota');
    v_ok := v_ok + 1;

    -- N42 · gasto en efectivo de administración: sale del cajón de hoy
    v_res := public.registrar_gasto(gen_random_uuid(), v_la_paz, null, v_concepto_luz, 'Luz de septiembre', 5000, 'efectivo', null, 'factura', '123', 'DELAPAZ');
    v_caja := public.caja_por_cerrar(v_la_paz);
    if (v_caja ->> 'salidas_efectivo')::bigint <> 45000 then raise exception 'FALLO N42: %', v_caja; end if;
    begin
      perform public.registrar_gasto(gen_random_uuid(), v_la_paz, app.hoy() - 3, v_concepto_luz, 'Agua', 100, 'efectivo', null, null, null, null);
      raise exception 'FALLO N42b: gasto en efectivo con fecha pasada';
    exception when others then
      if sqlerrm <> 'fecha_invalida' then raise exception 'FALLO N42b: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    v_ok := v_ok + 1;

    -- N43 · crear las cuotas de un grupo que ya tenía alumnos sin precio
    execute 'reset role';
    perform set_config('request.jwt.claims', json_build_object('sub', v_rosa, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    v_res := public.inscribir(gen_random_uuid(), null, '{"nombres":"Zoe","apellidos":"Caja Tres"}'::jsonb, v_g_sin, null, null, null, null, null);
    v_ins_z := (v_res ->> 'inscripcion')::uuid;
    if not (v_res ->> 'sin_plan')::boolean then raise exception 'FALLO N43a: %', v_res; end if;
    execute 'reset role';
    perform set_config('request.jwt.claims', json_build_object('sub', v_carla, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    insert into public.planes_de_pago (cohorte_id, monto_cuota, cuotas, primer_vencimiento) values (v_g_sin, 25000, 3, app.hoy());
    v_res := public.generar_cuotas_de_grupo(gen_random_uuid(), v_g_sin);
    if (v_res ->> 'inscripciones')::int <> 1 or (v_res ->> 'cuotas')::int <> 3 then raise exception 'FALLO N43b: %', v_res; end if;
    v_ok := v_ok + 1;
    execute 'reset role';

    -- N44 · retirar anula las cuotas que aún no vencen y no tienen cobros
    perform set_config('request.jwt.claims', json_build_object('sub', v_rosa, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    v_res := public.inscribir(gen_random_uuid(), null, '{"nombres":"Yago","apellidos":"Caja Dos"}'::jsonb, v_g, null, null, null, null, null);
    v_ins_y := (v_res ->> 'inscripcion')::uuid;
    v_res := public.cambiar_estado_de_inscripcion(gen_random_uuid(), v_ins_y, 'retirado', 'Cambio de horario');
    if (v_res ->> 'cuotas_anuladas')::int <> 1 then raise exception 'FALLO N44: %', v_res; end if;
    v_ok := v_ok + 1;
    execute 'reset role';

    -- N45 · el libro no se edita ni por el motor (fuera del modo mantenimiento)
    begin
      update public.pago_aplicaciones set monto = monto where pago_id = v_pago_efectivo;
      raise exception 'FALLO N45a: se editó una aplicación';
    exception when others then
      if sqlerrm <> 'libro_inmutable' then raise exception 'FALLO N45a: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    begin
      update public.pagos set monto = monto + 1 where id = v_pago_efectivo;
      raise exception 'FALLO N45b: se editó un cobro';
    exception when others then
      if sqlerrm <> 'libro_inmutable' then raise exception 'FALLO N45b: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;

    -- N46 · invariante: cada cobro reparte exactamente su monto
    select count(*) into v_n from public.pagos p
     where p.monto <> (select coalesce(sum(pa.monto), 0) from public.pago_aplicaciones pa where pa.pago_id = p.id);
    if v_n <> 0 then raise exception 'FALLO N46: % cobros no cuadran con sus aplicaciones', v_n; end if;
    v_ok := v_ok + 1;

    -- N47 · el estudiante no ve la caja ni cobra; anon no llega
    perform set_config('request.jwt.claims', json_build_object('sub', v_valeria, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select (select count(*) from public.cargos) + (select count(*) from public.pagos) + (select count(*) from public.v_saldos_de_alumno)
      into v_n;
    if v_n <> 0 then raise exception 'FALLO N47a: el estudiante ve % filas de caja', v_n; end if;
    begin
      perform public.caja_por_cerrar(v_la_paz);
      raise exception 'FALLO N47b: el estudiante vio la caja';
    exception when insufficient_privilege then v_ok := v_ok + 1;
    end;
    execute 'reset role';
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    execute 'set local role anon';
    begin
      perform public.registrar_cobro(gen_random_uuid(), v_la_paz, null, 'efectivo', null, null, 1, null, null);
      raise exception 'FALLO N47c: anon cobró';
    exception when insufficient_privilege then v_ok := v_ok + 1;
    end;
    execute 'reset role';
    v_ok := v_ok + 1;
  end;

  -- ============================================================ R4 · inventario (mismos números que valuacion.test.ts, §5.8)
  declare
    v_harina uuid;
    v_leche uuid;
    v_juego_s uuid;
    v_juego_m uuid;
    v_cuchillo uuid;
    v_detergente uuid;
    v_lote_a uuid;
    v_lote_b uuid;
    v_compra uuid;
    v_compra_d uuid;
    v_uso uuid;
    v_mov uuid;
    v_n integer;
    v_texto text;
    v_valores text := '';
    v_caja jsonb;
    v_antes_cant numeric;
    v_antes_valor bigint;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_carla, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';

    -- N50 · catálogo: código por tipo, nombre único, una variante en insumos, unidades
    v_res := public.guardar_articulo(gen_random_uuid(), '{"nombre":"Harina de prueba R4","tipo":"insumo","unidad":"kg","stock_minimo":"5"}'::jsonb, null);
    if v_res ->> 'codigo' !~ '^INS-[0-9]{4}$' then raise exception 'FALLO N50a: %', v_res; end if;
    select id into v_harina from public.variantes where articulo_id = (v_res ->> 'articulo')::uuid;
    v_res := public.guardar_articulo(gen_random_uuid(), '{"nombre":"Leche de prueba R4","tipo":"insumo","unidad":"l","controla_vencimiento":"true"}'::jsonb, null);
    select id into v_leche from public.variantes where articulo_id = (v_res ->> 'articulo')::uuid;
    v_res := public.guardar_articulo(gen_random_uuid(), '{"nombre":"Juego de prueba R4","tipo":"uniforme","precio_venta":"65000"}'::jsonb, array['S', 'M']);
    if v_res ->> 'codigo' !~ '^UNI-' then raise exception 'FALLO N50b: %', v_res; end if;
    select id into v_juego_s from public.variantes where articulo_id = (v_res ->> 'articulo')::uuid and etiqueta = 'S';
    select id into v_juego_m from public.variantes where articulo_id = (v_res ->> 'articulo')::uuid and etiqueta = 'M';
    v_res := public.guardar_articulo(gen_random_uuid(), '{"nombre":"Cuchillo de prueba R4","tipo":"utensilio"}'::jsonb, null);
    select id into v_cuchillo from public.variantes where articulo_id = (v_res ->> 'articulo')::uuid;
    v_res := public.guardar_articulo(gen_random_uuid(), '{"nombre":"Detergente de prueba R4","tipo":"otro","unidad":"l"}'::jsonb, null);
    select id into v_detergente from public.variantes where articulo_id = (v_res ->> 'articulo')::uuid;
    begin
      perform public.guardar_articulo(gen_random_uuid(), '{"nombre":"harina de PRUEBA r4","tipo":"insumo","unidad":"kg"}'::jsonb, null);
      raise exception 'FALLO N50c: nombre repetido aceptado';
    exception when others then
      if sqlerrm <> 'nombre_repetido' then raise exception 'FALLO N50c: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    begin
      perform public.guardar_articulo(gen_random_uuid(), '{"nombre":"Azúcar R4","tipo":"insumo","unidad":"kg"}'::jsonb, array['Blanca', 'Morena']);
      raise exception 'FALLO N50d: insumo con dos variantes';
    exception when others then
      if sqlerrm <> 'insumo_una_variante' then raise exception 'FALLO N50d: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    begin
      perform public.guardar_articulo(gen_random_uuid(), '{"nombre":"Mandil R4","tipo":"uniforme","unidad":"kg"}'::jsonb, null);
      raise exception 'FALLO N50e: uniforme en kg';
    exception when others then
      if sqlerrm <> 'unidad_no_admitida' then raise exception 'FALLO N50e: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    v_ok := v_ok + 1;

    -- N51 · PEPS de §5.3: 25 kg por Bs 170 y 25 kg por Bs 180; usos de 30, 0,333 y 19,667 kg
    perform public.registrar_compra(gen_random_uuid(), v_la_paz, null, 'Molino A', 'factura', '1', 'transferencia', 'TR-R4-1',
      jsonb_build_array(jsonb_build_object('variante', v_harina, 'cantidad', '25', 'costo_total', '17000')));
    perform public.registrar_compra(gen_random_uuid(), v_la_paz, null, 'Molino B', 'factura', '2', 'transferencia', 'TR-R4-2',
      jsonb_build_array(jsonb_build_object('variante', v_harina, 'cantidad', '25', 'costo_total', '18000')));
    v_res := public.usar_insumos(gen_random_uuid(), v_la_paz, 'clase', null, null, jsonb_build_array(jsonb_build_object('variante', v_harina, 'cantidad', '30')));
    v_valores := v_valores || (v_res ->> 'valor');
    v_res := public.usar_insumos(gen_random_uuid(), v_la_paz, 'clase', null, null, jsonb_build_array(jsonb_build_object('variante', v_harina, 'cantidad', '0.333')));
    v_valores := v_valores || '|' || (v_res ->> 'valor');
    v_res := public.usar_insumos(gen_random_uuid(), v_la_paz, 'clase', null, null, jsonb_build_array(jsonb_build_object('variante', v_harina, 'cantidad', '19.667')));
    v_valores := v_valores || '|' || (v_res ->> 'valor');
    if v_valores <> '20600|240|14160' then raise exception 'FALLO N51a: salidas %', v_valores; end if;
    select e.disponible::text || '|' || c.valor into v_texto from public.existencias e join public.existencias_costo c using (variante_id, sede_id)
     where e.variante_id = v_harina and e.sede_id = v_la_paz;
    if v_texto <> '0.000|0' then raise exception 'FALLO N51b: queda %', v_texto; end if;
    v_ok := v_ok + 1;

    -- N52 · fracciones: 3 kg por Bs 10 usados de a 1 kg → 333 + 334 + 333
    perform public.registrar_compra(gen_random_uuid(), v_la_paz, null, null, null, null, 'transferencia', 'TR-R4-3',
      jsonb_build_array(jsonb_build_object('variante', v_harina, 'cantidad', '3', 'costo_total', '1000')));
    v_valores := '';
    for v_n in 1 .. 3 loop
      v_res := public.usar_insumos(gen_random_uuid(), v_la_paz, 'practica', null, null, jsonb_build_array(jsonb_build_object('variante', v_harina, 'cantidad', '1')));
      v_valores := v_valores || (v_res ->> 'valor') || ';';
    end loop;
    if v_valores <> '333;334;333;' then raise exception 'FALLO N52: %', v_valores; end if;
    v_ok := v_ok + 1;

    -- N53 · lo vencido no se usa en clase; la baja por vencimiento saca ESE lote
    perform public.registrar_saldo_inicial(gen_random_uuid(), v_la_paz, jsonb_build_array(
      jsonb_build_object('variante', v_leche, 'cantidad', '2', 'valor', '2000', 'vence_el', app.hoy() - 1),
      jsonb_build_object('variante', v_leche, 'cantidad', '1', 'valor', '1100', 'vence_el', app.hoy() + 30)));
    select id into v_lote_a from public.lotes where variante_id = v_leche and vence_el < app.hoy();
    select id into v_lote_b from public.lotes where variante_id = v_leche and vence_el > app.hoy();
    begin
      perform public.usar_insumos(gen_random_uuid(), v_la_paz, 'clase', null, null, jsonb_build_array(jsonb_build_object('variante', v_leche, 'cantidad', '2')));
      raise exception 'FALLO N53a: usó leche vencida';
    exception when others then
      if sqlerrm <> 'stock_insuficiente' then raise exception 'FALLO N53a: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    v_res := public.usar_insumos(gen_random_uuid(), v_la_paz, 'clase', null, null, jsonb_build_array(jsonb_build_object('variante', v_leche, 'cantidad', '1')));
    select ml.lote_id into v_mov from public.movimiento_lotes ml join public.movimientos m on m.id = ml.movimiento_id
     where m.operacion_id = (v_res ->> 'operacion')::uuid;
    if v_mov <> v_lote_b or (v_res ->> 'valor')::bigint <> 1100 then raise exception 'FALLO N53b: salió del lote equivocado %', v_res; end if;
    begin
      perform public.dar_de_baja(gen_random_uuid(), v_la_paz, v_leche, '1', 'vencimiento', null, v_lote_b);
      raise exception 'FALLO N53c: dio de baja por vencimiento un lote vigente';
    exception when others then
      if sqlerrm <> 'lote_no_corresponde' and sqlerrm <> 'lote_no_vencido' then raise exception 'FALLO N53c: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    v_res := public.dar_de_baja(gen_random_uuid(), v_la_paz, v_leche, '2', 'vencimiento', null, v_lote_a);
    if (v_res ->> 'valor')::bigint <> 2000 then raise exception 'FALLO N53d: %', v_res; end if;
    v_ok := v_ok + 1;

    -- N54 · promedio (§5.4): 10 por Bs 3.000 + 10 por Bs 3.400 → cada juego M sale a Bs 320
    perform public.registrar_compra(gen_random_uuid(), v_la_paz, null, null, null, null, 'transferencia', 'TR-R4-4',
      jsonb_build_array(jsonb_build_object('variante', v_juego_m, 'cantidad', '10', 'costo_total', '300000')));
    perform public.registrar_compra(gen_random_uuid(), v_la_paz, null, null, null, null, 'transferencia', 'TR-R4-5',
      jsonb_build_array(jsonb_build_object('variante', v_juego_m, 'cantidad', '10', 'costo_total', '340000')));
    v_res := public.dar_de_baja(gen_random_uuid(), v_la_paz, v_juego_m, '1', 'dano', null, null);
    if (v_res ->> 'valor')::bigint <> 32000 then raise exception 'FALLO N54a: %', v_res; end if;
    perform public.registrar_compra(gen_random_uuid(), v_la_paz, null, null, null, null, 'transferencia', 'TR-R4-6',
      jsonb_build_array(jsonb_build_object('variante', v_juego_s, 'cantidad', '3', 'costo_total', '10000')));
    v_valores := '';
    for v_n in 1 .. 3 loop
      v_res := public.dar_de_baja(gen_random_uuid(), v_la_paz, v_juego_s, '1', 'dano', null, null);
      v_valores := v_valores || (v_res ->> 'valor') || ';';
    end loop;
    if v_valores <> '3333;3334;3333;' then raise exception 'FALLO N54b: %', v_valores; end if;
    begin
      perform public.dar_de_baja(gen_random_uuid(), v_la_paz, v_juego_m, '1.5', 'dano', null, null);
      raise exception 'FALLO N54c: medio uniforme';
    exception when others then
      if sqlerrm <> 'cantidad_no_entera' then raise exception 'FALLO N54c: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    v_ok := v_ok + 1;

    -- N55 · conteo: faltante por PEPS, sobrante al último costo, y si alguien movió el saldo se vuelve a contar
    perform public.registrar_compra(gen_random_uuid(), v_la_paz, null, null, null, null, 'transferencia', 'TR-R4-7',
      jsonb_build_array(jsonb_build_object('variante', v_harina, 'cantidad', '10', 'costo_total', '5000')));
    begin
      perform public.registrar_conteo(gen_random_uuid(), v_la_paz, jsonb_build_array(
        jsonb_build_object('variante', v_harina, 'existencia_vista', '7', 'contado', '6', 'motivo', 'Merma')));
      raise exception 'FALLO N55a: contó sobre un saldo distinto';
    exception when others then
      if sqlerrm <> 'existencia_cambio' then raise exception 'FALLO N55a: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    perform public.registrar_conteo(gen_random_uuid(), v_la_paz, jsonb_build_array(
      jsonb_build_object('variante', v_harina, 'existencia_vista', '10', 'contado', '9.5', 'motivo', 'Merma del saco')));
    select c.delta_valor into v_antes_valor from public.movimientos m join public.movimientos_costo c on c.movimiento_id = m.id
     where m.variante_id = v_harina and m.tipo = 'ajuste_faltante';
    if v_antes_valor <> -250 then raise exception 'FALLO N55b: faltante %', v_antes_valor; end if;
    perform public.registrar_conteo(gen_random_uuid(), v_la_paz, jsonb_build_array(
      jsonb_build_object('variante', v_harina, 'existencia_vista', '9.5', 'contado', '10', 'motivo', 'Apareció en el depósito')));
    select c.delta_valor into v_antes_valor from public.movimientos m join public.movimientos_costo c on c.movimiento_id = m.id
     where m.variante_id = v_harina and m.tipo = 'ajuste_sobrante';
    if v_antes_valor <> 250 then raise exception 'FALLO N55c: sobrante %', v_antes_valor; end if;
    v_ok := v_ok + 1;

    -- N56 · anular un uso devuelve EXACTAMENTE a los mismos lotes
    select sum(l.cantidad_restante), sum(lc.valor_restante) into v_antes_cant, v_antes_valor
      from public.lotes l join public.lotes_costo lc on lc.lote_id = l.id where l.variante_id = v_harina;
    v_uso := gen_random_uuid();
    perform public.usar_insumos(v_uso, v_la_paz, 'clase', null, null, jsonb_build_array(jsonb_build_object('variante', v_harina, 'cantidad', '9.75')));
    perform public.anular(gen_random_uuid(), 'uso', v_uso, 'Se registró en el grupo equivocado');
    select (sum(l.cantidad_restante) = v_antes_cant and sum(lc.valor_restante) = v_antes_valor)::text into v_texto
      from public.lotes l join public.lotes_costo lc on lc.lote_id = l.id where l.variante_id = v_harina;
    if v_texto <> 'true' then raise exception 'FALLO N56a: la anulación no devolvió lo mismo'; end if;
    begin
      perform public.anular(gen_random_uuid(), 'uso', v_uso, 'Otra vez');
      raise exception 'FALLO N56b: anuló dos veces';
    exception when others then
      if sqlerrm <> 'ya_anulado' then raise exception 'FALLO N56b: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    v_ok := v_ok + 1;

    -- N57 · compra en efectivo: sale de la caja; anulada, vuelve; con movimientos posteriores no se anula
    v_res := public.registrar_compra(gen_random_uuid(), v_la_paz, null, 'Limpieza SRL', 'recibo', '9', 'efectivo', null,
      jsonb_build_array(jsonb_build_object('variante', v_detergente, 'cantidad', '5', 'costo_total', '2500')));
    v_compra := (v_res ->> 'compra')::uuid;
    v_caja := public.caja_por_cerrar(v_la_paz);
    v_antes_valor := (v_caja ->> 'salidas_efectivo')::bigint;
    perform public.anular(gen_random_uuid(), 'compra', v_compra, 'Se registró dos veces');
    v_caja := public.caja_por_cerrar(v_la_paz);
    if (v_caja ->> 'salidas_efectivo')::bigint <> v_antes_valor or (v_caja ->> 'entradas_efectivo')::bigint < 2500 then
      raise exception 'FALLO N57a: la compra anulada no volvió a la caja %', v_caja;
    end if;
    v_res := public.registrar_compra(gen_random_uuid(), v_la_paz, null, null, null, null, 'transferencia', 'TR-R4-8',
      jsonb_build_array(jsonb_build_object('variante', v_detergente, 'cantidad', '4', 'costo_total', '2000')));
    v_compra_d := (v_res ->> 'compra')::uuid;
    perform public.usar_insumos(gen_random_uuid(), v_la_paz, 'uso_interno', null, null, jsonb_build_array(jsonb_build_object('variante', v_detergente, 'cantidad', '1')));
    begin
      perform public.anular(gen_random_uuid(), 'compra', v_compra_d, 'Prueba');
      raise exception 'FALLO N57b: anuló una compra ya usada';
    exception when others then
      if sqlerrm <> 'compra_con_movimientos_posteriores' then raise exception 'FALLO N57b: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    v_ok := v_ok + 1;
    execute 'reset role';

    -- N58 · recepción: usa en su sede, no compra, no ve costos, no anula, no usa uniformes en clase
    perform set_config('request.jwt.claims', json_build_object('sub', v_rosa, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    v_res := public.usar_insumos(gen_random_uuid(), v_la_paz, 'clase', null, null, jsonb_build_array(jsonb_build_object('variante', v_harina, 'cantidad', '0.5')));
    if v_res ->> 'valor' is not null then raise exception 'FALLO N58a: recepción recibió el costo %', v_res; end if;
    v_ok := v_ok + 1;
    begin
      perform public.registrar_compra(gen_random_uuid(), v_la_paz, null, null, null, null, 'efectivo', null,
        jsonb_build_array(jsonb_build_object('variante', v_harina, 'cantidad', '1', 'costo_total', '100')));
      raise exception 'FALLO N58b: recepción compró';
    exception when insufficient_privilege then v_ok := v_ok + 1;
    end;
    begin
      perform public.usar_insumos(gen_random_uuid(), v_el_alto, 'clase', null, null, jsonb_build_array(jsonb_build_object('variante', v_harina, 'cantidad', '0.1')));
      raise exception 'FALLO N58c: recepción usó en otra sede';
    exception when others then
      if sqlerrm <> 'sede_no_operable' then raise exception 'FALLO N58c: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    begin
      perform public.usar_insumos(gen_random_uuid(), v_la_paz, 'clase', null, null, jsonb_build_array(jsonb_build_object('variante', v_juego_m, 'cantidad', '1')));
      raise exception 'FALLO N58d: usó un uniforme en clase';
    exception when others then
      if sqlerrm <> 'uso_no_admitido' then raise exception 'FALLO N58d: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    select (select count(*) from public.existencias_costo) + (select count(*) from public.lotes_costo) + (select count(*) from public.compras)
         + (select count(*) from public.v_existencias_valorizadas) + (select count(*) from public.movimiento_lotes)
      into v_n;
    if v_n <> 0 then raise exception 'FALLO N58e: recepción ve % filas con costo', v_n; end if;
    select count(*) into v_n from public.v_existencias where variante_id = v_harina;
    if v_n < 2 then raise exception 'FALLO N58f: recepción no ve las existencias de las dos sedes'; end if;
    begin
      perform public.anular(gen_random_uuid(), 'uso', v_uso, 'Prueba');
      raise exception 'FALLO N58g: recepción anuló un uso';
    exception when insufficient_privilege then v_ok := v_ok + 1;
    end;
    v_ok := v_ok + 1;
    execute 'reset role';

    -- N59 · el libro no se edita (fuera del modo mantenimiento)
    select id into v_mov from public.movimientos where variante_id = v_harina order by numero limit 1;
    begin
      update public.movimientos set detalle = 'x' where id = v_mov;
      raise exception 'FALLO N59a: se editó el libro';
    exception when others then
      if sqlerrm <> 'libro_inmutable' then raise exception 'FALLO N59a: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    begin
      update public.lotes set cantidad_inicial = cantidad_inicial + 1 where variante_id = v_harina;
      raise exception 'FALLO N59b: se cambió lo que entró en un lote';
    exception when others then
      if sqlerrm <> 'libro_inmutable' then raise exception 'FALLO N59b: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;

    -- N60 · cuadre: lotes = saldo (PEPS); sin existencia no hay valor; compras = suma de sus líneas
    select count(*) into v_n from (
      select e.disponible, e.total, c.valor, a.valuacion,
             (select coalesce(sum(l.cantidad_restante), 0) from public.lotes l where l.variante_id = e.variante_id and l.sede_id = e.sede_id) as cantidad_lotes,
             (select coalesce(sum(lc.valor_restante), 0) from public.lotes l join public.lotes_costo lc on lc.lote_id = l.id
               where l.variante_id = e.variante_id and l.sede_id = e.sede_id) as valor_lotes
        from public.existencias e
        join public.existencias_costo c on c.variante_id = e.variante_id and c.sede_id = e.sede_id
        join public.variantes v on v.id = e.variante_id
        join public.articulos a on a.id = v.articulo_id
    ) x
    where (x.valuacion = 'peps' and (x.cantidad_lotes <> x.disponible or x.valor_lotes <> x.valor)) or (x.total = 0 and x.valor <> 0);
    if v_n <> 0 then raise exception 'FALLO N60a: % saldos no cuadran con sus lotes', v_n; end if;
    select count(*) into v_n from public.compras c
     where c.total <> (select coalesce(sum(mc.delta_valor), 0) from public.movimientos m join public.movimientos_costo mc on mc.movimiento_id = m.id
                        where m.compra_id = c.id and m.tipo = 'compra');
    if v_n <> 0 then raise exception 'FALLO N60b: % compras no suman sus líneas', v_n; end if;
    select count(*) into v_n from public.movimientos m
      join public.movimientos_costo mc on mc.movimiento_id = m.id
      join public.movimientos o on o.id = m.anula_a
      join public.movimientos_costo oc on oc.movimiento_id = o.id
     where m.tipo = 'anulacion' and mc.delta_valor <> -oc.delta_valor;
    if v_n <> 0 then raise exception 'FALLO N60c: % anulaciones no deshacen el valor exacto', v_n; end if;
    v_ok := v_ok + 1;

    -- N61 · el estudiante no ve el inventario
    perform set_config('request.jwt.claims', json_build_object('sub', v_valeria, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select (select count(*) from public.articulos) + (select count(*) from public.existencias) + (select count(*) from public.v_kardex) into v_n;
    if v_n <> 0 then raise exception 'FALLO N61: el estudiante ve % filas de inventario', v_n; end if;
    v_ok := v_ok + 1;
    execute 'reset role';
  end;

  raise exception 'OK · % pruebas superadas (todo revertido)', v_ok;
end;
$$;
