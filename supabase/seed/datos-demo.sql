-- ============================================================================
-- Datos de demostración del portal de estudiantes
-- ----------------------------------------------------------------------------
-- NO es una migración: las migraciones también corren en producción y esto
-- son datos de prueba. Se ejecuta a mano (editor SQL de Supabase o el
-- conector `execute_sql`) sobre la base de demostración.
--
-- Qué hace: convierte cuatro cuentas YA EXISTENTES en los escenarios de la
-- demo. El script no crea cuentas ni contraseñas: las cuentas las crea el
-- usuario en Authentication → Users → Add user → Create new user, con «Auto
-- Confirm User» marcado (no se envía correo).
--
--   Escenario          Qué verá en el portal
--   ─────────────────  ──────────────────────────────────────────────────────
--   estudiante nuevo   Panel vacío: hace su primera solicitud de inscripción.
--   quiere renovar     Inscripción a la carrera aprobada (gestión 2026, 1.er
--                      año); puede pedir la renovación.
--   tercer año         Inscripción 2024 y renovaciones 2025 y 2026 aprobadas:
--                      cursa el 3.er año de la carrera.
--   administración     Pasa a rol «administrador» y figura como quien aprobó.
--                      Aún no hay sistema interno donde entrar con ella.
--
-- El modelo todavía no tiene cohortes ni inscripciones (ADR 0004 pendiente):
-- el «año» del estudiante se deduce de su historial de solicitudes.
--
-- Cómo se cargan los datos: las solicitudes se insertan y se aprueban
-- simulando la sesión de cada cuenta (`set local role authenticated` +
-- `request.jwt.claims`), igual que la batería RLS. Así pasan por los mismos
-- disparadores que el portal, sin desactivar ninguno. Luego, como `postgres`,
-- se fechan en el pasado (created_at y revisado_en no los escribe el cliente).
--
-- Uso:
--   1. Cambiar los cuatro correos de la sección CONFIGURACIÓN (en el repositorio
--      quedan de ejemplo; no se versionan correos reales).
--   2. Ensayo: poner c_simular := true. Crea cuentas simuladas SIN contraseña con
--      esos correos, carga todo, comprueba y lo revierte terminando con
--      «OK · simulación…». No deja rastro.
--   3. Carga real: c_simular := false, con las cuentas ya creadas.
-- Es idempotente: si los datos ya están, se detiene sin cambiar nada.
-- ============================================================================

do $$
declare
  -- ------------------------------------------------------------ CONFIGURACIÓN
  c_simular        boolean := true;
  c_correo_nuevo   text := 'demo.nuevo@ejemplo.invalid';
  c_correo_renueva text := 'demo.renovacion@ejemplo.invalid';
  c_correo_tercero text := 'demo.tercero@ejemplo.invalid';
  c_correo_admin   text := 'demo.admin@ejemplo.invalid';
  -- ---------------------------------------------------------------------------
  v_nuevo uuid;
  v_renueva uuid;
  v_tercero uuid;
  v_admin uuid;
  v_la_paz uuid;
  v_el_alto uuid;
  v_sol uuid;
  v_n integer;
