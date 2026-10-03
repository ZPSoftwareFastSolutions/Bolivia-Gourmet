-- ============================================================================
-- 0013 · Sistema interno · Inventario y caja (rebanada R4)
-- ----------------------------------------------------------------------------
-- - `anular` suma compra, uso (por operación), baja y saldo inicial. Una
--   compra solo se anula si nada de lo comprado se movió después; una baja de
--   un préstamo no se anula (se registra la devolución, B.12 12).
-- - La caja cuenta las compras en efectivo: salen del cajón al registrarse y
--   vuelven si se anulan (en el arqueo siguiente).
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
    -- movimiento posterior de esa variante y sede (promedio).
    if exists (select 1 from public.movimientos m join public.lotes l on l.movimiento_entrada_id = m.id
                where m.compra_id = p_id and l.cantidad_restante <> l.cantidad_inicial)
       or exists (select 1 from public.movimientos m
                   where m.compra_id = p_id
                     and (app.articulo_de_variante(m.variante_id)).valuacion = 'promedio'
                     and exists (select 1 from public.movimientos x
                                  where x.variante_id = m.variante_id and x.sede_id = m.sede_id and x.numero > m.numero
                                    and x.compra_id is distinct from p_id)) then
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
    if p_tipo = 'saldo_inicial' and exists (select 1 from public.movimientos x where x.variante_id = v_mov.variante_id
                                               and x.sede_id = v_mov.sede_id and x.numero > v_mov.numero) then
      raise exception using errcode = 'P0001', message = 'compra_con_movimientos_posteriores';
    end if;
    perform app.revertir(p_clave, p_id, v_motivo);
    v_resultado := jsonb_build_object('tipo', p_tipo, 'id', p_id, 'cantidad', v_mov.cantidad);
  end if;

  return app.terminar_operacion(p_clave, v_resultado);
end;
$$;

