-- ============================================================================
-- Cuentas y datos de demostración (portal de estudiantes + personal)
-- ----------------------------------------------------------------------------
-- NO es una migración: las migraciones también corren en producción y esto
-- son datos de prueba. Se ejecuta a mano en el editor SQL de Supabase
-- (rol postgres) sobre la base de demostración.
--
-- Crea cinco cuentas FICTICIAS con correos del dominio reservado `.test`
-- (RFC 2606: nunca reciben correo), ya confirmadas, y su historial:
--
--   Cuenta               Rol            Escenario
--   ───────────────────  ─────────────  ─────────────────────────────────────
--   Carla Gutiérrez      administrador  Aprobó la carrera de Camila (3 gestiones)
--   Rosa Condori         recepcion      Aprobó la inscripción de Diego
--   Valeria Choque       estudiante     Nueva: panel vacío, hace su primera solicitud
--   Diego Mamani         estudiante     1.er año (gestión 2026) aprobado: pide su renovación
--   Camila Quispe        estudiante     3.er año: inscripción 2024 + renovaciones 2025 y 2026
--
-- Estas solicitudes son el historial de antes de las convocatorias (ADR 0009):
-- se cargan en modo mantenimiento, que no exige grupo. Los grupos, los
-- alumnos y la inscripción vigente de Diego los cargan después
-- `datos-panel-demo.sql` y `convocatorias-demo.sql`.
--
-- Cómo se cargan las solicitudes: simulando la sesión de cada cuenta
-- (`set local role authenticated` + `request.jwt.claims`), como la batería
-- RLS. Pasan por los mismos disparadores y políticas que el portal, sin
-- desactivar ninguno. Después, como postgres, se fechan en el pasado.
--
-- LA CONTRASEÑA NO SE VERSIONA (el repositorio es público). Uso:
--   - Ensayo (c_simular := true): crea todo dentro de la transacción, comprueba
--     también los flujos de la demo y lo revierte terminando con
--     «OK · simulación…». No deja rastro.
--   - Carga real: escribir la contraseña en c_clave y poner c_simular := false.
--     La copia lista para pegar se genera aparte en `datos-demo.local.sql`
--     (ignorada por git).
-- Es idempotente: si los datos ya están, se detiene sin cambiar nada.
-- Para volver a empezar: `borrar-datos-demo.sql` y luego este script.
--
-- ANTES DE PRODUCCIÓN: borrar estas cuentas (la del administrador tiene una
-- contraseña conocida).
-- ============================================================================

do $$
declare
  -- ------------------------------------------------------------ CONFIGURACIÓN
  c_simular boolean := true;
  c_clave   text := '';                    -- contraseña común de las cuentas de demostración
  c_dominio text := 'boliviagourmet.test';
  -- ---------------------------------------------------------------------------
  v_clave text;
  v_correo text;
  v_id uuid;
  v_admin uuid;
  v_recep uuid;
  v_nuevo uuid;
  v_renueva uuid;
  v_tercero uuid;
  v_la_paz uuid;
  v_el_alto uuid;
  v_sol uuid;
  v_g_renovacion uuid;
  v_g_nuevo uuid;
  v_n integer;
  r record;
  s record;
