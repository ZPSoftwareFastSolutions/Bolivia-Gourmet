-- ============================================================================
-- 0012 · Sistema interno · Inventario: motor y API (rebanada R4)
-- ----------------------------------------------------------------------------
-- Un solo motor para los dos métodos (especificación §5, enmiendas B.5 y B.6):
--   - PEPS (insumos): cada salida toma de los lotes en orden de ingreso; la
--     parte valorizada es round(valor_que_queda × toma / cantidad_que_queda)
--     y la toma que AGOTA un lote se lleva su valor restante exacto.
--   - Promedio (resto): una capa por variante y sede con la misma fórmula.
-- Cantidades: numeric exacto (llegan como texto «2.500»); valores: centavos.
--
-- Orden de candados (B.10): la caja de la sede (si mueve efectivo), luego los
-- saldos por variante en orden de id, luego los lotes. Nunca en otro orden.
-- ============================================================================

-- ---------------------------------------------------------------- piezas

-- Cantidad escrita como texto con punto decimal y hasta 3 decimales.
create or replace function app.leer_cantidad(p_texto text)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case when btrim(coalesce(p_texto, '')) ~ '^[0-9]{1,9}([.][0-9]{1,3})?$' then btrim(p_texto)::numeric end;
$$;

-- Valida una cantidad para un tipo de artículo: positiva y, en uniformes y
-- utensilios, entera.
create or replace function app.exigir_cantidad(p_texto text, p_tipo public.tipo_de_articulo)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  v numeric := app.leer_cantidad(p_texto);
begin
  if v is null or v <= 0 then
    raise exception using errcode = 'P0001', message = 'cantidad_invalida';
  end if;
  if p_tipo in ('uniforme', 'utensilio') and v <> trunc(v) then
    raise exception using errcode = 'P0001', message = 'cantidad_no_entera';
  end if;
  return v;
end;
$$;

create or replace function app.articulo_de_variante(p_variante uuid)
returns public.articulos
language sql
stable
set search_path = ''
as $$
  select a.* from public.variantes v join public.articulos a on a.id = v.articulo_id where v.id = p_variante;
$$;

-- Crea (si falta) y bloquea el saldo de una variante en una sede.
create or replace function app.bloquear_saldo(p_variante uuid, p_sede uuid)
returns public.existencias
language plpgsql
set search_path = ''
as $$
declare
  v public.existencias%rowtype;
begin
  insert into public.existencias (variante_id, sede_id) values (p_variante, p_sede) on conflict do nothing;
  insert into public.existencias_costo (variante_id, sede_id) values (p_variante, p_sede) on conflict do nothing;
  select * into v from public.existencias e where e.variante_id = p_variante and e.sede_id = p_sede for update;
  return v;
end;
$$;

