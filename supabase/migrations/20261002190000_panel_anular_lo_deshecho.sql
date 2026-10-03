-- ============================================================================
-- 0017 · Sistema interno · Anular compras y saldos iniciales (revisión de R9)
-- ----------------------------------------------------------------------------
-- La revisión del ADR 0007 encontró dos diferencias con la especificación:
-- - Una compra de costo promedio no se podía anular NUNCA después de un uso,
--   aunque ese uso se anulara: la anulación contaba como movimiento
--   posterior. Las enmiendas (A.2) prometen «anula los usos y después la
--   compra». Ahora lo posterior que ya se deshizo no bloquea.
-- - Anular dos veces un saldo inicial respondía «se movió después» en lugar
--   de «ya anulado». Lo mismo en el saldo inicial: lo deshecho no bloquea.
-- Solo cambia `app.anular`; la fachada `public.anular` sigue igual.
-- ============================================================================

create or replace function app.anular(p_clave uuid, p_tipo text, p_id uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previo jsonb;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_pago public.pagos%rowtype;
  v_cargo public.cargos%rowtype;
  v_gasto public.gastos%rowtype;
  v_compra public.compras%rowtype;
  v_mov public.movimientos%rowtype;
  v_fila record;
  v_sede uuid;
  v_medio public.medio_de_pago;
  v_resultado jsonb;
  v_anulados integer := 0;
begin
  if p_tipo not in ('cobro', 'cargo', 'gasto', 'compra', 'uso', 'baja', 'saldo_inicial') then
    raise exception using errcode = 'P0001', message = 'datos_invalidos', detail = jsonb_build_object('campos', jsonb_build_array('tipo'))::text;
  end if;
  perform app.exigir_permiso(case when p_tipo in ('cobro', 'cargo', 'gasto') then 'caja.anular' else 'inventario.anular' end);
  v_previo := app.iniciar_operacion(p_clave, 'anular');
  if v_previo is not null then return v_previo; end if;
  if v_motivo is null or char_length(v_motivo) < 3 then
    raise exception using errcode = 'P0001', message = 'motivo_requerido';
  end if;

  if p_tipo = 'cobro' then
    select p.sede_id, p.medio into v_sede, v_medio from public.pagos p where p.id = p_id;
    if not found then
      raise exception using errcode = 'P0001', message = 'documento_no_encontrado';
    end if;
    if v_medio = 'efectivo' then perform app.candado_de_caja(v_sede); end if;
    select * into v_pago from public.pagos p where p.id = p_id for update;
    if v_pago.anulado_en is not null then
      raise exception using errcode = 'P0001', message = 'ya_anulado';
    end if;
    update public.pagos
       set anulado_en = now(), anulado_el = app.hoy(), anulado_por = (select auth.uid()), anulacion_motivo = left(v_motivo, 300)
     where id = p_id;
    select jsonb_build_object('tipo', 'cobro', 'id', p_id, 'monto', v_pago.monto,
                              'recibo', app.numero_de_recibo(s.codigo, v_pago.anio, v_pago.numero))
      into v_resultado from public.sedes s where s.id = v_pago.sede_id;

  elsif p_tipo = 'cargo' then
    select * into v_cargo from public.cargos c where c.id = p_id for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'documento_no_encontrado';
    end if;
    if v_cargo.anulado_en is not null then
      raise exception using errcode = 'P0001', message = 'ya_anulado';
    end if;
    if exists (select 1 from public.pago_aplicaciones pa join public.pagos p on p.id = pa.pago_id
                where pa.cargo_id = p_id and p.anulado_en is null) then
      raise exception using errcode = 'P0001', message = 'cargo_con_cobros';
    end if;
    update public.cargos
       set anulado_en = now(), anulado_el = app.hoy(), anulado_por = (select auth.uid()), anulacion_motivo = left(v_motivo, 300)
     where id = p_id;
    v_resultado := jsonb_build_object('tipo', 'cargo', 'id', p_id, 'monto', v_cargo.monto, 'estudiante', v_cargo.estudiante_id);

  elsif p_tipo = 'gasto' then
    select g.sede_id, g.medio into v_sede, v_medio from public.gastos g where g.id = p_id;
    if not found then
      raise exception using errcode = 'P0001', message = 'documento_no_encontrado';
    end if;
    if v_medio = 'efectivo' then perform app.candado_de_caja(v_sede); end if;
    select * into v_gasto from public.gastos g where g.id = p_id for update;
    if v_gasto.anulado_en is not null then
      raise exception using errcode = 'P0001', message = 'ya_anulado';
    end if;
    update public.gastos
       set anulado_en = now(), anulado_el = app.hoy(), anulado_por = (select auth.uid()), anulacion_motivo = left(v_motivo, 300)
     where id = p_id;
    v_resultado := jsonb_build_object('tipo', 'gasto', 'id', p_id, 'monto', v_gasto.monto, 'numero', v_gasto.numero);

  elsif p_tipo = 'compra' then
    select c.sede_id, c.medio into v_sede, v_medio from public.compras c where c.id = p_id;
    if not found then
      raise exception using errcode = 'P0001', message = 'documento_no_encontrado';
    end if;
    if v_medio = 'efectivo' then perform app.candado_de_caja(v_sede); end if;
    select * into v_compra from public.compras c where c.id = p_id for update;
    if v_compra.anulado_en is not null then
      raise exception using errcode = 'P0001', message = 'ya_anulado';
    end if;
    perform app.bloquear_saldo(x.variante_id, x.sede_id)
       from (select distinct m.variante_id, m.sede_id from public.movimientos m where m.compra_id = p_id order by 1) x;
    -- Nada de lo comprado se movió después: lotes intactos (PEPS) o ningún
    -- movimiento posterior VIGENTE de esa variante y sede (promedio). Un
    -- movimiento posterior que ya se anuló, y la anulación misma, no cuentan:
    -- se deshicieron al centavo (así funciona «anula los usos y después la
    -- compra», enmiendas A.2).
    if exists (select 1 from public.movimientos m join public.lotes l on l.movimiento_entrada_id = m.id
                where m.compra_id = p_id and l.cantidad_restante <> l.cantidad_inicial)
       or exists (select 1 from public.movimientos m
                   where m.compra_id = p_id
                     and (app.articulo_de_variante(m.variante_id)).valuacion = 'promedio'
                     and exists (select 1 from public.movimientos x
                                  where x.variante_id = m.variante_id and x.sede_id = m.sede_id and x.numero > m.numero
                                    and x.compra_id is distinct from p_id
                                    and x.tipo <> 'anulacion'
                                    and not exists (select 1 from public.movimientos r where r.anula_a = x.id))) then
      raise exception using errcode = 'P0001', message = 'compra_con_movimientos_posteriores';
    end if;
    for v_fila in select m.id from public.movimientos m where m.compra_id = p_id and m.tipo = 'compra' order by m.variante_id, m.numero loop
      perform app.revertir(p_clave, v_fila.id, v_motivo);
      v_anulados := v_anulados + 1;
    end loop;
    update public.compras
       set anulado_en = now(), anulado_el = app.hoy(), anulado_por = (select auth.uid()), anulacion_motivo = left(v_motivo, 300)
     where id = p_id;
    v_resultado := jsonb_build_object('tipo', 'compra', 'id', p_id, 'numero', v_compra.numero, 'total', v_compra.total, 'lineas', v_anulados);

  elsif p_tipo = 'uso' then
    -- p_id es la operación del uso: todas sus líneas vuelven a sus lotes.
    if not exists (select 1 from public.movimientos m where m.operacion_id = p_id and m.tipo = 'consumo') then
      raise exception using errcode = 'P0001', message = 'documento_no_encontrado';
    end if;
    perform app.bloquear_saldo(x.variante_id, x.sede_id)
       from (select distinct m.variante_id, m.sede_id from public.movimientos m where m.operacion_id = p_id and m.tipo = 'consumo' order by 1) x;
    for v_fila in
      select m.id from public.movimientos m
       where m.operacion_id = p_id and m.tipo = 'consumo'
         and not exists (select 1 from public.movimientos r where r.anula_a = m.id)
       order by m.variante_id
    loop
      perform app.revertir(p_clave, v_fila.id, v_motivo);
      v_anulados := v_anulados + 1;
    end loop;
    if v_anulados = 0 then
      raise exception using errcode = 'P0001', message = 'ya_anulado';
    end if;
    v_resultado := jsonb_build_object('tipo', 'uso', 'id', p_id, 'lineas', v_anulados);

  else
    select * into v_mov from public.movimientos m where m.id = p_id;
    if not found or (p_tipo = 'baja' and v_mov.tipo <> 'baja') or (p_tipo = 'saldo_inicial' and v_mov.tipo <> 'saldo_inicial') then
      raise exception using errcode = 'P0001', message = 'documento_no_encontrado';
    end if;
    if v_mov.prestamo_id is not null then
      raise exception using errcode = 'P0001', message = 'baja_de_prestamo';
    end if;
    perform app.bloquear_saldo(v_mov.variante_id, v_mov.sede_id);
    -- Anular dos veces responde «ya anulado» (antes de mirar lo posterior,
    -- donde la propia anulación contaría).
    if exists (select 1 from public.movimientos r where r.anula_a = p_id) then
      raise exception using errcode = 'P0001', message = 'ya_anulado';
    end if;
    if p_tipo = 'saldo_inicial' and exists (select 1 from public.movimientos x where x.variante_id = v_mov.variante_id
                                               and x.sede_id = v_mov.sede_id and x.numero > v_mov.numero
                                               and x.tipo <> 'anulacion'
                                               and not exists (select 1 from public.movimientos r where r.anula_a = x.id)) then
      raise exception using errcode = 'P0001', message = 'compra_con_movimientos_posteriores';
    end if;
    perform app.revertir(p_clave, p_id, v_motivo);
    v_resultado := jsonb_build_object('tipo', p_tipo, 'id', p_id, 'cantidad', v_mov.cantidad);
  end if;

  return app.terminar_operacion(p_clave, v_resultado);
end;
$$;

revoke all on function app.anular(uuid, text, uuid, text) from public;
grant execute on function app.anular(uuid, text, uuid, text) to authenticated;
