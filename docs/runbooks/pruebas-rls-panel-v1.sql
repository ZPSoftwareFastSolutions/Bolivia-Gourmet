-- ============================================================================
-- Batería del panel interno v1 (crece con cada rebanada)
-- ----------------------------------------------------------------------------
-- Cómo se ejecuta: en el editor SQL de Supabase (o con `execute_sql`). Corre
-- como `postgres`, simula sesiones con `set local role` + `request.jwt.claims`
-- y TERMINA LANZANDO UNA EXCEPCIÓN a propósito, para que la transacción se
-- revierta entera: no deja ninguna fila de prueba.
--
-- Requiere las cuentas de demostración (supabase/seed/datos-demo.sql):
-- Carla (administración), Rosa (recepción, La Paz) y Valeria (estudiante).
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

  raise exception 'OK · % pruebas superadas (todo revertido)', v_ok;
end;
$$;
