-- ============================================================================
-- Sistema interno v1 · Revisión final (defectos confirmados en la revisión)
-- ----------------------------------------------------------------------------
-- Redefine cuatro funciones (cada una copia su ÚLTIMA definición y cambia solo
-- lo que se indica) y agrega una lectura para las pantallas:
--
--   DB-01 · app.generar_cuotas_de_grupo: ya no devuelve las cuotas anuladas a
--           propósito. Antes llamaba a app.generar_cuotas para todas las
--           inscripciones, y como esa función solo salta los números con cuota
--           vigente, una cuota anulada (beca o descuento: «se corrige anulando
--           el cargo con motivo») volvía a aparecer. Ahora procesa a quien no
--           tiene ninguna cuota de su plan (el plan llegó después) y a quien
--           tiene TODAS anuladas solo si el plan cambió desde entonces (el
--           cambio de precio del ADR 0008 §8: anular todo, corregir el plan,
--           generar otra vez), y en ese caso desde su primer vencimiento, para
--           no cobrar otra vez lo que se saltó con `p_desde` (B.7). Con el plan
--           igual, todo anulado es una beca completa y no vuelve.
--   DB-03 · app.sacar: un lote elegido a mano también respeta el vencimiento,
--           salvo que la operación pida incluir lo vencido (bajas y faltantes
--           de conteo). Antes, `usar_insumos` consumía un lote vencido si se lo
--           nombraba.
--   DB-05 · app.registrar_saldo_inicial: vuelve a comprobar
--           `ya_tiene_movimientos` DESPUÉS de bloquear los saldos. Dos envíos
--           simultáneos con claves distintas pasaban los dos la comprobación
--           previa al candado.
--   DOC-01 · public.resumen_del_mes: un cargo anulado ANTES de su propia fecha
--           (la cuota futura que anula un retiro) nunca se ganó: no cuenta en
--           el total de su mes ni resta en el mes de la anulación. Lo anulado
--           en su fecha o después sigue la regla de §5.7 (cuenta en su mes y
--           resta en el mes de `anulado_el`). El dominio
--           (`contabilidad/resumen.ts`, `ingresosDelMes`) hace lo mismo.
--   Nueva · public.variantes_con_movimientos(p_sede): las variantes que ya
--           tienen movimientos en una sede (las pantallas ofrecen el saldo
--           inicial solo a las que no tienen).
--
-- Orden de candados sin cambios (enmiendas B.10): caja, saldos por variante en
-- orden de id, lotes, documentos.
-- ============================================================================

-- ---------------------------------------------------------------- DB-01 · cuotas de un grupo

