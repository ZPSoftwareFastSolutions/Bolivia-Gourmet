-- ============================================================================
-- Sistema interno v1 · R6 · Contabilidad (especificación §5.7)
-- ----------------------------------------------------------------------------
-- Resumen del mes (resultado y dinero) y verificación del cuadre. Son
-- lecturas: corren como quien pregunta (INVOKER, bajo RLS) y exigen
-- `contabilidad.leer`. La base suma; el dominio (`contabilidad/resumen.ts`)
-- combina los totales igual que aquí.
--
-- Una anulación cuenta en el mes en que se hace (`anulado_el` o la fecha del
-- movimiento de anulación), restando; el mes original no cambia. Las compras
-- son dinero e inventario, nunca gasto.
-- ============================================================================

-- Totales del mes (y de una sede, o de todas). p_mes: cualquier día del mes.
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
                        and ((c2.fecha >= v_desde and c2.fecha < v_hasta) or (c2.anulado_el >= v_desde and c2.anulado_el < v_hasta))
                      group by k2.grupo) g
              where g.monto <> 0), '[]'::jsonb))
    into v_ingresos
    from public.cargos c
   where (p_sede is null or c.sede_id = p_sede)
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

-- Verificación del cuadre (enmiendas A.2): el libro y los saldos dicen lo
-- mismo. Cada diferencia sale con el artículo o el documento que la causa.
create or replace function public.verificar_cuadre(p_sede uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_diferencias jsonb;
  v_libro bigint;
  v_saldos bigint;
begin
  perform app.exigir_permiso('contabilidad.leer');

  select coalesce(sum(mc.delta_valor), 0) into v_libro
    from public.movimientos m join public.movimientos_costo mc on mc.movimiento_id = m.id
   where p_sede is null or m.sede_id = p_sede;
  select coalesce(sum(c.valor), 0) into v_saldos from public.existencias_costo c where p_sede is null or c.sede_id = p_sede;

  with libro as (
    select m.variante_id, m.sede_id, sum(m.delta_disponible) as disponible, sum(m.delta_prestado) as prestado, sum(mc.delta_valor) as valor
      from public.movimientos m join public.movimientos_costo mc on mc.movimiento_id = m.id
     where p_sede is null or m.sede_id = p_sede
     group by m.variante_id, m.sede_id
  ),
  lotes as (
    select l.variante_id, l.sede_id, sum(l.cantidad_restante) as cantidad, sum(lc.valor_restante) as valor
      from public.lotes l join public.lotes_costo lc on lc.lote_id = l.id
     where p_sede is null or l.sede_id = p_sede
     group by l.variante_id, l.sede_id
  ),
  saldos as (
    select e.variante_id, e.sede_id, e.disponible, e.prestado, c.valor, a.nombre, a.valuacion, s.nombre as sede
      from public.existencias e
      join public.existencias_costo c using (variante_id, sede_id)
      join public.variantes v on v.id = e.variante_id
      join public.articulos a on a.id = v.articulo_id
      join public.sedes s on s.id = e.sede_id
     where p_sede is null or e.sede_id = p_sede
  ),
  dif as (
    select 'cantidad' as clase, x.nombre || ' (' || x.sede || ')' as detalle
      from saldos x left join libro b using (variante_id, sede_id)
     where x.disponible <> coalesce(b.disponible, 0) or x.prestado <> coalesce(b.prestado, 0)
    union all
    select 'valor', x.nombre || ' (' || x.sede || ')'
      from saldos x left join libro b using (variante_id, sede_id)
     where x.valor <> coalesce(b.valor, 0)
    union all
    select 'lotes', x.nombre || ' (' || x.sede || ')'
      from saldos x left join lotes l using (variante_id, sede_id)
     where x.valuacion = 'peps' and (x.disponible <> coalesce(l.cantidad, 0) or x.valor <> coalesce(l.valor, 0))
    union all
    select 'compra', 'Compra n.º ' || c.numero
      from public.compras c
     where (p_sede is null or c.sede_id = p_sede)
       and c.total <> (select coalesce(sum(mc.delta_valor), 0) from public.movimientos m join public.movimientos_costo mc on mc.movimiento_id = m.id
                        where m.compra_id = c.id and m.tipo = 'compra')
    union all
    select 'cobro', 'Recibo ' || app.numero_de_recibo(s.codigo, p.anio, p.numero)
      from public.pagos p join public.sedes s on s.id = p.sede_id
     where (p_sede is null or p.sede_id = p_sede)
       and p.monto <> (select coalesce(sum(pa.monto), 0) from public.pago_aplicaciones pa where pa.pago_id = p.id)
  )
  select coalesce(jsonb_agg(jsonb_build_object('clase', clase, 'detalle', detalle)), '[]'::jsonb) into v_diferencias
    from (select * from dif limit 50) d;

  return jsonb_build_object('cuadra', jsonb_array_length(v_diferencias) = 0 and v_libro = v_saldos,
                            'valor_libro', v_libro, 'valor_saldos', v_saldos, 'diferencias', v_diferencias);
end;
$$;

revoke all on function public.resumen_del_mes(date, uuid) from public, anon;
revoke all on function public.verificar_cuadre(uuid) from public, anon;
grant execute on function public.resumen_del_mes(date, uuid) to authenticated;
grant execute on function public.verificar_cuadre(uuid) to authenticated;