begin
  if c_simular then
    insert into auth.users (id, aud, role, email) values
      (gen_random_uuid(), 'authenticated', 'authenticated', c_correo_nuevo),
      (gen_random_uuid(), 'authenticated', 'authenticated', c_correo_renueva),
      (gen_random_uuid(), 'authenticated', 'authenticated', c_correo_tercero),
      (gen_random_uuid(), 'authenticated', 'authenticated', c_correo_admin);
  end if;

  -- ------------------------------------------------------------ cuentas
  select id into v_nuevo   from auth.users where lower(email) = lower(c_correo_nuevo);
  select id into v_renueva from auth.users where lower(email) = lower(c_correo_renueva);
  select id into v_tercero from auth.users where lower(email) = lower(c_correo_tercero);
  select id into v_admin   from auth.users where lower(email) = lower(c_correo_admin);

  if v_nuevo is null or v_renueva is null or v_tercero is null or v_admin is null then
    raise exception 'Falta alguna cuenta (nuevo %, renovación %, tercer año %, administración %). Créalas en Authentication → Users → Add user.',
      v_nuevo is not null, v_renueva is not null, v_tercero is not null, v_admin is not null;
  end if;

  select count(distinct x) into v_n from unnest(array[v_nuevo, v_renueva, v_tercero, v_admin]) as x;
  if v_n <> 4 then
    raise exception 'Los cuatro correos deben ser de cuentas distintas.';
  end if;

  select count(*) into v_n from public.perfiles
  where id in (v_nuevo, v_renueva, v_tercero) and rol <> 'estudiante';
  if v_n > 0 then
    raise exception 'Una de las cuentas de estudiante tiene un rol de personal: revisa los correos.';
  end if;

  if exists (select 1 from public.solicitudes where estudiante_id in (v_nuevo, v_renueva, v_tercero)) then
    raise exception 'Los datos de demostración ya están cargados (estas cuentas tienen solicitudes). No se cambió nada.';
  end if;

  select id into v_la_paz  from public.sedes where codigo = 'la-paz';
  select id into v_el_alto from public.sedes where codigo = 'el-alto';

  -- ------------------------------------------------------------ perfiles (postgres, sin sesión)
  -- Solo se rellenan los nombres vacíos: si la cuenta se creó desde el portal,
  -- se respetan los que escribió el usuario.
  update public.perfiles set
    nombres = coalesce(nullif(nombres, ''), 'Valeria'),
    apellidos = coalesce(nullif(apellidos, ''), 'Choque Apaza'),
    sede_id = v_la_paz
  where id = v_nuevo;

  update public.perfiles set
    nombres = coalesce(nullif(nombres, ''), 'Diego'),
    apellidos = coalesce(nullif(apellidos, ''), 'Mamani Flores'),
    sede_id = v_la_paz
  where id = v_renueva;

  update public.perfiles set
    nombres = coalesce(nullif(nombres, ''), 'Camila'),
    apellidos = coalesce(nullif(apellidos, ''), 'Quispe Rojas'),
    sede_id = v_el_alto
  where id = v_tercero;

  update public.perfiles set
    rol = 'administrador',
    nombres = coalesce(nullif(nombres, ''), 'Administración'),
    apellidos = coalesce(nullif(apellidos, ''), 'Bolivia Gourmet'),
    sede_id = v_la_paz
  where id = v_admin;

  -- ------------------------------------------------------------ tercer año
  -- Inscripción 2024 (1.er año)
  perform set_config('request.jwt.claims', json_build_object('sub', v_tercero, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.solicitudes (tipo, programa_codigo, sede_id, turno, dias, duracion, paquete)
  values ('inscripcion', 'gastronomia', v_el_alto, 'manana', 'lun-vie', 3, 'economico')
  returning id into v_sol;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  update public.solicitudes set estado = 'aprobada',
    respuesta = 'Te damos la bienvenida a la carrera de Gastronomía. Primer año, gestión 2024.'
  where id = v_sol;
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  update public.solicitudes set created_at = '2024-01-15 10:20-04', revisado_en = '2024-01-17 09:05-04' where id = v_sol;

  -- Renovación 2025 (2.º año)
  perform set_config('request.jwt.claims', json_build_object('sub', v_tercero, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.solicitudes (tipo, programa_codigo, sede_id, turno, dias, duracion, paquete, gestion_anterior)
  values ('renovacion', 'gastronomia', v_el_alto, 'manana', 'lun-vie', 3, 'economico', 'Gestión 2024 · 1.er año')
  returning id into v_sol;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  update public.solicitudes set estado = 'aprobada',
    respuesta = 'Renovación aprobada: segundo año, gestión 2025.'
  where id = v_sol;
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  update public.solicitudes set created_at = '2025-01-13 16:40-04', revisado_en = '2025-01-14 11:30-04' where id = v_sol;

  -- Renovación 2026 (3.er año)
  perform set_config('request.jwt.claims', json_build_object('sub', v_tercero, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.solicitudes (tipo, programa_codigo, sede_id, turno, dias, duracion, paquete, gestion_anterior)
  values ('renovacion', 'gastronomia', v_el_alto, 'manana', 'lun-vie', 3, 'economico', 'Gestión 2025 · 2.º año')
  returning id into v_sol;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  update public.solicitudes set estado = 'aprobada',
    respuesta = 'Renovación aprobada: tercer año, gestión 2026.'
  where id = v_sol;
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  update public.solicitudes set created_at = '2026-01-12 15:10-04', revisado_en = '2026-01-13 10:00-04' where id = v_sol;

  -- ------------------------------------------------------------ quiere renovar
  -- Inscripción 2026 (1.er año) aprobada; la renovación la pide en la demo.
  perform set_config('request.jwt.claims', json_build_object('sub', v_renueva, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.solicitudes (tipo, programa_codigo, sede_id, turno, dias, duracion, paquete)
  values ('inscripcion', 'gastronomia', v_la_paz, 'noche', 'lun-vie', 3, 'economico')
  returning id into v_sol;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  update public.solicitudes set estado = 'aprobada',
    respuesta = 'Te damos la bienvenida a la carrera de Gastronomía. Primer año, gestión 2026.'
  where id = v_sol;
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  update public.solicitudes set created_at = '2026-01-19 11:45-04', revisado_en = '2026-01-21 09:30-04' where id = v_sol;

  -- ------------------------------------------------------------ comprobaciones
  select count(*) into v_n from public.solicitudes
  where estudiante_id = v_tercero and estado = 'aprobada' and revisado_por = v_admin;
  if v_n <> 3 then raise exception 'FALLO: tercer año con % solicitudes aprobadas', v_n; end if;

  select count(*) into v_n from public.solicitudes
  where estudiante_id = v_renueva and estado = 'aprobada' and revisado_por = v_admin;
  if v_n <> 1 then raise exception 'FALLO: renovación con % solicitudes aprobadas', v_n; end if;

  select count(*) into v_n from public.solicitudes where estudiante_id = v_nuevo;
  if v_n <> 0 then raise exception 'FALLO: el estudiante nuevo tiene % solicitudes', v_n; end if;

  perform 1 from public.perfiles where id = v_admin and rol = 'administrador';
  if not found then raise exception 'FALLO: la cuenta de administración no quedó como administrador'; end if;

  if c_simular then
    -- Ensayo de lo que se hará en vivo en la demo, con las mismas reglas que el portal.
    perform set_config('request.jwt.claims', json_build_object('sub', v_renueva, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    insert into public.solicitudes (tipo, programa_codigo, sede_id, turno, dias, duracion, gestion_anterior)
    values ('renovacion', 'gastronomia', v_la_paz, 'noche', 'lun-vie', 3, 'Gestión 2026 · 1.er año');
    select count(*) into v_n from public.solicitudes;
    if v_n <> 2 then raise exception 'FALLO: quien renueva ve % solicitudes (esperadas 2)', v_n; end if;
    execute 'reset role';

    perform set_config('request.jwt.claims', json_build_object('sub', v_nuevo, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    insert into public.solicitudes (tipo, programa_codigo, sede_id, turno, dias, duracion, paquete)
    values ('inscripcion', 'gastronomia', v_la_paz, 'tarde', 'lun-vie', 3, 'economico')
    returning id into v_sol;
    update public.solicitudes set estado = 'cancelada' where id = v_sol;
    select count(*) into v_n from public.solicitudes;
    if v_n <> 1 then raise exception 'FALLO: el estudiante nuevo ve % solicitudes (esperada 1)', v_n; end if;
    execute 'reset role';

    raise exception 'OK · simulación correcta: perfiles, 4 solicitudes aprobadas y flujos de la demo (todo revertido)';
  end if;
end;
$$;
