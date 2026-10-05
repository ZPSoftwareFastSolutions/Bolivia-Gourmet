-- ============================================================================
-- Batería del panel interno v1 (crece con cada rebanada)
-- ----------------------------------------------------------------------------
-- Cómo se ejecuta: en el editor SQL de Supabase (o con `execute_sql`). Corre
-- como `postgres`, simula sesiones con `set local role` + `request.jwt.claims`
-- y TERMINA LANZANDO UNA EXCEPCIÓN a propósito, para que la transacción se
-- revierta entera: no deja ninguna fila de prueba.
--
-- Requiere las cuentas de demostración (supabase/seed/datos-demo.sql):
-- Carla (administración), Rosa (recepción, La Paz), Valeria, Diego y Camila
-- (estudiantes). Si Valeria y Diego ya no tienen su solicitud pendiente de la
-- demo, o Diego tiene ficha (`convocatorias-demo.sql`), la batería prepara
-- lo que necesita dentro de la transacción.
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

    -- N25 y N26 usan una solicitud pendiente de Valeria (inscripción a la
    -- carrera) y la renovación pendiente de Diego. Si en la demo ya no están
    -- (se cancelaron o se atendieron), se crean como las de antes de las
    -- convocatorias: en modo mantenimiento, sin grupo. Y Diego entra «sin
    -- historia»: si `convocatorias-demo.sql` le enlazó una ficha, se suelta.
    declare
      v_diego_id uuid;
    begin
      select id into v_diego_id from auth.users where email = 'diego.mamani@boliviagourmet.test';
      perform set_config('app.mantenimiento', 'si', true);
      if not exists (select 1 from public.solicitudes where estudiante_id = v_valeria and estado = 'pendiente'
                      and tipo = 'inscripcion' and programa_codigo = 'gastronomia') then
        perform set_config('request.jwt.claims', json_build_object('sub', v_valeria, 'role', 'authenticated')::text, true);
        execute 'set local role authenticated';
        insert into public.solicitudes (tipo, programa_codigo, sede_id, turno, dias, duracion, paquete)
        values ('inscripcion', 'gastronomia', v_la_paz, 'tarde', 'lun-vie', 3, 'economico');
        execute 'reset role';
      end if;
      if not exists (select 1 from public.solicitudes where estudiante_id = v_diego_id and estado = 'pendiente' and tipo = 'renovacion') then
        perform set_config('request.jwt.claims', json_build_object('sub', v_diego_id, 'role', 'authenticated')::text, true);
        execute 'set local role authenticated';
        insert into public.solicitudes (tipo, programa_codigo, sede_id, turno, dias, duracion, gestion_anterior)
        values ('renovacion', 'gastronomia', v_la_paz, 'noche', 'lun-vie', 3, 'Gestión 2026 · 1.er año');
        execute 'reset role';
      end if;
      perform set_config('app.mantenimiento', 'no', true);
      update public.estudiantes set perfil_id = null where perfil_id = v_diego_id;
    end;

    -- N25 · aprobar e inscribir una solicitud del portal (Valeria): ficha nueva enlazada a su cuenta
    select id into v_sol_valeria from public.solicitudes where estudiante_id = v_valeria and estado = 'pendiente'
       and tipo = 'inscripcion' and programa_codigo = 'gastronomia' order by created_at limit 1;
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
    v_caja0 jsonb;
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

    -- Lo que ya había por arquear (datos de demostración): N38 mide la diferencia.
    v_caja0 := public.caja_por_cerrar(v_la_paz);

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
    if (v_caja ->> 'entradas_efectivo')::bigint - (v_caja0 ->> 'entradas_efectivo')::bigint <> 45000
       or (v_caja ->> 'cobros_qr')::bigint - (v_caja0 ->> 'cobros_qr')::bigint <> 20000
       or (v_caja ->> 'esperado')::bigint - (v_caja0 ->> 'esperado')::bigint <> 45000 then
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

  -- ============================================================ R5 · uniformes y utensilios (números de valuacion.test.ts)
  declare
    v_g uuid;
    v_alumno uuid;
    v_ins uuid;
    v_ins_ret uuid;
    v_juego uuid;
    v_m uuid;
    v_s uuid;
    v_l uuid;
    v_mandil uuid;
    v_cuchillo uuid;
    v_harina uuid;
    v_entrega_m uuid;
    v_entrega_l uuid;
    v_prestamo uuid;
    v_clave uuid := gen_random_uuid();
    v_caja_antes bigint;
    v_n integer;
    v_texto text;
    v_valores text := '';
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_carla, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    v_res := public.guardar_articulo(gen_random_uuid(), '{"nombre":"Juego R5","tipo":"uniforme","precio_venta":"65000"}'::jsonb, array['S', 'M', 'L']);
    v_juego := (v_res ->> 'articulo')::uuid;
    select id into v_s from public.variantes where articulo_id = v_juego and etiqueta = 'S';
    select id into v_m from public.variantes where articulo_id = v_juego and etiqueta = 'M';
    select id into v_l from public.variantes where articulo_id = v_juego and etiqueta = 'L';
    v_res := public.guardar_articulo(gen_random_uuid(), '{"nombre":"Mandil R5","tipo":"uniforme"}'::jsonb, null);
    select id into v_mandil from public.variantes where articulo_id = (v_res ->> 'articulo')::uuid;
    v_res := public.guardar_articulo(gen_random_uuid(), '{"nombre":"Cuchillo R5","tipo":"utensilio"}'::jsonb, null);
    select id into v_cuchillo from public.variantes where articulo_id = (v_res ->> 'articulo')::uuid;
    v_res := public.guardar_articulo(gen_random_uuid(), '{"nombre":"Harina R5","tipo":"insumo","unidad":"kg"}'::jsonb, null);
    select id into v_harina from public.variantes where articulo_id = (v_res ->> 'articulo')::uuid;
    perform public.registrar_compra(gen_random_uuid(), v_la_paz, null, null, null, null, 'transferencia', 'TR-R5-1', jsonb_build_array(
      jsonb_build_object('variante', v_m, 'cantidad', '10', 'costo_total', '300000'),
      jsonb_build_object('variante', v_s, 'cantidad', '3', 'costo_total', '10000'),
      jsonb_build_object('variante', v_l, 'cantidad', '3', 'costo_total', '10000'),
      jsonb_build_object('variante', v_mandil, 'cantidad', '2', 'costo_total', '4000'),
      jsonb_build_object('variante', v_cuchillo, 'cantidad', '10', 'costo_total', '45000'),
      jsonb_build_object('variante', v_harina, 'cantidad', '5', 'costo_total', '3000')));
    perform public.registrar_compra(gen_random_uuid(), v_la_paz, null, null, null, null, 'transferencia', 'TR-R5-2', jsonb_build_array(
      jsonb_build_object('variante', v_m, 'cantidad', '10', 'costo_total', '340000')));
    insert into public.cohortes (programa_codigo, sede_id, gestion, anio_de_carrera, turno, dias, duracion, fecha_inicio, estado)
    values ('gastronomia', v_la_paz, 2026, 1, 'tarde', 'lun-vie', 3, app.hoy() - 5, 'en_curso') returning id into v_g;
    v_res := public.inscribir(gen_random_uuid(), null, '{"nombres":"Uma","apellidos":"Uniforme Uno"}'::jsonb, v_g, 'economico', null, null, null, null);
    v_alumno := (v_res ->> 'estudiante')::uuid;
    v_ins := (v_res ->> 'inscripcion')::uuid;
    v_res := public.inscribir(gen_random_uuid(), null, '{"nombres":"Rita","apellidos":"Retirada Dos"}'::jsonb, v_g, 'economico', null, null, null, null);
    v_ins_ret := (v_res ->> 'inscripcion')::uuid;
    perform public.cambiar_estado_de_inscripcion(gen_random_uuid(), v_ins_ret, 'retirado', 'Se mudó de ciudad');

    -- N62 · el alumno de carrera sin uniforme aparece en la lista
    select count(*) into v_n from public.v_sin_uniforme where estudiante_id = v_alumno;
    if v_n <> 1 then raise exception 'FALLO N62: no aparece sin uniforme (%)', v_n; end if;
    v_ok := v_ok + 1;

    -- N63 · entrega con cargo y cobro en efectivo: costo promedio, cargo, recibo y caja
    v_caja_antes := (public.caja_por_cerrar(v_la_paz) ->> 'entradas_efectivo')::bigint;
    v_res := public.entregar_uniforme(v_clave, v_ins, v_la_paz, 'inscripcion', null,
      jsonb_build_array(jsonb_build_object('variante', v_m, 'cantidad', '1')), true, '{"medio":"efectivo"}'::jsonb);
    if (v_res ->> 'cargado')::bigint <> 65000 or v_res ->> 'recibo' !~ '^LP-' then raise exception 'FALLO N63a: %', v_res; end if;
    select en.id into v_entrega_m from public.entregas en where en.inscripcion_id = v_ins and en.variante_id = v_m;
    select -c.delta_valor into v_n from public.movimientos m join public.movimientos_costo c on c.movimiento_id = m.id
     where m.entrega_id = v_entrega_m and m.tipo = 'entrega';
    if v_n <> 32000 then raise exception 'FALLO N63b: salió a %', v_n; end if;
    select count(*) into v_n from public.cargos c join public.v_saldos_de_cargo x on x.id = c.id
     where c.entrega_id = v_entrega_m and c.monto = 65000 and c.origen = 'entrega' and x.pendiente = 0;
    if v_n <> 1 then raise exception 'FALLO N63c: el cargo no quedó pagado'; end if;
    if (public.caja_por_cerrar(v_la_paz) ->> 'entradas_efectivo')::bigint <> v_caja_antes + 65000 then
      raise exception 'FALLO N63d: el cobro no entró en la caja';
    end if;
    select count(*) into v_n from public.v_sin_uniforme where estudiante_id = v_alumno;
    if v_n <> 0 then raise exception 'FALLO N63e: sigue sin uniforme'; end if;
    v_res := public.entregar_uniforme(v_clave, v_ins, v_la_paz, 'inscripcion', null,
      jsonb_build_array(jsonb_build_object('variante', v_m, 'cantidad', '1')), true, '{"medio":"efectivo"}'::jsonb);
    select count(*) into v_n from public.entregas where inscripcion_id = v_ins;
    if not (v_res ->> 'repetida')::boolean or v_n <> 1 then raise exception 'FALLO N63f: el reenvío entregó otra vez'; end if;
    v_ok := v_ok + 1;

    -- N64 · lo que no se entrega
    begin
      perform public.entregar_uniforme(gen_random_uuid(), v_ins, v_la_paz, null, null, jsonb_build_array(jsonb_build_object('variante', v_harina)), false, null);
      raise exception 'FALLO N64a: entregó harina';
    exception when others then
      if sqlerrm <> 'entrega_no_admitida' then raise exception 'FALLO N64a: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    begin
      perform public.entregar_uniforme(gen_random_uuid(), v_ins, v_la_paz, null, null, jsonb_build_array(jsonb_build_object('variante', v_mandil)), true, null);
      raise exception 'FALLO N64b: cargó un uniforme sin precio';
    exception when others then
      if sqlerrm <> 'precio_no_definido' then raise exception 'FALLO N64b: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    begin
      perform public.entregar_uniforme(gen_random_uuid(), v_ins_ret, v_la_paz, null, null, jsonb_build_array(jsonb_build_object('variante', v_s)), false, null);
      raise exception 'FALLO N64c: entregó a un retirado';
    exception when others then
      if sqlerrm <> 'inscripcion_no_vigente' then raise exception 'FALLO N64c: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;

    -- N65 · cambio de talla: vuelve al costo con que salió y la nueva entrega va sin cargo
    begin
      perform public.devolver_uniforme(gen_random_uuid(), v_entrega_m, '1', 'Le queda grande', v_m);
      raise exception 'FALLO N65a: cambió a la misma talla';
    exception when others then
      if sqlerrm <> 'talla_igual' then raise exception 'FALLO N65a: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    begin
      perform public.devolver_uniforme(gen_random_uuid(), v_entrega_m, '1', 'Le queda grande', v_cuchillo);
      raise exception 'FALLO N65b: cambió por otra pieza';
    exception when others then
      if sqlerrm <> 'pieza_distinta' then raise exception 'FALLO N65b: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    perform public.devolver_uniforme(gen_random_uuid(), v_entrega_m, '1', 'Le queda grande', v_s);
    select c.delta_valor into v_n from public.movimientos m join public.movimientos_costo c on c.movimiento_id = m.id
     where m.entrega_id = v_entrega_m and m.tipo = 'devolucion_entrega';
    if v_n <> 32000 then raise exception 'FALLO N65c: volvió a %', v_n; end if;
    select count(*) into v_n from public.cargos where estudiante_id = v_alumno and anulado_en is null;
    if v_n <> 1 then raise exception 'FALLO N65d: el cambio cobró otra vez (% cargos)', v_n; end if;
    select count(*) into v_n from public.v_entregas where estudiante_id = v_alumno and contexto = 'cambio_de_talla' and etiqueta = 'S' and en_poder = 1;
    if v_n <> 1 then raise exception 'FALLO N65e: no está la entrega por cambio de talla'; end if;
    v_ok := v_ok + 1;

    -- N66 · devolución en partes: 3333, 3333 y la última se lleva el resto (3334)
    perform public.entregar_uniforme(gen_random_uuid(), v_ins, v_la_paz, 'reposicion', null,
      jsonb_build_array(jsonb_build_object('variante', v_l, 'cantidad', '3')), false, null);
    select en.id into v_entrega_l from public.entregas en where en.inscripcion_id = v_ins and en.variante_id = v_l;
    for v_n in 1 .. 3 loop
      perform public.devolver_uniforme(gen_random_uuid(), v_entrega_l, '1', 'Devuelve una pieza', null);
    end loop;
    select string_agg(c.delta_valor::text, ';' order by m.numero) into v_valores
      from public.movimientos m join public.movimientos_costo c on c.movimiento_id = m.id
     where m.entrega_id = v_entrega_l and m.tipo = 'devolucion_entrega';
    if v_valores <> '3333;3333;3334' then raise exception 'FALLO N66: %', v_valores; end if;
    v_ok := v_ok + 1;

    -- N67 · no se devuelve más de lo entregado
    begin
      perform public.devolver_uniforme(gen_random_uuid(), v_entrega_l, '1', 'Otra más', null);
      raise exception 'FALLO N67: devolvió de más';
    exception when others then
      if sqlerrm <> 'devolucion_excede' then raise exception 'FALLO N67: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;

    -- N68 · préstamo: custodia, el valor no cambia; destinatario y fecha
    begin
      perform public.prestar_utensilios(gen_random_uuid(), v_la_paz, v_alumno, null, 'Chef', app.hoy(), jsonb_build_array(jsonb_build_object('variante', v_cuchillo, 'cantidad', '1')));
      raise exception 'FALLO N68a: prestó a dos a la vez';
    exception when others then
      if sqlerrm <> 'destinatario_requerido' then raise exception 'FALLO N68a: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    begin
      perform public.prestar_utensilios(gen_random_uuid(), v_la_paz, null, null, 'Chef', app.hoy() - 1, jsonb_build_array(jsonb_build_object('variante', v_cuchillo, 'cantidad', '1')));
      raise exception 'FALLO N68b: devolver en el pasado';
    exception when others then
      if sqlerrm <> 'fecha_de_devolucion_invalida' then raise exception 'FALLO N68b: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    begin
      perform public.prestar_utensilios(gen_random_uuid(), v_la_paz, null, null, 'Chef', app.hoy(), jsonb_build_array(jsonb_build_object('variante', v_m, 'cantidad', '1')));
      raise exception 'FALLO N68c: prestó un uniforme';
    exception when others then
      if sqlerrm <> 'prestamo_no_admitido' then raise exception 'FALLO N68c: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    v_clave := gen_random_uuid();
    perform public.prestar_utensilios(v_clave, v_la_paz, null, null, '  Chef   Invitado ', app.hoy(), jsonb_build_array(jsonb_build_object('variante', v_cuchillo, 'cantidad', '2')));
    select e.disponible::text || '|' || e.prestado::text || '|' || c.valor into v_texto
      from public.existencias e join public.existencias_costo c using (variante_id, sede_id) where e.variante_id = v_cuchillo and e.sede_id = v_la_paz;
    if v_texto <> '8.000|2.000|45000' then raise exception 'FALLO N68d: %', v_texto; end if;
    select count(*) into v_n from public.v_kardex_valorizado where operacion_id = v_clave and delta_valor = 0;
    if v_n <> 1 then raise exception 'FALLO N68e: el préstamo no figura en el kárdex valorizado'; end if;
    select id into v_prestamo from public.v_prestamos_abiertos where operacion_id = v_clave and persona = 'Chef Invitado' and pendiente = 2;
    if v_prestamo is null then raise exception 'FALLO N68f: el préstamo no está abierto'; end if;
    v_ok := v_ok + 1;

    -- N69 · recibir: uno vuelve y uno se pierde (baja desde prestado a 4500)
    begin
      perform public.recibir_devolucion(gen_random_uuid(), jsonb_build_array(jsonb_build_object('prestamo', v_prestamo, 'devueltos', '1', 'perdidos', '1')));
      raise exception 'FALLO N69a: pérdida sin motivo';
    exception when others then
      if sqlerrm <> 'motivo_requerido' then raise exception 'FALLO N69a: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    perform public.recibir_devolucion(gen_random_uuid(), jsonb_build_array(
      jsonb_build_object('prestamo', v_prestamo, 'devueltos', '1', 'perdidos', '1', 'motivo', 'No apareció al cerrar la clase')));
    select e.disponible::text || '|' || e.prestado::text || '|' || c.valor into v_texto
      from public.existencias e join public.existencias_costo c using (variante_id, sede_id) where e.variante_id = v_cuchillo and e.sede_id = v_la_paz;
    if v_texto <> '9.000|0.000|40500' then raise exception 'FALLO N69b: %', v_texto; end if;
    select (cerrado_en is not null)::text into v_texto from public.prestamos where id = v_prestamo;
    if v_texto <> 'true' then raise exception 'FALLO N69c: el préstamo no se cerró'; end if;
    begin
      perform public.recibir_devolucion(gen_random_uuid(), jsonb_build_array(jsonb_build_object('prestamo', v_prestamo, 'devueltos', '1')));
      raise exception 'FALLO N69d: recibió de un préstamo cerrado';
    exception when others then
      if sqlerrm <> 'prestamo_cerrado' then raise exception 'FALLO N69d: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;

    -- N70 · la pérdida de un préstamo no se anula como una baja
    begin
      perform public.anular(gen_random_uuid(), 'baja',
        (select m.id from public.movimientos m where m.prestamo_id = v_prestamo and m.tipo = 'baja'), 'Prueba');
      raise exception 'FALLO N70: anuló la pérdida de un préstamo';
    exception when others then
      if sqlerrm <> 'baja_de_prestamo' then raise exception 'FALLO N70: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    execute 'reset role';

    -- N71 · recepción en otra sede; el estudiante no ve entregas ni préstamos
    perform set_config('request.jwt.claims', json_build_object('sub', v_rosa, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    begin
      perform public.prestar_utensilios(gen_random_uuid(), v_el_alto, null, null, 'Chef', app.hoy(), jsonb_build_array(jsonb_build_object('variante', v_cuchillo, 'cantidad', '1')));
      raise exception 'FALLO N71a: recepción prestó en otra sede';
    exception when others then
      if sqlerrm <> 'sede_no_operable' then raise exception 'FALLO N71a: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    execute 'reset role';
    perform set_config('request.jwt.claims', json_build_object('sub', v_valeria, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select (select count(*) from public.v_entregas) + (select count(*) from public.v_prestamos_abiertos) + (select count(*) from public.v_sin_uniforme) into v_n;
    if v_n <> 0 then raise exception 'FALLO N71b: el estudiante ve % filas', v_n; end if;
    v_ok := v_ok + 1;
    execute 'reset role';

    -- N72 · invariantes: todo movimiento con su costo; saldo en cero = valor en cero
    select count(*) into v_n from public.movimientos m where not exists (select 1 from public.movimientos_costo c where c.movimiento_id = m.id);
    if v_n <> 0 then raise exception 'FALLO N72a: % movimientos sin costo', v_n; end if;
    select count(*) into v_n from public.existencias e join public.existencias_costo c using (variante_id, sede_id) where e.total = 0 and c.valor <> 0;
    if v_n <> 0 then raise exception 'FALLO N72b: % saldos en cero con valor', v_n; end if;
    v_ok := v_ok + 1;
  end;

  -- ============================================================ R6 · contabilidad (seguimiento de §5.7, por diferencias)
  declare
    v_r0 jsonb;
    v_r1 jsonb;
    v_r2 jsonb;
    v_caja jsonb;
    v_harina uuid;
    v_juego uuid;
    v_tabla uuid;
    v_g uuid;
    v_ins uuid;
    v_pago uuid;
    v_gasto uuid;
    v_luz uuid;
    v_n integer;
    v_texto text;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_carla, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select id into v_luz from public.conceptos where codigo = 'servicios-basicos';
    v_r0 := public.resumen_del_mes(app.hoy(), v_la_paz);

    v_res := public.guardar_articulo(gen_random_uuid(), '{"nombre":"Harina R6","tipo":"insumo","unidad":"kg"}'::jsonb, null);
    select id into v_harina from public.variantes where articulo_id = (v_res ->> 'articulo')::uuid;
    v_res := public.guardar_articulo(gen_random_uuid(), '{"nombre":"Juego R6","tipo":"uniforme","precio_venta":"65000"}'::jsonb, array['M']);
    select id into v_juego from public.variantes where articulo_id = (v_res ->> 'articulo')::uuid;
    v_res := public.guardar_articulo(gen_random_uuid(), '{"nombre":"Tabla R6","tipo":"utensilio"}'::jsonb, null);
    select id into v_tabla from public.variantes where articulo_id = (v_res ->> 'articulo')::uuid;

    -- Compra de harina al contado; juego y tabla por transferencia.
    perform public.registrar_compra(gen_random_uuid(), v_la_paz, null, null, null, null, 'efectivo', null,
      jsonb_build_array(jsonb_build_object('variante', v_harina, 'cantidad', '50', 'costo_total', '35000')));
    perform public.registrar_compra(gen_random_uuid(), v_la_paz, null, null, null, null, 'transferencia', 'TR-R6-1', jsonb_build_array(
      jsonb_build_object('variante', v_juego, 'cantidad', '1', 'costo_total', '32000'),
      jsonb_build_object('variante', v_tabla, 'cantidad', '1', 'costo_total', '4500')));
    -- Uso de 30 kg (30/50 de 35000 = 21000).
    perform public.usar_insumos(gen_random_uuid(), v_la_paz, 'practica', null, null, jsonb_build_array(jsonb_build_object('variante', v_harina, 'cantidad', '30')));
    -- Cuota de un plan de 1 cuota que vence hoy.
    insert into public.cohortes (programa_codigo, sede_id, gestion, dias, duracion, fecha_inicio, estado)
    values ('cocina', v_la_paz, extract(year from app.hoy())::smallint, 'sab', 1, app.hoy(), 'en_curso') returning id into v_g;
    insert into public.planes_de_pago (cohorte_id, monto_cuota, cuotas, primer_vencimiento) values (v_g, 65000, 1, app.hoy());
    v_res := public.inscribir(gen_random_uuid(), null, '{"nombres":"Ceci","apellidos":"Contable Uno"}'::jsonb, v_g, null, null, null, null, null);
    v_ins := (v_res ->> 'inscripcion')::uuid;
    -- Entrega del juego con cargo (costo 32000) y cobro en efectivo.
    insert into public.cohortes (programa_codigo, sede_id, gestion, anio_de_carrera, turno, dias, duracion, fecha_inicio, estado)
    values ('gastronomia', v_la_paz, extract(year from app.hoy())::smallint, 1, 'manana', 'lun-vie', 3, app.hoy(), 'en_curso') returning id into v_g;
    v_res := public.inscribir(gen_random_uuid(), null, '{"nombres":"Dino","apellidos":"Contable Dos"}'::jsonb, v_g, 'economico', null, null, null, null);
    v_res := public.entregar_uniforme(gen_random_uuid(), (v_res ->> 'inscripcion')::uuid, v_la_paz, 'inscripcion', null,
      jsonb_build_array(jsonb_build_object('variante', v_juego)), true, '{"medio":"efectivo"}'::jsonb);
    v_pago := (v_res ->> 'pago')::uuid;
    -- Luz en efectivo y baja de la tabla rota.
    v_res := public.registrar_gasto(gen_random_uuid(), v_la_paz, null, v_luz, 'Luz R6', 18000, 'efectivo', null, 'sin_comprobante', null, null);
    select id into v_gasto from public.gastos where descripcion = 'Luz R6';
    perform public.dar_de_baja(gen_random_uuid(), v_la_paz, v_tabla, '1', 'rotura', 'Se partió en la clase', null);
    -- Arqueo con un faltante de Bs 5.
    v_caja := public.caja_por_cerrar(v_la_paz);
    perform public.cerrar_caja(gen_random_uuid(), v_la_paz, (v_caja ->> 'esperado')::bigint - 500, 0, 'Faltó cambio R6',
      case when (v_caja ->> 'primer_arqueo')::boolean then 0 end);

    v_r1 := public.resumen_del_mes(app.hoy(), v_la_paz);

    -- N73 · ingresos, costo de lo usado, gastos y diferencias de caja del mes
    if (v_r1 -> 'ingresos' ->> 'total')::bigint - (v_r0 -> 'ingresos' ->> 'total')::bigint <> 130000 then
      raise exception 'FALLO N73a: ingresos %', (v_r1 -> 'ingresos' ->> 'total')::bigint - (v_r0 -> 'ingresos' ->> 'total')::bigint;
    end if;
    if (v_r1 -> 'costo' ->> 'total')::bigint - (v_r0 -> 'costo' ->> 'total')::bigint <> 57500 then
      raise exception 'FALLO N73b: costo %', (v_r1 -> 'costo' ->> 'total')::bigint - (v_r0 -> 'costo' ->> 'total')::bigint;
    end if;
    if (v_r1 -> 'gastos' ->> 'total')::bigint - (v_r0 -> 'gastos' ->> 'total')::bigint <> 18000 then
      raise exception 'FALLO N73c: gastos';
    end if;
    if (v_r1 -> 'arqueos' ->> -1)::bigint <> -500 or jsonb_array_length(v_r1 -> 'arqueos') <> jsonb_array_length(v_r0 -> 'arqueos') + 1 then
      raise exception 'FALLO N73d: arqueos %', v_r1 -> 'arqueos';
    end if;
    v_ok := v_ok + 1;

    -- N74 · dinero del mes por medio: la compra es dinero, nunca gasto
    if coalesce((v_r1 -> 'dinero' -> 'efectivo' ->> 'compras')::bigint, 0) - coalesce((v_r0 -> 'dinero' -> 'efectivo' ->> 'compras')::bigint, 0) <> 35000
       or coalesce((v_r1 -> 'dinero' -> 'efectivo' ->> 'gastos')::bigint, 0) - coalesce((v_r0 -> 'dinero' -> 'efectivo' ->> 'gastos')::bigint, 0) <> 18000
       or coalesce((v_r1 -> 'dinero' -> 'efectivo' ->> 'cobros')::bigint, 0) - coalesce((v_r0 -> 'dinero' -> 'efectivo' ->> 'cobros')::bigint, 0) <> 65000
       or coalesce((v_r1 -> 'dinero' -> 'transferencia' ->> 'compras')::bigint, 0) - coalesce((v_r0 -> 'dinero' -> 'transferencia' ->> 'compras')::bigint, 0) <> 36500 then
      raise exception 'FALLO N74: dinero %', v_r1 -> 'dinero';
    end if;
    v_ok := v_ok + 1;

    -- N75 · cuadre del inventario del mes y valor de hoy
    if (v_r1 -> 'inventario' ->> 'valor_inicial')::bigint + (v_r1 -> 'costo' ->> 'compras')::bigint - (v_r1 -> 'costo' ->> 'compras_anuladas')::bigint
       + (v_r1 -> 'costo' ->> 'saldos_iniciales')::bigint - (v_r1 -> 'costo' ->> 'saldos_iniciales_anulados')::bigint - (v_r1 -> 'costo' ->> 'total')::bigint
       <> (v_r1 -> 'inventario' ->> 'valor_final')::bigint then
      raise exception 'FALLO N75a: el inventario del mes no cuadra %', v_r1;
    end if;
    if (v_r1 -> 'hoy' ->> 'valor_inventario')::bigint - (v_r0 -> 'hoy' ->> 'valor_inventario')::bigint <> 71500 - 57500 then
      raise exception 'FALLO N75b: valor del inventario';
    end if;
    if (v_r1 -> 'hoy' ->> 'deben')::bigint - (v_r0 -> 'hoy' ->> 'deben')::bigint <> 65000 then
      raise exception 'FALLO N75c: lo que deben';
    end if;
    v_res := public.verificar_cuadre(v_la_paz);
    if not (v_res ->> 'cuadra')::boolean then raise exception 'FALLO N75d: verificar_cuadre %', v_res; end if;
    v_ok := v_ok + 1;

    -- N76 · anulaciones en el mes: restan el dinero o el gasto, el ingreso del uniforme no cambia
    perform public.anular(gen_random_uuid(), 'cobro', v_pago, 'Se devolvió el dinero');
    perform public.anular(gen_random_uuid(), 'gasto', v_gasto, 'Era de la otra sede');
    v_r2 := public.resumen_del_mes(app.hoy(), v_la_paz);
    if (v_r2 -> 'dinero' -> 'efectivo' ->> 'cobros_anulados')::bigint - coalesce((v_r1 -> 'dinero' -> 'efectivo' ->> 'cobros_anulados')::bigint, 0) <> 65000
       or (v_r2 -> 'gastos' ->> 'anulados')::bigint - (v_r1 -> 'gastos' ->> 'anulados')::bigint <> 18000
       or (v_r2 -> 'ingresos' ->> 'total')::bigint <> (v_r1 -> 'ingresos' ->> 'total')::bigint
       or (v_r2 -> 'hoy' ->> 'deben')::bigint - (v_r1 -> 'hoy' ->> 'deben')::bigint <> 65000 then
      raise exception 'FALLO N76: %', v_r2;
    end if;
    v_ok := v_ok + 1;
    execute 'reset role';

    -- N77 · recepción y anon no ven la contabilidad (la estudiante no tiene ningún permiso: N02)
    perform set_config('request.jwt.claims', json_build_object('sub', v_rosa, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    begin
      perform public.resumen_del_mes(app.hoy(), v_la_paz);
      raise exception 'FALLO N77a: recepción vio el resumen';
    exception when insufficient_privilege then v_ok := v_ok + 1;
    end;
    begin
      perform public.verificar_cuadre(null);
      raise exception 'FALLO N77b: recepción verificó el cuadre';
    exception when insufficient_privilege then v_ok := v_ok + 1;
    end;
    execute 'reset role';
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    execute 'set local role anon';
    begin
      perform public.resumen_del_mes(null, null);
      raise exception 'FALLO N77c: anon vio el resumen';
    exception when insufficient_privilege then v_ok := v_ok + 1;
    end;
    execute 'reset role';

    -- N78 · el cuadre de todas las sedes sigue en pie
    perform set_config('request.jwt.claims', json_build_object('sub', v_carla, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    v_res := public.verificar_cuadre(null);
    if not (v_res ->> 'cuadra')::boolean then raise exception 'FALLO N78: %', v_res; end if;
    v_ok := v_ok + 1;
    execute 'reset role';
  end;

  -- ============================================================ R7 · tablero de administración (por diferencias)
  declare
    v_t0 jsonb;
    v_t1 jsonb;
    v_t2 jsonb;
    v_tabla uuid;
    v_baja uuid;
    v_g uuid;
    v_hoy date := app.hoy();
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_carla, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    v_t0 := public.tablero_de_administracion(v_la_paz);
    execute 'reset role';

    -- Una venta en efectivo de hace dos días que nadie arqueó (fecha simulada).
    perform set_config('app.mantenimiento', 'si', true);
    perform set_config('app.hoy_simulada', (v_hoy - 2)::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_carla, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    perform public.registrar_cobro(gen_random_uuid(), v_la_paz, null, 'efectivo', null, null, null,
      '{"concepto":"otro-ingreso","descripcion":"Recetario R7 atrasado","monto":3000,"cliente":"Cliente R7"}'::jsonb, null);
    execute 'reset role';
    perform set_config('app.hoy_simulada', '', true);
    perform set_config('app.mantenimiento', 'no', true);

    perform set_config('request.jwt.claims', json_build_object('sub', v_carla, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    -- Hoy: una venta en efectivo, una compra por transferencia que se da de baja y un grupo con inscritos sin precio.
    perform public.registrar_cobro(gen_random_uuid(), v_la_paz, null, 'efectivo', null, null, null,
      '{"concepto":"otro-ingreso","descripcion":"Recetario R7","monto":10000,"cliente":"Cliente R7"}'::jsonb, null);
    v_res := public.guardar_articulo(gen_random_uuid(), '{"nombre":"Tabla R7","tipo":"utensilio"}'::jsonb, null);
    select id into v_tabla from public.variantes where articulo_id = (v_res ->> 'articulo')::uuid;
    perform public.registrar_compra(gen_random_uuid(), v_la_paz, null, null, null, null, 'transferencia', 'TR-R7-1',
      jsonb_build_array(jsonb_build_object('variante', v_tabla, 'cantidad', '1', 'costo_total', '4500')));
    v_res := public.dar_de_baja(gen_random_uuid(), v_la_paz, v_tabla, '1', 'rotura', 'Se partió', null);
    v_baja := (v_res ->> 'movimiento')::uuid;
    insert into public.cohortes (programa_codigo, sede_id, gestion, dias, duracion, fecha_inicio, estado)
    values ('tortas', v_la_paz, extract(year from v_hoy)::smallint, 'sab', 1, v_hoy, 'abierto') returning id into v_g;
    perform public.inscribir(gen_random_uuid(), null, '{"nombres":"Tito","apellidos":"Tablero Uno"}'::jsonb, v_g, null, null, null, null, null);
    v_t1 := public.tablero_de_administracion(v_la_paz);

    -- N79 · el efectivo de días anteriores sin arqueo aparece, con su fecha
    if (v_t1 -> 'efectivo_sin_arqueo' ->> 'registros')::int <> (v_t0 -> 'efectivo_sin_arqueo' ->> 'registros')::int + 1
       or (v_t1 -> 'efectivo_sin_arqueo' ->> 'desde')::date > v_hoy - 2 then
      raise exception 'FALLO N79: %', v_t1 -> 'efectivo_sin_arqueo';
    end if;
    v_ok := v_ok + 1;

    -- N80 · bajas de los últimos 7 días; una baja anulada deja de contar
    if (v_t1 -> 'bajas_7_dias' ->> 'cantidad')::int <> (v_t0 -> 'bajas_7_dias' ->> 'cantidad')::int + 1
       or (v_t1 -> 'bajas_7_dias' ->> 'monto')::bigint <> (v_t0 -> 'bajas_7_dias' ->> 'monto')::bigint + 4500 then
      raise exception 'FALLO N80a: %', v_t1 -> 'bajas_7_dias';
    end if;
    perform public.anular(gen_random_uuid(), 'baja', v_baja, 'Se registró por error');
    v_t2 := public.tablero_de_administracion(v_la_paz);
    if (v_t2 -> 'bajas_7_dias' ->> 'cantidad')::int <> (v_t0 -> 'bajas_7_dias' ->> 'cantidad')::int then
      raise exception 'FALLO N80b: la baja anulada sigue contando';
    end if;
    v_ok := v_ok + 1;

    -- N81 · dinero del mes y de esta semana (la venta de hoy entra; la compra sale)
    if (v_t1 -> 'comparacion' ->> 'entro_mes')::bigint - (v_t0 -> 'comparacion' ->> 'entro_mes')::bigint
         <> 10000 + (case when date_trunc('month', v_hoy - 2) = date_trunc('month', v_hoy) then 3000 else 0 end)
       or (v_t1 -> 'comparacion' ->> 'salio_mes')::bigint - (v_t0 -> 'comparacion' ->> 'salio_mes')::bigint <> 4500
       or (v_t1 -> 'semanas' -> 7 ->> 'entro')::bigint - (v_t0 -> 'semanas' -> 7 ->> 'entro')::bigint
         < 10000
       or jsonb_array_length(v_t1 -> 'semanas') <> 8 then
      raise exception 'FALLO N81: %', v_t1 -> 'comparacion';
    end if;
    v_ok := v_ok + 1;

    -- N82 · un grupo con inscritos y sin precio
    if (v_t1 -> 'sin_precio' ->> 'grupos')::int <> (v_t0 -> 'sin_precio' ->> 'grupos')::int + 1 then
      raise exception 'FALLO N82: %', v_t1 -> 'sin_precio';
    end if;
    v_ok := v_ok + 1;
    execute 'reset role';

    -- N83 · recepción no ve el tablero de administración
    perform set_config('request.jwt.claims', json_build_object('sub', v_rosa, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    begin
      perform public.tablero_de_administracion(v_la_paz);
      raise exception 'FALLO N83: recepción vio el tablero de administración';
    exception when insufficient_privilege then v_ok := v_ok + 1;
    end;
    execute 'reset role';
  end;

  -- ============================================================ R9 · anular lo que vino después y ya se deshizo
  declare
    v_jabon uuid;
    v_aceite uuid;
    v_uso uuid;
    v_compra uuid;
    v_saldo uuid;
    v_texto text;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_carla, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    v_res := public.guardar_articulo(gen_random_uuid(), '{"nombre":"Jabón R9","tipo":"otro","unidad":"l"}'::jsonb, null);
    select id into v_jabon from public.variantes where articulo_id = (v_res ->> 'articulo')::uuid;
    v_res := public.guardar_articulo(gen_random_uuid(), '{"nombre":"Aceite R9","tipo":"insumo","unidad":"l"}'::jsonb, null);
    select id into v_aceite from public.variantes where articulo_id = (v_res ->> 'articulo')::uuid;

    -- N84 · costo promedio: se anula el uso y DESPUÉS la compra; vuelve a cero exacto
    v_res := public.registrar_compra(gen_random_uuid(), v_la_paz, null, null, null, null, 'transferencia', 'TR-R9-1',
      jsonb_build_array(jsonb_build_object('variante', v_jabon, 'cantidad', '4', 'costo_total', '2000')));
    v_compra := (v_res ->> 'compra')::uuid;
    v_uso := gen_random_uuid();
    perform public.usar_insumos(v_uso, v_la_paz, 'uso_interno', null, null, jsonb_build_array(jsonb_build_object('variante', v_jabon, 'cantidad', '1')));
    begin
      perform public.anular(gen_random_uuid(), 'compra', v_compra, 'Prueba');
      raise exception 'FALLO N84a: anuló una compra con un uso vigente';
    exception when others then
      if sqlerrm <> 'compra_con_movimientos_posteriores' then raise exception 'FALLO N84a: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    perform public.anular(gen_random_uuid(), 'uso', v_uso, 'Se registró en el destino equivocado');
    perform public.anular(gen_random_uuid(), 'compra', v_compra, 'La nota era de otro proveedor');
    select e.total::text || '|' || c.valor into v_texto
      from public.existencias e join public.existencias_costo c using (variante_id, sede_id) where e.variante_id = v_jabon and e.sede_id = v_la_paz;
    if v_texto <> '0.000|0' then raise exception 'FALLO N84b: quedó %', v_texto; end if;
    v_ok := v_ok + 1;

    -- N85 · saldo inicial: anular dos veces responde «ya anulado»
    perform public.registrar_saldo_inicial(gen_random_uuid(), v_el_alto, jsonb_build_array(
      jsonb_build_object('variante', v_aceite, 'cantidad', '3', 'valor', '3000')));
    select id into v_saldo from public.movimientos where variante_id = v_aceite and sede_id = v_el_alto and tipo = 'saldo_inicial';
    perform public.anular(gen_random_uuid(), 'saldo_inicial', v_saldo, 'Se contó mal');
    begin
      perform public.anular(gen_random_uuid(), 'saldo_inicial', v_saldo, 'Otra vez');
      raise exception 'FALLO N85: anuló dos veces el saldo inicial';
    exception when others then
      if sqlerrm <> 'ya_anulado' then raise exception 'FALLO N85: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;

    -- N86 · saldo inicial con un uso que ya se anuló: se puede anular
    perform public.registrar_saldo_inicial(gen_random_uuid(), v_la_paz, jsonb_build_array(
      jsonb_build_object('variante', v_aceite, 'cantidad', '2', 'valor', '2400')));
    select id into v_saldo from public.movimientos where variante_id = v_aceite and sede_id = v_la_paz and tipo = 'saldo_inicial';
    v_uso := gen_random_uuid();
    perform public.usar_insumos(v_uso, v_la_paz, 'practica', null, null, jsonb_build_array(jsonb_build_object('variante', v_aceite, 'cantidad', '0.5')));
    perform public.anular(gen_random_uuid(), 'uso', v_uso, 'Se registró dos veces');
    perform public.anular(gen_random_uuid(), 'saldo_inicial', v_saldo, 'Se cargó en la sede equivocada');
    select e.total::text || '|' || c.valor into v_texto
      from public.existencias e join public.existencias_costo c using (variante_id, sede_id) where e.variante_id = v_aceite and e.sede_id = v_la_paz;
    if v_texto <> '0.000|0' then raise exception 'FALLO N86: quedó %', v_texto; end if;
    v_ok := v_ok + 1;
    execute 'reset role';
  end;

  -- ============================================================ R7 (2) · el tablero dice dónde está el problema y cuenta en la base
  declare
    v_hoy date := app.hoy();
    v_antes date;
    v_tb jsonb;
    v_d jsonb;
    v_lp jsonb;
    v_ea jsonb;
    v_alumnos integer;
    v_con_vencido integer;
    v_vencido bigint;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_carla, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    -- El día anterior al efectivo sin arqueo más antiguo que ya haya (del ensayo o de la demostración).
    select min(x.fecha) into v_antes from (
      select p.fecha from public.pagos p where p.medio = 'efectivo' and p.cierre_id is null
      union all select g.fecha from public.gastos g where g.medio = 'efectivo' and g.cierre_id is null
      union all select c.fecha from public.compras c where c.medio = 'efectivo' and c.cierre_id is null
      union all select p.anulado_el from public.pagos p where p.medio = 'efectivo' and p.anulado_el is not null and p.anulacion_cierre_id is null
      union all select g.anulado_el from public.gastos g where g.medio = 'efectivo' and g.anulado_el is not null and g.anulacion_cierre_id is null
      union all select c.anulado_el from public.compras c where c.medio = 'efectivo' and c.anulado_el is not null and c.anulacion_cierre_id is null) x;
    v_antes := least(coalesce(v_antes, v_hoy), v_hoy) - 1;
    execute 'reset role';

    -- Una venta en efectivo en El Alto, la más antigua sin arqueo (fecha simulada).
    perform set_config('app.mantenimiento', 'si', true);
    perform set_config('app.hoy_simulada', v_antes::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_carla, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    perform public.registrar_cobro(gen_random_uuid(), v_el_alto, null, 'efectivo', null, null, null,
      '{"concepto":"otro-ingreso","descripcion":"Recetario R7 en El Alto","monto":2000,"cliente":"Cliente R7"}'::jsonb, null);
    execute 'reset role';
    perform set_config('app.hoy_simulada', '', true);
    perform set_config('app.mantenimiento', 'no', true);

    perform set_config('request.jwt.claims', json_build_object('sub', v_carla, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    -- N87 · con todas las sedes, el aviso del efectivo lleva a la sede del registro más antiguo
    v_tb := public.tablero_de_administracion(null);
    if (v_tb -> 'efectivo_sin_arqueo' ->> 'sede')::uuid is distinct from v_el_alto
       or (v_tb -> 'efectivo_sin_arqueo' ->> 'desde')::date <> v_antes
       or (v_tb -> 'efectivo_sin_arqueo' ->> 'sedes')::integer < 2 then
      raise exception 'FALLO N87a: %', v_tb -> 'efectivo_sin_arqueo';
    end if;
    -- con una sede elegida, el aviso es de esa sede (La Paz tiene el cobro atrasado de N79)
    v_tb := public.tablero_de_administracion(v_la_paz);
    if (v_tb -> 'efectivo_sin_arqueo' ->> 'sede')::uuid is distinct from v_la_paz
       or (v_tb -> 'efectivo_sin_arqueo' ->> 'sedes')::integer <> 1 then
      raise exception 'FALLO N87b: %', v_tb -> 'efectivo_sin_arqueo';
    end if;
    v_ok := v_ok + 1;

    -- N88 · lo que deben se cuenta en la base, sin tope de filas; las dos sedes suman el total
    v_d := public.resumen_de_deudores(null);
    select count(*), count(*) filter (where s.total_vencido > 0), coalesce(sum(s.total_vencido), 0)
      into v_alumnos, v_con_vencido, v_vencido from public.v_saldos_de_alumno s;
    if (v_d ->> 'alumnos')::integer <> v_alumnos or (v_d ->> 'alumnos_con_vencido')::integer <> v_con_vencido
       or (v_d ->> 'vencido')::bigint <> v_vencido then
      raise exception 'FALLO N88a: % frente a % / % / %', v_d, v_alumnos, v_con_vencido, v_vencido;
    end if;
    v_lp := public.resumen_de_deudores(v_la_paz);
    v_ea := public.resumen_de_deudores(v_el_alto);
    if (v_lp ->> 'alumnos')::integer + (v_ea ->> 'alumnos')::integer <> (v_d ->> 'alumnos')::integer
       or (v_lp ->> 'pendiente')::bigint + (v_ea ->> 'pendiente')::bigint <> (v_d ->> 'pendiente')::bigint then
      raise exception 'FALLO N88b: La Paz % + El Alto % <> %', v_lp, v_ea, v_d;
    end if;
    v_ok := v_ok + 1;
    execute 'reset role';

    -- N89 · una estudiante no lee lo que deben los alumnos
    perform set_config('request.jwt.claims', json_build_object('sub', v_valeria, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    begin
      perform public.resumen_de_deudores(null);
      raise exception 'FALLO N89: una estudiante leyó lo que deben los alumnos';
    exception when insufficient_privilege then v_ok := v_ok + 1;
    end;
    execute 'reset role';
  end;

  -- ============================================================ RF · revisión final (cuotas anuladas, lote vencido, ingresos del mes, variantes con movimientos)
  declare
    v_g1 uuid;
    v_g2 uuid;
    v_g3 uuid;
    v_ins_a uuid;
    v_ins_c uuid;
    v_ins_r uuid;
    v_cargo uuid;
    v_leche uuid;
    v_lote_vencido uuid;
    v_lote_vigente uuid;
    v_r0 jsonb;
    v_f0 jsonb;
    v_r1 jsonb;
    v_f1 jsonb;
    v_r2 jsonb;
    v_mes_que_viene date := (date_trunc('month', app.hoy()) + interval '1 month')::date;
    v_esperado uuid[];
    v_obtenido uuid[];
    v_esperado_alto uuid[];
    v_obtenido_alto uuid[];
    v_n integer;
    v_g4 uuid;
    v_g5 uuid;
    v_ins_b uuid;
    v_ins_t uuid;
    v_primer_vence date;
    v_numeros integer[];
    v_g6 uuid;
    v_g7 uuid;
    v_ins_m uuid;
    v_ins_p uuid;
    v_fechas date[];
    v_g8 uuid;
    v_ins_n uuid;
    v_est_n uuid;
    v_plan_n uuid;
    v_concepto_n uuid;
    v_op_n uuid;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_carla, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';

    -- N90 · una cuota anulada a propósito (beca) no vuelve al generar las cuotas del grupo
    insert into public.cohortes (programa_codigo, sede_id, gestion, dias, duracion, fecha_inicio, estado)
    values ('cocina', v_la_paz, extract(year from app.hoy())::smallint, 'sab', 2, app.hoy(), 'en_curso') returning id into v_g1;
    insert into public.planes_de_pago (cohorte_id, monto_cuota, cuotas, primer_vencimiento, cada_meses)
    values (v_g1, 20000, 3, app.hoy(), 1);
    v_res := public.inscribir(gen_random_uuid(), null, '{"nombres":"Ana","apellidos":"Revisión Noventa"}'::jsonb, v_g1, null, null, null, null, null);
    v_ins_a := (v_res ->> 'inscripcion')::uuid;
    if (v_res ->> 'cuotas')::int <> 3 then raise exception 'FALLO N90a: %', v_res; end if;
    select id into v_cargo from public.cargos where inscripcion_id = v_ins_a and numero_de_cuota = 2;
    perform public.anular(gen_random_uuid(), 'cargo', v_cargo, 'Beca de la segunda cuota');
    v_res := public.generar_cuotas_de_grupo(gen_random_uuid(), v_g1);
    if (v_res ->> 'inscripciones')::int <> 0 or (v_res ->> 'cuotas')::int <> 0 then raise exception 'FALLO N90b: %', v_res; end if;
    if exists (select 1 from public.cargos where inscripcion_id = v_ins_a and numero_de_cuota = 2 and anulado_en is null) then
      raise exception 'FALLO N90c: la cuota anulada volvió';
    end if;
    select count(*) into v_n from public.cargos where inscripcion_id = v_ins_a and anulado_en is null;
    if v_n <> 2 then raise exception 'FALLO N90d: % cuotas vigentes', v_n; end if;
    v_ok := v_ok + 1;

    -- N91 · si se anularon TODAS las cuotas (cambio de precio, ADR 0008 §8), se corrige el plan y se generan otra vez
    insert into public.cohortes (programa_codigo, sede_id, gestion, dias, duracion, fecha_inicio, estado)
    values ('cocina', v_la_paz, extract(year from app.hoy())::smallint, 'sab', 2, app.hoy(), 'en_curso') returning id into v_g2;
    insert into public.planes_de_pago (cohorte_id, monto_cuota, cuotas, primer_vencimiento, cada_meses)
    values (v_g2, 30000, 2, app.hoy(), 1);
    v_res := public.inscribir(gen_random_uuid(), null, '{"nombres":"Ciro","apellidos":"Revisión Noventa y Uno"}'::jsonb, v_g2, null, null, null, null, null);
    v_ins_c := (v_res ->> 'inscripcion')::uuid;
    for v_cargo in select id from public.cargos where inscripcion_id = v_ins_c order by numero_de_cuota loop
      perform public.anular(gen_random_uuid(), 'cargo', v_cargo, 'El precio del grupo cambió');
    end loop;
    update public.planes_de_pago set monto_cuota = 35000 where cohorte_id = v_g2;
    v_res := public.generar_cuotas_de_grupo(gen_random_uuid(), v_g2);
    if (v_res ->> 'inscripciones')::int <> 1 or (v_res ->> 'cuotas')::int <> 2 then raise exception 'FALLO N91a: %', v_res; end if;
    select count(*) into v_n from public.cargos where inscripcion_id = v_ins_c and anulado_en is null and monto = 35000;
    if v_n <> 2 then raise exception 'FALLO N91b: % cuotas vigentes al precio nuevo', v_n; end if;
    v_ok := v_ok + 1;

    -- N92 · un lote vencido no se usa en clase aunque se lo elija (mismo código que sin lote); la baja por vencimiento sí lo saca
    v_res := public.guardar_articulo(gen_random_uuid(), '{"nombre":"Leche de prueba RF","tipo":"insumo","unidad":"l","controla_vencimiento":"true"}'::jsonb, null);
    select id into v_leche from public.variantes where articulo_id = (v_res ->> 'articulo')::uuid;
    perform public.registrar_saldo_inicial(gen_random_uuid(), v_la_paz, jsonb_build_array(
      jsonb_build_object('variante', v_leche, 'cantidad', '2', 'valor', '2000', 'vence_el', app.hoy() - 1),
      jsonb_build_object('variante', v_leche, 'cantidad', '3', 'valor', '3300', 'vence_el', app.hoy() + 30)));
    select id into v_lote_vencido from public.lotes where variante_id = v_leche and vence_el < app.hoy();
    select id into v_lote_vigente from public.lotes where variante_id = v_leche and vence_el > app.hoy();
    begin
      perform public.usar_insumos(gen_random_uuid(), v_la_paz, 'clase', null, null,
        jsonb_build_array(jsonb_build_object('variante', v_leche, 'cantidad', '4')));
      raise exception 'FALLO N92a: usó leche vencida sin elegir lote';
    exception when others then
      if sqlerrm <> 'stock_insuficiente' then raise exception 'FALLO N92a: %', sqlerrm; end if;
    end;
    begin
      perform public.usar_insumos(gen_random_uuid(), v_la_paz, 'clase', null, null,
        jsonb_build_array(jsonb_build_object('variante', v_leche, 'cantidad', '1', 'lote', v_lote_vencido)));
      raise exception 'FALLO N92b: usó en clase un lote vencido elegido a mano';
    exception when others then
      if sqlerrm <> 'stock_insuficiente' then raise exception 'FALLO N92b: %', sqlerrm; end if;
    end;
    v_res := public.usar_insumos(gen_random_uuid(), v_la_paz, 'clase', null, null,
      jsonb_build_array(jsonb_build_object('variante', v_leche, 'cantidad', '1', 'lote', v_lote_vigente)));
    if (v_res ->> 'valor')::bigint <> 1100 then raise exception 'FALLO N92c: el lote vigente elegido no salió %', v_res; end if;
    v_res := public.dar_de_baja(gen_random_uuid(), v_la_paz, v_leche, '2', 'vencimiento', null, v_lote_vencido);
    if (v_res ->> 'valor')::bigint <> 2000 then raise exception 'FALLO N92d: %', v_res; end if;
    if (select l.cantidad_restante from public.lotes l where l.id = v_lote_vencido) <> 0 then
      raise exception 'FALLO N92e: el lote vencido no quedó en cero';
    end if;
    v_ok := v_ok + 1;

    -- N93 · un retiro anula cuotas futuras: no restan este mes ni cuentan en el mes de su vencimiento
    v_r0 := public.resumen_del_mes(app.hoy(), v_la_paz);
    v_f0 := public.resumen_del_mes(v_mes_que_viene, v_la_paz);
    insert into public.cohortes (programa_codigo, sede_id, gestion, dias, duracion, fecha_inicio, estado)
    values ('cocina', v_la_paz, extract(year from app.hoy())::smallint, 'sab', 2, app.hoy(), 'en_curso') returning id into v_g3;
    insert into public.planes_de_pago (cohorte_id, monto_cuota, cuotas, primer_vencimiento, cada_meses)
    values (v_g3, 40000, 3, app.hoy(), 1);
    v_res := public.inscribir(gen_random_uuid(), null, '{"nombres":"Rita","apellidos":"Revisión Noventa y Tres"}'::jsonb, v_g3, null, null, null, null, null);
    v_ins_r := (v_res ->> 'inscripcion')::uuid;
    v_res := public.cambiar_estado_de_inscripcion(gen_random_uuid(), v_ins_r, 'retirado', 'Se mudó de ciudad');
    if (v_res ->> 'cuotas_anuladas')::int <> 2 then raise exception 'FALLO N93a: %', v_res; end if;
    v_r1 := public.resumen_del_mes(app.hoy(), v_la_paz);
    v_f1 := public.resumen_del_mes(v_mes_que_viene, v_la_paz);
    if (v_r1 -> 'ingresos' ->> 'total')::bigint - (v_r0 -> 'ingresos' ->> 'total')::bigint <> 40000
       or (v_r1 -> 'ingresos' ->> 'anulados')::bigint - (v_r0 -> 'ingresos' ->> 'anulados')::bigint <> 0 then
      raise exception 'FALLO N93b: este mes % (antes %)', v_r1 -> 'ingresos', v_r0 -> 'ingresos';
    end if;
    -- El desglose por grupo es el mismo neto que total menos anulados.
    if (select coalesce(sum((e ->> 'monto')::bigint), 0) from jsonb_array_elements(v_r1 -> 'ingresos' -> 'por_grupo') e)
       <> (v_r1 -> 'ingresos' ->> 'total')::bigint - (v_r1 -> 'ingresos' ->> 'anulados')::bigint then
      raise exception 'FALLO N93e: por grupo no suma total menos anulados tras el retiro %', v_r1 -> 'ingresos';
    end if;
    if (v_f1 -> 'ingresos' ->> 'total')::bigint <> (v_f0 -> 'ingresos' ->> 'total')::bigint
       or (v_f1 -> 'ingresos' ->> 'anulados')::bigint <> (v_f0 -> 'ingresos' ->> 'anulados')::bigint then
      raise exception 'FALLO N93c: el mes que viene % (antes %)', v_f1 -> 'ingresos', v_f0 -> 'ingresos';
    end if;
    -- Lo anulado en su fecha o después sigue §5.7: la cuota de hoy, anulada hoy, cuenta y resta este mes.
    select id into v_cargo from public.cargos where inscripcion_id = v_ins_r and numero_de_cuota = 1;
    perform public.anular(gen_random_uuid(), 'cargo', v_cargo, 'Se le perdonó la cuota');
    v_r2 := public.resumen_del_mes(app.hoy(), v_la_paz);
    if (v_r2 -> 'ingresos' ->> 'total')::bigint <> (v_r1 -> 'ingresos' ->> 'total')::bigint
       or (v_r2 -> 'ingresos' ->> 'anulados')::bigint - (v_r1 -> 'ingresos' ->> 'anulados')::bigint <> 40000 then
      raise exception 'FALLO N93d: % (antes %)', v_r2 -> 'ingresos', v_r1 -> 'ingresos';
    end if;
    if (select coalesce(sum((e ->> 'monto')::bigint), 0) from jsonb_array_elements(v_r2 -> 'ingresos' -> 'por_grupo') e)
       <> (v_r2 -> 'ingresos' ->> 'total')::bigint - (v_r2 -> 'ingresos' ->> 'anulados')::bigint then
      raise exception 'FALLO N93f: por grupo no suma total menos anulados tras anular la cuota 1 %', v_r2 -> 'ingresos';
    end if;
    v_ok := v_ok + 1;

    -- N94 · variantes con movimientos en una sede: el mismo conjunto que el libro, sede por sede
    v_obtenido := public.variantes_con_movimientos(v_la_paz);
    v_obtenido_alto := public.variantes_con_movimientos(v_el_alto);
    execute 'reset role';
    select coalesce(array_agg(distinct m.variante_id order by m.variante_id), '{}') into v_esperado
      from public.movimientos m where m.sede_id = v_la_paz;
    select coalesce(array_agg(distinct m.variante_id order by m.variante_id), '{}') into v_esperado_alto
      from public.movimientos m where m.sede_id = v_el_alto;
    select coalesce(array_agg(x order by x), '{}') into v_obtenido from unnest(v_obtenido) x;
    select coalesce(array_agg(x order by x), '{}') into v_obtenido_alto from unnest(v_obtenido_alto) x;
    if v_obtenido <> v_esperado or not (v_leche = any (v_obtenido)) then
      raise exception 'FALLO N94a: La Paz % frente a %', cardinality(v_obtenido), cardinality(v_esperado);
    end if;
    if v_obtenido_alto <> v_esperado_alto or v_leche = any (v_obtenido_alto) then
      raise exception 'FALLO N94b: El Alto % frente a %', cardinality(v_obtenido_alto), cardinality(v_esperado_alto);
    end if;
    v_ok := v_ok + 1;

    -- N95 · la estudiante y anon no leen las variantes con movimientos
    perform set_config('request.jwt.claims', json_build_object('sub', v_valeria, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    begin
      perform public.variantes_con_movimientos(v_la_paz);
      raise exception 'FALLO N95a: la estudiante leyó las variantes con movimientos';
    exception when insufficient_privilege then v_ok := v_ok + 1;
    end;
    execute 'reset role';
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    execute 'set local role anon';
    begin
      perform public.variantes_con_movimientos(v_la_paz);
      raise exception 'FALLO N95b: anon leyó las variantes con movimientos';
    exception when insufficient_privilege then null;
    end;
    execute 'reset role';
    -- El rechazo de arriba podría venir del permiso de dentro de la función:
    -- lo que se exige es que anon ni siquiera tenga el grant de ejecutarla.
    if has_function_privilege('anon', 'public.variantes_con_movimientos(uuid)', 'execute') then
      raise exception 'FALLO N95b: anon tiene permiso de ejecutar variantes_con_movimientos';
    end if;
    v_ok := v_ok + 1;

    -- N102 · una beca completa (todas las cuotas anuladas, el plan sin cambios) no vuelve al generar las cuotas del grupo
    perform set_config('request.jwt.claims', json_build_object('sub', v_carla, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    insert into public.cohortes (programa_codigo, sede_id, gestion, dias, duracion, fecha_inicio, estado)
    values ('cocina', v_la_paz, extract(year from app.hoy())::smallint, 'sab', 2, app.hoy(), 'en_curso') returning id into v_g4;
    insert into public.planes_de_pago (cohorte_id, monto_cuota, cuotas, primer_vencimiento, cada_meses)
    values (v_g4, 20000, 2, app.hoy(), 1);
    v_res := public.inscribir(gen_random_uuid(), null, '{"nombres":"Beto","apellidos":"Revisión Ciento Dos"}'::jsonb, v_g4, null, null, null, null, null);
    v_ins_b := (v_res ->> 'inscripcion')::uuid;
    if (v_res ->> 'cuotas')::int <> 2 then raise exception 'FALLO N102a: %', v_res; end if;
    for v_cargo in select id from public.cargos where inscripcion_id = v_ins_b order by numero_de_cuota loop
      perform public.anular(gen_random_uuid(), 'cargo', v_cargo, 'Beca completa del grupo');
    end loop;
    v_res := public.generar_cuotas_de_grupo(gen_random_uuid(), v_g4);
    if (v_res ->> 'inscripciones')::int <> 0 or (v_res ->> 'cuotas')::int <> 0 then raise exception 'FALLO N102b: %', v_res; end if;
    select count(*) into v_n from public.cargos where inscripcion_id = v_ins_b and anulado_en is null;
    if v_n <> 0 then raise exception 'FALLO N102c: % cuotas vigentes tras la beca', v_n; end if;
    v_ok := v_ok + 1;

    -- N103 · quien ya pagaba antes del sistema (p_desde) y pasa por un cambio de precio recibe las cuotas desde su primer vencimiento, ninguna anterior
    -- Plan de 4 cuotas el día 1 desde hace dos meses; p_desde cae entre la 2.ª y la 3.ª (no coincide con ningún vencimiento).
    insert into public.cohortes (programa_codigo, sede_id, gestion, dias, duracion, fecha_inicio, estado)
    values ('cocina', v_la_paz, extract(year from app.hoy())::smallint, 'sab', 2, app.hoy(), 'en_curso') returning id into v_g5;
    insert into public.planes_de_pago (cohorte_id, monto_cuota, cuotas, primer_vencimiento, cada_meses)
    values (v_g5, 30000, 4, (date_trunc('month', app.hoy()) - interval '2 months')::date, 1);
    v_res := public.inscribir(gen_random_uuid(), null, '{"nombres":"Teo","apellidos":"Revisión Ciento Tres"}'::jsonb, v_g5, null, null, null, null,
                              date_trunc('month', app.hoy())::date - 10);
    v_ins_t := (v_res ->> 'inscripcion')::uuid;
    if (v_res ->> 'cuotas')::int <> 2 then raise exception 'FALLO N103a: %', v_res; end if;
    select min(vence_el) into v_primer_vence from public.cargos where inscripcion_id = v_ins_t;
    if v_primer_vence <> date_trunc('month', app.hoy())::date then raise exception 'FALLO N103b: primer vencimiento %', v_primer_vence; end if;
    for v_cargo in select id from public.cargos where inscripcion_id = v_ins_t order by numero_de_cuota loop
      perform public.anular(gen_random_uuid(), 'cargo', v_cargo, 'El precio del grupo cambió');
    end loop;
    update public.planes_de_pago set monto_cuota = 33000 where cohorte_id = v_g5;
    v_res := public.generar_cuotas_de_grupo(gen_random_uuid(), v_g5);
    if (v_res ->> 'inscripciones')::int <> 1 or (v_res ->> 'cuotas')::int <> 2 then raise exception 'FALLO N103c: %', v_res; end if;
    select coalesce(array_agg(numero_de_cuota::int order by numero_de_cuota), '{}') into v_numeros
      from public.cargos where inscripcion_id = v_ins_t and anulado_en is null;
    if v_numeros <> array[3, 4] then raise exception 'FALLO N103d: cuotas vigentes %', v_numeros; end if;
    if exists (select 1 from public.cargos where inscripcion_id = v_ins_t and anulado_en is null
                 and (monto <> 33000 or vence_el < v_primer_vence)) then
      raise exception 'FALLO N103e: una cuota nueva con el precio anterior o que vence antes del primer vencimiento original';
    end if;
    v_ok := v_ok + 1;

    -- N104 · bajar el número de cuotas (mismo monto y calendario) también es un cambio de plan: se generan las nuevas
    -- Protege el refinamiento (a) de DB-01: pasa también con la función de la ronda 1; se comprobó que falla con la regla literal.
    insert into public.cohortes (programa_codigo, sede_id, gestion, dias, duracion, fecha_inicio, estado)
    values ('cocina', v_la_paz, extract(year from app.hoy())::smallint, 'sab', 2, app.hoy(), 'en_curso') returning id into v_g6;
    insert into public.planes_de_pago (cohorte_id, monto_cuota, cuotas, primer_vencimiento, cada_meses)
    values (v_g6, 25000, 3, app.hoy(), 1);
    v_res := public.inscribir(gen_random_uuid(), null, '{"nombres":"Mara","apellidos":"Revisión Ciento Cuatro"}'::jsonb, v_g6, null, null, null, null, null);
    v_ins_m := (v_res ->> 'inscripcion')::uuid;
    for v_cargo in select id from public.cargos where inscripcion_id = v_ins_m order by numero_de_cuota loop
      perform public.anular(gen_random_uuid(), 'cargo', v_cargo, 'El grupo pasa a dos cuotas');
    end loop;
    update public.planes_de_pago set cuotas = 2 where cohorte_id = v_g6;
    v_res := public.generar_cuotas_de_grupo(gen_random_uuid(), v_g6);
    if (v_res ->> 'inscripciones')::int <> 1 or (v_res ->> 'cuotas')::int <> 2 then raise exception 'FALLO N104a: %', v_res; end if;
    select coalesce(array_agg(numero_de_cuota::int order by numero_de_cuota), '{}') into v_numeros
      from public.cargos where inscripcion_id = v_ins_m and anulado_en is null;
    if v_numeros <> array[1, 2] then raise exception 'FALLO N104b: cuotas vigentes %', v_numeros; end if;
    v_ok := v_ok + 1;

    -- N105 · adelantar el primer vencimiento de quien tenía todas sus cuotas (sin p_desde) no le quita la cuota 1
    -- Protege el refinamiento (b) de DB-01: pasa también con la función de la ronda 1; se comprobó que falla con la regla literal.
    insert into public.cohortes (programa_codigo, sede_id, gestion, dias, duracion, fecha_inicio, estado)
    values ('cocina', v_la_paz, extract(year from app.hoy())::smallint, 'sab', 2, app.hoy(), 'en_curso') returning id into v_g7;
    insert into public.planes_de_pago (cohorte_id, monto_cuota, cuotas, primer_vencimiento, cada_meses)
    values (v_g7, 25000, 2, (date_trunc('month', app.hoy()) + interval '1 month')::date, 1);
    v_res := public.inscribir(gen_random_uuid(), null, '{"nombres":"Pía","apellidos":"Revisión Ciento Cinco"}'::jsonb, v_g7, null, null, null, null, null);
    v_ins_p := (v_res ->> 'inscripcion')::uuid;
    if (v_res ->> 'cuotas')::int <> 2 then raise exception 'FALLO N105a: %', v_res; end if;
    for v_cargo in select id from public.cargos where inscripcion_id = v_ins_p order by numero_de_cuota loop
      perform public.anular(gen_random_uuid(), 'cargo', v_cargo, 'El grupo empieza a cobrar un mes antes');
    end loop;
    update public.planes_de_pago set primer_vencimiento = date_trunc('month', app.hoy())::date where cohorte_id = v_g7;
    v_res := public.generar_cuotas_de_grupo(gen_random_uuid(), v_g7);
    if (v_res ->> 'inscripciones')::int <> 1 or (v_res ->> 'cuotas')::int <> 2 then raise exception 'FALLO N105b: %', v_res; end if;
    select coalesce(array_agg(vence_el order by numero_de_cuota), '{}') into v_fechas
      from public.cargos where inscripcion_id = v_ins_p and anulado_en is null;
    if v_fechas <> array[date_trunc('month', app.hoy())::date, (date_trunc('month', app.hoy()) + interval '1 month')::date] then
      raise exception 'FALLO N105c: vencimientos %', v_fechas;
    end if;
    v_ok := v_ok + 1;
    execute 'reset role';
    -- N108 · solo cuenta la última tanda de cuotas: una tanda vieja anulada con otro precio y la última, anulada con el
    --        precio actual (una beca después de un cambio de precio), no hacen que la beca vuelva
    perform set_config('request.jwt.claims', json_build_object('sub', v_carla, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    insert into public.cohortes (programa_codigo, sede_id, gestion, dias, duracion, fecha_inicio, estado)
    values ('cocina', v_la_paz, extract(year from app.hoy())::smallint, 'sab', 2, app.hoy(), 'en_curso') returning id into v_g8;
    v_res := public.inscribir(gen_random_uuid(), null, '{"nombres":"Noa","apellidos":"Revisión Ciento Ocho"}'::jsonb, v_g8, null, null, null, null, null);
    v_ins_n := (v_res ->> 'inscripcion')::uuid;
    v_est_n := (v_res ->> 'estudiante')::uuid;
    insert into public.planes_de_pago (cohorte_id, monto_cuota, cuotas, primer_vencimiento, cada_meses)
    values (v_g8, 25000, 2, app.hoy(), 1) returning id, concepto_id into v_plan_n, v_concepto_n;
    execute 'reset role';
    -- Las dos tandas se escriben directo (como postgres) para darles días de registro distintos: en una sola
    -- transacción, now() es el mismo para todo. El disparador del libro solo vigila updates y deletes.
    select i.operacion_id into v_op_n from public.inscripciones i where i.id = v_ins_n;
    insert into public.cargos (operacion_id, estudiante_id, inscripcion_id, concepto_id, descripcion, monto, fecha, vence_el, sede_id,
                               origen, plan_id, numero_de_cuota, anulado_en, anulado_el, anulado_por, anulacion_motivo,
                               registrado_por, registrado_en)
    select v_op_n, v_est_n, v_ins_n, v_concepto_n, 'Cuota ' || n || ' de 2', monto, vence, vence, v_la_paz,
           'plan', v_plan_n, n, registrado + interval '1 hour', (registrado + interval '1 hour')::date, v_carla, motivo,
           v_carla, registrado
      from (values (1, 20000, now() - interval '2 days', 'El precio del grupo cambió'),
                   (2, 20000, now() - interval '2 days', 'El precio del grupo cambió'),
                   (1, 25000, now() - interval '1 day', 'Beca completa'),
                   (2, 25000, now() - interval '1 day', 'Beca completa')) as t(n, monto, registrado, motivo),
           lateral (select (app.hoy() + make_interval(months => n - 1))::date as vence) v;
    perform set_config('request.jwt.claims', json_build_object('sub', v_carla, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    v_res := public.generar_cuotas_de_grupo(gen_random_uuid(), v_g8);
    if (v_res ->> 'inscripciones')::int <> 0 or (v_res ->> 'cuotas')::int <> 0 then raise exception 'FALLO N108a: %', v_res; end if;
    select count(*) into v_n from public.cargos where inscripcion_id = v_ins_n and anulado_en is null;
    if v_n <> 0 then raise exception 'FALLO N108b: % cuotas vigentes tras la beca', v_n; end if;
    v_ok := v_ok + 1;
    execute 'reset role';
  end;

  -- ============================================================ DB-02 · devolver el uniforme anula su cargo (enmiendas B.12, crítica 14)
  declare
    v_g uuid;
    v_juego uuid;
    v_s uuid;
    v_m uuid;
    v_l uuid;
    v_alumno_1 uuid;
    v_ins_1 uuid;
    v_alumno_2 uuid;
    v_ins_2 uuid;
    v_alumno_3 uuid;
    v_ins_3 uuid;
    v_alumno_4 uuid;
    v_ins_4 uuid;
    v_alumno_5 uuid;
    v_ins_5 uuid;
    v_alumno_6 uuid;
    v_ins_6 uuid;
    v_alumno_7 uuid;
    v_ins_7 uuid;
    v_cambio uuid;
    v_cambio_2 uuid;
    v_entrega uuid;
    v_cargo uuid;
    v_clave_final uuid := gen_random_uuid();
    v_antes bigint;
    v_despues bigint;
    v_n integer;
    v_texto text;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_carla, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    v_res := public.guardar_articulo(gen_random_uuid(), '{"nombre":"Juego DB02","tipo":"uniforme","precio_venta":"65000"}'::jsonb, array['S', 'M', 'L']);
    v_juego := (v_res ->> 'articulo')::uuid;
    select id into v_s from public.variantes where articulo_id = v_juego and etiqueta = 'S';
    select id into v_m from public.variantes where articulo_id = v_juego and etiqueta = 'M';
    select id into v_l from public.variantes where articulo_id = v_juego and etiqueta = 'L';
    perform public.registrar_compra(gen_random_uuid(), v_la_paz, null, null, null, null, 'transferencia', 'TR-DB02-1', jsonb_build_array(
      jsonb_build_object('variante', v_s, 'cantidad', '5', 'costo_total', '150000'),
      jsonb_build_object('variante', v_m, 'cantidad', '5', 'costo_total', '150000'),
      jsonb_build_object('variante', v_l, 'cantidad', '5', 'costo_total', '150000')));
    insert into public.cohortes (programa_codigo, sede_id, gestion, anio_de_carrera, turno, dias, duracion, fecha_inicio, estado)
    values ('gastronomia', v_la_paz, 2026, 1, 'tarde', 'lun-vie', 3, app.hoy() - 5, 'en_curso') returning id into v_g;
    v_res := public.inscribir(gen_random_uuid(), null, '{"nombres":"Dora","apellidos":"Devuelve Uno"}'::jsonb, v_g, 'economico', null, null, null, null);
    v_alumno_1 := (v_res ->> 'estudiante')::uuid;
    v_ins_1 := (v_res ->> 'inscripcion')::uuid;
    v_res := public.inscribir(gen_random_uuid(), null, '{"nombres":"Pía","apellidos":"Pagado Dos"}'::jsonb, v_g, 'economico', null, null, null, null);
    v_alumno_2 := (v_res ->> 'estudiante')::uuid;
    v_ins_2 := (v_res ->> 'inscripcion')::uuid;
    v_res := public.inscribir(gen_random_uuid(), null, '{"nombres":"Tito","apellidos":"Talla Tres"}'::jsonb, v_g, 'economico', null, null, null, null);
    v_alumno_3 := (v_res ->> 'estudiante')::uuid;
    v_ins_3 := (v_res ->> 'inscripcion')::uuid;
    -- Dos piezas cargadas sin cobro (Bs 1300), para devolverlas en dos partes.
    perform public.entregar_uniforme(gen_random_uuid(), v_ins_1, v_la_paz, 'inscripcion', null,
      jsonb_build_array(jsonb_build_object('variante', v_m, 'cantidad', '2')), true, null);
    select en.id into v_entrega from public.entregas en where en.inscripcion_id = v_ins_1;
    select c.id into v_cargo from public.cargos c where c.entrega_id = v_entrega and c.anulado_en is null;
    if v_cargo is null then raise exception 'FALLO N96: la entrega no creó su cargo'; end if;
    execute 'reset role';
    select coalesce(sum(pendiente), 0) into v_antes from public.v_saldos_de_cargo where estudiante_id = v_alumno_1;

    -- N96 · devolución completa sin cobro (recepción): el cargo se sella hoy y lo que debe baja en su monto;
    --       la devolución parcial antes no lo toca y avisa
    perform set_config('request.jwt.claims', json_build_object('sub', v_rosa, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    v_res := public.devolver_uniforme(gen_random_uuid(), v_entrega, '1', 'Le sobra una pieza', null);
    if v_res ->> 'aviso' is distinct from 'devolucion_parcial' or (v_res -> 'cargo' ->> 'anulado')::boolean
       or (v_res -> 'cargo' ->> 'id')::uuid is distinct from v_cargo or (v_res -> 'cargo' ->> 'monto')::bigint <> 130000 then
      raise exception 'FALLO N96a: la devolución parcial respondió %', v_res;
    end if;
    execute 'reset role';
    select count(*) into v_n from public.cargos where id = v_cargo and anulado_en is null;
    if v_n <> 1 then raise exception 'FALLO N96b: la devolución parcial anuló el cargo'; end if;
    select coalesce(sum(pendiente), 0) into v_despues from public.v_saldos_de_cargo where estudiante_id = v_alumno_1;
    if v_despues <> v_antes then raise exception 'FALLO N96b: lo que debe cambió con la parcial (% → %)', v_antes, v_despues; end if;
    perform set_config('request.jwt.claims', json_build_object('sub', v_rosa, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    v_res := public.devolver_uniforme(v_clave_final, v_entrega, '1', 'Ya no lo necesita', null);
    if not coalesce((v_res -> 'cargo' ->> 'anulado')::boolean, false) or v_res ->> 'aviso' is not null
       or (v_res -> 'cargo' ->> 'id')::uuid is distinct from v_cargo or (v_res -> 'cargo' ->> 'monto')::bigint <> 130000 then
      raise exception 'FALLO N96c: la devolución completa respondió %', v_res;
    end if;
    -- El reenvío del formulario vuelve con la misma respuesta y no devuelve otra vez.
    v_res := public.devolver_uniforme(v_clave_final, v_entrega, '1', 'Ya no lo necesita', null);
    if not coalesce((v_res ->> 'repetida')::boolean, false) or not coalesce((v_res -> 'cargo' ->> 'anulado')::boolean, false) then
      raise exception 'FALLO N96d: el reenvío respondió %', v_res;
    end if;
    execute 'reset role';
    select c.anulado_el::text || '|' || c.anulado_por::text || '|' || c.anulacion_motivo into v_texto from public.cargos c where c.id = v_cargo;
    if v_texto is distinct from app.hoy()::text || '|' || v_rosa::text || '|Devolución del uniforme' then
      raise exception 'FALLO N96e: sello del cargo %', v_texto;
    end if;
    select coalesce(sum(pendiente), 0) into v_despues from public.v_saldos_de_cargo where estudiante_id = v_alumno_1;
    if v_despues <> v_antes - 130000 then raise exception 'FALLO N96f: lo que debe pasó de % a % (esperado -130000)', v_antes, v_despues; end if;
    select count(*) into v_n from public.v_saldos_de_cargo where id = v_cargo and estado = 'anulado' and pendiente = 0;
    if v_n <> 1 then raise exception 'FALLO N96g: el cargo no figura anulado en los saldos'; end if;
    v_ok := v_ok + 1;

    -- N97 · devolución completa de un uniforme cobrado: el cargo sigue vigente y la respuesta pide anular el cobro
    perform set_config('request.jwt.claims', json_build_object('sub', v_carla, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    perform public.entregar_uniforme(gen_random_uuid(), v_ins_2, v_la_paz, 'inscripcion', null,
      jsonb_build_array(jsonb_build_object('variante', v_s, 'cantidad', '1')), true, '{"medio":"efectivo"}'::jsonb);
    select en.id into v_entrega from public.entregas en where en.inscripcion_id = v_ins_2;
    select c.id into v_cargo from public.cargos c where c.entrega_id = v_entrega and c.anulado_en is null;
    v_res := public.devolver_uniforme(gen_random_uuid(), v_entrega, '1', 'Se retira del curso', null);
    if v_res ->> 'aviso' is distinct from 'anula_el_cobro' or coalesce((v_res -> 'cargo' ->> 'anulado')::boolean, true)
       or (v_res -> 'cargo' ->> 'id')::uuid is distinct from v_cargo or (v_res -> 'cargo' ->> 'monto')::bigint <> 65000 then
      raise exception 'FALLO N97a: respondió %', v_res;
    end if;
    execute 'reset role';
    select count(*) into v_n from public.v_saldos_de_cargo where id = v_cargo and estado = 'pagado';
    if v_n <> 1 then raise exception 'FALLO N97b: el cargo cobrado no sigue vigente y pagado'; end if;
    select count(*) into v_n from public.entregas where id = v_entrega and devuelta = 1;
    if v_n <> 1 then raise exception 'FALLO N97c: la pieza no volvió'; end if;
    v_ok := v_ok + 1;

    -- N98 · el cambio de talla no toca el cargo (ni avisa)
    perform set_config('request.jwt.claims', json_build_object('sub', v_carla, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    perform public.entregar_uniforme(gen_random_uuid(), v_ins_3, v_la_paz, 'inscripcion', null,
      jsonb_build_array(jsonb_build_object('variante', v_l, 'cantidad', '1')), true, null);
    select en.id into v_entrega from public.entregas en where en.inscripcion_id = v_ins_3;
    select c.id into v_cargo from public.cargos c where c.entrega_id = v_entrega and c.anulado_en is null;
    v_res := public.devolver_uniforme(gen_random_uuid(), v_entrega, '1', 'Le queda grande', v_m);
    if jsonb_typeof(v_res -> 'cargo') is distinct from 'null' or v_res ->> 'aviso' is not null or v_res ->> 'nueva_entrega' is null then
      raise exception 'FALLO N98a: respondió %', v_res;
    end if;
    execute 'reset role';
    select count(*) into v_n from public.v_saldos_de_cargo where id = v_cargo and estado = 'pendiente' and pendiente = 65000;
    if v_n <> 1 then raise exception 'FALLO N98b: el cambio de talla tocó el cargo'; end if;
    select count(*) into v_n from public.cargos where estudiante_id = v_alumno_3 and anulado_en is null;
    if v_n <> 1 then raise exception 'FALLO N98c: el cambio de talla cobró otra vez (% cargos)', v_n; end if;
    v_ok := v_ok + 1;

    -- N99 · la cadena de cambios de talla cuenta: de dos piezas cargadas sin cobro, una cambia de talla y la otra
    --       vuelve sin cambio → el alumno sigue con la pieza cambiada: el cargo sigue y se avisa la parcial
    perform set_config('request.jwt.claims', json_build_object('sub', v_carla, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    perform public.registrar_compra(gen_random_uuid(), v_la_paz, null, null, null, null, 'transferencia', 'TR-DB02-2', jsonb_build_array(
      jsonb_build_object('variante', v_s, 'cantidad', '5', 'costo_total', '150000'),
      jsonb_build_object('variante', v_m, 'cantidad', '5', 'costo_total', '150000'),
      jsonb_build_object('variante', v_l, 'cantidad', '5', 'costo_total', '150000')));
    v_res := public.inscribir(gen_random_uuid(), null, '{"nombres":"Cata","apellidos":"Cadena Cuatro"}'::jsonb, v_g, 'economico', null, null, null, null);
    v_alumno_4 := (v_res ->> 'estudiante')::uuid;
    v_ins_4 := (v_res ->> 'inscripcion')::uuid;
    v_res := public.inscribir(gen_random_uuid(), null, '{"nombres":"Lalo","apellidos":"Largo Cinco"}'::jsonb, v_g, 'economico', null, null, null, null);
    v_alumno_5 := (v_res ->> 'estudiante')::uuid;
    v_ins_5 := (v_res ->> 'inscripcion')::uuid;
    v_res := public.inscribir(gen_random_uuid(), null, '{"nombres":"Sole","apellidos":"Sigue Seis"}'::jsonb, v_g, 'economico', null, null, null, null);
    v_alumno_6 := (v_res ->> 'estudiante')::uuid;
    v_ins_6 := (v_res ->> 'inscripcion')::uuid;
    perform public.entregar_uniforme(gen_random_uuid(), v_ins_4, v_la_paz, 'inscripcion', null,
      jsonb_build_array(jsonb_build_object('variante', v_m, 'cantidad', '2')), true, null);
    select en.id into v_entrega from public.entregas en where en.inscripcion_id = v_ins_4;
    select c.id into v_cargo from public.cargos c where c.entrega_id = v_entrega and c.anulado_en is null;
    if v_cargo is null then raise exception 'FALLO N99: la entrega no creó su cargo'; end if;
    execute 'reset role';
    select coalesce(sum(pendiente), 0) into v_antes from public.v_saldos_de_cargo where estudiante_id = v_alumno_4;
    perform set_config('request.jwt.claims', json_build_object('sub', v_rosa, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    v_res := public.devolver_uniforme(gen_random_uuid(), v_entrega, '1', 'Le queda chica', v_l);
    v_cambio := (v_res ->> 'nueva_entrega')::uuid;
    if v_cambio is null or jsonb_typeof(v_res -> 'cargo') is distinct from 'null' then
      raise exception 'FALLO N99a: el cambio de talla respondió %', v_res;
    end if;
    v_res := public.devolver_uniforme(gen_random_uuid(), v_entrega, '1', 'Ya no necesita la otra', null);
    if v_res ->> 'aviso' is distinct from 'devolucion_parcial' or coalesce((v_res -> 'cargo' ->> 'anulado')::boolean, true)
       or (v_res -> 'cargo' ->> 'id')::uuid is distinct from v_cargo or (v_res -> 'cargo' ->> 'monto')::bigint <> 130000 then
      raise exception 'FALLO N99b: con la pieza cambiada todavía en su poder, la devolución respondió %', v_res;
    end if;
    execute 'reset role';
    select count(*) into v_n from public.v_saldos_de_cargo where id = v_cargo and estado = 'pendiente' and pendiente = 130000;
    if v_n <> 1 then raise exception 'FALLO N99c: el cargo no sigue vigente y pendiente por Bs 1300'; end if;
    select coalesce(sum(pendiente), 0) into v_despues from public.v_saldos_de_cargo where estudiante_id = v_alumno_4;
    if v_despues <> v_antes then raise exception 'FALLO N99d: lo que debe cambió (% → %)', v_antes, v_despues; end if;
    v_ok := v_ok + 1;

    -- N100 · cuando vuelve también la pieza cambiada (su fila no tiene cargo propio), se sella el cargo de la cadena
    perform set_config('request.jwt.claims', json_build_object('sub', v_rosa, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    v_res := public.devolver_uniforme(gen_random_uuid(), v_cambio, '1', 'Se retira del curso', null);
    if not coalesce((v_res -> 'cargo' ->> 'anulado')::boolean, false) or v_res ->> 'aviso' is not null
       or (v_res -> 'cargo' ->> 'id')::uuid is distinct from v_cargo or (v_res -> 'cargo' ->> 'monto')::bigint <> 130000 then
      raise exception 'FALLO N100a: la devolución de la pieza cambiada respondió %', v_res;
    end if;
    execute 'reset role';
    select count(*) into v_n from public.v_saldos_de_cargo where id = v_cargo and estado = 'anulado' and pendiente = 0;
    if v_n <> 1 then raise exception 'FALLO N100b: el cargo de la cadena no figura anulado'; end if;
    select coalesce(sum(pendiente), 0) into v_despues from public.v_saldos_de_cargo where estudiante_id = v_alumno_4;
    if v_despues <> v_antes - 130000 then raise exception 'FALLO N100c: lo que debe pasó de % a % (esperado -130000)', v_antes, v_despues; end if;
    v_ok := v_ok + 1;

    -- N101 · una pieza cargada sin cobro cambia de talla y vuelve entera la nueva: el cargo se sella
    perform set_config('request.jwt.claims', json_build_object('sub', v_carla, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    perform public.entregar_uniforme(gen_random_uuid(), v_ins_5, v_la_paz, 'inscripcion', null,
      jsonb_build_array(jsonb_build_object('variante', v_m, 'cantidad', '1')), true, null);
    select en.id into v_entrega from public.entregas en where en.inscripcion_id = v_ins_5;
    select c.id into v_cargo from public.cargos c where c.entrega_id = v_entrega and c.anulado_en is null;
    if v_cargo is null then raise exception 'FALLO N101: la entrega no creó su cargo'; end if;
    execute 'reset role';
    select coalesce(sum(pendiente), 0) into v_antes from public.v_saldos_de_cargo where estudiante_id = v_alumno_5;
    perform set_config('request.jwt.claims', json_build_object('sub', v_rosa, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    v_res := public.devolver_uniforme(gen_random_uuid(), v_entrega, '1', 'Le queda chica', v_l);
    v_cambio := (v_res ->> 'nueva_entrega')::uuid;
    v_res := public.devolver_uniforme(gen_random_uuid(), v_cambio, '1', 'Se retira del curso', null);
    if not coalesce((v_res -> 'cargo' ->> 'anulado')::boolean, false) or v_res ->> 'aviso' is not null
       or (v_res -> 'cargo' ->> 'id')::uuid is distinct from v_cargo or (v_res -> 'cargo' ->> 'monto')::bigint <> 65000 then
      raise exception 'FALLO N101a: la devolución de la talla nueva respondió %', v_res;
    end if;
    execute 'reset role';
    select count(*) into v_n from public.v_saldos_de_cargo where id = v_cargo and estado = 'anulado' and pendiente = 0;
    if v_n <> 1 then raise exception 'FALLO N101b: el cargo no figura anulado'; end if;
    select coalesce(sum(pendiente), 0) into v_despues from public.v_saldos_de_cargo where estudiante_id = v_alumno_5;
    if v_despues <> v_antes - 65000 then raise exception 'FALLO N101c: lo que debe pasó de % a % (esperado -65000)', v_antes, v_despues; end if;
    v_ok := v_ok + 1;

    -- N106 · dos cambios seguidos (M → L → S) de un uniforme cobrado: devolver la última talla llega al cargo de
    --        la primera entrega (la búsqueda recorre la cadena entera, no un solo paso) y pide anular el cobro
    perform set_config('request.jwt.claims', json_build_object('sub', v_carla, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    perform public.entregar_uniforme(gen_random_uuid(), v_ins_6, v_la_paz, 'inscripcion', null,
      jsonb_build_array(jsonb_build_object('variante', v_m, 'cantidad', '1')), true, '{"medio":"efectivo"}'::jsonb);
    select en.id into v_entrega from public.entregas en where en.inscripcion_id = v_ins_6;
    select c.id into v_cargo from public.cargos c where c.entrega_id = v_entrega and c.anulado_en is null;
    if v_cargo is null then raise exception 'FALLO N106: la entrega no creó su cargo'; end if;
    v_res := public.devolver_uniforme(gen_random_uuid(), v_entrega, '1', 'Le queda chica', v_l);
    v_cambio := (v_res ->> 'nueva_entrega')::uuid;
    v_res := public.devolver_uniforme(gen_random_uuid(), v_cambio, '1', 'Ahora le queda grande', v_s);
    v_cambio_2 := (v_res ->> 'nueva_entrega')::uuid;
    if v_cambio_2 is null or jsonb_typeof(v_res -> 'cargo') is distinct from 'null' or v_res ->> 'aviso' is not null then
      raise exception 'FALLO N106a: el segundo cambio de talla respondió %', v_res;
    end if;
    v_res := public.devolver_uniforme(gen_random_uuid(), v_cambio_2, '1', 'Se retira del curso', null);
    if v_res ->> 'aviso' is distinct from 'anula_el_cobro' or coalesce((v_res -> 'cargo' ->> 'anulado')::boolean, true)
       or (v_res -> 'cargo' ->> 'id')::uuid is distinct from v_cargo or (v_res -> 'cargo' ->> 'monto')::bigint <> 65000 then
      raise exception 'FALLO N106b: la devolución tras dos cambios respondió %', v_res;
    end if;
    execute 'reset role';
    select count(*) into v_n from public.v_saldos_de_cargo where id = v_cargo and estado = 'pagado';
    if v_n <> 1 then raise exception 'FALLO N106c: el cargo cobrado no sigue vigente y pagado'; end if;
    select count(*) into v_n from public.entregas where id in (v_entrega, v_cambio, v_cambio_2) and devuelta = cantidad;
    if v_n <> 3 then raise exception 'FALLO N106d: la cadena no quedó devuelta entera (% de 3 filas)', v_n; end if;
    v_ok := v_ok + 1;
    -- N107 · la cuenta de piezas baja por toda la cadena (nietos incluidos): de dos piezas cargadas sin cobro,
    --        una cambia M → L → S y la otra vuelve sin cambio → parcial; cuando vuelve la S, se sella
    perform set_config('request.jwt.claims', json_build_object('sub', v_carla, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    v_res := public.inscribir(gen_random_uuid(), null, '{"nombres":"Nico","apellidos":"Nieto Siete"}'::jsonb, v_g, 'economico', null, null, null, null);
    v_alumno_7 := (v_res ->> 'estudiante')::uuid;
    v_ins_7 := (v_res ->> 'inscripcion')::uuid;
    perform public.entregar_uniforme(gen_random_uuid(), v_ins_7, v_la_paz, 'inscripcion', null,
      jsonb_build_array(jsonb_build_object('variante', v_m, 'cantidad', '2')), true, null);
    select en.id into v_entrega from public.entregas en where en.inscripcion_id = v_ins_7;
    select c.id into v_cargo from public.cargos c where c.entrega_id = v_entrega and c.anulado_en is null;
    if v_cargo is null then raise exception 'FALLO N107: la entrega no creó su cargo'; end if;
    v_res := public.devolver_uniforme(gen_random_uuid(), v_entrega, '1', 'Le queda chica', v_l);
    v_cambio := (v_res ->> 'nueva_entrega')::uuid;
    v_res := public.devolver_uniforme(gen_random_uuid(), v_cambio, '1', 'Ahora le queda grande', v_s);
    v_cambio_2 := (v_res ->> 'nueva_entrega')::uuid;
    if v_cambio is null or v_cambio_2 is null then raise exception 'FALLO N107a: los cambios de talla respondieron %', v_res; end if;
    v_res := public.devolver_uniforme(gen_random_uuid(), v_entrega, '1', 'Ya no necesita la otra', null);
    if v_res ->> 'aviso' is distinct from 'devolucion_parcial' or coalesce((v_res -> 'cargo' ->> 'anulado')::boolean, true)
       or (v_res -> 'cargo' ->> 'id')::uuid is distinct from v_cargo or (v_res -> 'cargo' ->> 'monto')::bigint <> 130000 then
      raise exception 'FALLO N107b: con la talla S (nieta) todavía en su poder, la devolución respondió %', v_res;
    end if;
    execute 'reset role';
    select count(*) into v_n from public.v_saldos_de_cargo where id = v_cargo and estado = 'pendiente' and pendiente = 130000;
    if v_n <> 1 then raise exception 'FALLO N107c: el cargo no sigue pendiente por Bs 1300'; end if;
    perform set_config('request.jwt.claims', json_build_object('sub', v_carla, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    v_res := public.devolver_uniforme(gen_random_uuid(), v_cambio_2, '1', 'Se retira del curso', null);
    if not coalesce((v_res -> 'cargo' ->> 'anulado')::boolean, false) or v_res ->> 'aviso' is not null
       or (v_res -> 'cargo' ->> 'id')::uuid is distinct from v_cargo then
      raise exception 'FALLO N107d: la devolución de la nieta respondió %', v_res;
    end if;
    execute 'reset role';
    select count(*) into v_n from public.v_saldos_de_cargo where id = v_cargo and estado = 'anulado' and pendiente = 0;
    if v_n <> 1 then raise exception 'FALLO N107e: el cargo no figura anulado'; end if;
    v_ok := v_ok + 1;
  end;

  -- ============================================================ E5 · revisar los arqueos con diferencia
  declare
    v_caja jsonb;
    v_t0 jsonb;
    v_t1 jsonb;
    v_cierre uuid;
    v_cuadra uuid;
    v_texto text;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_carla, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    v_t0 := public.tablero_de_administracion(v_la_paz);
    -- Una venta en efectivo y un arqueo al que le faltan Bs 5.
    perform public.registrar_cobro(gen_random_uuid(), v_la_paz, null, 'efectivo', null, null, null,
      '{"concepto":"otro-ingreso","descripcion":"Recetario E5","monto":4000,"cliente":"Cliente E5"}'::jsonb, null);
    v_caja := public.caja_por_cerrar(v_la_paz);
    v_res := public.cerrar_caja(gen_random_uuid(), v_la_paz, (v_caja ->> 'esperado')::bigint - 500, 0, 'Faltó cambio E5',
      case when (v_caja ->> 'primer_arqueo')::boolean then 0 end);
    v_cierre := (v_res ->> 'cierre')::uuid;
    v_t1 := public.tablero_de_administracion(v_la_paz);

    -- N109 · el arqueo con diferencia queda por revisar y el aviso lo cuenta, con su sede
    if (v_t1 -> 'arqueos_con_diferencia' ->> 'cantidad')::int <> (v_t0 -> 'arqueos_con_diferencia' ->> 'cantidad')::int + 1
       or (v_t1 -> 'arqueos_con_diferencia' ->> 'sede')::uuid is distinct from v_la_paz then
      raise exception 'FALLO N109: %', v_t1 -> 'arqueos_con_diferencia';
    end if;
    v_ok := v_ok + 1;
    execute 'reset role';

    -- N110 · recepción no revisa; administración sí, con nota; el aviso deja de contarlo; una sola vez
    perform set_config('request.jwt.claims', json_build_object('sub', v_rosa, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    begin
      perform public.revisar_arqueo(gen_random_uuid(), v_cierre, 'Contó mal el cambio');
      raise exception 'FALLO N110a: recepción revisó un arqueo';
    exception when insufficient_privilege then null;
    end;
    execute 'reset role';
    perform set_config('request.jwt.claims', json_build_object('sub', v_carla, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    begin
      perform public.revisar_arqueo(gen_random_uuid(), v_cierre, '  ');
      raise exception 'FALLO N110b: revisó sin nota';
    exception when others then
      if sqlerrm <> 'nota_requerida' then raise exception 'FALLO N110b: %', sqlerrm; end if;
    end;
    v_res := public.revisar_arqueo(gen_random_uuid(), v_cierre, 'Se dio mal un cambio; se habló con la cajera');
    v_t1 := public.tablero_de_administracion(v_la_paz);
    if (v_t1 -> 'arqueos_con_diferencia' ->> 'cantidad')::int <> (v_t0 -> 'arqueos_con_diferencia' ->> 'cantidad')::int then
      raise exception 'FALLO N110c: el arqueo revisado sigue en el aviso %', v_t1 -> 'arqueos_con_diferencia';
    end if;
    begin
      perform public.revisar_arqueo(gen_random_uuid(), v_cierre, 'Otra vez');
      raise exception 'FALLO N110d: revisó dos veces';
    exception when others then
      if sqlerrm <> 'ya_revisado' then raise exception 'FALLO N110d: %', sqlerrm; end if;
    end;
    execute 'reset role';
    select c.revisado_por::text || '|' || c.revision_nota || '|' || c.diferencia into v_texto from public.cierres_de_caja c where c.id = v_cierre;
    if v_texto is distinct from v_carla::text || '|Se dio mal un cambio; se habló con la cajera|-500' then
      raise exception 'FALLO N110e: %', v_texto;
    end if;
    v_ok := v_ok + 1;

    -- N111 · un arqueo que cuadró no se revisa
    perform set_config('request.jwt.claims', json_build_object('sub', v_carla, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    perform public.registrar_cobro(gen_random_uuid(), v_la_paz, null, 'efectivo', null, null, null,
      '{"concepto":"otro-ingreso","descripcion":"Recetario E5 dos","monto":3000,"cliente":"Cliente E5"}'::jsonb, null);
    v_caja := public.caja_por_cerrar(v_la_paz);
    v_res := public.cerrar_caja(gen_random_uuid(), v_la_paz, (v_caja ->> 'esperado')::bigint, 0, null, null);
    v_cuadra := (v_res ->> 'cierre')::uuid;
    begin
      perform public.revisar_arqueo(gen_random_uuid(), v_cuadra, 'No hacía falta');
      raise exception 'FALLO N111: revisó un arqueo que cuadró';
    exception when others then
      if sqlerrm <> 'arqueo_sin_diferencia' then raise exception 'FALLO N111: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    -- N112 · nadie escribe el sello por la API, y el sello no se cambia (ni siquiera postgres)
    begin
      update public.cierres_de_caja set revision_nota = 'Cambiada por la API' where id = v_cierre;
      raise exception 'FALLO N112a: se escribió el sello por la API';
    exception when insufficient_privilege then null;
    end;
    execute 'reset role';
    begin
      update public.cierres_de_caja set revision_nota = 'Cambiada después' where id = v_cierre;
      raise exception 'FALLO N112b: se cambió la nota de revisión';
    exception when others then
      if sqlerrm <> 'libro_inmutable' then raise exception 'FALLO N112b: %', sqlerrm; end if;
    end;
    begin
      update public.cierres_de_caja set contado = contado + 1 where id = v_cierre;
      raise exception 'FALLO N112c: se cambió lo contado';
    exception when others then
      if sqlerrm <> 'libro_inmutable' then raise exception 'FALLO N112c: %', sqlerrm; end if;
    end;
    v_ok := v_ok + 1;
  end;

  -- ============================================================ E5 · inscripciones por convocatoria (ADR 0009)
  declare
    v_hoy date := app.hoy();
    v_diego uuid;
    v_camila uuid;
    v_g1 uuid; v_g2 uuid; v_g3 uuid; v_g4 uuid; v_g5 uuid; v_g6 uuid; v_g7 uuid; v_g8 uuid; v_g10 uuid; v_g11 uuid;
    v_ficha uuid;
    v_sol uuid;
    v_oferta jsonb;
    v_mios jsonb;
    v_texto text;
    v_n integer;
  begin
    select id into v_diego from auth.users where email = 'diego.mamani@boliviagourmet.test';
    select id into v_camila from auth.users where email = 'camila.quispe@boliviagourmet.test';
    if v_diego is null or v_camila is null then raise exception 'FALLO P00: faltan Diego y Camila (datos-demo.sql)'; end if;

    -- Punto de partida conocido, pase lo que pase en la demo o antes en esta
    -- batería (N25 ya le dio a Valeria una ficha y una inscripción): Valeria,
    -- Diego y Camila sin ficha enlazada ni solicitudes abiertas.
    perform set_config('request.jwt.claims', '', true);
    update public.estudiantes set perfil_id = null where perfil_id in (v_valeria, v_diego, v_camila);
    delete from public.solicitudes where estudiante_id in (v_valeria, v_diego, v_camila) and estado in ('pendiente', 'en_revision');

    -- Grupos (administración): en convocatoria, sin abrir, planificado, lleno, de la carrera.
    perform set_config('request.jwt.claims', json_build_object('sub', v_carla, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    insert into public.cohortes (programa_codigo, sede_id, gestion, dias, duracion, fecha_inicio, fecha_fin, capacidad, estado, hora_inicio, hora_fin, inscripcion_desde, inscripcion_hasta)
    values ('cocina', v_la_paz, extract(year from v_hoy)::smallint, 'sab', 2, v_hoy + 7, v_hoy + 60, 20, 'abierto', '09:00', '13:00', v_hoy - 1, v_hoy + 10) returning id into v_g1;
    insert into public.cohortes (programa_codigo, sede_id, gestion, dias, duracion, fecha_inicio, fecha_fin, capacidad, estado, hora_inicio, hora_fin, inscripcion_desde, inscripcion_hasta)
    values ('tortas', v_la_paz, extract(year from v_hoy)::smallint, 'sab', 2, v_hoy + 7, v_hoy + 60, 20, 'abierto', '10:00', '12:00', v_hoy - 1, v_hoy + 10) returning id into v_g2;
    insert into public.cohortes (programa_codigo, sede_id, gestion, turno, dias, duracion, fecha_inicio, fecha_fin, estado, hora_inicio, hora_fin, inscripcion_desde, inscripcion_hasta)
    values ('reposteria-y-panaderia', v_la_paz, extract(year from v_hoy)::smallint, 'noche', 'lun-mie', 2, v_hoy + 7, v_hoy + 60, 'abierto', '18:00', '21:00', v_hoy, v_hoy) returning id into v_g3;
    insert into public.cohortes (programa_codigo, sede_id, gestion, dias, duracion, fecha_inicio, fecha_fin, estado, hora_inicio, hora_fin, inscripcion_desde, inscripcion_hasta)
    values ('cocteleria', v_la_paz, extract(year from v_hoy)::smallint, 'jue-vie', 1, v_hoy + 20, v_hoy + 50, 'abierto', '18:00', '20:00', v_hoy + 5, v_hoy + 15) returning id into v_g4;
    insert into public.cohortes (programa_codigo, sede_id, gestion, dias, duracion, fecha_inicio, fecha_fin, estado, hora_inicio, hora_fin, inscripcion_desde, inscripcion_hasta)
    values ('cocteleria', v_la_paz, extract(year from v_hoy)::smallint, 'sab', 1, v_hoy + 20, v_hoy + 50, 'planificado', '15:00', '17:00', v_hoy - 1, v_hoy + 10) returning id into v_g5;
    insert into public.cohortes (programa_codigo, sede_id, gestion, dias, duracion, fecha_inicio, fecha_fin, capacidad, estado, hora_inicio, hora_fin, inscripcion_desde, inscripcion_hasta)
    values ('cocteleria', v_la_paz, extract(year from v_hoy)::smallint, 'jue-vie', 1, v_hoy + 20, v_hoy + 50, 1, 'abierto', '18:00', '20:00', v_hoy - 1, v_hoy + 10) returning id into v_g6;
    perform public.inscribir(gen_random_uuid(), null, '{"nombres":"Lleno","apellidos":"Convocatoria Uno"}'::jsonb, v_g6, null, null, null, null, null);
    insert into public.cohortes (programa_codigo, sede_id, gestion, anio_de_carrera, turno, dias, duracion, fecha_inicio, estado, hora_inicio, hora_fin, inscripcion_desde, inscripcion_hasta)
    values ('gastronomia', v_la_paz, extract(year from v_hoy)::smallint, 2, 'noche', 'lun-vie', 3, v_hoy + 30, 'abierto', '18:00', '22:00', v_hoy - 1, v_hoy + 10) returning id into v_g7;
    insert into public.cohortes (programa_codigo, sede_id, gestion, anio_de_carrera, turno, dias, duracion, fecha_inicio, estado, hora_inicio, hora_fin)
    values ('gastronomia', v_la_paz, extract(year from v_hoy)::smallint, 1, 'noche', 'lun-vie', 3, v_hoy - 30, 'en_curso', '18:00', '22:00') returning id into v_g8;
    insert into public.cohortes (programa_codigo, sede_id, gestion, turno, dias, duracion, fecha_inicio, fecha_fin, estado, hora_inicio, hora_fin, inscripcion_desde, inscripcion_hasta)
    values ('reposteria-y-panaderia', v_la_paz, extract(year from v_hoy)::smallint, 'noche', 'lun-mie', 2, v_hoy + 7, v_hoy + 60, 'abierto', '19:00', '21:00', v_hoy - 1, v_hoy + 10) returning id into v_g10;
    insert into public.cohortes (programa_codigo, sede_id, gestion, dias, duracion, fecha_inicio, fecha_fin, estado, hora_inicio, hora_fin, inscripcion_desde, inscripcion_hasta)
    values ('tortas', v_la_paz, extract(year from v_hoy)::smallint, 'jue-vie', 2, v_hoy + 7, v_hoy + 60, 'abierto', '15:00', '17:00', v_hoy - 1, v_hoy + 10) returning id into v_g11;
    -- Diego cursa el 1.er año (G8); su cuenta queda vinculada a esa ficha.
    v_res := public.inscribir(gen_random_uuid(), null, '{"nombres":"Diego","apellidos":"Convocatoria Dos"}'::jsonb, v_g8, 'economico', null, null, null, null);
    v_ficha := (v_res ->> 'estudiante')::uuid;

    -- N126 · un plazo sin horario, o un horario que termina antes de empezar, no se guardan
    begin
      update public.cohortes set hora_inicio = null, hora_fin = null where id = v_g1;
      raise exception 'FALLO N126a: quedó un plazo sin horario';
    exception when check_violation then null;
    end;
    begin
      update public.cohortes set hora_fin = '08:00' where id = v_g1;
      raise exception 'FALLO N126b: un horario que termina antes de empezar';
    exception when check_violation then null;
    end;
    v_ok := v_ok + 1;
    execute 'reset role';
    update public.estudiantes set perfil_id = v_diego where id = v_ficha;

    perform set_config('request.jwt.claims', json_build_object('sub', v_valeria, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    -- N113 · transición (20261005130200): sin grupo todavía se pide, con las
    -- reglas de antes, porque el portal de hoy no elige grupo. Cuando el
    -- portal nuevo lo exija, este caso esperará «Elige un grupo con
    -- inscripciones abiertas.». El ensayo se deshace para no estorbar a N116.
    begin
      insert into public.solicitudes (tipo, programa_codigo, sede_id) values ('inscripcion', 'cocina', v_la_paz);
      raise exception using errcode = 'P0001', message = 'ensayo_revertido';
    exception when others then
      if sqlerrm <> 'ensayo_revertido' then raise exception 'FALLO N113: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    -- N114 · el grupo es del programa pedido
    begin
      insert into public.solicitudes (tipo, programa_codigo, sede_id, cohorte_id) values ('inscripcion', 'tortas', v_la_paz, v_g1);
      raise exception 'FALLO N114: grupo de otro programa';
    exception when check_violation then
      if sqlerrm <> 'El grupo elegido no es de ese programa.' then raise exception 'FALLO N114: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    -- N115 · plazo sin abrir y grupo planificado: no hay convocatoria
    begin
      insert into public.solicitudes (tipo, programa_codigo, sede_id, cohorte_id) values ('inscripcion', 'cocteleria', v_la_paz, v_g4);
      raise exception 'FALLO N115a: plazo sin abrir';
    exception when check_violation then
      if sqlerrm <> 'Las inscripciones de ese grupo no están abiertas.' then raise exception 'FALLO N115a: %', sqlerrm; end if;
    end;
    begin
      insert into public.solicitudes (tipo, programa_codigo, sede_id, cohorte_id) values ('inscripcion', 'cocteleria', v_la_paz, v_g5);
      raise exception 'FALLO N115b: grupo planificado';
    exception when check_violation then
      if sqlerrm <> 'Las inscripciones de ese grupo no están abiertas.' then raise exception 'FALLO N115b: %', sqlerrm; end if;
    end;
    v_ok := v_ok + 1;
    -- N116 · en convocatoria se pide; la sede y los días salen del grupo, no de lo enviado
    insert into public.solicitudes (tipo, programa_codigo, sede_id, dias, turno, cohorte_id)
    values ('inscripcion', 'cocina', v_el_alto, 'lun', 'manana', v_g1) returning id into v_sol;
    execute 'reset role';
    select s.sede_id::text || '|' || coalesce(s.dias, '') || '|' || coalesce(s.turno, '—') into v_texto from public.solicitudes s where s.id = v_sol;
    if v_texto is distinct from v_la_paz::text || '|sab|—' then raise exception 'FALLO N116: %', v_texto; end if;
    v_ok := v_ok + 1;
    perform set_config('request.jwt.claims', json_build_object('sub', v_valeria, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    -- N117 · se cruza con el grupo que ya pidió (sábados 10:00–12:00 dentro de 09:00–13:00)
    begin
      insert into public.solicitudes (tipo, programa_codigo, sede_id, cohorte_id) values ('inscripcion', 'tortas', v_la_paz, v_g2);
      raise exception 'FALLO N117: se cruza con lo que ya pidió';
    exception when check_violation then
      if sqlerrm not like 'Ese horario se cruza con el grupo que ya pediste: «Cocina%' then raise exception 'FALLO N117: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    -- N118 · otro día no se cruza; el último día del plazo todavía se pide
    insert into public.solicitudes (tipo, programa_codigo, sede_id, cohorte_id) values ('inscripcion', 'reposteria-y-panaderia', v_la_paz, v_g3);
    v_ok := v_ok + 1;
    -- N119 · un grupo lleno no se pide
    begin
      insert into public.solicitudes (tipo, programa_codigo, sede_id, cohorte_id) values ('inscripcion', 'cocteleria', v_la_paz, v_g6);
      raise exception 'FALLO N119: grupo lleno';
    exception when check_violation then
      if sqlerrm <> 'Ese grupo ya no tiene cupos.' then raise exception 'FALLO N119: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    -- N120 · la renovación es para la carrera
    begin
      insert into public.solicitudes (tipo, programa_codigo, sede_id, cohorte_id, gestion_anterior) values ('renovacion', 'tortas', v_la_paz, v_g11, 'Gestión 2026');
      raise exception 'FALLO N120: renovación de un curso';
    exception when check_violation then
      if sqlerrm <> 'La renovación es para la carrera.' then raise exception 'FALLO N120: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    -- N124 · la estudiante ve solo los grupos en convocatoria, sin datos de nadie
    v_oferta := public.oferta_abierta();
    select count(*) into v_n from jsonb_array_elements(v_oferta) g where (g ->> 'id')::uuid in (v_g1, v_g2, v_g3, v_g7, v_g10, v_g11);
    if v_n <> 6 then raise exception 'FALLO N124a: % de 6 grupos en convocatoria', v_n; end if;
    if exists (select 1 from jsonb_array_elements(v_oferta) g where (g ->> 'id')::uuid in (v_g4, v_g5, v_g6, v_g8)) then
      raise exception 'FALLO N124b: ofreció un grupo sin convocatoria';
    end if;
    if exists (select 1 from jsonb_array_elements(v_oferta) g where g ? 'inscritos')
       or (select g ->> 'hora_inicio' from jsonb_array_elements(v_oferta) g where (g ->> 'id')::uuid = v_g1) <> '09:00' then
      raise exception 'FALLO N124c: forma de la oferta %', (select g from jsonb_array_elements(v_oferta) g where (g ->> 'id')::uuid = v_g1);
    end if;
    execute 'reset role';
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    execute 'set local role anon';
    begin
      perform public.oferta_abierta();
      raise exception 'FALLO N124d: anon leyó la oferta';
    exception when insufficient_privilege then null;
    end;
    execute 'reset role';
    v_ok := v_ok + 1;

    -- Diego: cursa G8 (lun a vie 18:00–22:00).
    perform set_config('request.jwt.claims', json_build_object('sub', v_diego, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    -- N121 · se cruza con su curso vigente
    begin
      insert into public.solicitudes (tipo, programa_codigo, sede_id, cohorte_id) values ('inscripcion', 'reposteria-y-panaderia', v_la_paz, v_g10);
      raise exception 'FALLO N121: se cruza con su curso';
    exception when check_violation then
      if sqlerrm not like 'Ese horario se cruza con tu curso «Gastronomía%' then raise exception 'FALLO N121: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    -- N122 · renovar al 2.º año no choca con su propio 1.er año
    insert into public.solicitudes (tipo, programa_codigo, sede_id, cohorte_id, gestion_anterior) values ('renovacion', 'gastronomia', v_la_paz, v_g7, '1.er año · 2026') returning id into v_sol;
    v_ok := v_ok + 1;
    execute 'reset role';
    -- N123 · ya inscrito en ese grupo (se abre el plazo del 1.er año para probarlo)
    update public.cohortes set inscripcion_desde = v_hoy - 1, inscripcion_hasta = v_hoy + 1 where id = v_g8;
    perform set_config('request.jwt.claims', json_build_object('sub', v_diego, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    begin
      insert into public.solicitudes (tipo, programa_codigo, sede_id, cohorte_id, paquete) values ('inscripcion', 'gastronomia', v_la_paz, v_g8, 'economico');
      raise exception 'FALLO N123: se pidió un grupo en el que ya está';
    exception when unique_violation then
      if sqlerrm <> 'Ya estás inscrito en ese grupo.' then raise exception 'FALLO N123: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    -- N125 · cada estudiante lee solo lo suyo: Diego, su 1.er año y el grupo que pidió
    v_mios := public.mis_grupos();
    if jsonb_array_length(v_mios -> 'inscripciones') <> 1
       or (v_mios -> 'inscripciones' -> 0 -> 'grupo' ->> 'id')::uuid <> v_g8
       or (v_mios -> 'inscripciones' -> 0 ->> 'estado') <> 'inscrito'
       or not exists (select 1 from jsonb_array_elements(v_mios -> 'solicitudes') x where (x -> 'grupo' ->> 'id')::uuid = v_g7) then
      raise exception 'FALLO N125a: %', v_mios;
    end if;
    execute 'reset role';
    perform set_config('request.jwt.claims', json_build_object('sub', v_camila, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    v_mios := public.mis_grupos();
    if jsonb_array_length(v_mios -> 'inscripciones') <> 0 or jsonb_array_length(v_mios -> 'solicitudes') <> 0 then
      raise exception 'FALLO N125b: Camila ve lo de otros %', v_mios;
    end if;
    v_ok := v_ok + 1;

    -- N127 · por el portal, la carrera se empieza en el 1.er año (Camila no tiene nada abierto)
    begin
      insert into public.solicitudes (tipo, programa_codigo, sede_id, cohorte_id, paquete) values ('inscripcion', 'gastronomia', v_la_paz, v_g7, 'economico');
      raise exception 'FALLO N127: inscripción directa al 2.º año';
    exception when check_violation then
      if sqlerrm not like 'Por el portal, la carrera empieza en el 1.er año.%' then raise exception 'FALLO N127: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    -- N128 · la renovación es al 2.º o al 3.er año (el plazo del 1.er año sigue abierto desde N123)
    begin
      insert into public.solicitudes (tipo, programa_codigo, sede_id, cohorte_id, gestion_anterior) values ('renovacion', 'gastronomia', v_la_paz, v_g8, 'Gestión 2025');
      raise exception 'FALLO N128: renovación al 1.er año';
    exception when check_violation then
      if sqlerrm <> 'La renovación es para el 2.º o el 3.er año de la carrera.' then raise exception 'FALLO N128: %', sqlerrm; end if;
      v_ok := v_ok + 1;
    end;
    execute 'reset role';
  end;

  raise exception 'OK · % pruebas superadas (todo revertido)', v_ok;
end;
$;
