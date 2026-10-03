-- ============================================================================
-- Datos de demostración del panel interno (sistema interno v1)
-- ----------------------------------------------------------------------------
-- NO es una migración: son datos de prueba. Se ejecuta a mano en el editor SQL
-- de Supabase (rol postgres) sobre la base de demostración, DESPUÉS de
-- `datos-demo.sql` (usa a Carla, administración, y a Rosa, recepción de La Paz).
--
-- TODO ES FICTICIO: alumnos, carnets, fechas de nacimiento, proveedores,
-- números de operación, costos de compra de insumos, uniformes y utensilios,
-- montos de alquiler, luz, gas y limpieza. Son valores de demostración, no
-- información del instituto. Los ÚNICOS precios confirmados que se usan son
-- el Paquete Económico de la carrera (Bs 650, un plan de 1 cuota con la nota
-- «Periodicidad por confirmar») y el juego de uniforme (Bs 650). Los cursos
-- de capacitación (Cocina, Tortas) van SIN plan de pagos: su precio es
-- «Consultar». Por eso el tablero los cuenta como «grupos sin precio», y la
-- pieza perdida en un préstamo, como «pérdida sin cargo»: es lo esperado.
-- No se guardan teléfonos ni correos de los alumnos (no hay rangos ficticios
-- seguros en Bolivia).
--
-- Qué crea: «viaja» por los últimos 56 días (hasta hoy) y registra lo que
-- haría el personal, día por día:
--   - Catálogo: 6 insumos (harina, huevos, leche, mantequilla, azúcar,
--     levadura), el juego de uniforme (tallas S, M, L, XL), 3 utensilios
--     (cuchillos, bol, batidor) y detergente; saldo inicial en las dos sedes.
--   - Grupos: Gastronomía 1.er año (noche) en La Paz y en El Alto y 2.º año
--     (tarde) en La Paz, con su plan; Cocina sábados (La Paz) y Tortas
--     sábados (El Alto) sin plan.
--   - 14 alumnos inscritos con ficha nueva; cobros por efectivo, QR y
--     transferencia; tres alumnos con cuota vencida (uno con pago parcial).
--   - Uniformes entregados con cargo y cobro (un cambio de talla; una alumna
--     de la carrera aún sin uniforme).
--   - Compras semanales de insumos (una anulada por duplicada), usos en las
--     clases de Cocina y Tortas y en una degustación (nunca en la carrera),
--     préstamos de utensilios al grupo de Cocina (una pieza perdida), un
--     préstamo atrasado a «Chef invitado», bajas por vencimiento y por
--     rotura y un conteo con un faltante pequeño.
--   - Gastos (alquiler por transferencia; luz, gas y limpieza en efectivo).
--   - Arqueos semanales de Rosa en La Paz (el último con −Bs 5 y su
--     observación) y quincenales de Carla en El Alto. Un cobro anulado.
-- Al final quedan, a propósito: cobros de HOY sin cerrar en La Paz («Caja
-- por cerrar»), efectivo de AYER sin arquear en El Alto, un préstamo
-- atrasado, un lote de leche vencido y otro por vencer, una alumna sin
-- uniforme, deudores con cuota vencida y dos existencias bajo el mínimo.
--
-- Cómo lo hace: todo pasa por las RPC reales del panel y por las escrituras
-- directas que la RLS permite (grupos, planes y estado del grupo, como Carla),
-- simulando la sesión de Carla o de Rosa (`set local role authenticated` +
-- `request.jwt.claims`), igual que la batería. Cada día fija
-- `app.hoy_simulada` en modo mantenimiento (`app.mantenimiento = 'si'`), que
-- solo honra `app.hoy()` para el rol postgres. OJO: en ese modo los
-- disparadores de inmutabilidad se saltan; los datos son válidos por
-- construcción (las RPC siguen validando todo lo demás).
-- Como todo ocurre en UNA transacción, `now()` es el mismo para todas las
-- filas; al cerrar cada día pasado, un bloque aparte lleva SOLO las marcas de
-- tiempo (registrado_en, cerrado_en, anulado_en, created_at) de las filas de
-- ese día a su fecha simulada, como `datos-demo.sql` fecha sus solicitudes.
-- Las de hoy conservan la hora real de la carga.
-- No toca las solicitudes del portal (las pendientes de Valeria y Diego las
-- necesita la batería).
--
-- Uso:
--   - Ensayo (c_simular := true): crea todo, comprueba el resultado y lo
--     revierte terminando con «OK · simulación: …». No deja rastro.
--   - Carga real: c_simular := false. Termina con un aviso (notice) con el
--     mismo resumen.
-- Todo es relativo al día de la carga: las clases caen en los sábados de esas
-- 8 semanas y el resultado es el mismo sea cual sea el día de la semana (se
-- ensayó con los siete).
-- Es idempotente: si ya existe el artículo «Harina de trigo», se detiene con
-- un aviso sin cambiar nada. Para volver a empezar: `borrar-datos-demo.sql`
-- (borra TODO el panel y las cuentas), luego `datos-demo.sql` y este script.
-- ============================================================================

do $$
declare
  -- ------------------------------------------------------------ CONFIGURACIÓN
  c_simular boolean := true;
  -- ---------------------------------------------------------------------------
  v_hoy date := (now() at time zone 'America/La_Paz')::date;
  v_inicio date;
  v_dia date;
  v_d integer;
  v_dow integer;
  v_paso text := 'inicio';
  v_error text;
  v_carla uuid;
  v_rosa uuid;
  v_jwt_carla text;
  v_jwt_rosa text;
  v_la_paz uuid;
  v_el_alto uuid;
  v_pendientes integer;
  v_res jsonb;
  v_caja jsonb;
  v_tablero jsonb;
  v_lineas jsonb;
  v_clave uuid;
  v_id uuid;
  v_lote uuid;
  v_cantidad numeric;
  v_cantidad_2 numeric;
  v_esperado bigint;
  v_contado bigint;
  v_retiro bigint;
  v_n integer;
  v_texto text;
  r record;
  -- catálogo (variantes)
  v_harina uuid;
  v_huevos uuid;
  v_leche uuid;
  v_mantequilla uuid;
  v_azucar uuid;
  v_levadura uuid;
  v_talla_s uuid;
  v_talla_m uuid;
  v_talla_l uuid;
  v_talla_xl uuid;
  v_cuchillos uuid;
  v_bol uuid;
  v_batidor uuid;
  v_detergente uuid;
  v_variantes uuid[];
  -- grupos
  v_anio smallint;
  v_inicio_carrera date;
  v_inicio_cocina date;
  v_inicio_tortas date;
  v_g_lp_1 uuid;
  v_g_ea_1 uuid;
  v_g_lp_2 uuid;
  v_g_cocina uuid;
  v_g_tortas uuid;
  v_clase_cocina integer := 0;
  v_clase_tortas integer := 0;
  -- conceptos de gasto
  v_c_alquiler uuid;
  v_c_servicios uuid;
  v_c_limpieza uuid;
  -- alumnos (ficha) e inscripciones
  e_luis uuid;
  i_luis uuid;
  e_mariela uuid;
  i_mariela uuid;
  e_jhonatan uuid;
  i_jhonatan uuid;
  e_wendy uuid;
  e_brayan uuid;
  i_brayan uuid;
  e_gabriela uuid;
  i_gabriela uuid;
  e_ruben uuid;
  i_ruben uuid;
  e_silvia uuid;
  i_silvia uuid;
  e_edwin uuid;
  i_edwin uuid;
  -- requisitos (INFORMACION-INSTITUTO.md §4 y §6)
  v_docs_carrera text[] := array['Fotocopia de carnet de identidad', 'Fotocopia del certificado de nacimiento',
                                 'Fotocopia del título de bachiller', '4 fotografías', 'Folder oficio con fastener'];
  v_docs_curso text[] := array['Fotocopia de carnet de identidad', 'Fotos 3x3 fondo celeste'];
  -- clases
  v_uso_cocina jsonb;
  v_uso_tortas jsonb;
