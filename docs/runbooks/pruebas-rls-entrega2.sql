-- ============================================================================
-- Batería RLS · entrega 2 (sedes, perfiles, permisos, programas, solicitudes)
-- ----------------------------------------------------------------------------
-- Cómo se ejecuta: pegar el bloque entero en el editor SQL de Supabase (o con
-- `execute_sql`). Corre como `postgres`, simula sesiones con
-- `set local role` + `request.jwt.claims`, y TERMINA LANZANDO UNA EXCEPCIÓN
-- a propósito: así la transacción se revierte entera y no queda ningún
-- usuario ni solicitud de prueba. Los usuarios de prueba no tienen
-- contraseña: no sirven para iniciar sesión, solo existen dentro del bloque.
--
-- Resultado esperado:  ERROR:  OK · N pruebas superadas (todo revertido)
-- Cualquier otro mensaje que empiece por «FALLO» indica qué regla se rompió.
-- ============================================================================

do $$
declare
  v_est1 uuid := gen_random_uuid();
  v_est2 uuid := gen_random_uuid();
  v_recep uuid := gen_random_uuid();
  v_admin uuid := gen_random_uuid();
  v_sede uuid;
  v_sol uuid;
  v_sol_ajena uuid;
  v_n integer;
  v_ok integer := 0;
  v_estado text;
  v_revisor uuid;
