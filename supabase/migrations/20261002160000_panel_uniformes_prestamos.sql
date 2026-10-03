-- ============================================================================
-- Sistema interno v1 · R5 · Uniformes y utensilios (especificación §3.6, §6.3–6.6)
-- ----------------------------------------------------------------------------
-- Entregar el uniforme a un alumno inscrito (con cargo «Venta de uniforme» y,
-- si se cobra en el acto, su recibo), devolverlo o cambiarle la talla al costo
-- con que salió, prestar utensilios (custodia: el valor no cambia) y recibir
-- lo prestado; lo que no vuelve es una baja desde «prestado», a promedio.
--
-- Las entregas y los préstamos NO se anulan: se devuelven. Es lo que pasó.
--
-- Orden de candados (B.10): caja primero (si se cobra en efectivo), luego los
-- saldos por variante en orden de id. El cobro anidado usa una clave derivada
-- de la del formulario: un reenvío vuelve con el resultado guardado antes de
-- llegar a él.
-- ============================================================================

-- ---------------------------------------------------------------- entregar uniforme

create or replace function app.entregar_uniforme(
  p_clave uuid,
  p_inscripcion uuid,
  p_sede uuid,
  p_contexto public.contexto_de_entrega,
  p_detalle text,
  p_lineas jsonb,
  p_cargar boolean,
  p_cobro jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previo jsonb;
  v_contexto public.contexto_de_entrega := coalesce(p_contexto, 'inscripcion');
  v_detalle text := nullif(btrim(coalesce(p_detalle, '')), '');
  v_cargar boolean := coalesce(p_cargar, false);
  v_ins record;
  v_linea jsonb;
  v_variante uuid;
  v_articulo public.articulos%rowtype;
  v_etiqueta text;
  v_cantidad integer;
  v_normalizadas jsonb := '[]'::jsonb;
  v_entrega uuid;
  v_salida jsonb;
  v_mov uuid;
  v_antes numeric;
  v_cargo uuid;
  v_aplicaciones jsonb := '[]'::jsonb;
  v_cargado bigint := 0;
  v_concepto uuid;
  v_cobro jsonb;
  v_confirmacion jsonb := '[]'::jsonb;
  v_medio text := nullif(p_cobro ->> 'medio', '');
begin
  perform app.exigir_permiso('inventario.operar');
  if v_cargar or p_cobro is not null then
    perform app.exigir_permiso('caja.cobrar');
  end if;
  perform app.exigir_sede(p_sede);
  v_previo := app.iniciar_operacion(p_clave, 'entrega');
  if v_previo is not null then return v_previo; end if;

  select i.id, i.estado, i.estudiante_id, e.codigo
    into v_ins
    from public.inscripciones i join public.estudiantes e on e.id = i.estudiante_id
   where i.id = p_inscripcion;
  if not found then
    raise exception using errcode = 'P0001', message = 'inscripcion_no_encontrada';
  end if;
  if v_ins.estado <> 'inscrito' then
    raise exception using errcode = 'P0001', message = 'inscripcion_no_vigente';
  end if;
  if v_contexto = 'otro' and (v_detalle is null or char_length(v_detalle) < 3) then
    raise exception using errcode = 'P0001', message = 'detalle_requerido';
  end if;
  if v_detalle is not null and char_length(v_detalle) > 300 then
    raise exception using errcode = 'P0001', message = 'datos_invalidos', detail = jsonb_build_object('campos', jsonb_build_array('detalle'))::text;
  end if;
  if jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception using errcode = 'P0001', message = 'sin_lineas';
  end if;
  if p_cobro is not null and not v_cargar then
    raise exception using errcode = 'P0001', message = 'cobro_sin_aplicar';
  end if;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_variante := nullif(v_linea ->> 'variante', '')::uuid;
    if v_variante is null then
      raise exception using errcode = 'P0001', message = 'talla_requerida';
    end if;
    v_articulo := app.articulo_de_variante(v_variante);
    if v_articulo.id is null or not v_articulo.activo then
      raise exception using errcode = 'P0001', message = 'articulo_inactivo';
    end if;
    if v_articulo.tipo <> 'uniforme' then
      raise exception using errcode = 'P0001', message = 'entrega_no_admitida', detail = jsonb_build_object('articulo', v_articulo.nombre)::text;
    end if;
    if exists (select 1 from jsonb_array_elements(v_normalizadas) n where (n ->> 'variante')::uuid = v_variante) then
      raise exception using errcode = 'P0001', message = 'linea_repetida', detail = jsonb_build_object('articulo', v_articulo.nombre)::text;
    end if;
    v_cantidad := app.exigir_cantidad(coalesce(v_linea ->> 'cantidad', '1'), v_articulo.tipo)::integer;
    if v_cargar and v_articulo.precio_venta is null then
      raise exception using errcode = 'P0001', message = 'precio_no_definido', detail = jsonb_build_object('articulo', v_articulo.nombre)::text;
    end if;
    v_normalizadas := v_normalizadas || jsonb_build_object('variante', v_variante, 'cantidad', v_cantidad);
  end loop;

  -- B.10: la caja primero si el cobro es en efectivo; luego los saldos en orden.
  if v_medio = 'efectivo' then
    perform app.candado_de_caja(p_sede);
  end if;
  perform app.bloquear_saldo(x.variante, p_sede)
     from (select distinct (e ->> 'variante')::uuid as variante from jsonb_array_elements(v_normalizadas) e order by 1) x;

  select k.id into v_concepto from public.conceptos k where k.codigo = 'venta-uniforme';

  for v_linea in select e from jsonb_array_elements(v_normalizadas) e order by (e ->> 'variante')::uuid loop
    v_variante := (v_linea ->> 'variante')::uuid;
    v_cantidad := (v_linea ->> 'cantidad')::integer;
    v_articulo := app.articulo_de_variante(v_variante);
    select v.etiqueta into v_etiqueta from public.variantes v where v.id = v_variante;
    select e.disponible into v_antes from public.existencias e where e.variante_id = v_variante and e.sede_id = p_sede;

    v_salida := app.sacar(v_variante, p_sede, v_cantidad, false, null, false);
    insert into public.entregas (operacion_id, inscripcion_id, sede_id, variante_id, cantidad, contexto, detalle, fecha, registrado_por)
    values (p_clave, p_inscripcion, p_sede, v_variante, v_cantidad, v_contexto, v_detalle, app.hoy(), (select auth.uid()))
    returning id into v_entrega;
    v_mov := app.mover(p_clave, v_variante, p_sede, 'entrega', v_cantidad, -v_cantidad, 0,
                       jsonb_build_object('entrega', v_entrega, 'detalle', v_detalle));
    perform app.valorizar(v_mov, v_variante, p_sede, -(v_salida ->> 'valor')::bigint);

    if v_cargar then
      insert into public.cargos (operacion_id, estudiante_id, inscripcion_id, concepto_id, descripcion, monto, fecha, vence_el,
                                 sede_id, origen, entrega_id, registrado_por)
      values (p_clave, v_ins.estudiante_id, p_inscripcion, v_concepto,
              left(v_articulo.nombre || case when v_etiqueta <> 'Única' then ' · talla ' || v_etiqueta else '' end
                   || case when v_cantidad > 1 then ' × ' || v_cantidad else '' end, 200),
              v_articulo.precio_venta * v_cantidad, app.hoy(), app.hoy(), p_sede, 'entrega', v_entrega, (select auth.uid()))
      returning id into v_cargo;
      v_aplicaciones := v_aplicaciones || jsonb_build_object('cargo', v_cargo, 'monto', v_articulo.precio_venta * v_cantidad);
      v_cargado := v_cargado + v_articulo.precio_venta * v_cantidad;
    end if;
    v_confirmacion := v_confirmacion || app.linea_de_confirmacion(v_variante, p_sede, v_cantidad, v_antes);
  end loop;

  if p_cobro is not null then
    v_cobro := app.registrar_cobro(md5(p_clave::text || ':cobro')::uuid, p_sede, v_ins.estudiante_id,
                                   v_medio::public.medio_de_pago, p_cobro ->> 'referencia', v_aplicaciones, null, null, null);
  end if;

  return app.terminar_operacion(p_clave, jsonb_build_object(
    'estudiante', v_ins.estudiante_id, 'codigo', v_ins.codigo, 'cargado', v_cargado,
    'pago', v_cobro -> 'pago', 'recibo', v_cobro -> 'recibo', 'lineas', v_confirmacion));
end;
$$;

-- ---------------------------------------------------------------- devolver o cambiar la talla

-- Vuelve al costo con que salió; la devolución que completa la entrega se
-- lleva el resto exacto (gemela de `valorDeDevolucion` del dominio).
create or replace function app.devolver_uniforme(p_clave uuid, p_entrega uuid, p_cantidad text, p_motivo text, p_cambiar_por uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previo jsonb;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_entrega public.entregas%rowtype;
  v_articulo public.articulos%rowtype;
  v_nueva_articulo uuid;
  v_cantidad integer;
  v_pendiente integer;
  v_valor_salida bigint;
  v_ya bigint;
  v_valor bigint;
  v_mov uuid;
  v_antes numeric;
  v_nueva uuid;
  v_salida jsonb;
  v_etiqueta text;
  v_confirmacion jsonb := '[]'::jsonb;
begin
  perform app.exigir_permiso('inventario.operar');
  select * into v_entrega from public.entregas e where e.id = p_entrega;
  if not found then
    raise exception using errcode = 'P0001', message = 'documento_no_encontrado';
  end if;
  perform app.exigir_sede(v_entrega.sede_id);
  v_previo := app.iniciar_operacion(p_clave, 'devolucion_entrega');
  if v_previo is not null then return v_previo; end if;

  if v_motivo is null or char_length(v_motivo) < 3 then
    raise exception using errcode = 'P0001', message = 'motivo_requerido';
  end if;
  v_articulo := app.articulo_de_variante(v_entrega.variante_id);
  v_cantidad := app.exigir_cantidad(p_cantidad, v_articulo.tipo)::integer;
  if p_cambiar_por is not null then
    select v.articulo_id into v_nueva_articulo from public.variantes v where v.id = p_cambiar_por and v.activa;
    if v_nueva_articulo is null or v_nueva_articulo <> v_articulo.id then
      raise exception using errcode = 'P0001', message = 'pieza_distinta';
    end if;
    if p_cambiar_por = v_entrega.variante_id then
      raise exception using errcode = 'P0001', message = 'talla_igual';
    end if;
  end if;

  -- Saldos en orden de id; la entrega bloqueada después, y se vuelve a leer.
  perform app.bloquear_saldo(x.v, v_entrega.sede_id)
     from (select distinct v from unnest(array[v_entrega.variante_id, p_cambiar_por]) as t(v) where v is not null order by 1) x;
  select * into v_entrega from public.entregas e where e.id = p_entrega for update;
  v_pendiente := v_entrega.cantidad - v_entrega.devuelta;
  if v_cantidad > v_pendiente then
    raise exception using errcode = 'P0001', message = 'devolucion_excede', detail = jsonb_build_object('pendiente', v_pendiente)::text;
  end if;

  select -c.delta_valor into v_valor_salida
    from public.movimientos m join public.movimientos_costo c on c.movimiento_id = m.id
   where m.entrega_id = p_entrega and m.tipo = 'entrega';
  select coalesce(sum(c.delta_valor), 0) into v_ya
    from public.movimientos m join public.movimientos_costo c on c.movimiento_id = m.id
   where m.entrega_id = p_entrega and m.tipo = 'devolucion_entrega';
  v_valor := case when v_cantidad = v_pendiente then v_valor_salida - v_ya
                  else least(round(v_valor_salida::numeric * v_cantidad / v_entrega.cantidad)::bigint, v_valor_salida - v_ya) end;

  select e.disponible into v_antes from public.existencias e where e.variante_id = v_entrega.variante_id and e.sede_id = v_entrega.sede_id;
  v_mov := app.mover(p_clave, v_entrega.variante_id, v_entrega.sede_id, 'devolucion_entrega', v_cantidad, v_cantidad, 0,
                     jsonb_build_object('entrega', p_entrega, 'detalle', left(v_motivo, 300)));
  perform app.valorizar(v_mov, v_entrega.variante_id, v_entrega.sede_id, v_valor);
  update public.entregas set devuelta = devuelta + v_cantidad where id = p_entrega;
  v_confirmacion := v_confirmacion || app.linea_de_confirmacion(v_entrega.variante_id, v_entrega.sede_id, v_cantidad, v_antes);

  -- Cambio de talla: otra entrega del mismo artículo, sin cargo.
  if p_cambiar_por is not null then
    select v.etiqueta into v_etiqueta from public.variantes v where v.id = v_entrega.variante_id;
    select e.disponible into v_antes from public.existencias e where e.variante_id = p_cambiar_por and e.sede_id = v_entrega.sede_id;
    v_salida := app.sacar(p_cambiar_por, v_entrega.sede_id, v_cantidad, false, null, false);
    insert into public.entregas (operacion_id, inscripcion_id, sede_id, variante_id, cantidad, contexto, detalle, fecha, registrado_por)
    values (p_clave, v_entrega.inscripcion_id, v_entrega.sede_id, p_cambiar_por, v_cantidad, 'cambio_de_talla',
            left('Cambio de la talla ' || v_etiqueta, 300), app.hoy(), (select auth.uid()))
    returning id into v_nueva;
    v_mov := app.mover(p_clave, p_cambiar_por, v_entrega.sede_id, 'entrega', v_cantidad, -v_cantidad, 0,
                       jsonb_build_object('entrega', v_nueva, 'detalle', left('Cambio de la talla ' || v_etiqueta, 300)));
    perform app.valorizar(v_mov, p_cambiar_por, v_entrega.sede_id, -(v_salida ->> 'valor')::bigint);
    v_confirmacion := v_confirmacion || app.linea_de_confirmacion(p_cambiar_por, v_entrega.sede_id, v_cantidad, v_antes);
  end if;

  return app.terminar_operacion(p_clave, jsonb_build_object(
    'entrega', p_entrega, 'devuelta', v_cantidad, 'nueva_entrega', v_nueva, 'lineas', v_confirmacion));
end;
$$;

-- ---------------------------------------------------------------- prestar utensilios

create or replace function app.prestar_utensilios(
  p_clave uuid,
  p_sede uuid,
  p_estudiante uuid,
  p_cohorte uuid,
  p_persona text,
  p_devolver_el date,
  p_lineas jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previo jsonb;
  v_persona text := nullif(regexp_replace(btrim(coalesce(p_persona, '')), '\s+', ' ', 'g'), '');
  v_devolver date := coalesce(p_devolver_el, app.hoy());
  v_linea jsonb;
  v_variante uuid;
  v_articulo public.articulos%rowtype;
  v_cantidad integer;
  v_normalizadas jsonb := '[]'::jsonb;
  v_prestamo uuid;
  v_mov uuid;
  v_antes numeric;
  v_ids jsonb := '[]'::jsonb;
  v_confirmacion jsonb := '[]'::jsonb;
begin
  perform app.exigir_permiso('inventario.operar');
  perform app.exigir_sede(p_sede);
  v_previo := app.iniciar_operacion(p_clave, 'prestamo');
  if v_previo is not null then return v_previo; end if;

  if num_nonnulls(p_estudiante, p_cohorte, v_persona) <> 1 then
    raise exception using errcode = 'P0001', message = 'destinatario_requerido';
  end if;
  if v_persona is not null and char_length(v_persona) not between 2 and 120 then
    raise exception using errcode = 'P0001', message = 'destinatario_requerido';
  end if;
  if p_estudiante is not null and not exists (select 1 from public.estudiantes e where e.id = p_estudiante and e.archivado_en is null) then
    raise exception using errcode = 'P0001', message = 'alumno_no_encontrado';
  end if;
  if p_cohorte is not null and not exists (select 1 from public.cohortes c where c.id = p_cohorte and c.sede_id = p_sede) then
    raise exception using errcode = 'P0001', message = 'grupo_no_corresponde';
  end if;
  if v_devolver < app.hoy() or v_devolver > app.hoy() + 120 then
    raise exception using errcode = 'P0001', message = 'fecha_de_devolucion_invalida';
  end if;
  if jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception using errcode = 'P0001', message = 'sin_lineas';
  end if;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_variante := (v_linea ->> 'variante')::uuid;
    v_articulo := app.articulo_de_variante(v_variante);
    if v_articulo.id is null or not v_articulo.activo then
      raise exception using errcode = 'P0001', message = 'articulo_inactivo';
    end if;
    if v_articulo.tipo <> 'utensilio' then
      raise exception using errcode = 'P0001', message = 'prestamo_no_admitido', detail = jsonb_build_object('articulo', v_articulo.nombre)::text;
    end if;
    if exists (select 1 from jsonb_array_elements(v_normalizadas) n where (n ->> 'variante')::uuid = v_variante) then
      raise exception using errcode = 'P0001', message = 'linea_repetida', detail = jsonb_build_object('articulo', v_articulo.nombre)::text;
    end if;
    v_cantidad := app.exigir_cantidad(v_linea ->> 'cantidad', v_articulo.tipo)::integer;
    v_normalizadas := v_normalizadas || jsonb_build_object('variante', v_variante, 'cantidad', v_cantidad);
  end loop;

  perform app.bloquear_saldo(x.variante, p_sede)
     from (select distinct (e ->> 'variante')::uuid as variante from jsonb_array_elements(v_normalizadas) e order by 1) x;

  for v_linea in select e from jsonb_array_elements(v_normalizadas) e order by (e ->> 'variante')::uuid loop
    v_variante := (v_linea ->> 'variante')::uuid;
    v_cantidad := (v_linea ->> 'cantidad')::integer;
    select e.disponible into v_antes from public.existencias e where e.variante_id = v_variante and e.sede_id = p_sede;
    -- Solo comprueba que alcance (custodia: el valor no se mueve).
    perform app.sacar(v_variante, p_sede, v_cantidad, false, null, false);
    insert into public.prestamos (operacion_id, sede_id, variante_id, cantidad, estudiante_id, cohorte_id, persona, fecha, devolver_el, registrado_por)
    values (p_clave, p_sede, v_variante, v_cantidad, p_estudiante, p_cohorte, v_persona, app.hoy(), v_devolver, (select auth.uid()))
    returning id into v_prestamo;
    v_mov := app.mover(p_clave, v_variante, p_sede, 'prestamo', v_cantidad, -v_cantidad, v_cantidad, jsonb_build_object('prestamo', v_prestamo));
    perform app.valorizar(v_mov, v_variante, p_sede, 0);
    v_ids := v_ids || to_jsonb(v_prestamo);
    v_confirmacion := v_confirmacion || app.linea_de_confirmacion(v_variante, p_sede, v_cantidad, v_antes);
  end loop;

  return app.terminar_operacion(p_clave, jsonb_build_object('prestamos', v_ids, 'devolver_el', v_devolver, 'lineas', v_confirmacion));
end;
$$;

-- ---------------------------------------------------------------- recibir lo prestado

-- Líneas {prestamo, devueltos, perdidos, motivo_baja?, motivo?}. Lo que vuelve
-- pasa de «prestado» al estante; lo que no vuelve es una baja desde
-- «prestado» al costo promedio (perdida o rotura).
create or replace function app.recibir_devolucion(p_clave uuid, p_lineas jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previo jsonb;
  v_linea jsonb;
  v_prestamo public.prestamos%rowtype;
  v_articulo public.articulos%rowtype;
  v_devueltos integer;
  v_perdidos integer;
  v_motivo text;
  v_motivo_baja public.motivo_de_baja;
  v_normalizadas jsonb := '[]'::jsonb;
  v_salida jsonb;
  v_mov uuid;
  v_total_perdidos integer := 0;
  v_valor_perdido bigint := 0;
begin
  perform app.exigir_permiso('inventario.operar');
  v_previo := app.iniciar_operacion(p_clave, 'devolucion_prestamo');
  if v_previo is not null then return v_previo; end if;
  if jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception using errcode = 'P0001', message = 'sin_lineas';
  end if;

  -- Validar todo antes de escribir.
  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    select * into v_prestamo from public.prestamos p where p.id = (v_linea ->> 'prestamo')::uuid;
    if not found then
      raise exception using errcode = 'P0001', message = 'documento_no_encontrado';
    end if;
    perform app.exigir_sede(v_prestamo.sede_id);
    if exists (select 1 from jsonb_array_elements(v_normalizadas) n where (n ->> 'prestamo')::uuid = v_prestamo.id) then
      raise exception using errcode = 'P0001', message = 'linea_repetida';
    end if;
    v_articulo := app.articulo_de_variante(v_prestamo.variante_id);
    v_devueltos := coalesce(app.leer_cantidad(coalesce(nullif(v_linea ->> 'devueltos', ''), '0')), -1);
    v_perdidos := coalesce(app.leer_cantidad(coalesce(nullif(v_linea ->> 'perdidos', ''), '0')), -1);
    if v_devueltos < 0 or v_perdidos < 0 or v_devueltos + v_perdidos = 0 then
      raise exception using errcode = 'P0001', message = 'cantidad_invalida';
    end if;
    if (v_linea ->> 'devueltos') ~ '[.]' and app.leer_cantidad(v_linea ->> 'devueltos') <> trunc(app.leer_cantidad(v_linea ->> 'devueltos'))
       or (v_linea ->> 'perdidos') ~ '[.]' and app.leer_cantidad(v_linea ->> 'perdidos') <> trunc(app.leer_cantidad(v_linea ->> 'perdidos')) then
      raise exception using errcode = 'P0001', message = 'cantidad_no_entera';
    end if;
    v_motivo := nullif(btrim(coalesce(v_linea ->> 'motivo', '')), '');
    if v_perdidos > 0 and (v_motivo is null or char_length(v_motivo) < 3) then
      raise exception using errcode = 'P0001', message = 'motivo_requerido', detail = jsonb_build_object('articulo', v_articulo.nombre)::text;
    end if;
    v_motivo_baja := case when v_linea ->> 'motivo_baja' = 'rotura' then 'rotura' else 'perdida' end;
    v_normalizadas := v_normalizadas || jsonb_build_object('prestamo', v_prestamo.id, 'variante', v_prestamo.variante_id, 'sede', v_prestamo.sede_id,
                                                           'devueltos', v_devueltos, 'perdidos', v_perdidos, 'motivo', v_motivo,
                                                           'motivo_baja', v_motivo_baja);
  end loop;

  -- Saldos en orden de variante; luego cada préstamo, y se vuelve a comprobar.
  perform app.bloquear_saldo(x.variante, x.sede)
     from (select distinct (e ->> 'variante')::uuid as variante, (e ->> 'sede')::uuid as sede from jsonb_array_elements(v_normalizadas) e order by 1, 2) x;

  for v_linea in select e from jsonb_array_elements(v_normalizadas) e order by (e ->> 'prestamo')::uuid loop
    select * into v_prestamo from public.prestamos p where p.id = (v_linea ->> 'prestamo')::uuid for update;
    if v_prestamo.cerrado_en is not null then
      raise exception using errcode = 'P0001', message = 'prestamo_cerrado';
    end if;
    v_devueltos := (v_linea ->> 'devueltos')::integer;
    v_perdidos := (v_linea ->> 'perdidos')::integer;
    if v_devueltos + v_perdidos > v_prestamo.cantidad - v_prestamo.devuelta - v_prestamo.perdida then
      raise exception using errcode = 'P0001', message = 'devolucion_excede',
        detail = jsonb_build_object('pendiente', v_prestamo.cantidad - v_prestamo.devuelta - v_prestamo.perdida)::text;
    end if;
    if v_devueltos > 0 then
      v_mov := app.mover(p_clave, v_prestamo.variante_id, v_prestamo.sede_id, 'devolucion_prestamo', v_devueltos, v_devueltos, -v_devueltos,
                         jsonb_build_object('prestamo', v_prestamo.id));
      perform app.valorizar(v_mov, v_prestamo.variante_id, v_prestamo.sede_id, 0);
    end if;
    if v_perdidos > 0 then
      v_salida := app.sacar(v_prestamo.variante_id, v_prestamo.sede_id, v_perdidos, false, null, true);
      v_mov := app.mover(p_clave, v_prestamo.variante_id, v_prestamo.sede_id, 'baja', v_perdidos, 0, -v_perdidos,
                         jsonb_build_object('prestamo', v_prestamo.id, 'motivo_baja', v_linea ->> 'motivo_baja', 'detalle', left(v_linea ->> 'motivo', 300)));
      perform app.valorizar(v_mov, v_prestamo.variante_id, v_prestamo.sede_id, -(v_salida ->> 'valor')::bigint);
      v_total_perdidos := v_total_perdidos + v_perdidos;
      v_valor_perdido := v_valor_perdido + (v_salida ->> 'valor')::bigint;
    end if;
    update public.prestamos
       set devuelta = devuelta + v_devueltos,
           perdida = perdida + v_perdidos,
           cerrado_en = case when devuelta + v_devueltos + perdida + v_perdidos = cantidad then now() end
     where id = v_prestamo.id;
  end loop;

  return app.terminar_operacion(p_clave, jsonb_build_object(
    'lineas', jsonb_array_length(v_normalizadas), 'perdidos', v_total_perdidos,
    'valor_perdido', case when app.tiene_permiso('contabilidad.leer') then v_valor_perdido end));
end;
$$;

revoke all on function app.entregar_uniforme(uuid, uuid, uuid, public.contexto_de_entrega, text, jsonb, boolean, jsonb) from public;
revoke all on function app.devolver_uniforme(uuid, uuid, text, text, uuid) from public;
revoke all on function app.prestar_utensilios(uuid, uuid, uuid, uuid, text, date, jsonb) from public;
revoke all on function app.recibir_devolucion(uuid, jsonb) from public;
grant execute on function app.entregar_uniforme(uuid, uuid, uuid, public.contexto_de_entrega, text, jsonb, boolean, jsonb) to authenticated;
grant execute on function app.devolver_uniforme(uuid, uuid, text, text, uuid) to authenticated;
grant execute on function app.prestar_utensilios(uuid, uuid, uuid, uuid, text, date, jsonb) to authenticated;
grant execute on function app.recibir_devolucion(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------- fachadas (API)

create or replace function public.entregar_uniforme(
  p_clave uuid,
  p_inscripcion uuid,
  p_sede uuid,
  p_contexto public.contexto_de_entrega,
  p_detalle text,
  p_lineas jsonb,
  p_cargar boolean,
  p_cobro jsonb
)
returns jsonb
language sql
set search_path = ''
as $$
  select app.entregar_uniforme(p_clave, p_inscripcion, p_sede, p_contexto, p_detalle, p_lineas, p_cargar, p_cobro);
$$;

create or replace function public.devolver_uniforme(p_clave uuid, p_entrega uuid, p_cantidad text, p_motivo text, p_cambiar_por uuid)
returns jsonb
language sql
set search_path = ''
as $$
  select app.devolver_uniforme(p_clave, p_entrega, p_cantidad, p_motivo, p_cambiar_por);
$$;

create or replace function public.prestar_utensilios(
  p_clave uuid,
  p_sede uuid,
  p_estudiante uuid,
  p_cohorte uuid,
  p_persona text,
  p_devolver_el date,
  p_lineas jsonb
)
returns jsonb
language sql
set search_path = ''
as $$
  select app.prestar_utensilios(p_clave, p_sede, p_estudiante, p_cohorte, p_persona, p_devolver_el, p_lineas);
$$;

create or replace function public.recibir_devolucion(p_clave uuid, p_lineas jsonb)
returns jsonb
language sql
set search_path = ''
as $$
  select app.recibir_devolucion(p_clave, p_lineas);
$$;

revoke all on function public.entregar_uniforme(uuid, uuid, uuid, public.contexto_de_entrega, text, jsonb, boolean, jsonb) from public, anon;
revoke all on function public.devolver_uniforme(uuid, uuid, text, text, uuid) from public, anon;
revoke all on function public.prestar_utensilios(uuid, uuid, uuid, uuid, text, date, jsonb) from public, anon;
revoke all on function public.recibir_devolucion(uuid, jsonb) from public, anon;
grant execute on function public.entregar_uniforme(uuid, uuid, uuid, public.contexto_de_entrega, text, jsonb, boolean, jsonb) to authenticated;
grant execute on function public.devolver_uniforme(uuid, uuid, text, text, uuid) to authenticated;
grant execute on function public.prestar_utensilios(uuid, uuid, uuid, uuid, text, date, jsonb) to authenticated;
grant execute on function public.recibir_devolucion(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------- vistas

-- Entregas de uniforme con su alumno (ficha del alumno, «Uniforme y préstamos»).
create or replace view public.v_entregas with (security_invoker = true) as
select
  en.id,
  en.numero,
  en.operacion_id,
  en.inscripcion_id,
  i.estudiante_id,
  en.sede_id,
  s.nombre as sede_nombre,
  en.variante_id,
  a.id as articulo_id,
  a.codigo as articulo_codigo,
  a.nombre as articulo_nombre,
  v.etiqueta,
  en.cantidad,
  en.devuelta,
  en.cantidad - en.devuelta as en_poder,
  en.contexto,
  en.detalle,
  en.fecha,
  en.registrado_en
from public.entregas en
join public.inscripciones i on i.id = en.inscripcion_id
join public.variantes v on v.id = en.variante_id
join public.articulos a on a.id = v.articulo_id
join public.sedes s on s.id = en.sede_id;

-- Préstamos sin cerrar: a quién, qué, cuánto falta y si está atrasado.
create or replace view public.v_prestamos_abiertos with (security_invoker = true) as
select
  p.id,
  p.numero,
  p.operacion_id,
  p.sede_id,
  s.nombre as sede_nombre,
  p.variante_id,
  a.id as articulo_id,
  a.codigo as articulo_codigo,
  a.nombre as articulo_nombre,
  a.icono,
  p.cantidad,
  p.devuelta,
  p.perdida,
  p.cantidad - p.devuelta - p.perdida as pendiente,
  p.estudiante_id,
  e.codigo as estudiante_codigo,
  e.nombres as estudiante_nombres,
  e.apellidos as estudiante_apellidos,
  e.telefono as estudiante_telefono,
  p.cohorte_id,
  g.nombre as grupo_nombre,
  p.persona,
  coalesce(e.nombres || ' ' || e.apellidos, g.nombre, p.persona) as destinatario,
  p.fecha,
  p.devolver_el,
  greatest(0, app.hoy() - p.devolver_el) as dias_de_atraso,
  p.devolver_el < app.hoy() as atrasado
from public.prestamos p
join public.variantes v on v.id = p.variante_id
join public.articulos a on a.id = v.articulo_id
join public.sedes s on s.id = p.sede_id
left join public.estudiantes e on e.id = p.estudiante_id
left join public.v_grupos g on g.id = p.cohorte_id
where p.cerrado_en is null;

-- Alumnos de la carrera con inscripción vigente que no tienen un uniforme en
-- su poder (por alumno: quien renueva al 2.º año ya lo recibió en el 1.º).
create or replace view public.v_sin_uniforme with (security_invoker = true) as
select distinct on (i.estudiante_id)
  i.id as inscripcion_id,
  i.estudiante_id,
  e.codigo,
  e.nombres,
  e.apellidos,
  e.telefono,
  c.sede_id,
  s.nombre as sede_nombre,
  g.nombre as grupo_nombre,
  i.fecha as inscrito_el
from public.inscripciones i
join public.estudiantes e on e.id = i.estudiante_id
join public.cohortes c on c.id = i.cohorte_id
join public.programas pr on pr.codigo = c.programa_codigo
join public.sedes s on s.id = c.sede_id
join public.v_grupos g on g.id = c.id
where i.estado = 'inscrito'
  and pr.tipo = 'carrera'
  and e.archivado_en is null
  and not exists (
    select 1 from public.entregas en join public.inscripciones i2 on i2.id = en.inscripcion_id
     where i2.estudiante_id = i.estudiante_id and en.cantidad > en.devuelta
  )
order by i.estudiante_id, i.fecha desc;

revoke all on public.v_entregas, public.v_prestamos_abiertos, public.v_sin_uniforme from anon, authenticated;
grant select on public.v_entregas, public.v_prestamos_abiertos, public.v_sin_uniforme to authenticated;