begin
  -- ------------------------------------------------------------ precondiciones
  select u.id into v_carla
    from auth.users u join public.perfiles p on p.id = u.id
   where lower(u.email) = 'carla.gutierrez@boliviagourmet.test' and p.rol = 'administrador' and p.activo;
  select u.id into v_rosa
    from auth.users u join public.perfiles p on p.id = u.id join public.sedes s on s.id = p.sede_id
   where lower(u.email) = 'rosa.condori@boliviagourmet.test' and p.rol = 'recepcion' and p.activo and s.codigo = 'la-paz';
  if v_carla is null or v_rosa is null then
    raise exception 'Faltan las cuentas del personal de demostración (Carla, administración; Rosa, recepción de La Paz). Carga antes supabase/seed/datos-demo.sql.';
  end if;

  if exists (select 1 from public.articulos a where lower(a.nombre) = 'harina de trigo') then
    raise notice 'Los datos de demostración del panel ya están cargados (existe el artículo «Harina de trigo»). No se cambió nada.';
    return;
  end if;

  select id into v_la_paz from public.sedes where codigo = 'la-paz';
  select id into v_el_alto from public.sedes where codigo = 'el-alto';
  select id into v_c_alquiler from public.conceptos where codigo = 'alquiler';
  select id into v_c_servicios from public.conceptos where codigo = 'servicios-basicos';
  select id into v_c_limpieza from public.conceptos where codigo = 'limpieza';
  select count(*) into v_pendientes from public.solicitudes where estado in ('pendiente', 'en_revision');

  v_jwt_carla := json_build_object('sub', v_carla, 'role', 'authenticated')::text;
  v_jwt_rosa := json_build_object('sub', v_rosa, 'role', 'authenticated')::text;

  -- ------------------------------------------------------------ calendario
  -- Los últimos 56 días (8 semanas) hasta hoy. Las clases de los sábados caen
  -- en ventanas de semanas completas: siempre 7 de Cocina y 5 de Tortas.
  v_inicio := v_hoy - 56;
  v_inicio_carrera := make_date(extract(year from v_inicio)::integer, 2, 2);
  if v_inicio_carrera > v_inicio then
    v_inicio_carrera := v_inicio;
  end if;
  v_anio := extract(year from v_inicio_carrera)::smallint;
  v_inicio_cocina := (v_hoy - 49) + ((6 - extract(isodow from v_hoy - 49)::integer + 7) % 7);
  v_inicio_tortas := (v_hoy - 35) + ((6 - extract(isodow from v_hoy - 35)::integer + 7) % 7);

  v_uso_cocina := '[]'::jsonb;  -- se arma cuando existen las variantes
  perform set_config('app.mantenimiento', 'si', true);

  for v_d in -56 .. 0 loop
    v_dia := v_hoy + v_d;
    v_dow := extract(isodow from v_dia)::integer;
    perform set_config('app.hoy_simulada', v_dia::text, true);

    begin
      -- ======================================================== día −56: puesta en marcha
      if v_d = -56 then
        v_paso := 'catálogo';
        perform set_config('request.jwt.claims', v_jwt_carla, true);
        execute 'set local role authenticated';

        v_res := public.guardar_articulo(gen_random_uuid(), jsonb_build_object('nombre', 'Harina de trigo', 'tipo', 'insumo',
          'unidad', 'kg', 'icono', 'trigo', 'categoria', 'Secos', 'stock_minimo', '10'), null);
        select id into v_harina from public.variantes where articulo_id = (v_res ->> 'articulo')::uuid;
        v_res := public.guardar_articulo(gen_random_uuid(), jsonb_build_object('nombre', 'Huevos', 'tipo', 'insumo',
          'unidad', 'unidad', 'icono', 'huevo', 'categoria', 'Frescos', 'stock_minimo', '30'), null);
        select id into v_huevos from public.variantes where articulo_id = (v_res ->> 'articulo')::uuid;
        v_res := public.guardar_articulo(gen_random_uuid(), jsonb_build_object('nombre', 'Leche', 'tipo', 'insumo',
          'unidad', 'l', 'icono', 'lacteo', 'categoria', 'Lácteos', 'stock_minimo', '6', 'controla_vencimiento', 'true'), null);
        select id into v_leche from public.variantes where articulo_id = (v_res ->> 'articulo')::uuid;
        v_res := public.guardar_articulo(gen_random_uuid(), jsonb_build_object('nombre', 'Mantequilla', 'tipo', 'insumo',
          'unidad', 'kg', 'icono', 'lacteo', 'categoria', 'Lácteos', 'stock_minimo', '2', 'controla_vencimiento', 'true'), null);
        select id into v_mantequilla from public.variantes where articulo_id = (v_res ->> 'articulo')::uuid;
        v_res := public.guardar_articulo(gen_random_uuid(), jsonb_build_object('nombre', 'Azúcar', 'tipo', 'insumo',
          'unidad', 'kg', 'icono', 'plato', 'categoria', 'Secos', 'stock_minimo', '5'), null);
        select id into v_azucar from public.variantes where articulo_id = (v_res ->> 'articulo')::uuid;
        v_res := public.guardar_articulo(gen_random_uuid(), jsonb_build_object('nombre', 'Levadura', 'tipo', 'insumo',
          'unidad', 'paquete', 'icono', 'paquete', 'categoria', 'Secos', 'stock_minimo', '5', 'controla_vencimiento', 'true'), null);
        select id into v_levadura from public.variantes where articulo_id = (v_res ->> 'articulo')::uuid;
        v_res := public.guardar_articulo(gen_random_uuid(), jsonb_build_object('nombre', 'Juego de uniforme', 'tipo', 'uniforme',
          'icono', 'chaqueta', 'precio_venta', '65000', 'stock_minimo', '2'), array['S', 'M', 'L', 'XL']);
        select id into v_talla_s from public.variantes where articulo_id = (v_res ->> 'articulo')::uuid and etiqueta = 'S';
        select id into v_talla_m from public.variantes where articulo_id = (v_res ->> 'articulo')::uuid and etiqueta = 'M';
        select id into v_talla_l from public.variantes where articulo_id = (v_res ->> 'articulo')::uuid and etiqueta = 'L';
        select id into v_talla_xl from public.variantes where articulo_id = (v_res ->> 'articulo')::uuid and etiqueta = 'XL';
        v_res := public.guardar_articulo(gen_random_uuid(), jsonb_build_object('nombre', 'Juego de cuchillos', 'tipo', 'utensilio',
          'icono', 'cubiertos', 'categoria', 'Cocina', 'stock_minimo', '4'), null);
        select id into v_cuchillos from public.variantes where articulo_id = (v_res ->> 'articulo')::uuid;
        v_res := public.guardar_articulo(gen_random_uuid(), jsonb_build_object('nombre', 'Bol de acero', 'tipo', 'utensilio',
          'icono', 'bol', 'categoria', 'Cocina', 'stock_minimo', '4'), null);
        select id into v_bol from public.variantes where articulo_id = (v_res ->> 'articulo')::uuid;
        v_res := public.guardar_articulo(gen_random_uuid(), jsonb_build_object('nombre', 'Batidor', 'tipo', 'utensilio',
          'icono', 'batidor', 'categoria', 'Cocina', 'stock_minimo', '3'), null);
        select id into v_batidor from public.variantes where articulo_id = (v_res ->> 'articulo')::uuid;
        v_res := public.guardar_articulo(gen_random_uuid(), jsonb_build_object('nombre', 'Detergente', 'tipo', 'otro',
          'unidad', 'l', 'icono', 'paquete', 'categoria', 'Limpieza', 'stock_minimo', '2'), null);
        select id into v_detergente from public.variantes where articulo_id = (v_res ->> 'articulo')::uuid;
        v_variantes := array[v_harina, v_huevos, v_leche, v_mantequilla, v_azucar, v_levadura, v_talla_s, v_talla_m,
                             v_talla_l, v_talla_xl, v_cuchillos, v_bol, v_batidor, v_detergente];

        v_uso_cocina := jsonb_build_array(
          jsonb_build_object('variante', v_harina, 'cantidad', '3'),
          jsonb_build_object('variante', v_huevos, 'cantidad', '18'),
          jsonb_build_object('variante', v_leche, 'cantidad', '2'),
          jsonb_build_object('variante', v_mantequilla, 'cantidad', '0.5'),
          jsonb_build_object('variante', v_azucar, 'cantidad', '1'),
          jsonb_build_object('variante', v_levadura, 'cantidad', '1'));
        v_uso_tortas := jsonb_build_array(
          jsonb_build_object('variante', v_harina, 'cantidad', '2'),
          jsonb_build_object('variante', v_huevos, 'cantidad', '18'),
          jsonb_build_object('variante', v_azucar, 'cantidad', '1.5'),
          jsonb_build_object('variante', v_mantequilla, 'cantidad', '0.5'),
          jsonb_build_object('variante', v_leche, 'cantidad', '1'));

        v_paso := 'saldo inicial';
        perform public.registrar_saldo_inicial(gen_random_uuid(), v_la_paz, jsonb_build_array(
          jsonb_build_object('variante', v_harina, 'cantidad', '20', 'valor', '14000'),
          jsonb_build_object('variante', v_huevos, 'cantidad', '120', 'valor', '9600'),
          jsonb_build_object('variante', v_leche, 'cantidad', '8', 'valor', '5600', 'vence_el', v_hoy - 30),
          jsonb_build_object('variante', v_mantequilla, 'cantidad', '4', 'valor', '20000', 'vence_el', v_hoy + 25),
          jsonb_build_object('variante', v_azucar, 'cantidad', '25', 'valor', '20000'),
          jsonb_build_object('variante', v_levadura, 'cantidad', '10', 'valor', '10000', 'vence_el', v_hoy + 60),
          jsonb_build_object('variante', v_talla_s, 'cantidad', '3', 'valor', '96000'),
          jsonb_build_object('variante', v_talla_m, 'cantidad', '5', 'valor', '160000'),
          jsonb_build_object('variante', v_talla_l, 'cantidad', '5', 'valor', '160000'),
          jsonb_build_object('variante', v_talla_xl, 'cantidad', '2', 'valor', '64000'),
          jsonb_build_object('variante', v_cuchillos, 'cantidad', '6', 'valor', '108000'),
          jsonb_build_object('variante', v_bol, 'cantidad', '10', 'valor', '45000'),
          jsonb_build_object('variante', v_batidor, 'cantidad', '6', 'valor', '15000'),
          jsonb_build_object('variante', v_detergente, 'cantidad', '8', 'valor', '12000')));
        perform public.registrar_saldo_inicial(gen_random_uuid(), v_el_alto, jsonb_build_array(
          jsonb_build_object('variante', v_harina, 'cantidad', '25', 'valor', '17500'),
          jsonb_build_object('variante', v_huevos, 'cantidad', '60', 'valor', '4800'),
          jsonb_build_object('variante', v_leche, 'cantidad', '6', 'valor', '4200', 'vence_el', v_hoy + 20),
          jsonb_build_object('variante', v_mantequilla, 'cantidad', '3', 'valor', '15000', 'vence_el', v_hoy + 25),
          jsonb_build_object('variante', v_azucar, 'cantidad', '15', 'valor', '12000'),
          jsonb_build_object('variante', v_levadura, 'cantidad', '6', 'valor', '6000', 'vence_el', v_hoy + 60),
          jsonb_build_object('variante', v_talla_s, 'cantidad', '3', 'valor', '96000'),
          jsonb_build_object('variante', v_talla_m, 'cantidad', '3', 'valor', '96000'),
          jsonb_build_object('variante', v_talla_l, 'cantidad', '3', 'valor', '96000'),
          jsonb_build_object('variante', v_talla_xl, 'cantidad', '2', 'valor', '64000'),
          jsonb_build_object('variante', v_cuchillos, 'cantidad', '4', 'valor', '72000'),
          jsonb_build_object('variante', v_bol, 'cantidad', '6', 'valor', '27000'),
          jsonb_build_object('variante', v_batidor, 'cantidad', '4', 'valor', '10000'),
          jsonb_build_object('variante', v_detergente, 'cantidad', '4', 'valor', '6000')));

        -- Grupos y planes: escritura directa de administración (RLS).
        v_paso := 'grupos y planes';
        insert into public.cohortes (programa_codigo, sede_id, gestion, anio_de_carrera, turno, dias, duracion, fecha_inicio, capacidad, estado)
        values ('gastronomia', v_la_paz, v_anio, 1, 'noche', 'lun-vie', 3, v_inicio_carrera, 30, 'en_curso') returning id into v_g_lp_1;
        insert into public.cohortes (programa_codigo, sede_id, gestion, anio_de_carrera, turno, dias, duracion, fecha_inicio, capacidad, estado)
        values ('gastronomia', v_el_alto, v_anio, 1, 'noche', 'lun-vie', 3, v_inicio_carrera, 25, 'en_curso') returning id into v_g_ea_1;
        insert into public.cohortes (programa_codigo, sede_id, gestion, anio_de_carrera, turno, dias, duracion, fecha_inicio, capacidad, estado)
        values ('gastronomia', v_la_paz, v_anio, 2, 'tarde', 'lun-vie', 3, v_inicio_carrera, 30, 'en_curso') returning id into v_g_lp_2;
        insert into public.cohortes (programa_codigo, sede_id, gestion, dias, duracion, fecha_inicio, fecha_fin, capacidad, estado)
        values ('cocina', v_la_paz, extract(year from v_inicio_cocina)::smallint, 'sab', 2, v_inicio_cocina,
                (v_inicio_cocina + interval '2 months' - interval '1 day')::date, 15, 'abierto') returning id into v_g_cocina;
        insert into public.cohortes (programa_codigo, sede_id, gestion, dias, duracion, fecha_inicio, fecha_fin, capacidad, estado)
        values ('tortas', v_el_alto, extract(year from v_inicio_tortas)::smallint, 'sab', 2, v_inicio_tortas,
                (v_inicio_tortas + interval '2 months' - interval '1 day')::date, 12, 'abierto') returning id into v_g_tortas;
        insert into public.planes_de_pago (cohorte_id, paquete, monto_cuota, cuotas, primer_vencimiento, nota)
        select g, 'economico'::public.paquete_de_pago, 65000, 1, v_inicio + 14, 'Periodicidad por confirmar'
          from unnest(array[v_g_lp_1, v_g_ea_1, v_g_lp_2]) as g;
        execute 'reset role';

        v_paso := 'Luis (La Paz)';
        perform set_config('request.jwt.claims', v_jwt_rosa, true);
        execute 'set local role authenticated';
        v_res := public.inscribir(gen_random_uuid(), null, jsonb_build_object('nombres', 'Luis Fernando', 'apellidos', 'Mamani Quispe',
          'documento', '6845213', 'fecha_de_nacimiento', '2005-03-14'), v_g_lp_1, 'economico', v_docs_carrera, null, null, null);
        e_luis := (v_res ->> 'estudiante')::uuid;
        i_luis := (v_res ->> 'inscripcion')::uuid;
        perform public.registrar_cobro(gen_random_uuid(), v_la_paz, e_luis, 'efectivo', null, null, 65000, null, null);
        perform public.entregar_uniforme(gen_random_uuid(), i_luis, v_la_paz, 'inscripcion', null,
          jsonb_build_array(jsonb_build_object('variante', v_talla_m, 'cantidad', '1')), true, '{"medio":"efectivo"}'::jsonb);
        execute 'reset role';
      end if;

      -- ======================================================== día −55
      if v_d = -55 then
        v_paso := 'Mariela (La Paz)';
        perform set_config('request.jwt.claims', v_jwt_rosa, true);
        execute 'set local role authenticated';
        v_res := public.inscribir(gen_random_uuid(), null, jsonb_build_object('nombres', 'Mariela', 'apellidos', 'Choque Huanca',
          'documento', '7012458', 'fecha_de_nacimiento', '2006-07-22'), v_g_lp_1, 'economico', v_docs_carrera, null, null, null);
        e_mariela := (v_res ->> 'estudiante')::uuid;
        i_mariela := (v_res ->> 'inscripcion')::uuid;
        perform public.registrar_cobro(gen_random_uuid(), v_la_paz, e_mariela, 'qr', 'QR-7310452', null, 65000, null, null);
        perform public.entregar_uniforme(gen_random_uuid(), i_mariela, v_la_paz, 'inscripcion', null,
          jsonb_build_array(jsonb_build_object('variante', v_talla_s, 'cantidad', '1')), true,
          jsonb_build_object('medio', 'qr', 'referencia', 'QR-7310453'));
        execute 'reset role';

        v_paso := 'Rubén (El Alto)';
        perform set_config('request.jwt.claims', v_jwt_carla, true);
        execute 'set local role authenticated';
        v_res := public.inscribir(gen_random_uuid(), null, jsonb_build_object('nombres', 'Rubén', 'apellidos', 'Alanoca Poma',
          'documento', '8012345', 'fecha_de_nacimiento', '2005-12-12'), v_g_ea_1, 'economico', v_docs_carrera, null, null, null);
        e_ruben := (v_res ->> 'estudiante')::uuid;
        i_ruben := (v_res ->> 'inscripcion')::uuid;
        perform public.registrar_cobro(gen_random_uuid(), v_el_alto, e_ruben, 'efectivo', null, null, 65000, null, null);
        perform public.entregar_uniforme(gen_random_uuid(), i_ruben, v_el_alto, 'inscripcion', null,
          jsonb_build_array(jsonb_build_object('variante', v_talla_m, 'cantidad', '1')), true, '{"medio":"efectivo"}'::jsonb);
        execute 'reset role';
      end if;

      -- ======================================================== día −54
      if v_d = -54 then
        v_paso := 'Jhonatan (La Paz)';
        perform set_config('request.jwt.claims', v_jwt_rosa, true);
        execute 'set local role authenticated';
        v_res := public.inscribir(gen_random_uuid(), null, jsonb_build_object('nombres', 'Jhonatan', 'apellidos', 'Apaza Ticona',
          'documento', '6932147', 'fecha_de_nacimiento', '2004-11-02'), v_g_lp_1, 'economico',
          v_docs_carrera[1:3], null, 'Entregará las fotografías y el folder la próxima semana', null);
        e_jhonatan := (v_res ->> 'estudiante')::uuid;
        i_jhonatan := (v_res ->> 'inscripcion')::uuid;
        -- Paga el uniforme; la cuota del paquete queda pendiente (vencerá).
        perform public.entregar_uniforme(gen_random_uuid(), i_jhonatan, v_la_paz, 'inscripcion', null,
          jsonb_build_array(jsonb_build_object('variante', v_talla_l, 'cantidad', '1')), true, '{"medio":"efectivo"}'::jsonb);
        execute 'reset role';
      end if;

      -- ======================================================== día −53 (cobro anulado)
      if v_d = -53 then
        v_paso := 'Wendy y el cobro en la ficha equivocada';
        perform set_config('request.jwt.claims', v_jwt_rosa, true);
        execute 'set local role authenticated';
        v_res := public.inscribir(gen_random_uuid(), null, jsonb_build_object('nombres', 'Wendy Rocío', 'apellidos', 'Limachi Condori',
          'documento', '7124536', 'fecha_de_nacimiento', '2006-01-30'), v_g_lp_1, 'economico',
          array['Fotocopia de carnet de identidad', 'Fotocopia del certificado de nacimiento', '4 fotografías'], null, null, null);
        e_wendy := (v_res ->> 'estudiante')::uuid;
        -- Rosa registra el pago de Wendy en la ficha de Jhonatan por error…
        v_res := public.registrar_cobro(gen_random_uuid(), v_la_paz, e_jhonatan, 'efectivo', null, null, 65000, null, null);
        v_id := (v_res ->> 'pago')::uuid;
        -- …lo vuelve a registrar en la ficha correcta…
        perform public.registrar_cobro(gen_random_uuid(), v_la_paz, e_wendy, 'efectivo', null, null, 65000, null, null);
        v_paso := 'Patricia (Cocina)';
        perform public.inscribir(gen_random_uuid(), null, jsonb_build_object('nombres', 'Patricia', 'apellidos', 'Vargas Siñani',
          'documento', '6547891', 'fecha_de_nacimiento', '1998-08-17'), v_g_cocina, null, v_docs_curso, null, null, null);
        execute 'reset role';

        -- …y administración anula el cobro equivocado (recepción no anula).
        v_paso := 'anular el cobro equivocado';
        perform set_config('request.jwt.claims', v_jwt_carla, true);
        execute 'set local role authenticated';
        perform public.anular(gen_random_uuid(), 'cobro', v_id, 'Se registró en la ficha de otro alumno; el pago era de Wendy Limachi');
        execute 'reset role';
      end if;

      -- ======================================================== día −52
      if v_d = -52 then
        v_paso := 'Marco Antonio (Cocina)';
        perform set_config('request.jwt.claims', v_jwt_rosa, true);
        execute 'set local role authenticated';
        perform public.inscribir(gen_random_uuid(), null, jsonb_build_object('nombres', 'Marco Antonio', 'apellidos', 'Flores Rojas',
          'documento', '6698745', 'fecha_de_nacimiento', '1995-05-03'), v_g_cocina, null, v_docs_curso, null, null, null);
        execute 'reset role';

        v_paso := 'Silvia (El Alto)';
        perform set_config('request.jwt.claims', v_jwt_carla, true);
        execute 'set local role authenticated';
        v_res := public.inscribir(gen_random_uuid(), null, jsonb_build_object('nombres', 'Silvia', 'apellidos', 'Mamani Chura',
          'documento', '8123456', 'fecha_de_nacimiento', '2006-02-25'), v_g_ea_1, 'economico', v_docs_carrera, null, null, null);
        e_silvia := (v_res ->> 'estudiante')::uuid;
        i_silvia := (v_res ->> 'inscripcion')::uuid;
        -- Paga el uniforme por QR; la cuota queda pendiente (vencerá).
        perform public.entregar_uniforme(gen_random_uuid(), i_silvia, v_el_alto, 'inscripcion', null,
          jsonb_build_array(jsonb_build_object('variante', v_talla_s, 'cantidad', '1')), true,
          jsonb_build_object('medio', 'qr', 'referencia', 'QR-7310597'));
        execute 'reset role';
      end if;

      -- ======================================================== día −51
      if v_d = -51 then
        v_paso := 'Brayan (2.º año) y Carmen (Cocina)';
        perform set_config('request.jwt.claims', v_jwt_rosa, true);
        execute 'set local role authenticated';
        v_res := public.inscribir(gen_random_uuid(), null, jsonb_build_object('nombres', 'Brayan', 'apellidos', 'Copa Nina',
          'documento', '6758241', 'fecha_de_nacimiento', '2003-09-18'), v_g_lp_2, 'economico', v_docs_carrera, null, null, null);
        e_brayan := (v_res ->> 'estudiante')::uuid;
        i_brayan := (v_res ->> 'inscripcion')::uuid;
        perform public.entregar_uniforme(gen_random_uuid(), i_brayan, v_la_paz, 'inscripcion', null,
          jsonb_build_array(jsonb_build_object('variante', v_talla_xl, 'cantidad', '1')), true, '{"medio":"efectivo"}'::jsonb);
        -- Paga una parte de la cuota (el resto vencerá).
        perform public.registrar_cobro(gen_random_uuid(), v_la_paz, e_brayan, 'efectivo', null, null, 30000, null,
          'Pago a cuenta; completará el resto');
        perform public.inscribir(gen_random_uuid(), null, jsonb_build_object('nombres', 'Carmen', 'apellidos', 'Ticona Mamani',
          'documento', '6123987', 'fecha_de_nacimiento', '1990-10-21'), v_g_cocina, null, v_docs_curso, null, null, null);
        execute 'reset role';
      end if;

      -- ======================================================== día −50
      if v_d = -50 then
        v_paso := 'Gabriela (2.º año)';
        perform set_config('request.jwt.claims', v_jwt_rosa, true);
        execute 'set local role authenticated';
        v_res := public.inscribir(gen_random_uuid(), null, jsonb_build_object('nombres', 'Gabriela', 'apellidos', 'Tórrez Mendoza',
          'documento', '6981234', 'fecha_de_nacimiento', '2004-04-05'), v_g_lp_2, 'economico', v_docs_carrera, null, null, null);
        e_gabriela := (v_res ->> 'estudiante')::uuid;
        i_gabriela := (v_res ->> 'inscripcion')::uuid;
        perform public.registrar_cobro(gen_random_uuid(), v_la_paz, e_gabriela, 'qr', 'QR-7310611', null, 65000, null, null);
        perform public.entregar_uniforme(gen_random_uuid(), i_gabriela, v_la_paz, 'inscripcion', null,
          jsonb_build_array(jsonb_build_object('variante', v_talla_l, 'cantidad', '1')), true,
          jsonb_build_object('medio', 'transferencia', 'referencia', 'TRF-5521873'));
        execute 'reset role';

        v_paso := 'Edwin (El Alto) y alquiler de La Paz';
        perform set_config('request.jwt.claims', v_jwt_carla, true);
        execute 'set local role authenticated';
        v_res := public.inscribir(gen_random_uuid(), null, jsonb_build_object('nombres', 'Edwin', 'apellidos', 'Quispe Laura',
          'documento', '7845123', 'fecha_de_nacimiento', '2005-06-09'), v_g_ea_1, 'economico', v_docs_carrera, null, null, null);
        e_edwin := (v_res ->> 'estudiante')::uuid;
        i_edwin := (v_res ->> 'inscripcion')::uuid;
        perform public.registrar_cobro(gen_random_uuid(), v_el_alto, e_edwin, 'transferencia', 'TRF-5522014', null, 65000, null, null);
        perform public.registrar_gasto(gen_random_uuid(), v_la_paz, null, v_c_alquiler, 'Alquiler del local de La Paz', 450000,
          'transferencia', 'TRF-6609981', 'recibo', '0031', null);
        execute 'reset role';
      end if;

      -- ======================================================== compras semanales y gastos (administración)
      if v_d in (-49, -42, -38, -37, -35, -33, -28, -26, -25, -21, -20, -19, -14, -9, -7, -40, -39) then
        v_paso := 'compras y gastos';
        perform set_config('request.jwt.claims', v_jwt_carla, true);
        execute 'set local role authenticated';

        if v_d = -49 then
          perform public.registrar_compra(gen_random_uuid(), v_la_paz, v_dia, null, 'sin_comprobante', null, 'efectivo', null,
            jsonb_build_array(
              jsonb_build_object('variante', v_harina, 'cantidad', '10', 'costo_total', '7000'),
              jsonb_build_object('variante', v_azucar, 'cantidad', '5', 'costo_total', '4000')));
          perform public.registrar_gasto(gen_random_uuid(), v_el_alto, null, v_c_alquiler, 'Alquiler del local de El Alto', 250000,
            'transferencia', 'TRF-6609990', 'recibo', '0012', null);
        elsif v_d = -42 then
          perform public.registrar_compra(gen_random_uuid(), v_la_paz, v_dia, 'Distribuidora de lácteos', 'factura', '1045',
            'transferencia', 'TRF-6610241', jsonb_build_array(
              jsonb_build_object('variante', v_mantequilla, 'cantidad', '2', 'costo_total', '10000', 'vence_el', v_hoy + 18),
              jsonb_build_object('variante', v_huevos, 'cantidad', '30', 'costo_total', '2400', 'presentacion', '1 maple')));
        elsif v_d = -40 then
          perform public.registrar_gasto(gen_random_uuid(), v_la_paz, null, v_c_servicios, 'Luz del mes', 42000,
            'efectivo', null, 'factura', '558214', null);
        elsif v_d = -39 then
          perform public.registrar_gasto(gen_random_uuid(), v_el_alto, null, v_c_servicios, 'Luz del mes', 21000,
            'efectivo', null, 'factura', '558377', null);
        elsif v_d = -38 then
          perform public.inscribir(gen_random_uuid(), null, jsonb_build_object('nombres', 'Lidia', 'apellidos', 'Condori Aruquipa',
            'documento', '8234567', 'fecha_de_nacimiento', '1993-03-08'), v_g_tortas, null, v_docs_curso, null, null, null);
        elsif v_d = -37 then
          perform public.inscribir(gen_random_uuid(), null, jsonb_build_object('nombres', 'Noemí', 'apellidos', 'Cruz Quisbert',
            'documento', '8345671', 'fecha_de_nacimiento', '2000-12-01'), v_g_tortas, null, v_docs_curso, null, null, null);
        elsif v_d = -35 then
          perform public.registrar_compra(gen_random_uuid(), v_la_paz, v_dia, 'Molino y lácteos', 'factura', '2210',
            'transferencia', 'TRF-6610398', jsonb_build_array(
              jsonb_build_object('variante', v_leche, 'cantidad', '12', 'costo_total', '8400', 'vence_el', v_hoy + 30,
                                 'presentacion', 'Larga vida, caja de 12'),
              jsonb_build_object('variante', v_harina, 'cantidad', '25', 'costo_total', '17500', 'presentacion', '1 quintal')));
          perform public.registrar_compra(gen_random_uuid(), v_el_alto, v_dia, 'Molino y lácteos', 'factura', '2211',
            'transferencia', 'TRF-6610402', jsonb_build_array(
              jsonb_build_object('variante', v_huevos, 'cantidad', '60', 'costo_total', '4800', 'presentacion', '2 maples'),
              jsonb_build_object('variante', v_mantequilla, 'cantidad', '2', 'costo_total', '10000', 'vence_el', v_hoy + 40),
              jsonb_build_object('variante', v_leche, 'cantidad', '6', 'costo_total', '4200', 'vence_el', v_hoy + 40)));
        elsif v_d = -33 then
          perform public.registrar_gasto(gen_random_uuid(), v_la_paz, null, v_c_servicios, 'Gas: 4 garrafas', 9000,
            'efectivo', null, 'sin_comprobante', null, null);
        elsif v_d = -28 then
          perform public.registrar_compra(gen_random_uuid(), v_la_paz, v_dia, null, 'recibo', '0457', 'efectivo', null,
            jsonb_build_array(
              jsonb_build_object('variante', v_azucar, 'cantidad', '5', 'costo_total', '4000'),
              jsonb_build_object('variante', v_detergente, 'cantidad', '2', 'costo_total', '3000')));
        elsif v_d = -26 then
          perform public.registrar_gasto(gen_random_uuid(), v_la_paz, null, v_c_limpieza, 'Escobas, trapeadores y bolsas de basura', 6500,
            'efectivo', null, 'nota_de_venta', '0912', null);
        elsif v_d = -25 then
          perform public.registrar_gasto(gen_random_uuid(), v_el_alto, null, v_c_servicios, 'Gas: 2 garrafas', 4500,
            'efectivo', null, 'sin_comprobante', null, null);
        elsif v_d = -21 then
          v_lineas := jsonb_build_array(
            jsonb_build_object('variante', v_harina, 'cantidad', '10', 'costo_total', '7000'),
            jsonb_build_object('variante', v_mantequilla, 'cantidad', '2', 'costo_total', '10000', 'vence_el', v_hoy + 39));
          perform public.registrar_compra(gen_random_uuid(), v_la_paz, v_dia, null, 'sin_comprobante', null, 'efectivo', null, v_lineas);
          -- La misma compra, registrada otra vez por error: se anula.
          v_paso := 'compra duplicada y anulada';
          v_res := public.registrar_compra(gen_random_uuid(), v_la_paz, v_dia, null, 'sin_comprobante', null, 'efectivo', null, v_lineas);
          perform public.anular(gen_random_uuid(), 'compra', (v_res ->> 'compra')::uuid, 'Se registró dos veces la misma compra');
          perform public.registrar_compra(gen_random_uuid(), v_el_alto, v_dia, null, 'sin_comprobante', null, 'efectivo', null,
            jsonb_build_array(
              jsonb_build_object('variante', v_huevos, 'cantidad', '30', 'costo_total', '2400', 'presentacion', '1 maple'),
              jsonb_build_object('variante', v_harina, 'cantidad', '10', 'costo_total', '7000')));
        elsif v_d = -20 then
          perform public.registrar_gasto(gen_random_uuid(), v_la_paz, null, v_c_alquiler, 'Alquiler del local de La Paz', 450000,
            'transferencia', 'TRF-6610552', 'recibo', '0032', null);
        elsif v_d = -19 then
          perform public.registrar_gasto(gen_random_uuid(), v_el_alto, null, v_c_alquiler, 'Alquiler del local de El Alto', 250000,
            'transferencia', 'TRF-6610560', 'recibo', '0013', null);
        elsif v_d = -14 then
          perform public.registrar_compra(gen_random_uuid(), v_la_paz, v_dia, 'Distribuidora de lácteos', 'factura', '1102',
            'transferencia', 'TRF-6610725', jsonb_build_array(
              jsonb_build_object('variante', v_leche, 'cantidad', '6', 'costo_total', '4200', 'vence_el', v_hoy - 3,
                                 'presentacion', 'Leche fresca en bolsa'),
              jsonb_build_object('variante', v_levadura, 'cantidad', '10', 'costo_total', '10000', 'vence_el', v_hoy + 46)));
        elsif v_d = -9 then
          perform public.registrar_compra(gen_random_uuid(), v_el_alto, v_dia, null, 'sin_comprobante', null, 'efectivo', null,
            jsonb_build_array(
              jsonb_build_object('variante', v_azucar, 'cantidad', '5', 'costo_total', '4000'),
              jsonb_build_object('variante', v_huevos, 'cantidad', '30', 'costo_total', '2400', 'presentacion', '1 maple')));
        elsif v_d = -7 then
          perform public.registrar_compra(gen_random_uuid(), v_la_paz, v_dia, null, 'sin_comprobante', null, 'efectivo', null,
            jsonb_build_array(
              jsonb_build_object('variante', v_leche, 'cantidad', '6', 'costo_total', '4200', 'vence_el', v_hoy + 5,
                                 'presentacion', 'Leche fresca en bolsa'),
              jsonb_build_object('variante', v_harina, 'cantidad', '10', 'costo_total', '7000')));
        end if;
        execute 'reset role';
      end if;

      -- ======================================================== recepción de La Paz: días sueltos
      if v_d in (-46, -40, -32, -28, -18, -6, -5, -4) then
        v_paso := 'recepción de La Paz';
        perform set_config('request.jwt.claims', v_jwt_rosa, true);
        execute 'set local role authenticated';

        if v_d in (-46, -32, -18, -4) then
          perform public.usar_insumos(gen_random_uuid(), v_la_paz, 'uso_interno', null, 'Limpieza de la cocina',
            jsonb_build_array(jsonb_build_object('variante', v_detergente, 'cantidad', '1')));
        end if;

        if v_d = -40 then
          v_paso := 'cambio de talla';
          select en.id into v_id from public.entregas en where en.inscripcion_id = i_gabriela and en.variante_id = v_talla_l;
          perform public.devolver_uniforme(gen_random_uuid(), v_id, '1', 'Le queda grande; cambia a la talla M', v_talla_m);
        end if;

        if v_d = -28 then
          -- La leche del saldo inicial venció con lo que quedaba: se da de baja ESE lote.
          v_paso := 'baja de leche vencida';
          v_lote := null;
          select l.id, l.cantidad_restante into v_lote, v_cantidad
            from public.lotes l
           where l.variante_id = v_leche and l.sede_id = v_la_paz and l.cantidad_restante > 0 and l.vence_el < v_dia
           order by l.vence_el, l.secuencia limit 1;
          if v_lote is null then
            raise exception 'FALLO semilla: no quedó leche vencida que dar de baja';
          end if;
          perform public.dar_de_baja(gen_random_uuid(), v_la_paz, v_leche, v_cantidad::text, 'vencimiento',
            'Venció en el estante', v_lote);
        end if;

        if v_d = -6 then
          -- Préstamo a un chef invitado que debía devolverse hace días.
          v_paso := 'préstamo a Chef invitado';
          perform public.prestar_utensilios(gen_random_uuid(), v_la_paz, null, null, 'Chef invitado', v_hoy - 3,
            jsonb_build_array(jsonb_build_object('variante', v_cuchillos, 'cantidad', '1')));
        end if;

        if v_d = -5 then
          v_paso := 'baja por rotura';
          perform public.dar_de_baja(gen_random_uuid(), v_la_paz, v_bol, '1', 'rotura', 'Se abolló al caer y ya no sirve', null);
        end if;
        execute 'reset role';
      end if;

      -- ======================================================== degustación (no es de la carrera)
      if v_d = -20 then
        v_paso := 'degustación';
        perform set_config('request.jwt.claims', v_jwt_rosa, true);
        execute 'set local role authenticated';
        perform public.usar_insumos(gen_random_uuid(), v_la_paz, 'degustacion', null, 'Degustación para visitantes del instituto',
          jsonb_build_array(
            jsonb_build_object('variante', v_harina, 'cantidad', '2'),
            jsonb_build_object('variante', v_huevos, 'cantidad', '12'),
            jsonb_build_object('variante', v_mantequilla, 'cantidad', '0.5'),
            jsonb_build_object('variante', v_azucar, 'cantidad', '1'),
            jsonb_build_object('variante', v_levadura, 'cantidad', '2')));
        execute 'reset role';
      end if;

      -- ======================================================== sábados: Cocina (La Paz)
      if v_dow = 6 and v_d between -49 and -1 then
        v_clase_cocina := v_clase_cocina + 1;
        v_paso := 'clase de Cocina n.º ' || v_clase_cocina;
        if v_clase_cocina = 1 then
          perform set_config('request.jwt.claims', v_jwt_carla, true);
          execute 'set local role authenticated';
          update public.cohortes set estado = 'en_curso' where id = v_g_cocina;
          execute 'reset role';
        end if;

        perform set_config('request.jwt.claims', v_jwt_rosa, true);
        execute 'set local role authenticated';
        v_clave := gen_random_uuid();
        perform public.prestar_utensilios(v_clave, v_la_paz, null, v_g_cocina, null, v_dia, jsonb_build_array(
          jsonb_build_object('variante', v_cuchillos, 'cantidad', '4'),
          jsonb_build_object('variante', v_bol, 'cantidad', '6')));
        perform public.usar_insumos(gen_random_uuid(), v_la_paz, 'clase', v_g_cocina, null, v_uso_cocina);
        -- Todo vuelve el mismo día; en la 5.ª clase falta un bol.
        select jsonb_agg(jsonb_build_object(
                 'prestamo', p.id,
                 'devueltos', (p.cantidad - case when p.variante_id = v_bol and v_clase_cocina = 5 then 1 else 0 end)::text,
                 'perdidos', case when p.variante_id = v_bol and v_clase_cocina = 5 then '1' else '0' end,
                 'motivo_baja', 'perdida',
                 'motivo', case when p.variante_id = v_bol and v_clase_cocina = 5 then 'No apareció al cerrar la clase' end))
          into v_lineas
          from public.prestamos p where p.operacion_id = v_clave;
        perform public.recibir_devolucion(gen_random_uuid(), v_lineas);
        execute 'reset role';
      end if;

      -- ======================================================== sábados: Tortas (El Alto)
      if v_dow = 6 and v_d between -35 and -1 then
        v_clase_tortas := v_clase_tortas + 1;
        v_paso := 'clase de Tortas n.º ' || v_clase_tortas;
        perform set_config('request.jwt.claims', v_jwt_carla, true);
        execute 'set local role authenticated';
        if v_clase_tortas = 1 then
          update public.cohortes set estado = 'en_curso' where id = v_g_tortas;
        end if;
        perform public.usar_insumos(gen_random_uuid(), v_el_alto, 'clase', v_g_tortas, null, v_uso_tortas);
        execute 'reset role';
      end if;

      -- ======================================================== conteo físico (administración)
      if v_d = -14 then
        v_paso := 'conteo';
        perform set_config('request.jwt.claims', v_jwt_carla, true);
        execute 'set local role authenticated';
        select e.disponible into v_cantidad from public.existencias e where e.variante_id = v_harina and e.sede_id = v_la_paz;
        select e.disponible into v_cantidad_2 from public.existencias e where e.variante_id = v_azucar and e.sede_id = v_la_paz;
        perform public.registrar_conteo(gen_random_uuid(), v_la_paz, jsonb_build_array(
          jsonb_build_object('variante', v_harina, 'existencia_vista', v_cantidad::text, 'contado', (v_cantidad - 0.5)::text,
                             'motivo', 'Merma: un saco abierto se humedeció'),
          jsonb_build_object('variante', v_azucar, 'existencia_vista', v_cantidad_2::text, 'contado', v_cantidad_2::text)));
        execute 'reset role';
      end if;

      -- ======================================================== ayer: uniforme en El Alto, en efectivo (sin arquear)
      if v_d = -1 then
        v_paso := 'uniforme de Edwin (El Alto)';
        perform set_config('request.jwt.claims', v_jwt_carla, true);
        execute 'set local role authenticated';
        perform public.entregar_uniforme(gen_random_uuid(), i_edwin, v_el_alto, 'inscripcion', null,
          jsonb_build_array(jsonb_build_object('variante', v_talla_l, 'cantidad', '1')), true, '{"medio":"efectivo"}'::jsonb);
        execute 'reset role';
      end if;

      -- ======================================================== hoy: cobros de La Paz que quedan por cerrar
      if v_d = 0 then
        v_paso := 'cobros de hoy en La Paz';
        perform set_config('request.jwt.claims', v_jwt_rosa, true);
        execute 'set local role authenticated';
        perform public.registrar_cobro(gen_random_uuid(), v_la_paz, e_brayan, 'efectivo', null, null, 20000, null,
          'Segundo pago a cuenta');
        perform public.entregar_uniforme(gen_random_uuid(), i_luis, v_la_paz, 'otro', 'Segundo juego para las prácticas',
          jsonb_build_array(jsonb_build_object('variante', v_talla_m, 'cantidad', '1')), true,
          jsonb_build_object('medio', 'qr', 'referencia', 'QR-7311240'));
        execute 'reset role';
      end if;

      -- ======================================================== arqueo semanal de La Paz (Rosa): −50, −43, …, −1
      if v_d between -50 and -1 and (v_d + 1) % 7 = 0 then
        v_paso := 'arqueo de La Paz';
        perform set_config('request.jwt.claims', v_jwt_rosa, true);
        execute 'set local role authenticated';
        v_caja := public.caja_por_cerrar(v_la_paz);
        if (v_caja ->> 'registros')::integer > 0 then
          v_esperado := (v_caja ->> 'esperado')::bigint + case when (v_caja ->> 'primer_arqueo')::boolean then 30000 else 0 end;
          v_contado := v_esperado - case when v_d = -1 then 500 else 0 end;
          if v_contado < 0 then
            raise exception 'FALLO semilla: la caja de La Paz quedaría en negativo (%)', v_caja;
          end if;
          v_retiro := case when v_contado > 200000 then ((v_contado - 150000) / 10000) * 10000 else 0 end;
          perform public.cerrar_caja(gen_random_uuid(), v_la_paz, v_contado, v_retiro,
            case when v_d = -1 then 'Faltaron Bs 5 al contar el cajón; se revisará el cambio' end,
            case when (v_caja ->> 'primer_arqueo')::boolean then 30000 end);
        end if;
        execute 'reset role';
      end if;

      -- ======================================================== arqueo quincenal de El Alto (Carla): −44, −30, −16, −2
      if v_d between -44 and -2 and (v_d + 2) % 14 = 0 then
        v_paso := 'arqueo de El Alto';
        perform set_config('request.jwt.claims', v_jwt_carla, true);
        execute 'set local role authenticated';
        v_caja := public.caja_por_cerrar(v_el_alto);
        if (v_caja ->> 'registros')::integer > 0 then
          v_esperado := (v_caja ->> 'esperado')::bigint + case when (v_caja ->> 'primer_arqueo')::boolean then 30000 else 0 end;
          if v_esperado < 0 then
            raise exception 'FALLO semilla: la caja de El Alto quedaría en negativo (%)', v_caja;
          end if;
          v_retiro := case when v_esperado > 200000 then ((v_esperado - 150000) / 10000) * 10000 else 0 end;
          perform public.cerrar_caja(gen_random_uuid(), v_el_alto, v_esperado, v_retiro, null,
            case when (v_caja ->> 'primer_arqueo')::boolean then 30000 end);
        end if;
        execute 'reset role';
      end if;

    exception when others then
      get stacked diagnostics v_error = pg_exception_detail;
      raise exception 'FALLO semilla (día %, %): % %', v_d, v_paso, sqlerrm, coalesce(v_error, '');
    end;

    -- ---------------------------------------------------------- marcas de tiempo del día (solo días pasados)
    -- Solo columnas de fecha y hora, como postgres: las filas creadas hoy en
    -- esta transacción (marca = now()) pasan a la fecha simulada, en el orden
    -- en que se registraron. Las de hoy conservan la hora real de la carga.
    if v_d < 0 then
      for r in
        select * from (values
          ('articulos', 'created_at', 'codigo', '08:00', 1),
          ('cohortes', 'created_at', 'programa_codigo, anio_de_carrera, id', '08:10', 2),
          ('planes_de_pago', 'created_at', 'id', '08:25', 1),
          ('compras', 'registrado_en', 'numero', '08:30', 10),
          ('compras', 'anulado_en', 'numero', '08:55', 1),
          ('movimientos', 'registrado_en', 'numero', '08:35', 2),
          ('estudiantes', 'created_at', 'codigo', '09:00', 30),
          ('inscripciones', 'created_at', 'numero', '09:02', 30),
          ('cargos', 'registrado_en', 'registrado_en, id', '09:05', 15),
          ('pagos', 'registrado_en', 'numero', '09:10', 15),
          ('entregas', 'registrado_en', 'numero', '09:20', 30),
          ('prestamos', 'registrado_en', 'numero', '10:00', 1),
          ('gastos', 'registrado_en', 'numero', '11:30', 15),
          ('pagos', 'anulado_en', 'numero', '12:40', 5),
          ('cargos', 'anulado_en', 'id', '12:50', 5),
          ('gastos', 'anulado_en', 'numero', '12:55', 5),
          ('prestamos', 'cerrado_en', 'numero', '13:00', 1),
          ('conteos', 'registrado_en', 'numero', '17:00', 5),
          ('cierres_de_caja', 'cerrado_en', 'numero', '19:00', 10)
        ) as t(tabla, columna, orden, hora, paso)
      loop
        execute format(
          'update public.%1$I t set %2$I = $1 + make_interval(mins => x.n * %4$s)
             from (select id, (row_number() over (order by %3$s) - 1)::integer as n from public.%1$I where %2$I = $2) x
            where t.id = x.id',
          r.tabla, r.columna, r.orden, r.paso)
        using ((v_dia + r.hora::time) at time zone 'America/La_Paz'), now();
      end loop;
    end if;
  end loop;

  perform set_config('app.hoy_simulada', '', true);
  perform set_config('app.mantenimiento', 'no', true);

  -- ------------------------------------------------------------ comprobaciones (como Carla, con la fecha real)
  if v_clase_cocina <> 7 or v_clase_tortas <> 5 then
    raise exception 'FALLO semilla: % clases de Cocina y % de Tortas (esperadas 7 y 5)', v_clase_cocina, v_clase_tortas;
  end if;
  select count(*) into v_n from public.solicitudes where estado in ('pendiente', 'en_revision');
  if v_n <> v_pendientes then
    raise exception 'FALLO semilla: cambiaron las solicitudes abiertas del portal (% → %)', v_pendientes, v_n;
  end if;

  perform set_config('request.jwt.claims', v_jwt_carla, true);
  execute 'set local role authenticated';

  v_res := public.verificar_cuadre(null);
  if not coalesce((v_res ->> 'cuadra')::boolean, false) then
    raise exception 'FALLO semilla: el cuadre no cierra %', v_res;
  end if;

  v_tablero := public.tablero_de_administracion(null);
  if coalesce((v_tablero -> 'efectivo_sin_arqueo' ->> 'registros')::integer, 0) = 0 then
    raise exception 'FALLO semilla: el tablero no muestra efectivo sin arqueo %', v_tablero -> 'efectivo_sin_arqueo';
  end if;
  if not exists (select 1 from public.cierres_de_caja c where c.sede_id = v_el_alto) then
    raise exception 'FALLO semilla: El Alto no tiene arqueos';
  end if;
  if (select max(p.fecha) from public.pagos p where p.sede_id = v_el_alto and p.medio = 'efectivo' and p.cierre_id is null) <> v_hoy - 1 then
    raise exception 'FALLO semilla: El Alto no tiene efectivo de ayer sin arquear';
  end if;

  v_caja := public.caja_por_cerrar(v_la_paz);
  if (v_caja ->> 'registros')::integer = 0
     or exists (select 1 from public.pagos p where p.sede_id = v_la_paz and p.cierre_id is null and p.fecha <> v_hoy) then
    raise exception 'FALLO semilla: La Paz debía quedar con cobros de hoy (y solo de hoy) por cerrar %', v_caja;
  end if;

  if not exists (select 1 from public.v_prestamos_abiertos where atrasado and persona = 'Chef invitado') then
    raise exception 'FALLO semilla: no hay préstamo atrasado';
  end if;
  if not exists (select 1 from public.v_lotes_vigentes where estado = 'vencido' and variante_id = v_leche) then
    raise exception 'FALLO semilla: no quedó un lote de leche vencido';
  end if;
  if not exists (select 1 from public.v_lotes_vigentes where estado = 'por_vencer' and variante_id = v_leche) then
    raise exception 'FALLO semilla: no quedó un lote de leche por vencer';
  end if;
  if not exists (select 1 from public.v_sin_uniforme) then
    raise exception 'FALLO semilla: no hay alumnos de la carrera sin uniforme';
  end if;
  if not exists (select 1 from public.v_saldos_de_alumno where total_vencido > 0) then
    raise exception 'FALLO semilla: no hay deudores con cuota vencida';
  end if;
  select count(*) filter (where estado = 'bajo'), count(*) filter (where estado = 'agotado') into v_n, v_cantidad
    from public.v_existencias where variante_id = any (v_variantes);
  if v_n not between 1 and 2 or v_cantidad <> 0 then
    raise exception 'FALLO semilla: % existencias bajo el mínimo (esperadas 1 o 2) y % agotadas (esperadas 0)', v_n, v_cantidad;
  end if;

  v_texto := format(
    '%s artículos, %s grupos, %s alumnos, %s cobros (%s anulado), %s compras (%s anulada), %s gastos, %s arqueos; '
    || 'tablero: efectivo sin arqueo %s (desde %s), arqueos con diferencia este mes %s, bajas en 7 días %s, grupos sin precio %s, '
    || 'préstamos atrasados %s, lotes vencidos %s, por vencer %s, sin uniforme %s, deudores con vencido %s (Bs %s), '
    || 'bajo el mínimo %s, caja de La Paz por cerrar %s registros; cuadre correcto',
    (select count(*) from public.articulos where id in (select articulo_id from public.variantes where id = any (v_variantes))),
    (select count(*) from public.cohortes),
    (select count(*) from public.estudiantes),
    (select count(*) from public.pagos), (select count(*) from public.pagos where anulado_en is not null),
    (select count(*) from public.compras), (select count(*) from public.compras where anulado_en is not null),
    (select count(*) from public.gastos),
    (select count(*) from public.cierres_de_caja),
    v_tablero -> 'efectivo_sin_arqueo' ->> 'registros', v_tablero -> 'efectivo_sin_arqueo' ->> 'desde',
    v_tablero -> 'arqueos_con_diferencia' ->> 'cantidad', v_tablero -> 'bajas_7_dias' ->> 'cantidad',
    v_tablero -> 'sin_precio' ->> 'grupos',
    (select count(*) from public.v_prestamos_abiertos where atrasado),
    (select count(*) from public.v_lotes_vigentes where estado = 'vencido'),
    (select count(*) from public.v_lotes_vigentes where estado = 'por_vencer'),
    (select count(*) from public.v_sin_uniforme),
    (select count(*) from public.v_saldos_de_alumno where total_vencido > 0),
    (select (sum(total_vencido) / 100.0)::numeric(14, 2) from public.v_saldos_de_alumno where total_vencido > 0),
    v_n,
    v_caja ->> 'registros');
  execute 'reset role';

  if c_simular then
    raise exception 'OK · simulación: % (todo revertido)', v_texto;
  end if;

  raise notice 'Datos de demostración del panel cargados: %', v_texto;
end;
$$;
