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

  raise exception 'OK · % pruebas superadas (todo revertido)', v_ok;
end;
$$;
