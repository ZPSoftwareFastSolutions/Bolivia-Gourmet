-- ============================================================================
-- Sistema interno v1 · R7 · Tablero de administración (especificación §7.7,
-- enmiendas B.12 crítica 29: hasta 4 alertas, 4 cifras del mes, 1 gráfico)
-- ----------------------------------------------------------------------------
-- Lo que el tablero necesita y ningún otro puerto da: efectivo sin arquear de
-- días anteriores, arqueos del mes con diferencia, bajas y faltantes de los
-- últimos 7 días, lo que quedó sin precio, el dinero del mes comparado con el
-- mes anterior a la misma fecha y el dinero de las últimas 8 semanas.
--
-- Lectura (INVOKER, bajo RLS) que exige `contabilidad.leer`. El dinero sigue
-- la regla de §5.7: el alta cuenta en su fecha y la anulación en `anulado_el`.
-- ============================================================================

create or replace function public.tablero_de_administracion(p_sede uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_hoy date := app.hoy();
  v_mes date := date_trunc('month', app.hoy())::date;
  v_mes_anterior date := (date_trunc('month', app.hoy()) - interval '1 month')::date;
  v_corte_anterior date;
  v_lunes date := app.hoy() - (extract(isodow from app.hoy())::integer - 1);
  v_efectivo jsonb;
  v_arqueos jsonb;
  v_bajas jsonb;
  v_sin_precio jsonb;
  v_comparacion jsonb;
  v_semanas jsonb;
begin
  perform app.exigir_permiso('contabilidad.leer');
  -- El mismo día del mes anterior (o su último día, si ese mes es más corto).
  v_corte_anterior := least(v_mes_anterior + (v_hoy - v_mes), v_mes - 1);

  -- Efectivo de días anteriores que todavía no entró en un arqueo.
  with sin_arqueo as (
    select p.fecha from public.pagos p
     where p.medio = 'efectivo' and p.cierre_id is null and p.fecha < v_hoy and (p_sede is null or p.sede_id = p_sede)
    union all
    select g.fecha from public.gastos g
     where g.medio = 'efectivo' and g.cierre_id is null and g.fecha < v_hoy and (p_sede is null or g.sede_id = p_sede)
    union all
    select c.fecha from public.compras c
     where c.medio = 'efectivo' and c.cierre_id is null and c.fecha < v_hoy and (p_sede is null or c.sede_id = p_sede)
    union all
    select p.anulado_el from public.pagos p
     where p.medio = 'efectivo' and p.anulado_el is not null and p.anulacion_cierre_id is null and p.anulado_el < v_hoy and (p_sede is null or p.sede_id = p_sede)
    union all
    select g.anulado_el from public.gastos g
     where g.medio = 'efectivo' and g.anulado_el is not null and g.anulacion_cierre_id is null and g.anulado_el < v_hoy and (p_sede is null or g.sede_id = p_sede)
    union all
    select c.anulado_el from public.compras c
     where c.medio = 'efectivo' and c.anulado_el is not null and c.anulacion_cierre_id is null and c.anulado_el < v_hoy and (p_sede is null or c.sede_id = p_sede)
  )
  select jsonb_build_object('registros', count(*), 'desde', min(fecha)) into v_efectivo from sin_arqueo;

  -- Arqueos de este mes que no cuadraron.
  select jsonb_build_object('cantidad', count(*), 'monto', coalesce(sum(abs(c.diferencia)), 0))
    into v_arqueos
    from public.cierres_de_caja c
   where c.diferencia <> 0 and c.fecha >= v_mes and (p_sede is null or c.sede_id = p_sede);

  -- Bajas y faltantes de los últimos 7 días que siguen vigentes (no anulados).
  select jsonb_build_object('cantidad', count(*), 'monto', coalesce(-sum(mc.delta_valor), 0))
    into v_bajas
    from public.movimientos m
    join public.movimientos_costo mc on mc.movimiento_id = m.id
   where m.tipo in ('baja', 'ajuste_faltante') and m.fecha > v_hoy - 7
     and not exists (select 1 from public.movimientos r where r.anula_a = m.id)
     and (p_sede is null or m.sede_id = p_sede);

  -- Lo que quedó sin precio: grupos con inscritos y sin plan; uniformes
  -- entregados sin cargo y pérdidas en préstamos sin cargo (30 días).
  select jsonb_build_object(
           'grupos', (select count(*) from public.v_grupos g
                       where g.inscritos > 0 and g.planes = 0 and g.estado <> 'cerrado' and (p_sede is null or g.sede_id = p_sede)),
           'entregas', (select count(*) from public.entregas en
                         where en.fecha > v_hoy - 30 and en.contexto <> 'cambio_de_talla' and (p_sede is null or en.sede_id = p_sede)
                           and not exists (select 1 from public.cargos c where c.entrega_id = en.id and c.anulado_en is null)),
           'perdidas', (select count(*) from public.movimientos m
                         where m.tipo = 'baja' and m.prestamo_id is not null and m.fecha > v_hoy - 30 and (p_sede is null or m.sede_id = p_sede)
                           and not exists (select 1 from public.cargos c where c.prestamo_id = m.prestamo_id and c.anulado_en is null)))
    into v_sin_precio;

  -- Dinero que entró (cobros) y salió (gastos y compras), neto de anulaciones.
  with docs as (
    select 'entro' as sentido, p.monto, p.fecha, p.anulado_el from public.pagos p where p_sede is null or p.sede_id = p_sede
    union all
    select 'salio', g.monto, g.fecha, g.anulado_el from public.gastos g where p_sede is null or g.sede_id = p_sede
    union all
    select 'salio', c.total, c.fecha, c.anulado_el from public.compras c where p_sede is null or c.sede_id = p_sede
  ),
  rangos as (
    select 'mes' as clave, v_mes as desde, v_hoy + 1 as hasta
    union all
    select 'anterior', v_mes_anterior, v_corte_anterior + 1
  ),
  netos as (
    select r.clave, d.sentido,
           coalesce(sum(d.monto) filter (where d.fecha >= r.desde and d.fecha < r.hasta), 0)
           - coalesce(sum(d.monto) filter (where d.anulado_el >= r.desde and d.anulado_el < r.hasta), 0) as monto
      from rangos r cross join docs d
     group by r.clave, d.sentido
  )
  select jsonb_build_object(
           'entro_mes', coalesce(sum(monto) filter (where clave = 'mes' and sentido = 'entro'), 0),
           'salio_mes', coalesce(sum(monto) filter (where clave = 'mes' and sentido = 'salio'), 0),
           'entro_anterior', coalesce(sum(monto) filter (where clave = 'anterior' and sentido = 'entro'), 0),
           'salio_anterior', coalesce(sum(monto) filter (where clave = 'anterior' and sentido = 'salio'), 0),
           'corte_anterior', v_corte_anterior)
    into v_comparacion
    from netos;

  -- Las últimas 8 semanas (de lunes a domingo; la última es la actual).
  with docs as (
    select 'entro' as sentido, p.monto, p.fecha, p.anulado_el from public.pagos p where p_sede is null or p.sede_id = p_sede
    union all
    select 'salio', g.monto, g.fecha, g.anulado_el from public.gastos g where p_sede is null or g.sede_id = p_sede
    union all
    select 'salio', c.total, c.fecha, c.anulado_el from public.compras c where p_sede is null or c.sede_id = p_sede
  ),
  semanas as (
    select i, v_lunes - (7 - i) * 7 as desde, v_lunes - (7 - i) * 7 + 7 as hasta from generate_series(0, 7) as i
  ),
  netos as (
    select s.i, s.desde,
           coalesce(sum(d.monto) filter (where d.sentido = 'entro' and d.fecha >= s.desde and d.fecha < s.hasta), 0)
           - coalesce(sum(d.monto) filter (where d.sentido = 'entro' and d.anulado_el >= s.desde and d.anulado_el < s.hasta), 0) as entro,
           coalesce(sum(d.monto) filter (where d.sentido = 'salio' and d.fecha >= s.desde and d.fecha < s.hasta), 0)
           - coalesce(sum(d.monto) filter (where d.sentido = 'salio' and d.anulado_el >= s.desde and d.anulado_el < s.hasta), 0) as salio
      from semanas s left join docs d on true
     group by s.i, s.desde
  )
  select jsonb_agg(jsonb_build_object('desde', desde, 'entro', entro, 'salio', salio) order by i) into v_semanas from netos;

  return jsonb_build_object(
    'hoy', v_hoy, 'efectivo_sin_arqueo', v_efectivo, 'arqueos_con_diferencia', v_arqueos, 'bajas_7_dias', v_bajas,
    'sin_precio', v_sin_precio, 'comparacion', v_comparacion, 'semanas', v_semanas);
end;
$$;

revoke all on function public.tablero_de_administracion(uuid) from public, anon;
grant execute on function public.tablero_de_administracion(uuid) to authenticated;
