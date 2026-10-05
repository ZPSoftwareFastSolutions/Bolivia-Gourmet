-- ============================================================================
-- 0021 · Sistema interno · Revisar los arqueos con diferencia
-- ----------------------------------------------------------------------------
-- Antes, el aviso «Arqueos con diferencia» del inicio de administración
-- contaba todo arqueo del mes que no cuadró: no había nada que hacer con él y
-- quedaba hasta fin de mes. Ahora administración lo REVISA (habla con quien
-- cerró la caja, busca el cobro o el gasto mal registrado y, si hace falta, lo
-- anula: la anulación entra en el arqueo siguiente) y lo marca revisado con
-- una nota. El aviso cuenta solo los que faltan revisar, de cualquier mes.
--
-- La diferencia NO cambia: es dinero que faltó o sobró de verdad y sigue en
-- el resultado del mes. Revisar es un sello que se pone una vez, como el de
-- anulación (`app.solo_sellos`).
--
-- Adelanta a la v1 la parte «revisar arqueos» de `caja.supervisar`
-- (enmiendas A.2); «verificar QR» sigue en la v1.1.
-- ============================================================================

alter table public.cierres_de_caja
  add column revisado_en timestamptz,
  add column revisado_por uuid references public.perfiles (id),
  add column revision_nota text check (revision_nota is null or char_length(revision_nota) between 3 and 300),
  add constraint cierres_revision_completa check (
    (revisado_en is null and revisado_por is null and revision_nota is null)
    or (revisado_en is not null and revisado_por is not null and revision_nota is not null)
  );

create index cierres_de_caja_revisado_por_idx on public.cierres_de_caja (revisado_por);
create index cierres_de_caja_por_revisar_idx on public.cierres_de_caja (sede_id, numero desc)
  where diferencia <> 0 and revisado_en is null;

-- El libro sigue inmutable salvo el sello de revisión, que se pone una vez.
drop trigger cierres_de_caja_inmutables on public.cierres_de_caja;
create trigger cierres_de_caja_inmutables
  before update or delete on public.cierres_de_caja
  for each row execute function app.solo_sellos('revisado_en', 'revisado_por', 'revision_nota');

insert into public.permisos_de_rol (rol, permiso) values ('administrador', 'caja.supervisar')
on conflict do nothing;

-- ---------------------------------------------------------------- motor

create or replace function app.revisar_arqueo(p_clave uuid, p_cierre uuid, p_nota text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previo jsonb;
  v_nota text := nullif(btrim(coalesce(p_nota, '')), '');
  v_cierre public.cierres_de_caja%rowtype;
begin
  perform app.exigir_permiso('caja.supervisar');
  v_previo := app.iniciar_operacion(p_clave, 'revisar_arqueo');
  if v_previo is not null then return v_previo; end if;
  if v_nota is null or char_length(v_nota) < 3 then
    raise exception using errcode = 'P0001', message = 'nota_requerida';
  end if;
  if char_length(v_nota) > 300 then
    raise exception using errcode = 'P0001', message = 'datos_invalidos', detail = jsonb_build_object('campos', jsonb_build_array('nota'))::text;
  end if;
  select * into v_cierre from public.cierres_de_caja c where c.id = p_cierre for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'documento_no_encontrado';
  end if;
  perform app.exigir_sede(v_cierre.sede_id);
  if v_cierre.diferencia = 0 then
    raise exception using errcode = 'P0001', message = 'arqueo_sin_diferencia';
  end if;
  if v_cierre.revisado_en is not null then
    raise exception using errcode = 'P0001', message = 'ya_revisado';
  end if;
  update public.cierres_de_caja
     set revisado_en = now(), revisado_por = (select auth.uid()), revision_nota = left(v_nota, 300)
   where id = p_cierre;
  return app.terminar_operacion(p_clave, jsonb_build_object('cierre', p_cierre, 'numero', v_cierre.numero, 'diferencia', v_cierre.diferencia));
end;
$$;

create or replace function public.revisar_arqueo(p_clave uuid, p_cierre uuid, p_nota text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select app.revisar_arqueo(p_clave, p_cierre, p_nota);
$$;

revoke all on function app.revisar_arqueo(uuid, uuid, text) from public;
revoke all on function public.revisar_arqueo(uuid, uuid, text) from public, anon;
grant execute on function app.revisar_arqueo(uuid, uuid, text) to authenticated;
grant execute on function public.revisar_arqueo(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------- tablero

-- Igual que en 20261002180100 salvo los arqueos: cuenta los que tienen
-- diferencia y faltan revisar, de cualquier mes (con el filtro del mes, uno
-- sin revisar desaparecía del aviso al cambiar de mes).
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

  -- Efectivo de días anteriores que todavía no entró en un arqueo, con la
  -- sede del registro más antiguo (a donde lleva el aviso).
  with sin_arqueo as (
    select p.fecha, p.sede_id from public.pagos p
     where p.medio = 'efectivo' and p.cierre_id is null and p.fecha < v_hoy and (p_sede is null or p.sede_id = p_sede)
    union all
    select g.fecha, g.sede_id from public.gastos g
     where g.medio = 'efectivo' and g.cierre_id is null and g.fecha < v_hoy and (p_sede is null or g.sede_id = p_sede)
    union all
    select c.fecha, c.sede_id from public.compras c
     where c.medio = 'efectivo' and c.cierre_id is null and c.fecha < v_hoy and (p_sede is null or c.sede_id = p_sede)
    union all
    select p.anulado_el, p.sede_id from public.pagos p
     where p.medio = 'efectivo' and p.anulado_el is not null and p.anulacion_cierre_id is null and p.anulado_el < v_hoy and (p_sede is null or p.sede_id = p_sede)
    union all
    select g.anulado_el, g.sede_id from public.gastos g
     where g.medio = 'efectivo' and g.anulado_el is not null and g.anulacion_cierre_id is null and g.anulado_el < v_hoy and (p_sede is null or g.sede_id = p_sede)
    union all
    select c.anulado_el, c.sede_id from public.compras c
     where c.medio = 'efectivo' and c.anulado_el is not null and c.anulacion_cierre_id is null and c.anulado_el < v_hoy and (p_sede is null or c.sede_id = p_sede)
  )
  select jsonb_build_object('registros', count(*), 'desde', min(fecha),
                            'sede', (select s.sede_id from sin_arqueo s order by s.fecha limit 1),
                            'sedes', count(distinct sede_id))
    into v_efectivo from sin_arqueo;

  -- Arqueos con diferencia que faltan revisar, con la sede del más reciente.
  select jsonb_build_object('cantidad', count(*), 'monto', coalesce(sum(abs(c.diferencia)), 0),
                            'sede', (select c2.sede_id from public.cierres_de_caja c2
                                      where c2.diferencia <> 0 and c2.revisado_en is null and (p_sede is null or c2.sede_id = p_sede)
                                      order by c2.numero desc limit 1),
                            'sedes', count(distinct c.sede_id))
    into v_arqueos
    from public.cierres_de_caja c
   where c.diferencia <> 0 and c.revisado_en is null and (p_sede is null or c.sede_id = p_sede);

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