begin
  if c_simular then
    v_clave := coalesce(nullif(c_clave, ''), 'Simulacion' || floor(random() * 1e6)::text);
  else
    if char_length(c_clave) < 10 or c_clave !~ '[A-Za-z]' or c_clave !~ '[0-9]' then
      raise exception 'Escribe en c_clave una contraseña de 10 o más caracteres con letras y números.';
    end if;
    v_clave := c_clave;
  end if;

  select id into v_la_paz  from public.sedes where codigo = 'la-paz';
  select id into v_el_alto from public.sedes where codigo = 'el-alto';

  -- ------------------------------------------------------------ cuentas y perfiles (postgres, sin sesión)
  perform set_config('request.jwt.claims', '', true);

  for r in
    select * from (values
      (1, 'carla.gutierrez', 'Carla',   'Gutiérrez Vargas', 'administrador'::public.rol_de_usuario, 'la-paz'),
      (2, 'rosa.condori',    'Rosa',    'Condori Limachi',  'recepcion',  'la-paz'),
      (3, 'valeria.choque',  'Valeria', 'Choque Apaza',     'estudiante', 'la-paz'),
      (4, 'diego.mamani',    'Diego',   'Mamani Flores',    'estudiante', 'la-paz'),
      (5, 'camila.quispe',   'Camila',  'Quispe Rojas',     'estudiante', 'el-alto')
    ) as t(orden, usuario, nombres, apellidos, rol, sede)
    order by orden
  loop
    v_correo := r.usuario || '@' || c_dominio;
    select id into v_id from auth.users where lower(email) = v_correo;

    if v_id is null then
      v_id := gen_random_uuid();
      -- Las cuatro columnas de token sin valor por defecto van en '' y no en
      -- NULL: con NULL, Supabase Auth falla al iniciar sesión
      -- («Database error querying schema»).
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
      ) values (
        '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_correo,
        extensions.crypt(v_clave, extensions.gen_salt('bf', 10)), now(),
        '', '', '', '',
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('nombres', r.nombres, 'apellidos', r.apellidos),
        now(), now()
      );
      -- La identidad de correo que también crea el panel de Supabase.
      insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
      values (
        v_id::text, v_id,
        jsonb_build_object('sub', v_id::text, 'email', v_correo, 'email_verified', true, 'phone_verified', false),
        'email', now(), now()
      );
    end if;

    -- El disparador de alta creó el perfil como estudiante; el rol del
    -- personal se asigna aquí, sin sesión, como se promueve a un administrador.
    update public.perfiles set
      rol = r.rol,
      nombres = coalesce(nullif(nombres, ''), r.nombres),
      apellidos = coalesce(nullif(apellidos, ''), r.apellidos),
      sede_id = case r.sede when 'el-alto' then v_el_alto else v_la_paz end
    where id = v_id;

    case r.orden
      when 1 then v_admin := v_id;
      when 2 then v_recep := v_id;
      when 3 then v_nuevo := v_id;
      when 4 then v_renueva := v_id;
      else v_tercero := v_id;
    end case;
  end loop;

  if exists (select 1 from public.solicitudes where estudiante_id in (v_nuevo, v_renueva, v_tercero)) then
    raise exception 'Los datos de demostración ya están cargados (las cuentas tienen solicitudes). No se cambió nada.';
  end if;

  -- ------------------------------------------------------------ historial de solicitudes
  -- En orden: Camila no puede pedir la renovación 2026 mientras la de 2025
  -- siga abierta (una abierta por programa y tipo).
  for s in
    select * from (values
      (1, v_tercero, v_admin, 'inscripcion'::public.tipo_de_solicitud, v_el_alto, 'manana', null::text,
          'Te damos la bienvenida a la carrera de Gastronomía. Primer año, gestión 2024.',
          timestamptz '2024-01-15 10:20-04', timestamptz '2024-01-17 09:05-04'),
      (2, v_tercero, v_admin, 'renovacion', v_el_alto, 'manana', 'Gestión 2024 · 1.er año',
          'Renovación aprobada: segundo año, gestión 2025.',
          '2025-01-13 16:40-04', '2025-01-14 11:30-04'),
      (3, v_tercero, v_admin, 'renovacion', v_el_alto, 'manana', 'Gestión 2025 · 2.º año',
          'Renovación aprobada: tercer año, gestión 2026.',
          '2026-01-12 15:10-04', '2026-01-13 10:00-04'),
      (4, v_renueva, v_recep, 'inscripcion', v_la_paz, 'noche', null,
          'Te damos la bienvenida a la carrera de Gastronomía. Primer año, gestión 2026.',
          '2026-01-19 11:45-04', '2026-01-21 09:30-04')
    ) as t(orden, estudiante, revisor, tipo, sede, turno, gestion_anterior, respuesta, creada, revisada)
    order by orden
  loop
    -- El estudiante la pide… (sin grupo: en modo mantenimiento, que solo
    -- honra el rol postgres, ADR 0009)
    perform set_config('request.jwt.claims', json_build_object('sub', s.estudiante, 'role', 'authenticated')::text, true);
    perform set_config('app.mantenimiento', 'si', true);
    execute 'set local role authenticated';
    insert into public.solicitudes (tipo, programa_codigo, sede_id, turno, dias, duracion, paquete, gestion_anterior)
    values (s.tipo, 'gastronomia', s.sede, s.turno, 'lun-vie', 3, 'economico', s.gestion_anterior)
    returning id into v_sol;
    execute 'reset role';
    perform set_config('app.mantenimiento', 'no', true);

    -- …el personal la aprueba (el disparador anota quién y cuándo)…
    perform set_config('request.jwt.claims', json_build_object('sub', s.revisor, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    update public.solicitudes set estado = 'aprobada', respuesta = s.respuesta where id = v_sol;
    execute 'reset role';

    -- …y se lleva a su fecha real.
    perform set_config('request.jwt.claims', '', true);
    update public.solicitudes set created_at = s.creada, revisado_en = s.revisada where id = v_sol;
  end loop;

  -- ------------------------------------------------------------ comprobaciones
  select count(*) into v_n
  from auth.users u
  join auth.identities i on i.user_id = u.id and i.provider = 'email'
  where u.id in (v_admin, v_recep, v_nuevo, v_renueva, v_tercero)
    and u.email_confirmed_at is not null
    and u.confirmation_token = '' and u.recovery_token = ''
    and u.email_change_token_new = '' and u.email_change = '';
  if v_n <> 5 then raise exception 'FALLO: % de 5 cuentas quedaron completas', v_n; end if;

  select count(*) into v_n from public.perfiles
  where (id = v_admin and rol = 'administrador')
     or (id = v_recep and rol = 'recepcion')
     or (id in (v_nuevo, v_renueva, v_tercero) and rol = 'estudiante');
  if v_n <> 5 then raise exception 'FALLO: % de 5 perfiles con el rol esperado', v_n; end if;

  select count(*) into v_n from public.solicitudes
  where estudiante_id = v_tercero and estado = 'aprobada' and revisado_por = v_admin;
  if v_n <> 3 then raise exception 'FALLO: Camila tiene % solicitudes aprobadas (esperadas 3)', v_n; end if;

  select count(*) into v_n from public.solicitudes
  where estudiante_id = v_renueva and estado = 'aprobada' and revisado_por = v_recep;
  if v_n <> 1 then raise exception 'FALLO: Diego tiene % solicitudes aprobadas (esperada 1)', v_n; end if;

  select count(*) into v_n from public.solicitudes where estudiante_id = v_nuevo;
  if v_n <> 0 then raise exception 'FALLO: Valeria tiene % solicitudes (esperadas 0)', v_n; end if;

  if c_simular then
    -- Ensayo de lo que se hará en vivo, con las mismas reglas que el portal.
    -- Desde el ADR 0009 se pide un grupo en convocatoria: se abren dos, como
    -- postgres y a nombre de Carla (sin sesión, `auth.uid()` es nulo).
    perform set_config('request.jwt.claims', '', true);
    insert into public.cohortes (programa_codigo, sede_id, gestion, anio_de_carrera, turno, dias, duracion, fecha_inicio, estado,
                                 hora_inicio, hora_fin, inscripcion_desde, inscripcion_hasta, registrado_por)
    values ('gastronomia', v_la_paz, extract(year from app.hoy())::integer + 1, 2, 'noche', 'lun-vie', 3,
            make_date(extract(year from app.hoy())::integer + 1, 2, 1), 'abierto', '18:00', '21:00', app.hoy() - 1, app.hoy() + 10, v_admin)
    returning id into v_g_renovacion;
    insert into public.cohortes (programa_codigo, sede_id, gestion, anio_de_carrera, turno, dias, duracion, fecha_inicio, estado,
                                 hora_inicio, hora_fin, inscripcion_desde, inscripcion_hasta, registrado_por)
    values ('gastronomia', v_la_paz, extract(year from app.hoy())::integer + 1, 1, 'tarde', 'lun-vie', 3,
            make_date(extract(year from app.hoy())::integer + 1, 2, 1), 'abierto', '15:00', '18:00', app.hoy() - 1, app.hoy() + 10, v_admin)
    returning id into v_g_nuevo;

    -- Diego pide su renovación.
    perform set_config('request.jwt.claims', json_build_object('sub', v_renueva, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    insert into public.solicitudes (tipo, programa_codigo, sede_id, cohorte_id, gestion_anterior)
    values ('renovacion', 'gastronomia', v_la_paz, v_g_renovacion, 'Gestión 2026 · 1.er año');
    select count(*) into v_n from public.solicitudes;
    if v_n <> 2 then raise exception 'FALLO: Diego ve % solicitudes (esperadas 2)', v_n; end if;
    execute 'reset role';

    -- Valeria se inscribe y cancela.
    perform set_config('request.jwt.claims', json_build_object('sub', v_nuevo, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    insert into public.solicitudes (tipo, programa_codigo, sede_id, cohorte_id, paquete)
    values ('inscripcion', 'gastronomia', v_la_paz, v_g_nuevo, 'economico')
    returning id into v_sol;
    update public.solicitudes set estado = 'cancelada' where id = v_sol;
    select count(*) into v_n from public.solicitudes;
    if v_n <> 1 then raise exception 'FALLO: Valeria ve % solicitudes (esperada 1)', v_n; end if;
    execute 'reset role';

    -- Camila solo ve lo suyo; recepción ve todo.
    perform set_config('request.jwt.claims', json_build_object('sub', v_tercero, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select count(*) into v_n from public.solicitudes;
    if v_n <> 3 then raise exception 'FALLO: Camila ve % solicitudes (esperadas 3)', v_n; end if;
    execute 'reset role';

    perform set_config('request.jwt.claims', json_build_object('sub', v_recep, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select count(*) into v_n from public.solicitudes where estudiante_id in (v_nuevo, v_renueva, v_tercero);
    if v_n <> 6 then raise exception 'FALLO: recepción ve % solicitudes de la demo (esperadas 6)', v_n; end if;
    execute 'reset role';

    raise exception 'OK · simulación correcta: 5 cuentas, roles, 4 solicitudes aprobadas y flujos de la demo (todo revertido)';
  end if;

  raise notice 'Datos de demostración cargados: 5 cuentas y 4 solicitudes aprobadas.';
end;
$$;