create or replace function app.caja_por_cerrar(p_sede uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ultimo public.cierres_de_caja%rowtype;
  v_hay_anterior boolean;
  v_entradas bigint;
  v_salidas bigint;
  v_qr bigint;
  v_transferencia bigint;
  v_registros integer;
  v_saldo bigint;
begin
  perform app.exigir_permiso('caja.cerrar');
  perform app.exigir_sede(p_sede);

  select * into v_ultimo from public.cierres_de_caja c where c.sede_id = p_sede order by c.cerrado_en desc, c.numero desc limit 1;
  v_hay_anterior := found;
  v_saldo := case when v_hay_anterior then v_ultimo.queda else 0 end;

  select
    coalesce(sum(p.monto) filter (where p.cierre_id is null and p.medio = 'efectivo'), 0),
    coalesce(sum(p.monto) filter (where p.anulado_en is not null and p.anulacion_cierre_id is null and p.medio = 'efectivo'), 0),
    coalesce(sum(p.monto) filter (where p.cierre_id is null and p.medio = 'qr'), 0),
    coalesce(sum(p.monto) filter (where p.cierre_id is null and p.medio = 'transferencia'), 0),
    count(*) filter (where p.cierre_id is null) + count(*) filter (where p.anulado_en is not null and p.anulacion_cierre_id is null)
  into v_entradas, v_salidas, v_qr, v_transferencia, v_registros
  from public.pagos p
  where p.sede_id = p_sede and (p.cierre_id is null or (p.anulado_en is not null and p.anulacion_cierre_id is null));

  select
    v_entradas + coalesce(sum(g.monto) filter (where g.anulado_en is not null and g.anulacion_cierre_id is null and g.medio = 'efectivo'), 0),
    v_salidas + coalesce(sum(g.monto) filter (where g.cierre_id is null and g.medio = 'efectivo'), 0),
    v_registros + count(*) filter (where g.cierre_id is null) + count(*) filter (where g.anulado_en is not null and g.anulacion_cierre_id is null)
  into v_entradas, v_salidas, v_registros
  from public.gastos g
  where g.sede_id = p_sede and (g.cierre_id is null or (g.anulado_en is not null and g.anulacion_cierre_id is null));

  select
    v_entradas + coalesce(sum(c.total) filter (where c.anulado_en is not null and c.anulacion_cierre_id is null and c.medio = 'efectivo'), 0),
    v_salidas + coalesce(sum(c.total) filter (where c.cierre_id is null and c.medio = 'efectivo'), 0),
    v_registros + count(*) filter (where c.cierre_id is null) + count(*) filter (where c.anulado_en is not null and c.anulacion_cierre_id is null)
  into v_entradas, v_salidas, v_registros
  from public.compras c
  where c.sede_id = p_sede and (c.cierre_id is null or (c.anulado_en is not null and c.anulacion_cierre_id is null));

  return jsonb_build_object(
    'primer_arqueo', not v_hay_anterior,
    'saldo_inicial', v_saldo,
    'entradas_efectivo', v_entradas,
    'salidas_efectivo', v_salidas,
    'esperado', v_saldo + v_entradas - v_salidas,
    'cobros_qr', v_qr,
    'cobros_transferencia', v_transferencia,
    'registros', v_registros,
    'ultimo_cierre_en', case when v_hay_anterior then v_ultimo.cerrado_en end,
    'salidas', coalesce((
      select jsonb_agg(jsonb_build_object('quien', x.quien, 'cuando', x.cuando, 'monto', x.monto, 'clase', x.clase) order by x.cuando)
        from (
          select pf.nombres as quien, g.registrado_en as cuando, g.monto, 'salida' as clase
            from public.gastos g join public.perfiles pf on pf.id = g.registrado_por
           where g.sede_id = p_sede and g.cierre_id is null and g.medio = 'efectivo'
          union all
          select pf.nombres, c.registrado_en, c.total, 'salida'
            from public.compras c join public.perfiles pf on pf.id = c.registrado_por
           where c.sede_id = p_sede and c.cierre_id is null and c.medio = 'efectivo'
          union all
          select pf.nombres, p.anulado_en, p.monto, 'cobro_anulado'
            from public.pagos p join public.perfiles pf on pf.id = p.anulado_por
           where p.sede_id = p_sede and p.anulado_en is not null and p.anulacion_cierre_id is null and p.medio = 'efectivo'
        ) x), '[]'::jsonb),
    'digitales', coalesce((
      select jsonb_agg(jsonb_build_object('recibo', app.numero_de_recibo(s.codigo, p.anio, p.numero), 'medio', p.medio,
                                          'referencia', p.referencia, 'monto', p.monto) order by p.registrado_en)
        from public.pagos p join public.sedes s on s.id = p.sede_id
       where p.sede_id = p_sede and p.cierre_id is null and p.medio <> 'efectivo'), '[]'::jsonb)
  );
end;
$$;

create or replace function app.cerrar_caja(
  p_clave uuid,
  p_sede uuid,
  p_contado bigint,
  p_retiro bigint,
  p_observacion text,
  p_saldo_inicial bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previo jsonb;
  v_id uuid := gen_random_uuid();
  v_obs text := nullif(btrim(coalesce(p_observacion, '')), '');
  v_saldo bigint;
  v_hay_anterior boolean;
  v_pagos_alta uuid[];
  v_pagos_anul uuid[];
  v_gastos_alta uuid[];
  v_gastos_anul uuid[];
  v_compras_alta uuid[];
  v_compras_anul uuid[];
  v_entradas bigint;
  v_salidas bigint;
  v_entradas_x bigint;
  v_salidas_x bigint;
  v_qr bigint;
  v_transferencia bigint;
  v_registros integer;
  v_esperado bigint;
  v_numero bigint;
begin
  perform app.exigir_permiso('caja.cerrar');
  perform app.exigir_sede(p_sede);
  v_previo := app.iniciar_operacion(p_clave, 'cierre_de_caja');
  if v_previo is not null then return v_previo; end if;

  if p_contado is null or p_contado < 0 or coalesce(p_retiro, 0) < 0 then
    raise exception using errcode = 'P0001', message = 'monto_invalido';
  end if;
  if coalesce(p_retiro, 0) > p_contado then
    raise exception using errcode = 'P0001', message = 'retiro_excede';
  end if;

  perform app.candado_de_caja(p_sede);

  select c.queda into v_saldo from public.cierres_de_caja c where c.sede_id = p_sede order by c.cerrado_en desc, c.numero desc limit 1;
  v_hay_anterior := found;
  if v_hay_anterior and p_saldo_inicial is not null then
    raise exception using errcode = 'P0001', message = 'saldo_inicial_no_admitido';
  end if;
  if not v_hay_anterior then
    v_saldo := coalesce(p_saldo_inicial, 0);
    if v_saldo < 0 then
      raise exception using errcode = 'P0001', message = 'monto_invalido';
    end if;
  end if;

  select
    coalesce(array_agg(x.id) filter (where x.alta), '{}'),
    coalesce(array_agg(x.id) filter (where x.anul), '{}'),
    coalesce(sum(x.monto) filter (where x.alta and x.medio = 'efectivo'), 0),
    coalesce(sum(x.monto) filter (where x.anul and x.medio = 'efectivo'), 0),
    coalesce(sum(x.monto) filter (where x.alta and x.medio = 'qr'), 0),
    coalesce(sum(x.monto) filter (where x.alta and x.medio = 'transferencia'), 0)
  into v_pagos_alta, v_pagos_anul, v_entradas, v_salidas, v_qr, v_transferencia
  from (
    select p.id, p.medio, p.monto, p.cierre_id is null as alta, (p.anulado_en is not null and p.anulacion_cierre_id is null) as anul
      from public.pagos p
     where p.sede_id = p_sede and (p.cierre_id is null or (p.anulado_en is not null and p.anulacion_cierre_id is null))
       for update
  ) x;

  select
    coalesce(array_agg(x.id) filter (where x.alta), '{}'),
    coalesce(array_agg(x.id) filter (where x.anul), '{}'),
    coalesce(sum(x.monto) filter (where x.anul and x.medio = 'efectivo'), 0),
    coalesce(sum(x.monto) filter (where x.alta and x.medio = 'efectivo'), 0)
  into v_gastos_alta, v_gastos_anul, v_entradas_x, v_salidas_x
  from (
    select g.id, g.medio, g.monto, g.cierre_id is null as alta, (g.anulado_en is not null and g.anulacion_cierre_id is null) as anul
      from public.gastos g
     where g.sede_id = p_sede and (g.cierre_id is null or (g.anulado_en is not null and g.anulacion_cierre_id is null))
       for update
  ) x;
  v_entradas := v_entradas + v_entradas_x;
  v_salidas := v_salidas + v_salidas_x;

  select
    coalesce(array_agg(x.id) filter (where x.alta), '{}'),
    coalesce(array_agg(x.id) filter (where x.anul), '{}'),
    coalesce(sum(x.total) filter (where x.anul and x.medio = 'efectivo'), 0),
    coalesce(sum(x.total) filter (where x.alta and x.medio = 'efectivo'), 0)
  into v_compras_alta, v_compras_anul, v_entradas_x, v_salidas_x
  from (
    select c.id, c.medio, c.total, c.cierre_id is null as alta, (c.anulado_en is not null and c.anulacion_cierre_id is null) as anul
      from public.compras c
     where c.sede_id = p_sede and (c.cierre_id is null or (c.anulado_en is not null and c.anulacion_cierre_id is null))
       for update
  ) x;
  v_entradas := v_entradas + v_entradas_x;
  v_salidas := v_salidas + v_salidas_x;

  v_registros := cardinality(v_pagos_alta) + cardinality(v_pagos_anul) + cardinality(v_gastos_alta) + cardinality(v_gastos_anul)
               + cardinality(v_compras_alta) + cardinality(v_compras_anul);
  if v_registros = 0 then
    raise exception using errcode = 'P0001', message = 'nada_que_arquear';
  end if;
  v_esperado := v_saldo + v_entradas - v_salidas;
  if p_contado <> v_esperado and (v_obs is null or char_length(v_obs) < 3) then
    raise exception using errcode = 'P0001', message = 'observacion_requerida',
      detail = jsonb_build_object('diferencia', p_contado - v_esperado)::text;
  end if;

  insert into public.cierres_de_caja (id, operacion_id, sede_id, fecha, saldo_inicial, entradas_efectivo, salidas_efectivo,
                                      esperado, contado, retiro, cobros_qr, cobros_transferencia, registros, observacion, cerrado_por)
  values (v_id, p_clave, p_sede, app.hoy(), v_saldo, v_entradas, v_salidas, v_esperado, p_contado, coalesce(p_retiro, 0),
          v_qr, v_transferencia, v_registros, left(v_obs, 500), (select auth.uid()))
  returning numero into v_numero;

  update public.pagos set cierre_id = v_id where id = any(v_pagos_alta);
  update public.pagos set anulacion_cierre_id = v_id where id = any(v_pagos_anul);
  update public.gastos set cierre_id = v_id where id = any(v_gastos_alta);
  update public.gastos set anulacion_cierre_id = v_id where id = any(v_gastos_anul);
  update public.compras set cierre_id = v_id where id = any(v_compras_alta);
  update public.compras set anulacion_cierre_id = v_id where id = any(v_compras_anul);

  return app.terminar_operacion(p_clave, jsonb_build_object(
    'cierre', v_id, 'numero', v_numero, 'esperado', v_esperado, 'contado', p_contado,
    'diferencia', p_contado - v_esperado, 'retiro', coalesce(p_retiro, 0), 'queda', p_contado - coalesce(p_retiro, 0),
    'registros', v_registros));
end;
$$;

revoke all on function app.anular(uuid, text, uuid, text) from public;
revoke all on function app.caja_por_cerrar(uuid) from public;
revoke all on function app.cerrar_caja(uuid, uuid, bigint, bigint, text, bigint) from public;
grant execute on function app.anular(uuid, text, uuid, text) to authenticated;
grant execute on function app.caja_por_cerrar(uuid) to authenticated;
grant execute on function app.cerrar_caja(uuid, uuid, bigint, bigint, text, bigint) to authenticated;