-- Asienta un movimiento: actualiza el saldo y escribe la fila del libro con lo
-- que quedó. El valor va aparte (app.valorizar), porque solo lo ve administración.
create or replace function app.mover(
  p_operacion uuid,
  p_variante uuid,
  p_sede uuid,
  p_tipo public.tipo_de_movimiento,
  p_cantidad numeric,
  p_delta_disponible numeric,
  p_delta_prestado numeric,
  p_extras jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_disponible numeric;
  v_prestado numeric;
  v_id uuid;
begin
  update public.existencias
     set disponible = disponible + p_delta_disponible, prestado = prestado + p_delta_prestado, actualizado_en = now()
   where variante_id = p_variante and sede_id = p_sede
  returning disponible, prestado into v_disponible, v_prestado;

  insert into public.movimientos (operacion_id, variante_id, sede_id, tipo, fecha, cantidad, delta_disponible, delta_prestado,
                                  disponible_resultante, prestado_resultante, destino, cohorte_id, detalle, motivo_baja,
                                  compra_id, entrega_id, prestamo_id, conteo_id, lote_id, anula_a, registrado_por)
  values (p_operacion, p_variante, p_sede, p_tipo, app.hoy(), p_cantidad, p_delta_disponible, p_delta_prestado,
          v_disponible, v_prestado,
          (p_extras ->> 'destino')::public.destino_de_uso, (p_extras ->> 'cohorte')::uuid, p_extras ->> 'detalle',
          (p_extras ->> 'motivo_baja')::public.motivo_de_baja, (p_extras ->> 'compra')::uuid, (p_extras ->> 'entrega')::uuid,
          (p_extras ->> 'prestamo')::uuid, (p_extras ->> 'conteo')::uuid, (p_extras ->> 'lote')::uuid, (p_extras ->> 'anula_a')::uuid,
          (select auth.uid()))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function app.valorizar(p_movimiento uuid, p_variante uuid, p_sede uuid, p_delta bigint)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_valor bigint;
begin
  update public.existencias_costo set valor = valor + p_delta
   where variante_id = p_variante and sede_id = p_sede
  returning valor into v_valor;
  insert into public.movimientos_costo (movimiento_id, delta_valor, valor_resultante) values (p_movimiento, p_delta, v_valor);
end;
$$;

-- Calcula una salida SIN escribir: {valor, tomas:[{lote, cantidad, valor}]}.
-- Bloquea los lotes que toca. Si no alcanza, `stock_insuficiente` con lo
-- usable, lo pedido y lo vencido (B.5).
create or replace function app.sacar(
  p_variante uuid,
  p_sede uuid,
  p_cantidad numeric,
  p_incluir_vencidos boolean,
  p_lote uuid,
  p_desde_prestado boolean
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_articulo public.articulos%rowtype := app.articulo_de_variante(p_variante);
  v_saldo public.existencias%rowtype;
  v_capa bigint;
  v_hay numeric;
  v_total numeric;
  v_lote record;
  v_toma numeric;
  v_valor_toma bigint;
  v_pendiente numeric := p_cantidad;
  v_valor bigint := 0;
  v_tomas jsonb := '[]'::jsonb;
  v_vencido numeric;
begin
  select * into v_saldo from public.existencias e where e.variante_id = p_variante and e.sede_id = p_sede;

  if v_articulo.valuacion = 'promedio' then
    v_hay := case when p_desde_prestado then coalesce(v_saldo.prestado, 0) else coalesce(v_saldo.disponible, 0) end;
    if p_cantidad > v_hay then
      raise exception using errcode = 'P0001', message = 'stock_insuficiente',
        detail = jsonb_build_object('articulo', v_articulo.nombre, 'disponible', v_hay, 'pedido', p_cantidad, 'vencido', 0,
                                    'unidad', v_articulo.unidad)::text;
    end if;
    select c.valor into v_capa from public.existencias_costo c where c.variante_id = p_variante and c.sede_id = p_sede;
    v_total := v_saldo.disponible + v_saldo.prestado;
    v_valor := case when p_cantidad = v_total then v_capa else round(v_capa * p_cantidad / v_total)::bigint end;
    return jsonb_build_object('valor', v_valor, 'tomas', '[]'::jsonb);
  end if;

  for v_lote in
    select l.id, l.cantidad_restante, l.vence_el, lc.valor_restante
      from public.lotes l join public.lotes_costo lc on lc.lote_id = l.id
     where l.variante_id = p_variante and l.sede_id = p_sede and l.cantidad_restante > 0
       and case when p_lote is not null then l.id = p_lote
                when p_incluir_vencidos then true
                else (l.vence_el is null or l.vence_el >= app.hoy()) end
     order by case when p_incluir_vencidos and l.vence_el < app.hoy() then 0 else 1 end, l.fecha_ingreso, l.secuencia
       for update of l
  loop
    exit when v_pendiente = 0;
    v_toma := least(v_pendiente, v_lote.cantidad_restante);
    v_valor_toma := case when v_toma = v_lote.cantidad_restante then v_lote.valor_restante
                         else round(v_lote.valor_restante * v_toma / v_lote.cantidad_restante)::bigint end;
    v_tomas := v_tomas || jsonb_build_object('lote', v_lote.id, 'cantidad', v_toma, 'valor', v_valor_toma);
    v_pendiente := v_pendiente - v_toma;
    v_valor := v_valor + v_valor_toma;
  end loop;

  if v_pendiente > 0 then
    select coalesce(sum(l.cantidad_restante) filter (where l.vence_el < app.hoy()), 0) into v_vencido
      from public.lotes l where l.variante_id = p_variante and l.sede_id = p_sede and l.cantidad_restante > 0;
    raise exception using errcode = 'P0001', message = 'stock_insuficiente',
      detail = jsonb_build_object('articulo', v_articulo.nombre, 'disponible', p_cantidad - v_pendiente, 'pedido', p_cantidad,
                                  'vencido', case when p_incluir_vencidos then 0 else v_vencido end, 'unidad', v_articulo.unidad)::text;
  end if;
  return jsonb_build_object('valor', v_valor, 'tomas', v_tomas);
end;
$$;

-- Escribe las tomas en los lotes y en movimiento_lotes. Signo 1: sale del
-- lote; signo -1: vuelve al lote (anulación de una salida).
create or replace function app.aplicar_tomas(p_movimiento uuid, p_tomas jsonb, p_signo integer)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_toma jsonb;
begin
  for v_toma in select * from jsonb_array_elements(coalesce(p_tomas, '[]'::jsonb)) loop
    update public.lotes set cantidad_restante = cantidad_restante - p_signo * (v_toma ->> 'cantidad')::numeric
     where id = (v_toma ->> 'lote')::uuid;
    update public.lotes_costo set valor_restante = valor_restante - p_signo * (v_toma ->> 'valor')::bigint
     where lote_id = (v_toma ->> 'lote')::uuid;
    insert into public.movimiento_lotes (movimiento_id, lote_id, cantidad, valor)
    values (p_movimiento, (v_toma ->> 'lote')::uuid, (v_toma ->> 'cantidad')::numeric, (v_toma ->> 'valor')::bigint);
  end loop;
end;
$$;

-- Entrada: en PEPS crea el lote (con su costo y su vencimiento); en promedio
-- solo suma a la capa (lo hace app.valorizar).
create or replace function app.entrar(
  p_movimiento uuid,
  p_variante uuid,
  p_sede uuid,
  p_cantidad numeric,
  p_valor bigint,
  p_vence_el date,
  p_origen public.origen_de_lote
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_lote uuid;
begin
  if (app.articulo_de_variante(p_variante)).valuacion <> 'peps' then
    return null;
  end if;
  insert into public.lotes (variante_id, sede_id, origen, fecha_ingreso, vence_el, cantidad_inicial, cantidad_restante, movimiento_entrada_id)
  values (p_variante, p_sede, p_origen, app.hoy(), p_vence_el, p_cantidad, p_cantidad, p_movimiento)
  returning id into v_lote;
  insert into public.lotes_costo (lote_id, valor_inicial, valor_restante) values (v_lote, p_valor, p_valor);
  insert into public.movimiento_lotes (movimiento_id, lote_id, cantidad, valor) values (p_movimiento, v_lote, p_cantidad, p_valor);
  return v_lote;
end;
$$;

-- Asiento de anulación: deshace exactamente el original (mismos lotes, mismo
-- valor), aunque un lote ya estuviera agotado.
create or replace function app.revertir(p_operacion uuid, p_movimiento uuid, p_motivo text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_mov public.movimientos%rowtype;
  v_delta bigint;
  v_tomas jsonb;
  v_id uuid;
begin
  select * into v_mov from public.movimientos m where m.id = p_movimiento;
  if not found then
    raise exception using errcode = 'P0001', message = 'documento_no_encontrado';
  end if;
  if exists (select 1 from public.movimientos r where r.anula_a = p_movimiento) then
    raise exception using errcode = 'P0001', message = 'ya_anulado';
  end if;
  perform app.bloquear_saldo(v_mov.variante_id, v_mov.sede_id);
  perform 1 from public.lotes l
   where l.id in (select ml.lote_id from public.movimiento_lotes ml where ml.movimiento_id = p_movimiento)
   order by l.secuencia
     for update;
  select coalesce(jsonb_agg(jsonb_build_object('lote', ml.lote_id, 'cantidad', ml.cantidad, 'valor', ml.valor) order by l.secuencia), '[]'::jsonb)
    into v_tomas
    from public.movimiento_lotes ml join public.lotes l on l.id = ml.lote_id
   where ml.movimiento_id = p_movimiento;
  select c.delta_valor into v_delta from public.movimientos_costo c where c.movimiento_id = p_movimiento;

  v_id := app.mover(p_operacion, v_mov.variante_id, v_mov.sede_id, 'anulacion', v_mov.cantidad,
                    -v_mov.delta_disponible, -v_mov.delta_prestado,
                    jsonb_build_object('anula_a', p_movimiento, 'detalle', left(p_motivo, 300)));
  -- Si el original entró a un lote, la anulación lo saca; si salió, lo devuelve.
  perform app.aplicar_tomas(v_id, v_tomas, case when v_mov.delta_disponible + v_mov.delta_prestado > 0 then 1 else -1 end);
  perform app.valorizar(v_id, v_mov.variante_id, v_mov.sede_id, -coalesce(v_delta, 0));
  return v_id;
end;
$$;

revoke all on function app.leer_cantidad(text) from public;
revoke all on function app.exigir_cantidad(text, public.tipo_de_articulo) from public;
revoke all on function app.articulo_de_variante(uuid) from public;
revoke all on function app.bloquear_saldo(uuid, uuid) from public;
revoke all on function app.mover(uuid, uuid, uuid, public.tipo_de_movimiento, numeric, numeric, numeric, jsonb) from public;
revoke all on function app.valorizar(uuid, uuid, uuid, bigint) from public;
revoke all on function app.sacar(uuid, uuid, numeric, boolean, uuid, boolean) from public;
revoke all on function app.aplicar_tomas(uuid, jsonb, integer) from public;
revoke all on function app.entrar(uuid, uuid, uuid, numeric, bigint, date, public.origen_de_lote) from public;
revoke all on function app.revertir(uuid, uuid, text) from public;

-- Línea del resultado para la confirmación: «Harina: 25 kg → 20 kg».
create or replace function app.linea_de_confirmacion(p_variante uuid, p_sede uuid, p_cantidad numeric, p_antes numeric)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('variante', p_variante, 'articulo', a.nombre, 'etiqueta', v.etiqueta, 'unidad', a.unidad,
                            'cantidad', p_cantidad, 'antes', p_antes, 'ahora', e.disponible)
    from public.variantes v join public.articulos a on a.id = v.articulo_id
    join public.existencias e on e.variante_id = v.id and e.sede_id = p_sede
   where v.id = p_variante;
$$;

revoke all on function app.linea_de_confirmacion(uuid, uuid, numeric, numeric) from public;

-- ---------------------------------------------------------------- alta de artículo

create or replace function app.guardar_articulo(p_clave uuid, p_datos jsonb, p_variantes text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previo jsonb;
  v_nombre text := regexp_replace(btrim(coalesce(p_datos ->> 'nombre', '')), '\s+', ' ', 'g');
  v_tipo public.tipo_de_articulo := (p_datos ->> 'tipo')::public.tipo_de_articulo;
  v_unidad public.unidad_de_medida := coalesce(nullif(p_datos ->> 'unidad', '')::public.unidad_de_medida, 'unidad');
  v_vence boolean := coalesce((p_datos ->> 'controla_vencimiento')::boolean, false);
  v_precio bigint := nullif(p_datos ->> 'precio_venta', '')::bigint;
  v_minimo numeric := app.leer_cantidad(coalesce(nullif(p_datos ->> 'stock_minimo', ''), '0'));
  v_icono text := coalesce(nullif(p_datos ->> 'icono', ''),
                           case v_tipo when 'insumo' then 'trigo' when 'uniforme' then 'chaqueta' when 'utensilio' then 'cubiertos' else 'paquete' end);
  v_variantes text[];
  v_id uuid;
  v_codigo text;
begin
  perform app.exigir_permiso('inventario.catalogo');
  v_previo := app.iniciar_operacion(p_clave, 'articulo');
  if v_previo is not null then return v_previo; end if;

  if char_length(v_nombre) not between 1 and 80 or v_tipo is null then
    raise exception using errcode = 'P0001', message = 'datos_invalidos', detail = jsonb_build_object('campos', jsonb_build_array('nombre'))::text;
  end if;
  if v_unidad in ('kg', 'g', 'l', 'ml') and v_tipo in ('uniforme', 'utensilio') then
    raise exception using errcode = 'P0001', message = 'unidad_no_admitida';
  end if;
  if v_vence and v_tipo <> 'insumo' then
    raise exception using errcode = 'P0001', message = 'datos_invalidos', detail = jsonb_build_object('campos', jsonb_build_array('controla_vencimiento'))::text;
  end if;
  if v_precio is not null and v_tipo <> 'uniforme' then
    raise exception using errcode = 'P0001', message = 'precio_solo_uniforme';
  end if;
  if v_precio is not null and v_precio <= 0 then
    raise exception using errcode = 'P0001', message = 'monto_invalido';
  end if;
  if v_minimo is null then
    raise exception using errcode = 'P0001', message = 'cantidad_invalida';
  end if;
  if exists (select 1 from public.articulos a where lower(a.nombre) = lower(v_nombre) and a.activo) then
    raise exception using errcode = 'P0001', message = 'nombre_repetido';
  end if;

  select coalesce(array_agg(e order by n), '{}') into v_variantes
    from (select distinct on (lower(btrim(x))) btrim(x) as e, n
            from unnest(coalesce(p_variantes, '{}')) with ordinality as t(x, n)
           where btrim(x) <> ''
           order by lower(btrim(x)), n) d;
  if cardinality(v_variantes) = 0 then
    v_variantes := array['Única'];
  end if;
  if exists (select 1 from unnest(v_variantes) e where char_length(e) > 20) then
    raise exception using errcode = 'P0001', message = 'variantes_invalidas';
  end if;
  if cardinality(v_variantes) > 1 and v_tipo <> 'uniforme' then
    raise exception using errcode = 'P0001', message = case when v_tipo = 'insumo' then 'insumo_una_variante' else 'variantes_invalidas' end;
  end if;

  insert into public.articulos (codigo, nombre, tipo, categoria, icono, unidad, controla_vencimiento, stock_minimo, precio_venta, registrado_por)
  values ('INS-0000', v_nombre, v_tipo, nullif(btrim(coalesce(p_datos ->> 'categoria', '')), ''), v_icono, v_unidad, v_vence, v_minimo, v_precio,
          (select auth.uid()))
  returning id, codigo into v_id, v_codigo;
  insert into public.variantes (articulo_id, etiqueta, orden)
  select v_id, e, n::smallint from unnest(v_variantes) with ordinality as t(e, n);

  return app.terminar_operacion(p_clave, jsonb_build_object('articulo', v_id, 'codigo', v_codigo, 'nombre', v_nombre));
end;
$$;

-- ---------------------------------------------------------------- saldo inicial (puesta en marcha)

create or replace function app.registrar_saldo_inicial(p_clave uuid, p_sede uuid, p_lineas jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previo jsonb;
  v_linea jsonb;
  v_articulo public.articulos%rowtype;
  v_cantidad numeric;
  v_valor bigint;
  v_vence date;
  v_conteo uuid;
  v_numero bigint;
  v_mov uuid;
  v_variante uuid;
  v_normalizadas jsonb := '[]'::jsonb;
begin
  perform app.exigir_permiso('inventario.ajustar');
  perform app.exigir_sede(p_sede);
  v_previo := app.iniciar_operacion(p_clave, 'saldo_inicial');
  if v_previo is not null then return v_previo; end if;
  if jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception using errcode = 'P0001', message = 'sin_lineas';
  end if;

  -- Validar todo antes de escribir.
  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_variante := (v_linea ->> 'variante')::uuid;
    v_articulo := app.articulo_de_variante(v_variante);
    if v_articulo.id is null or not v_articulo.activo then
      raise exception using errcode = 'P0001', message = 'articulo_inactivo';
    end if;
    v_cantidad := app.exigir_cantidad(v_linea ->> 'cantidad', v_articulo.tipo);
    v_valor := case when (v_linea ->> 'valor') ~ '^[0-9]{1,15}$' then (v_linea ->> 'valor')::bigint end;
    if v_valor is null then
      raise exception using errcode = 'P0001', message = 'monto_invalido';
    end if;
    v_vence := nullif(v_linea ->> 'vence_el', '')::date;
    if v_articulo.controla_vencimiento and v_vence is null then
      raise exception using errcode = 'P0001', message = 'vencimiento_requerido', detail = jsonb_build_object('articulo', v_articulo.nombre)::text;
    end if;
    if exists (select 1 from public.movimientos m where m.variante_id = v_variante and m.sede_id = p_sede) then
      raise exception using errcode = 'P0001', message = 'ya_tiene_movimientos', detail = jsonb_build_object('articulo', v_articulo.nombre)::text;
    end if;
    v_normalizadas := v_normalizadas || jsonb_build_object('variante', v_variante, 'articulo', v_articulo.nombre, 'cantidad', v_cantidad,
                                                           'valor', v_valor, 'vence_el', v_vence);
  end loop;

  perform app.bloquear_saldo(x.variante, p_sede)
     from (select distinct (e ->> 'variante')::uuid as variante from jsonb_array_elements(v_normalizadas) e order by 1) x;

  insert into public.conteos (operacion_id, sede_id, fecha, clase, lineas, registrado_por)
  values (p_clave, p_sede, app.hoy(), 'saldo_inicial', v_normalizadas, (select auth.uid()))
  returning id, numero into v_conteo, v_numero;

  for v_linea in select * from jsonb_array_elements(v_normalizadas) loop
    v_variante := (v_linea ->> 'variante')::uuid;
    v_cantidad := (v_linea ->> 'cantidad')::numeric;
    v_valor := (v_linea ->> 'valor')::bigint;
    v_mov := app.mover(p_clave, v_variante, p_sede, 'saldo_inicial', v_cantidad, v_cantidad, 0, jsonb_build_object('conteo', v_conteo));
    perform app.entrar(v_mov, v_variante, p_sede, v_cantidad, v_valor, nullif(v_linea ->> 'vence_el', '')::date, 'saldo_inicial');
    perform app.valorizar(v_mov, v_variante, p_sede, v_valor);
  end loop;

  return app.terminar_operacion(p_clave, jsonb_build_object('conteo', v_conteo, 'numero', v_numero, 'lineas', jsonb_array_length(v_normalizadas)));
end;
$$;

-- ---------------------------------------------------------------- compra

create or replace function app.registrar_compra(
  p_clave uuid,
  p_sede uuid,
  p_fecha_documento date,
  p_proveedor text,
  p_comprobante public.tipo_de_comprobante,
  p_numero_comprobante text,
  p_medio public.medio_de_pago,
  p_referencia text,
  p_lineas jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previo jsonb;
  v_ref text := nullif(btrim(coalesce(p_referencia, '')), '');
  v_linea jsonb;
  v_articulo public.articulos%rowtype;
  v_variante uuid;
  v_cantidad numeric;
  v_costo bigint;
  v_vence date;
  v_total bigint := 0;
  v_normalizadas jsonb := '[]'::jsonb;
  v_compra uuid;
  v_numero bigint;
  v_mov uuid;
  v_antes numeric;
  v_confirmacion jsonb := '[]'::jsonb;
begin
  perform app.exigir_permiso('inventario.comprar');
  perform app.exigir_sede(p_sede);
  v_previo := app.iniciar_operacion(p_clave, 'compra');
  if v_previo is not null then return v_previo; end if;

  if jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception using errcode = 'P0001', message = 'sin_lineas';
  end if;
  if jsonb_array_length(p_lineas) > 30 then
    raise exception using errcode = 'P0001', message = 'demasiadas_lineas';
  end if;
  if p_medio is null then
    raise exception using errcode = 'P0001', message = 'datos_invalidos', detail = jsonb_build_object('campos', jsonb_build_array('medio'))::text;
  end if;
  if p_medio = 'efectivo' then
    v_ref := null;
  elsif v_ref is null or char_length(v_ref) < 3 then
    raise exception using errcode = 'P0001', message = 'referencia_requerida';
  end if;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_variante := (v_linea ->> 'variante')::uuid;
    v_articulo := app.articulo_de_variante(v_variante);
    if v_articulo.id is null or not v_articulo.activo then
      raise exception using errcode = 'P0001', message = 'articulo_inactivo';
    end if;
    v_cantidad := app.exigir_cantidad(v_linea ->> 'cantidad', v_articulo.tipo);
    v_costo := case when (v_linea ->> 'costo_total') ~ '^[0-9]{1,15}$' then (v_linea ->> 'costo_total')::bigint end;
    if v_costo is null or v_costo <= 0 then
      raise exception using errcode = 'P0001', message = 'monto_invalido';
    end if;
    v_vence := nullif(v_linea ->> 'vence_el', '')::date;
    if v_articulo.controla_vencimiento and v_vence is null then
      raise exception using errcode = 'P0001', message = 'vencimiento_requerido', detail = jsonb_build_object('articulo', v_articulo.nombre)::text;
    end if;
    if v_vence is not null and v_vence < app.hoy() then
      raise exception using errcode = 'P0001', message = 'vencimiento_pasado', detail = jsonb_build_object('articulo', v_articulo.nombre)::text;
    end if;
    if exists (select 1 from jsonb_array_elements(v_normalizadas) n
                where (n ->> 'variante')::uuid = v_variante and (n ->> 'vence_el') is not distinct from v_vence::text) then
      raise exception using errcode = 'P0001', message = 'linea_repetida', detail = jsonb_build_object('articulo', v_articulo.nombre)::text;
    end if;
    v_normalizadas := v_normalizadas || jsonb_build_object('variante', v_variante, 'cantidad', v_cantidad, 'costo', v_costo,
                                                           'vence_el', v_vence, 'detalle', nullif(btrim(coalesce(v_linea ->> 'presentacion', '')), ''));
    v_total := v_total + v_costo;
  end loop;

  -- B.10: caja primero (si es efectivo), luego los saldos por variante.
  if p_medio = 'efectivo' then
    perform app.candado_de_caja(p_sede);
  end if;
  perform app.bloquear_saldo(x.variante, p_sede)
     from (select distinct (e ->> 'variante')::uuid as variante from jsonb_array_elements(v_normalizadas) e order by 1) x;

  insert into public.compras (operacion_id, sede_id, fecha, fecha_documento, proveedor, comprobante, numero_comprobante, medio, referencia, total, registrado_por)
  values (p_clave, p_sede, app.hoy(), p_fecha_documento, nullif(btrim(coalesce(p_proveedor, '')), ''), coalesce(p_comprobante, 'sin_comprobante'),
          nullif(btrim(coalesce(p_numero_comprobante, '')), ''), p_medio, v_ref, v_total, (select auth.uid()))
  returning id, numero into v_compra, v_numero;

  for v_linea in select * from jsonb_array_elements(v_normalizadas) loop
    v_variante := (v_linea ->> 'variante')::uuid;
    v_cantidad := (v_linea ->> 'cantidad')::numeric;
    v_costo := (v_linea ->> 'costo')::bigint;
    select e.disponible into v_antes from public.existencias e where e.variante_id = v_variante and e.sede_id = p_sede;
    v_mov := app.mover(p_clave, v_variante, p_sede, 'compra', v_cantidad, v_cantidad, 0,
                       jsonb_build_object('compra', v_compra, 'detalle', v_linea ->> 'detalle'));
    perform app.entrar(v_mov, v_variante, p_sede, v_cantidad, v_costo, nullif(v_linea ->> 'vence_el', '')::date, 'compra');
    perform app.valorizar(v_mov, v_variante, p_sede, v_costo);
    v_confirmacion := v_confirmacion || app.linea_de_confirmacion(v_variante, p_sede, v_cantidad, v_antes);
  end loop;

  return app.terminar_operacion(p_clave, jsonb_build_object('compra', v_compra, 'numero', v_numero, 'total', v_total, 'lineas', v_confirmacion));
end;
$$;

-- ---------------------------------------------------------------- uso en clase

create or replace function app.usar_insumos(
  p_clave uuid,
  p_sede uuid,
  p_destino public.destino_de_uso,
  p_cohorte uuid,
  p_detalle text,
  p_lineas jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previo jsonb;
  v_detalle text := nullif(btrim(coalesce(p_detalle, '')), '');
  v_linea jsonb;
  v_articulo public.articulos%rowtype;
  v_variante uuid;
  v_cantidad numeric;
  v_salida jsonb;
  v_mov uuid;
  v_antes numeric;
  v_valor bigint := 0;
  v_normalizadas jsonb := '[]'::jsonb;
  v_confirmacion jsonb := '[]'::jsonb;
begin
  perform app.exigir_permiso('inventario.operar');
  perform app.exigir_sede(p_sede);
  v_previo := app.iniciar_operacion(p_clave, 'uso');
  if v_previo is not null then return v_previo; end if;

  if p_destino is null then
    raise exception using errcode = 'P0001', message = 'datos_invalidos', detail = jsonb_build_object('campos', jsonb_build_array('destino'))::text;
  end if;
  if p_destino = 'otro' and (v_detalle is null or char_length(v_detalle) < 3) then
    raise exception using errcode = 'P0001', message = 'detalle_requerido';
  end if;
  if p_cohorte is not null and not exists (select 1 from public.cohortes c where c.id = p_cohorte and c.sede_id = p_sede) then
    raise exception using errcode = 'P0001', message = 'grupo_no_corresponde';
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
    if v_articulo.tipo not in ('insumo', 'otro') then
      raise exception using errcode = 'P0001', message = 'uso_no_admitido', detail = jsonb_build_object('articulo', v_articulo.nombre)::text;
    end if;
    if exists (select 1 from jsonb_array_elements(v_normalizadas) n where (n ->> 'variante')::uuid = v_variante) then
      raise exception using errcode = 'P0001', message = 'linea_repetida', detail = jsonb_build_object('articulo', v_articulo.nombre)::text;
    end if;
    v_cantidad := app.exigir_cantidad(v_linea ->> 'cantidad', v_articulo.tipo);
    v_normalizadas := v_normalizadas || jsonb_build_object('variante', v_variante, 'cantidad', v_cantidad, 'lote', nullif(v_linea ->> 'lote', ''));
  end loop;

  perform app.bloquear_saldo(x.variante, p_sede)
     from (select distinct (e ->> 'variante')::uuid as variante from jsonb_array_elements(v_normalizadas) e order by 1) x;

  for v_linea in
    select e from jsonb_array_elements(v_normalizadas) e order by (e ->> 'variante')::uuid
  loop
    v_variante := (v_linea ->> 'variante')::uuid;
    v_cantidad := (v_linea ->> 'cantidad')::numeric;
    select e.disponible into v_antes from public.existencias e where e.variante_id = v_variante and e.sede_id = p_sede;
    v_salida := app.sacar(v_variante, p_sede, v_cantidad, false, (v_linea ->> 'lote')::uuid, false);
    v_mov := app.mover(p_clave, v_variante, p_sede, 'consumo', v_cantidad, -v_cantidad, 0,
                       jsonb_build_object('destino', p_destino, 'cohorte', p_cohorte, 'detalle', v_detalle, 'lote', v_linea ->> 'lote'));
    perform app.aplicar_tomas(v_mov, v_salida -> 'tomas', 1);
    perform app.valorizar(v_mov, v_variante, p_sede, -(v_salida ->> 'valor')::bigint);
    v_valor := v_valor + (v_salida ->> 'valor')::bigint;
    v_confirmacion := v_confirmacion || app.linea_de_confirmacion(v_variante, p_sede, v_cantidad, v_antes);
  end loop;

  return app.terminar_operacion(p_clave, jsonb_build_object(
    'operacion', p_clave, 'lineas', v_confirmacion,
    'valor', case when app.tiene_permiso('contabilidad.leer') then v_valor end));
end;
$$;

-- ---------------------------------------------------------------- dar de baja

create or replace function app.dar_de_baja(
  p_clave uuid,
  p_sede uuid,
  p_variante uuid,
  p_cantidad text,
  p_motivo_baja public.motivo_de_baja,
  p_detalle text,
  p_lote uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previo jsonb;
  v_detalle text := nullif(btrim(coalesce(p_detalle, '')), '');
  v_articulo public.articulos%rowtype := app.articulo_de_variante(p_variante);
  v_cantidad numeric;
  v_lote public.lotes%rowtype;
  v_salida jsonb;
  v_mov uuid;
  v_antes numeric;
begin
  perform app.exigir_permiso('inventario.operar');
  perform app.exigir_sede(p_sede);
  v_previo := app.iniciar_operacion(p_clave, 'baja');
  if v_previo is not null then return v_previo; end if;

  if v_articulo.id is null then
    raise exception using errcode = 'P0001', message = 'articulo_inactivo';
  end if;
  if p_motivo_baja is null then
    raise exception using errcode = 'P0001', message = 'motivo_requerido';
  end if;
  if p_motivo_baja = 'otro' and (v_detalle is null or char_length(v_detalle) < 3) then
    raise exception using errcode = 'P0001', message = 'detalle_requerido';
  end if;
  v_cantidad := app.exigir_cantidad(p_cantidad, v_articulo.tipo);

  if p_motivo_baja = 'vencimiento' then
    if p_lote is null then
      raise exception using errcode = 'P0001', message = 'lote_requerido';
    end if;
    select * into v_lote from public.lotes l where l.id = p_lote;
    if not found or v_lote.variante_id <> p_variante or v_lote.sede_id <> p_sede then
      raise exception using errcode = 'P0001', message = 'lote_no_corresponde';
    end if;
    if v_lote.vence_el is null or v_lote.vence_el >= app.hoy() then
      raise exception using errcode = 'P0001', message = 'lote_no_vencido';
    end if;
  end if;

  perform app.bloquear_saldo(p_variante, p_sede);
  select e.disponible into v_antes from public.existencias e where e.variante_id = p_variante and e.sede_id = p_sede;
  -- La baja por vencimiento saca ESE lote; las demás, lo vencido primero (B.5).
  v_salida := app.sacar(p_variante, p_sede, v_cantidad, true, case when p_motivo_baja = 'vencimiento' then p_lote end, false);
  v_mov := app.mover(p_clave, p_variante, p_sede, 'baja', v_cantidad, -v_cantidad, 0,
                     jsonb_build_object('motivo_baja', p_motivo_baja, 'detalle', v_detalle,
                                        'lote', case when p_motivo_baja = 'vencimiento' then p_lote end));
  perform app.aplicar_tomas(v_mov, v_salida -> 'tomas', 1);
  perform app.valorizar(v_mov, p_variante, p_sede, -(v_salida ->> 'valor')::bigint);

  return app.terminar_operacion(p_clave, jsonb_build_object(
    'movimiento', v_mov, 'lineas', jsonb_build_array(app.linea_de_confirmacion(p_variante, p_sede, v_cantidad, v_antes)),
    'valor', case when app.tiene_permiso('contabilidad.leer') then (v_salida ->> 'valor')::bigint end));
end;
$$;

-- ---------------------------------------------------------------- conteo físico

-- Si mientras se contaba alguien movió un artículo, el conteo entero se
-- rechaza (`existencia_cambio`): se vuelve a contar. Faltante → PEPS o
-- promedio con lo vencido primero; sobrante → al último costo (crítica 24).
create or replace function app.registrar_conteo(p_clave uuid, p_sede uuid, p_lineas jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previo jsonb;
  v_linea jsonb;
  v_articulo public.articulos%rowtype;
  v_variante uuid;
  v_vista numeric;
  v_contado numeric;
  v_diferencia numeric;
  v_saldo public.existencias%rowtype;
  v_capa bigint;
  v_valor bigint;
  v_vence date;
  v_salida jsonb;
  v_conteo uuid;
  v_numero bigint;
  v_mov uuid;
  v_cambios jsonb := '[]'::jsonb;
  v_normalizadas jsonb := '[]'::jsonb;
  v_ultimo record;
  v_diferencias integer := 0;
begin
  perform app.exigir_permiso('inventario.ajustar');
  perform app.exigir_sede(p_sede);
  v_previo := app.iniciar_operacion(p_clave, 'conteo');
  if v_previo is not null then return v_previo; end if;
  if jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception using errcode = 'P0001', message = 'sin_lineas';
  end if;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_variante := (v_linea ->> 'variante')::uuid;
    v_articulo := app.articulo_de_variante(v_variante);
    if v_articulo.id is null then
      raise exception using errcode = 'P0001', message = 'articulo_inactivo';
    end if;
    if exists (select 1 from jsonb_array_elements(v_normalizadas) n where (n ->> 'variante')::uuid = v_variante) then
      raise exception using errcode = 'P0001', message = 'linea_repetida', detail = jsonb_build_object('articulo', v_articulo.nombre)::text;
    end if;
    v_vista := app.leer_cantidad(v_linea ->> 'existencia_vista');
    v_contado := app.leer_cantidad(v_linea ->> 'contado');
    if v_vista is null or v_contado is null then
      raise exception using errcode = 'P0001', message = 'cantidad_invalida';
    end if;
    if v_articulo.tipo in ('uniforme', 'utensilio') and v_contado <> trunc(v_contado) then
      raise exception using errcode = 'P0001', message = 'cantidad_no_entera';
    end if;
    v_normalizadas := v_normalizadas || jsonb_build_object(
      'variante', v_variante, 'articulo', v_articulo.nombre, 'vista', v_vista, 'contado', v_contado,
      'motivo', nullif(btrim(coalesce(v_linea ->> 'motivo', '')), ''), 'valor', nullif(v_linea ->> 'valor', ''),
      'vence_el', nullif(v_linea ->> 'vence_el', ''));
  end loop;

  -- Bloquear en orden y comparar con lo que vio la persona.
  for v_linea in select e from jsonb_array_elements(v_normalizadas) e order by (e ->> 'variante')::uuid loop
    v_saldo := app.bloquear_saldo((v_linea ->> 'variante')::uuid, p_sede);
    if v_saldo.disponible <> (v_linea ->> 'vista')::numeric then
      v_cambios := v_cambios || jsonb_build_object('articulo', v_linea ->> 'articulo', 'vista', (v_linea ->> 'vista')::numeric, 'ahora', v_saldo.disponible);
    end if;
  end loop;
  if jsonb_array_length(v_cambios) > 0 then
    raise exception using errcode = 'P0001', message = 'existencia_cambio', detail = jsonb_build_object('lineas', v_cambios)::text;
  end if;

  insert into public.conteos (operacion_id, sede_id, fecha, clase, lineas, registrado_por)
  values (p_clave, p_sede, app.hoy(), 'conteo', v_normalizadas, (select auth.uid()))
  returning id, numero into v_conteo, v_numero;

  for v_linea in select e from jsonb_array_elements(v_normalizadas) e order by (e ->> 'variante')::uuid loop
    v_variante := (v_linea ->> 'variante')::uuid;
    v_articulo := app.articulo_de_variante(v_variante);
    v_contado := (v_linea ->> 'contado')::numeric;
    select * into v_saldo from public.existencias e where e.variante_id = v_variante and e.sede_id = p_sede;
    v_diferencia := v_contado - v_saldo.disponible;
    continue when v_diferencia = 0;
    v_diferencias := v_diferencias + 1;
    if (v_linea ->> 'motivo') is null or char_length(v_linea ->> 'motivo') < 3 then
      raise exception using errcode = 'P0001', message = 'motivo_requerido', detail = jsonb_build_object('articulo', v_articulo.nombre)::text;
    end if;

    if v_diferencia < 0 then
      v_salida := app.sacar(v_variante, p_sede, -v_diferencia, true, null, false);
      v_mov := app.mover(p_clave, v_variante, p_sede, 'ajuste_faltante', -v_diferencia, v_diferencia, 0,
                         jsonb_build_object('conteo', v_conteo, 'detalle', v_linea ->> 'motivo'));
      perform app.aplicar_tomas(v_mov, v_salida -> 'tomas', 1);
      perform app.valorizar(v_mov, v_variante, p_sede, -(v_salida ->> 'valor')::bigint);
    else
      v_valor := null;
      if v_articulo.valuacion = 'peps' then
        select lc.valor_inicial, l.cantidad_inicial into v_ultimo
          from public.lotes l join public.lotes_costo lc on lc.lote_id = l.id
         where l.variante_id = v_variante and l.sede_id = p_sede
         order by l.fecha_ingreso desc, l.secuencia desc limit 1;
        if found then v_valor := round(v_ultimo.valor_inicial * v_diferencia / v_ultimo.cantidad_inicial)::bigint; end if;
      else
        select c.valor into v_capa from public.existencias_costo c where c.variante_id = v_variante and c.sede_id = p_sede;
        if v_saldo.total > 0 then
          v_valor := round(v_capa * v_diferencia / v_saldo.total)::bigint;
        else
          select mc.delta_valor as valor_inicial, m.cantidad as cantidad_inicial into v_ultimo
            from public.movimientos m join public.movimientos_costo mc on mc.movimiento_id = m.id
           where m.variante_id = v_variante and m.sede_id = p_sede and m.tipo in ('compra', 'saldo_inicial')
             and not exists (select 1 from public.movimientos r where r.anula_a = m.id)
           order by m.numero desc limit 1;
          if found then v_valor := round(v_ultimo.valor_inicial * v_diferencia / v_ultimo.cantidad_inicial)::bigint; end if;
        end if;
      end if;
      if v_valor is null then
        v_valor := case when (v_linea ->> 'valor') ~ '^[0-9]{1,15}$' then (v_linea ->> 'valor')::bigint end;
        if v_valor is null then
          raise exception using errcode = 'P0001', message = 'costo_requerido', detail = jsonb_build_object('articulo', v_articulo.nombre)::text;
        end if;
      end if;
      v_vence := nullif(v_linea ->> 'vence_el', '')::date;
      if v_articulo.controla_vencimiento and v_vence is null then
        raise exception using errcode = 'P0001', message = 'vencimiento_requerido', detail = jsonb_build_object('articulo', v_articulo.nombre)::text;
      end if;
      v_mov := app.mover(p_clave, v_variante, p_sede, 'ajuste_sobrante', v_diferencia, v_diferencia, 0,
                         jsonb_build_object('conteo', v_conteo, 'detalle', v_linea ->> 'motivo'));
      perform app.entrar(v_mov, v_variante, p_sede, v_diferencia, v_valor, v_vence, 'sobrante');
      perform app.valorizar(v_mov, v_variante, p_sede, v_valor);
    end if;
  end loop;

  return app.terminar_operacion(p_clave, jsonb_build_object('conteo', v_conteo, 'numero', v_numero, 'diferencias', v_diferencias,
                                                            'lineas', jsonb_array_length(v_normalizadas)));
end;
$$;

revoke all on function app.guardar_articulo(uuid, jsonb, text[]) from public;
revoke all on function app.registrar_saldo_inicial(uuid, uuid, jsonb) from public;
revoke all on function app.registrar_compra(uuid, uuid, date, text, public.tipo_de_comprobante, text, public.medio_de_pago, text, jsonb) from public;
revoke all on function app.usar_insumos(uuid, uuid, public.destino_de_uso, uuid, text, jsonb) from public;
revoke all on function app.dar_de_baja(uuid, uuid, uuid, text, public.motivo_de_baja, text, uuid) from public;
revoke all on function app.registrar_conteo(uuid, uuid, jsonb) from public;
grant execute on function app.guardar_articulo(uuid, jsonb, text[]) to authenticated;
grant execute on function app.registrar_saldo_inicial(uuid, uuid, jsonb) to authenticated;
grant execute on function app.registrar_compra(uuid, uuid, date, text, public.tipo_de_comprobante, text, public.medio_de_pago, text, jsonb) to authenticated;
grant execute on function app.usar_insumos(uuid, uuid, public.destino_de_uso, uuid, text, jsonb) to authenticated;
grant execute on function app.dar_de_baja(uuid, uuid, uuid, text, public.motivo_de_baja, text, uuid) to authenticated;
grant execute on function app.registrar_conteo(uuid, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------- fachadas (API)

create or replace function public.guardar_articulo(p_clave uuid, p_datos jsonb, p_variantes text[])
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select app.guardar_articulo(p_clave, p_datos, p_variantes);
$$;

create or replace function public.registrar_saldo_inicial(p_clave uuid, p_sede uuid, p_lineas jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select app.registrar_saldo_inicial(p_clave, p_sede, p_lineas);
$$;

create or replace function public.registrar_compra(
  p_clave uuid,
  p_sede uuid,
  p_fecha_documento date,
  p_proveedor text,
  p_comprobante public.tipo_de_comprobante,
  p_numero_comprobante text,
  p_medio public.medio_de_pago,
  p_referencia text,
  p_lineas jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select app.registrar_compra(p_clave, p_sede, p_fecha_documento, p_proveedor, p_comprobante, p_numero_comprobante, p_medio, p_referencia, p_lineas);
$$;

create or replace function public.usar_insumos(
  p_clave uuid,
  p_sede uuid,
  p_destino public.destino_de_uso,
  p_cohorte uuid,
  p_detalle text,
  p_lineas jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select app.usar_insumos(p_clave, p_sede, p_destino, p_cohorte, p_detalle, p_lineas);
$$;

create or replace function public.dar_de_baja(
  p_clave uuid,
  p_sede uuid,
  p_variante uuid,
  p_cantidad text,
  p_motivo_baja public.motivo_de_baja,
  p_detalle text,
  p_lote uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select app.dar_de_baja(p_clave, p_sede, p_variante, p_cantidad, p_motivo_baja, p_detalle, p_lote);
$$;

create or replace function public.registrar_conteo(p_clave uuid, p_sede uuid, p_lineas jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select app.registrar_conteo(p_clave, p_sede, p_lineas);
$$;

revoke all on function public.guardar_articulo(uuid, jsonb, text[]) from public, anon;
revoke all on function public.registrar_saldo_inicial(uuid, uuid, jsonb) from public, anon;
revoke all on function public.registrar_compra(uuid, uuid, date, text, public.tipo_de_comprobante, text, public.medio_de_pago, text, jsonb) from public, anon;
revoke all on function public.usar_insumos(uuid, uuid, public.destino_de_uso, uuid, text, jsonb) from public, anon;
revoke all on function public.dar_de_baja(uuid, uuid, uuid, text, public.motivo_de_baja, text, uuid) from public, anon;
revoke all on function public.registrar_conteo(uuid, uuid, jsonb) from public, anon;
grant execute on function public.guardar_articulo(uuid, jsonb, text[]) to authenticated;
grant execute on function public.registrar_saldo_inicial(uuid, uuid, jsonb) to authenticated;
grant execute on function public.registrar_compra(uuid, uuid, date, text, public.tipo_de_comprobante, text, public.medio_de_pago, text, jsonb) to authenticated;
grant execute on function public.usar_insumos(uuid, uuid, public.destino_de_uso, uuid, text, jsonb) to authenticated;
grant execute on function public.dar_de_baja(uuid, uuid, uuid, text, public.motivo_de_baja, text, uuid) to authenticated;
grant execute on function public.registrar_conteo(uuid, uuid, jsonb) to authenticated;