begin
  -- ------------------------------------------------------------ preparación (postgres)
  insert into auth.users (id, aud, role, email, raw_user_meta_data) values
    (v_est1, 'authenticated', 'authenticated', 'est1@prueba.invalid',
     '{"nombres":"Ana","apellidos":"Quispe","telefono":"777 12345","documento":"1234567-lp","rol":"administrador"}'),
    (v_est2, 'authenticated', 'authenticated', 'est2@prueba.invalid',
     '{"nombres":"Luis","apellidos":"Mamani","telefono":"123","documento":"x"}'),
    (v_recep, 'authenticated', 'authenticated', 'recep@prueba.invalid', '{"nombres":"Rosa"}'),
    (v_admin, 'authenticated', 'authenticated', 'admin@prueba.invalid', '{"nombres":"Carla"}');

  -- P01 · el alta crea el perfil SIEMPRE como estudiante, aunque los metadatos digan otra cosa
  select count(*) into v_n from public.perfiles
  where id in (v_est1, v_est2, v_recep, v_admin) and rol = 'estudiante';
  if v_n <> 4 then raise exception 'FALLO P01: el rol salió de los metadatos (%)', v_n; end if;
  v_ok := v_ok + 1;

  -- P02 · datos de contacto saneados: válidos se guardan normalizados, inválidos quedan vacíos
  perform 1 from public.perfiles where id = v_est1 and telefono = '77712345' and documento = '1234567-LP';
  if not found then raise exception 'FALLO P02a: no normalizó el teléfono o el documento válidos'; end if;
  perform 1 from public.perfiles where id = v_est2 and telefono is null and documento is null;
  if not found then raise exception 'FALLO P02b: guardó datos de contacto inválidos'; end if;
  v_ok := v_ok + 1;

  -- Roles del personal (como postgres, sin sesión: así se promueve al primer administrador)
  update public.perfiles set rol = 'recepcion' where id = v_recep;
  update public.perfiles set rol = 'administrador' where id = v_admin;
  select id into v_sede from public.sedes where codigo = 'la-paz';

  -- ------------------------------------------------------------ anónimo
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';

  select count(*) into v_n from public.sedes;
  if v_n <> 2 then raise exception 'FALLO A01: anon ve % sedes', v_n; end if;
  v_ok := v_ok + 1;

  select count(*) into v_n from public.programas;
  if v_n <> 6 then raise exception 'FALLO A02: anon ve % programas', v_n; end if;
  v_ok := v_ok + 1;

  begin
    perform 1 from public.perfiles limit 1;
    raise exception 'FALLO A03: anon pudo leer perfiles';
  exception when insufficient_privilege then v_ok := v_ok + 1;
  end;

  begin
    perform 1 from public.solicitudes limit 1;
    raise exception 'FALLO A04: anon pudo leer solicitudes';
  exception when insufficient_privilege then v_ok := v_ok + 1;
  end;

  begin
    insert into public.sedes (codigo, nombre, zona, direccion, telefono) values ('x', 'X', 'X', 'X', '70000000');
    raise exception 'FALLO A05: anon pudo crear una sede';
  exception when insufficient_privilege then v_ok := v_ok + 1;
  end;

  execute 'reset role';

  -- ------------------------------------------------------------ estudiante 1
  perform set_config('request.jwt.claims', json_build_object('sub', v_est1, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into v_n from public.perfiles;
  if v_n <> 1 then raise exception 'FALLO E01: el estudiante ve % perfiles', v_n; end if;
  v_ok := v_ok + 1;

  update public.perfiles set nombres = 'Ana María' where id = v_est1;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'FALLO E02: no pudo editar su nombre'; end if;
  v_ok := v_ok + 1;

  begin
    update public.perfiles set rol = 'administrador' where id = v_est1;
    raise exception 'FALLO E03: el estudiante se asignó un rol';
  exception when insufficient_privilege then v_ok := v_ok + 1;
  end;

  update public.perfiles set nombres = 'Hackeado' where id = v_est2;
  get diagnostics v_n = row_count;
  if v_n <> 0 then raise exception 'FALLO E04: editó el perfil de otro estudiante'; end if;
  v_ok := v_ok + 1;

  begin
    update public.perfiles set correo = 'otro@prueba.invalid' where id = v_est1;
    raise exception 'FALLO E05: cambió su correo de perfil por la API';
  exception when insufficient_privilege then v_ok := v_ok + 1;
  end;

  insert into public.solicitudes (tipo, programa_codigo, sede_id, dias, duracion, mensaje)
  values ('inscripcion', 'cocina', v_sede, 'sab', 2, 'Quiero empezar en sábado')
  returning id, estado into v_sol, v_estado;
  if v_estado <> 'pendiente' then raise exception 'FALLO E06: estado inicial %', v_estado; end if;
  v_ok := v_ok + 1;

  begin
    insert into public.solicitudes (tipo, programa_codigo, sede_id, turno, dias, duracion)
    values ('inscripcion', 'gastronomia', v_sede, 'noche', 'lun-vie', 3);
    raise exception 'FALLO E07: inscripción a la carrera sin paquete';
  exception when check_violation then v_ok := v_ok + 1;
  end;

  begin
    insert into public.solicitudes (tipo, programa_codigo, sede_id, dias, duracion, paquete)
    values ('inscripcion', 'tortas', v_sede, 'sab', 2, 'economico');
    raise exception 'FALLO E08: un curso aceptó paquete';
  exception when check_violation then v_ok := v_ok + 1;
  end;

  begin
    insert into public.solicitudes (tipo, programa_codigo, sede_id, dias, duracion)
    values ('inscripcion', 'cocina', v_sede, 'jue-vie', 1);
    raise exception 'FALLO E09: aceptó una solicitud duplicada abierta';
  exception when unique_violation then v_ok := v_ok + 1;
  end;

  begin
    insert into public.solicitudes (estudiante_id, tipo, programa_codigo, sede_id)
    values (v_est2, 'inscripcion', 'tortas', v_sede);
    raise exception 'FALLO E10: creó una solicitud a nombre de otro';
  exception when insufficient_privilege then v_ok := v_ok + 1;
  end;

  begin
    insert into public.solicitudes (tipo, programa_codigo, sede_id, estado)
    values ('inscripcion', 'tortas', v_sede, 'aprobada');
    raise exception 'FALLO E11: fijó el estado inicial';
  exception when insufficient_privilege then v_ok := v_ok + 1;
  end;

  begin
    update public.solicitudes set estado = 'aprobada' where id = v_sol;
    raise exception 'FALLO E12: el estudiante aprobó su propia solicitud';
  exception when insufficient_privilege then v_ok := v_ok + 1;
  end;

  begin
    insert into public.solicitudes (tipo, programa_codigo, sede_id)
    values ('renovacion', 'tortas', v_sede);
    raise exception 'FALLO E13: renovación sin gestión anterior';
  exception when check_violation then v_ok := v_ok + 1;
  end;

  begin
    delete from public.solicitudes where id = v_sol;
    raise exception 'FALLO E14: pudo borrar una solicitud';
  exception when insufficient_privilege then v_ok := v_ok + 1;
  end;

  select count(*) into v_n from public.permisos_de_rol;
  if v_n <> 0 then raise exception 'FALLO E15: el estudiante tiene % permisos', v_n; end if;
  v_ok := v_ok + 1;

  execute 'reset role';

  -- ------------------------------------------------------------ estudiante 2
  perform set_config('request.jwt.claims', json_build_object('sub', v_est2, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into v_n from public.solicitudes;
  if v_n <> 0 then raise exception 'FALLO F01: ve solicitudes ajenas (%)', v_n; end if;
  v_ok := v_ok + 1;

  update public.solicitudes set estado = 'cancelada' where id = v_sol;
  get diagnostics v_n = row_count;
  if v_n <> 0 then raise exception 'FALLO F02: canceló una solicitud ajena'; end if;
  v_ok := v_ok + 1;

  insert into public.solicitudes (tipo, programa_codigo, sede_id, gestion_anterior, dias, duracion)
  values ('renovacion', 'tortas', v_sede, 'Gestión 2026', 'sab', 4)
  returning id into v_sol_ajena;
  v_ok := v_ok + 1;

  execute 'reset role';

  -- ------------------------------------------------------------ recepción
  perform set_config('request.jwt.claims', json_build_object('sub', v_recep, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into v_n from public.perfiles where id in (v_est1, v_est2, v_recep, v_admin);
  if v_n <> 4 then raise exception 'FALLO R01: recepción ve % perfiles', v_n; end if;
  v_ok := v_ok + 1;

  select count(*) into v_n from public.solicitudes where id in (v_sol, v_sol_ajena);
  if v_n <> 2 then raise exception 'FALLO R02: recepción ve % solicitudes', v_n; end if;
  v_ok := v_ok + 1;

  update public.solicitudes set estado = 'en_revision', respuesta = 'Te llamamos esta semana.' where id = v_sol;
  select estado::text, revisado_por into v_estado, v_revisor from public.solicitudes where id = v_sol;
  if v_estado <> 'en_revision' or v_revisor <> v_recep then
    raise exception 'FALLO R03: revisión no registrada (% / %)', v_estado, v_revisor;
  end if;
  v_ok := v_ok + 1;

  begin
    update public.solicitudes set estado = 'cancelada' where id = v_sol_ajena;
    raise exception 'FALLO R04: recepción canceló en nombre del estudiante';
  exception when check_violation then v_ok := v_ok + 1;
  end;

  update public.perfiles set rol = 'administrador' where id = v_est1;
  get diagnostics v_n = row_count;
  if v_n <> 0 then raise exception 'FALLO R05: recepción cambió el rol de otro'; end if;
  v_ok := v_ok + 1;

  begin
    update public.perfiles set rol = 'administrador' where id = v_recep;
    raise exception 'FALLO R06: recepción se ascendió a administrador';
  exception when insufficient_privilege then v_ok := v_ok + 1;
  end;

  execute 'reset role';

  -- ------------------------------------------------------------ estudiante 1 otra vez
  perform set_config('request.jwt.claims', json_build_object('sub', v_est1, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  begin
    update public.solicitudes set estado = 'cancelada' where id = v_sol;
    raise exception 'FALLO E16: canceló una solicitud que ya estaba en revisión';
  exception when insufficient_privilege then v_ok := v_ok + 1;
  end;

  -- Límite de abuso: con 5 abiertas, la sexta se rechaza.
  insert into public.solicitudes (tipo, programa_codigo, sede_id, dias, duracion) values ('inscripcion', 'cocteleria', v_sede, 'sab', 1);
  insert into public.solicitudes (tipo, programa_codigo, sede_id, dias, duracion) values ('inscripcion', 'tortas', v_sede, 'sab', 2);
  insert into public.solicitudes (tipo, programa_codigo, sede_id, turno, dias, duracion) values ('inscripcion', 'reposteria-y-panaderia', v_sede, 'manana', 'lun-mie', 4);
  insert into public.solicitudes (tipo, programa_codigo, sede_id, modalidad) values ('inscripcion', 'cursos-de-temporada', v_sede, 'virtual');
  begin
    insert into public.solicitudes (tipo, programa_codigo, sede_id, turno, dias, duracion, paquete)
    values ('inscripcion', 'gastronomia', v_sede, 'noche', 'lun-vie', 3, 'economico');
    raise exception 'FALLO E17: aceptó una sexta solicitud abierta';
  exception when program_limit_exceeded then v_ok := v_ok + 1;
  end;

  update public.solicitudes set estado = 'cancelada' where programa_codigo = 'cocteleria';
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'FALLO E18: no pudo cancelar su solicitud pendiente'; end if;
  v_ok := v_ok + 1;

  begin
    update public.solicitudes set estado = 'pendiente' where programa_codigo = 'cocteleria';
    raise exception 'FALLO E19: reabrió una solicitud cancelada';
  exception when check_violation then v_ok := v_ok + 1;
  end;

  execute 'reset role';

  -- ------------------------------------------------------------ administrador
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  update public.perfiles set rol = 'recepcion' where id = v_est2;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'FALLO D01: el administrador no pudo asignar un rol'; end if;
  v_ok := v_ok + 1;

  select count(*) into v_n from public.permisos_de_rol;
  if v_n <> 6 then raise exception 'FALLO D02: el administrador ve % permisos', v_n; end if;
  v_ok := v_ok + 1;

  begin
    update public.perfiles set rol = 'recepcion' where id = v_admin;
    raise exception 'FALLO D03: el único administrador se quitó el rol';
  exception when check_violation then v_ok := v_ok + 1;
  end;

  update public.solicitudes set estado = 'aprobada', respuesta = 'Bienvenida.' where id = v_sol;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'FALLO D04: el administrador no pudo aprobar'; end if;
  v_ok := v_ok + 1;

  execute 'reset role';

  raise exception 'OK · % pruebas superadas (todo revertido)', v_ok;
end;
$$;