create or replace function app.generar_cuotas_de_grupo(p_clave uuid, p_cohorte uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previo jsonb;
  v_ins record;
  v_inscripciones integer := 0;
  v_cuotas integer := 0;
  v_n integer;
begin
  perform app.exigir_permiso('contabilidad.gestionar');
  v_previo := app.iniciar_operacion(p_clave, 'cuotas_de_grupo');
  if v_previo is not null then return v_previo; end if;
  if not exists (select 1 from public.planes_de_pago pl where pl.cohorte_id = p_cohorte) then
    raise exception using errcode = 'P0001', message = 'sin_plan_de_pagos';
  end if;

  -- Qué inscripciones se procesan, según las cuotas de SU plan (grupo y
  -- paquete):
  --   · Ninguna cuota del plan: el plan llegó después de inscribirse. Se crean
  --     todas, como antes (N43).
  --   · Alguna vigente: nada. Lo que falta se anuló a propósito (beca o
  --     descuento) y no vuelve (N90).
  --   · Todas anuladas: solo si el plan ya no es el de esas cuotas: otro monto,
  --     un vencimiento que no cae en primer_vencimiento + (n − 1) × cada_meses,
  --     más cuotas que la última anulada o una cuota que el plan ya no tiene.
  --     Es el cambio de precio del ADR 0008 §8 (anular todo, corregir el
  --     plan, generar otra vez; N91). Con el plan igual, se anularon a
  --     propósito (beca completa) y no vuelven (N102).
  --     Se generan desde el primer vencimiento anulado: quien ya pagaba antes
  --     del sistema (`p_desde`, B.7) no vuelve a deber lo que pagó fuera
  --     (N103). Si esas cuotas empezaban en la 1, no se saltó nada y se pasa
  --     nulo: adelantar el primer vencimiento no pierde la cuota 1.
  -- Se compara con la ÚLTIMA tanda generada (las cuotas con el mismo
  -- `registrado_en`: cada generación es una sola transacción), no con todas
  -- las anuladas: una beca completa dada después de un cambio de precio no
  -- vuelve por culpa de las cuotas del precio anterior.
  for v_ins in
    select i.id, case when u.primera = 1 then null else u.desde end as desde
      from public.inscripciones i
      join public.planes_de_pago pl on pl.cohorte_id = i.cohorte_id and pl.paquete is not distinct from i.paquete
      cross join lateral (
        select count(*) as total,
               count(*) filter (where c.anulado_en is null) as vigentes,
               max(c.registrado_en) as tanda
          from public.cargos c
         where c.inscripcion_id = i.id and c.plan_id = pl.id) t
      cross join lateral (
        select min(c.numero_de_cuota) as primera,
               min(c.vence_el) as desde,
               bool_or(c.monto <> pl.monto_cuota
                       or c.numero_de_cuota > pl.cuotas
                       or c.vence_el <> (pl.primer_vencimiento + make_interval(months => (c.numero_de_cuota - 1) * pl.cada_meses))::date)
                 or max(c.numero_de_cuota) < pl.cuotas as cambio
          from public.cargos c
         where c.inscripcion_id = i.id and c.plan_id = pl.id and c.registrado_en = t.tanda) u
     where i.cohorte_id = p_cohorte and i.estado = 'inscrito'
       and (t.total = 0 or (t.vigentes = 0 and u.cambio))
     order by i.numero
  loop
    v_n := app.generar_cuotas(v_ins.id, v_ins.desde);
    if v_n > 0 then
      v_inscripciones := v_inscripciones + 1;
      v_cuotas := v_cuotas + v_n;
    end if;
  end loop;
  return app.terminar_operacion(p_clave, jsonb_build_object('grupo', p_cohorte, 'inscripciones', v_inscripciones, 'cuotas', v_cuotas));
end;
$$;

revoke all on function app.generar_cuotas_de_grupo(uuid, uuid) from public;
grant execute on function app.generar_cuotas_de_grupo(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------- DB-03 · salidas de inventario

-- Calcula una salida SIN escribir: {valor, tomas:[{lote, cantidad, valor}]}.
-- Bloquea los lotes que toca. Si no alcanza, `stock_insuficiente` con lo
-- usable, lo pedido y lo vencido (B.5). Un lote elegido (p_lote) también
-- respeta el vencimiento salvo p_incluir_vencidos: así un uso en clase nunca
-- toma un lote vencido, aunque lo nombre; la baja por vencimiento sí.
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

  -- El lote elegido y el vencimiento son dos condiciones independientes.
  for v_lote in
    select l.id, l.cantidad_restante, l.vence_el, lc.valor_restante
      from public.lotes l join public.lotes_costo lc on lc.lote_id = l.id
     where l.variante_id = p_variante and l.sede_id = p_sede and l.cantidad_restante > 0
       and (p_lote is null or l.id = p_lote)
       and (p_incluir_vencidos or l.vence_el is null or l.vence_el >= app.hoy())
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
    -- Con un lote elegido, lo vencido que se informa es el de ESE lote.
    select coalesce(sum(l.cantidad_restante) filter (where l.vence_el < app.hoy()), 0) into v_vencido
      from public.lotes l
     where l.variante_id = p_variante and l.sede_id = p_sede and l.cantidad_restante > 0
       and (p_lote is null or l.id = p_lote);
    raise exception using errcode = 'P0001', message = 'stock_insuficiente',
      detail = jsonb_build_object('articulo', v_articulo.nombre, 'disponible', p_cantidad - v_pendiente, 'pedido', p_cantidad,
                                  'vencido', case when p_incluir_vencidos then 0 else v_vencido end, 'unidad', v_articulo.unidad)::text;
  end if;
  return jsonb_build_object('valor', v_valor, 'tomas', v_tomas);
end;
$$;

revoke all on function app.sacar(uuid, uuid, numeric, boolean, uuid, boolean) from public;

-- ---------------------------------------------------------------- DB-05 · saldo inicial

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
  v_ocupado text;
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

  -- Con los saldos ya bloqueados, otra vez: un envío simultáneo (con otra
  -- clave) pudo pasar la comprobación de arriba y escribir antes que este.
  -- Lo que escribe esta misma operación no cuenta (aún no escribió nada).
  select n ->> 'articulo' into v_ocupado
    from jsonb_array_elements(v_normalizadas) n
   where exists (select 1 from public.movimientos m
                  where m.variante_id = (n ->> 'variante')::uuid and m.sede_id = p_sede and m.operacion_id <> p_clave)
   limit 1;
  if v_ocupado is not null then
    raise exception using errcode = 'P0001', message = 'ya_tiene_movimientos', detail = jsonb_build_object('articulo', v_ocupado)::text;
  end if;

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

revoke all on function app.registrar_saldo_inicial(uuid, uuid, jsonb) from public;
grant execute on function app.registrar_saldo_inicial(uuid, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------- DOC-01 · resumen del mes

-- Totales del mes (y de una sede, o de todas). p_mes: cualquier día del mes.
-- Una anulación cuenta en el mes en que se hace, restando; el mes original no
-- cambia. Excepción: un cargo anulado ANTES de su fecha (la cuota futura que
-- anula un retiro) nunca se ganó y no cuenta en ningún mes.
create or replace function public.resumen_del_mes(p_mes date, p_sede uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_desde date := date_trunc('month', coalesce(p_mes, app.hoy()))::date;
  v_hasta date := (date_trunc('month', coalesce(p_mes, app.hoy())) + interval '1 month')::date;
  v_ingresos jsonb;
  v_costo jsonb;
  v_gastos jsonb;
  v_dinero jsonb;
  v_inventario jsonb;
  v_arqueos jsonb;
  v_cierre jsonb;
begin
  perform app.exigir_permiso('contabilidad.leer');

  -- INGRESOS: cargos del mes por grupo de concepto, y los anulados en el mes.
  -- Lo anulado antes de su fecha queda fuera de las dos cuentas.
  select jsonb_build_object(
           'total', coalesce(sum(c.monto) filter (where c.fecha >= v_desde and c.fecha < v_hasta), 0),
           'anulados', coalesce(sum(c.monto) filter (where c.anulado_el >= v_desde and c.anulado_el < v_hasta), 0),
           'por_grupo', coalesce((
             select jsonb_agg(jsonb_build_object('grupo', g.grupo, 'monto', g.monto) order by g.monto desc)
               from (select k2.grupo,
                            sum(case when c2.fecha >= v_desde and c2.fecha < v_hasta then c2.monto else 0 end)
                            - sum(case when c2.anulado_el >= v_desde and c2.anulado_el < v_hasta then c2.monto else 0 end) as monto
                       from public.cargos c2 join public.conceptos k2 on k2.id = c2.concepto_id
                      where (p_sede is null or c2.sede_id = p_sede)
                        and (c2.anulado_el is null or c2.anulado_el >= c2.fecha)
                        and ((c2.fecha >= v_desde and c2.fecha < v_hasta) or (c2.anulado_el >= v_desde and c2.anulado_el < v_hasta))
                      group by k2.grupo) g
              where g.monto <> 0), '[]'::jsonb))
    into v_ingresos
    from public.cargos c
   where (p_sede is null or c.sede_id = p_sede)
     and (c.anulado_el is null or c.anulado_el >= c.fecha)
     and ((c.fecha >= v_desde and c.fecha < v_hasta) or (c.anulado_el >= v_desde and c.anulado_el < v_hasta));

  -- COSTO DE LO USADO: el valor que salió del inventario (y lo que volvió),
  -- por el tipo original (una anulación cuenta como su original, al revés).
  with mov as (
    select coalesce(o.tipo, m.tipo) as tipo, m.tipo = 'anulacion' as es_anulacion, mc.delta_valor
      from public.movimientos m
      join public.movimientos_costo mc on mc.movimiento_id = m.id
      left join public.movimientos o on o.id = m.anula_a
     where m.fecha >= v_desde and m.fecha < v_hasta and (p_sede is null or m.sede_id = p_sede)
  )
  select jsonb_build_object(
           'total', coalesce(-sum(delta_valor) filter (where tipo not in ('compra', 'saldo_inicial')), 0),
           'por_tipo', coalesce((
             select jsonb_agg(jsonb_build_object('tipo', t.tipo, 'monto', t.monto) order by t.monto desc)
               from (select tipo, -sum(delta_valor) as monto from mov where tipo not in ('compra', 'saldo_inicial') group by tipo) t
              where t.monto <> 0), '[]'::jsonb),
           'compras', coalesce(sum(delta_valor) filter (where tipo = 'compra' and not es_anulacion), 0),
           'compras_anuladas', coalesce(-sum(delta_valor) filter (where tipo = 'compra' and es_anulacion), 0),
           'saldos_iniciales', coalesce(sum(delta_valor) filter (where tipo = 'saldo_inicial' and not es_anulacion), 0),
           'saldos_iniciales_anulados', coalesce(-sum(delta_valor) filter (where tipo = 'saldo_inicial' and es_anulacion), 0))
    into v_costo
    from mov;

  -- GASTOS: del mes por concepto, y los anulados en el mes.
  select jsonb_build_object(
           'total', coalesce(sum(g.monto) filter (where g.fecha >= v_desde and g.fecha < v_hasta), 0),
           'anulados', coalesce(sum(g.monto) filter (where g.anulado_el >= v_desde and g.anulado_el < v_hasta), 0),
           'por_concepto', coalesce((
             select jsonb_agg(jsonb_build_object('concepto', x.nombre, 'icono', x.icono, 'monto', x.monto) order by x.monto desc)
               from (select k2.nombre, k2.icono,
                            sum(case when g2.fecha >= v_desde and g2.fecha < v_hasta then g2.monto else 0 end)
                            - sum(case when g2.anulado_el >= v_desde and g2.anulado_el < v_hasta then g2.monto else 0 end) as monto
                       from public.gastos g2 join public.conceptos k2 on k2.id = g2.concepto_id
                      where (p_sede is null or g2.sede_id = p_sede)
                        and ((g2.fecha >= v_desde and g2.fecha < v_hasta) or (g2.anulado_el >= v_desde and g2.anulado_el < v_hasta))
                      group by k2.nombre, k2.icono) x
              where x.monto <> 0), '[]'::jsonb))
    into v_gastos
    from public.gastos g
   where (p_sede is null or g.sede_id = p_sede)
     and ((g.fecha >= v_desde and g.fecha < v_hasta) or (g.anulado_el >= v_desde and g.anulado_el < v_hasta));

  -- DINERO DEL MES por medio: cobros, gastos y compras, con sus anulaciones.
  with docs as (
    select 'cobros' as clase, p.medio, p.monto, p.fecha, p.anulado_el from public.pagos p where p_sede is null or p.sede_id = p_sede
    union all
    select 'gastos', g.medio, g.monto, g.fecha, g.anulado_el from public.gastos g where p_sede is null or g.sede_id = p_sede
    union all
    select 'compras', c.medio, c.total, c.fecha, c.anulado_el from public.compras c where p_sede is null or c.sede_id = p_sede
  ),
  por_medio as (
    select d.medio,
           coalesce(sum(d.monto) filter (where d.clase = 'cobros' and d.fecha >= v_desde and d.fecha < v_hasta), 0) as cobros,
           coalesce(sum(d.monto) filter (where d.clase = 'cobros' and d.anulado_el >= v_desde and d.anulado_el < v_hasta), 0) as cobros_anulados,
           coalesce(sum(d.monto) filter (where d.clase = 'gastos' and d.fecha >= v_desde and d.fecha < v_hasta), 0) as gastos,
           coalesce(sum(d.monto) filter (where d.clase = 'gastos' and d.anulado_el >= v_desde and d.anulado_el < v_hasta), 0) as gastos_anulados,
           coalesce(sum(d.monto) filter (where d.clase = 'compras' and d.fecha >= v_desde and d.fecha < v_hasta), 0) as compras,
           coalesce(sum(d.monto) filter (where d.clase = 'compras' and d.anulado_el >= v_desde and d.anulado_el < v_hasta), 0) as compras_anuladas
      from docs d
     where (d.fecha >= v_desde and d.fecha < v_hasta) or (d.anulado_el >= v_desde and d.anulado_el < v_hasta)
     group by d.medio
  )
  select coalesce(jsonb_object_agg(medio, jsonb_build_object(
           'cobros', cobros, 'cobros_anulados', cobros_anulados, 'gastos', gastos, 'gastos_anulados', gastos_anulados,
           'compras', compras, 'compras_anuladas', compras_anuladas)), '{}'::jsonb)
    into v_dinero
    from por_medio;

  -- Arqueos del mes: la diferencia de cada uno (contado − esperado).
  select coalesce(jsonb_agg(c.diferencia order by c.numero), '[]'::jsonb)
    into v_arqueos
    from public.cierres_de_caja c
   where c.fecha >= v_desde and c.fecha < v_hasta and (p_sede is null or c.sede_id = p_sede);

  -- Cuadre del inventario del mes: valor al inicio y al final según el libro.
  select jsonb_build_object(
           'valor_inicial', coalesce(sum(mc.delta_valor) filter (where m.fecha < v_desde), 0),
           'valor_final', coalesce(sum(mc.delta_valor) filter (where m.fecha < v_hasta), 0))
    into v_inventario
    from public.movimientos m join public.movimientos_costo mc on mc.movimiento_id = m.id
   where p_sede is null or m.sede_id = p_sede;

  -- Cifras de cierre: lo que deben hoy y el valor del inventario hoy.
  select jsonb_build_object(
           'deben', (select coalesce(sum(s.pendiente), 0) from public.v_saldos_de_cargo s where p_sede is null or s.sede_id = p_sede),
           'valor_inventario', (select coalesce(sum(e.valor), 0) from public.existencias_costo e where p_sede is null or e.sede_id = p_sede))
    into v_cierre;

  return jsonb_build_object(
    'desde', v_desde, 'hasta', v_hasta, 'sede', p_sede,
    'ingresos', v_ingresos, 'costo', v_costo, 'gastos', v_gastos, 'dinero', v_dinero,
    'arqueos', v_arqueos, 'inventario', v_inventario, 'hoy', v_cierre);
end;
$$;

revoke all on function public.resumen_del_mes(date, uuid) from public, anon;
grant execute on function public.resumen_del_mes(date, uuid) to authenticated;

-- ---------------------------------------------------------------- nueva lectura · variantes con movimientos

-- Las variantes que ya tienen algún movimiento en la sede (en cualquier
-- sentido, anulaciones incluidas). Corre como quien pregunta (RLS de
-- movimientos) y exige `inventario.leer` para que el error sea el del panel y
-- no una lista vacía.
create or replace function public.variantes_con_movimientos(p_sede uuid)
returns uuid[]
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  perform app.exigir_permiso('inventario.leer');
  return array(select distinct m.variante_id from public.movimientos m where m.sede_id = p_sede);
end;
$$;

revoke all on function public.variantes_con_movimientos(uuid) from public, anon;
grant execute on function public.variantes_con_movimientos(uuid) to authenticated;
