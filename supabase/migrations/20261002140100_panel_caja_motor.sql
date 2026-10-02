-- ============================================================================
-- 0009 · Sistema interno · Caja: motor y API (rebanada R3)
-- ----------------------------------------------------------------------------
-- Cobrar (con recibo sin huecos), cargo manual, gasto, «lo que hay por
-- arquear», cerrar caja, anular (cobro, cargo, gasto) y crear las cuotas de un
-- grupo. Reemplaza las piezas que la R2 dejó en 0: app.generar_cuotas,
-- app.al_retirar y app.alumnos_que_deben.
--
-- Orden de candados (enmiendas B.10): lo que mueve efectivo toma PRIMERO el
-- candado de la caja de su sede; después los cargos (por id) y el recibo.
-- ============================================================================

-- ---------------------------------------------------------------- piezas internas

create or replace function app.candado_de_caja(p_sede uuid)
returns void
language sql
set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtext('caja:' || p_sede::text));
$$;

-- Recibo correlativo por sede y año SIN huecos: el candado serializa y una
-- transacción revertida no deja número tomado.
create or replace function app.siguiente_recibo(p_sede uuid, p_anio smallint)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_numero integer;
begin
  perform pg_advisory_xact_lock(hashtext('recibo:' || p_sede::text || ':' || p_anio::text));
  select coalesce(max(p.numero), 0) + 1 into v_numero from public.pagos p where p.sede_id = p_sede and p.anio = p_anio;
  return v_numero;
end;
$$;

-- Lo que falta pagar de un cargo (lo aplicado de cobros anulados no cuenta).
create or replace function app.pendiente_de_cargo(p_cargo uuid)
returns bigint
language sql
stable
set search_path = ''
as $$
  select case when c.anulado_en is not null then 0
              else greatest(c.monto - coalesce((
                select sum(pa.monto) from public.pago_aplicaciones pa join public.pagos p on p.id = pa.pago_id
                 where pa.cargo_id = c.id and p.anulado_en is null), 0), 0) end
    from public.cargos c where c.id = p_cargo;
$$;

create or replace function app.saldo_de_alumno(p_estudiante uuid)
returns bigint
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(app.pendiente_de_cargo(c.id)), 0)::bigint
    from public.cargos c where c.estudiante_id = p_estudiante and c.anulado_en is null;
$$;

revoke all on function app.candado_de_caja(uuid) from public;
revoke all on function app.siguiente_recibo(uuid, smallint) from public;
revoke all on function app.pendiente_de_cargo(uuid) from public;
revoke all on function app.saldo_de_alumno(uuid) from public;

-- ---------------------------------------------------------------- cuotas (reemplazan las piezas de la R2)

-- Una cuota por número del plan del grupo y paquete: vence el primer
-- vencimiento + (k − 1) × cada_meses meses (PostgreSQL recorta al fin de mes,
-- igual que el dominio). `p_desde` omite las que vencen antes (B.7).
create or replace function app.generar_cuotas(p_inscripcion uuid, p_desde date)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_ins public.inscripciones%rowtype;
  v_plan public.planes_de_pago%rowtype;
  v_grupo text;
  v_sede uuid;
  v_vence date;
  v_creadas integer := 0;
begin
  select * into v_ins from public.inscripciones i where i.id = p_inscripcion;
  if not found then return 0; end if;
  select * into v_plan from public.planes_de_pago pl
   where pl.cohorte_id = v_ins.cohorte_id and pl.paquete is not distinct from v_ins.paquete;
  if not found then return 0; end if;
  select g.nombre, g.sede_id into v_grupo, v_sede from public.v_grupos g where g.id = v_ins.cohorte_id;

  for k in 1 .. v_plan.cuotas loop
    v_vence := (v_plan.primer_vencimiento + make_interval(months => (k - 1) * v_plan.cada_meses))::date;
    continue when p_desde is not null and v_vence < p_desde;
    continue when exists (select 1 from public.cargos c where c.inscripcion_id = p_inscripcion and c.plan_id = v_plan.id
                            and c.numero_de_cuota = k and c.anulado_en is null);
    insert into public.cargos (operacion_id, estudiante_id, inscripcion_id, concepto_id, descripcion, monto, fecha, vence_el,
                               sede_id, origen, plan_id, numero_de_cuota, registrado_por)
    values (v_ins.operacion_id, v_ins.estudiante_id, p_inscripcion, v_plan.concepto_id,
            left(case when v_plan.cuotas > 1 then 'Cuota ' || k || ' de ' || v_plan.cuotas || ' · ' else '' end
                 || case v_ins.paquete when 'economico' then 'Paquete Económico · ' when 'ahorrador' then 'Paquete Ahorrador · ' else '' end
                 || coalesce(v_grupo, 'Grupo'), 200),
            v_plan.monto_cuota, v_vence, v_vence, v_sede, 'plan', v_plan.id, k, (select auth.uid()));
    v_creadas := v_creadas + 1;
  end loop;
  return v_creadas;
end;
$$;

-- Al retirar (B.12, crítica 15): se anulan las cuotas sin cobros que aún no
-- vencen. Las vencidas quedan: se deben.
create or replace function app.al_retirar(p_inscripcion uuid)
returns integer
language sql
set search_path = ''
as $$
  with anuladas as (
    update public.cargos c
       set anulado_en = now(), anulado_el = app.hoy(), anulado_por = (select auth.uid()),
           anulacion_motivo = 'Retiro del alumno: cuota que aún no vencía'
     where c.inscripcion_id = p_inscripcion and c.origen = 'plan' and c.anulado_en is null and c.vence_el > app.hoy()
       and not exists (select 1 from public.pago_aplicaciones pa join public.pagos p on p.id = pa.pago_id
                        where pa.cargo_id = c.id and p.anulado_en is null)
    returning 1
  )
  select count(*)::integer from anuladas;
$$;

create or replace function app.alumnos_que_deben(p_cohorte uuid)
returns integer
language sql
set search_path = ''
as $$
  select count(distinct c.estudiante_id)::integer
    from public.cargos c join public.inscripciones i on i.id = c.inscripcion_id
   where i.cohorte_id = p_cohorte and c.anulado_en is null and app.pendiente_de_cargo(c.id) > 0;
$$;

-- ---------------------------------------------------------------- cobrar

-- Aplicaciones: [{cargo, monto}] (se respetan, B.12 crítica 21); o `p_monto`
-- sin aplicaciones: se reparte del cargo más antiguo al más nuevo. Venta
-- directa: {concepto (código), descripcion, monto, cliente?}.
create or replace function app.registrar_cobro(
  p_clave uuid,
  p_sede uuid,
  p_estudiante uuid,
  p_medio public.medio_de_pago,
  p_referencia text,
  p_aplicaciones jsonb,
  p_monto bigint,
  p_venta jsonb,
  p_nota text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previo jsonb;
  v_ref text := nullif(btrim(coalesce(p_referencia, '')), '');
  v_nota text := nullif(btrim(coalesce(p_nota, '')), '');
  v_cliente text;
  v_alumno public.estudiantes%rowtype;
  v_cargo public.cargos%rowtype;
  v_concepto public.conceptos%rowtype;
  v_aplic record;
  v_anterior uuid;
  v_pend bigint;
  v_resto bigint;
  v_parte bigint;
  v_total bigint := 0;
  v_lista jsonb := '[]'::jsonb;
  v_desc text;
  v_monto_venta bigint;
  v_cargo_venta uuid;
  v_anio smallint := extract(year from app.hoy())::smallint;
  v_numero integer;
  v_pago uuid;
  v_codigo_sede text;
  v_otro text;
begin
  perform app.exigir_permiso('caja.cobrar');
  perform app.exigir_sede(p_sede);
  v_previo := app.iniciar_operacion(p_clave, 'cobro');
  if v_previo is not null then return v_previo; end if;

  if p_medio is null then
    raise exception using errcode = 'P0001', message = 'datos_invalidos', detail = jsonb_build_object('campos', jsonb_build_array('medio'))::text;
  end if;
  if p_medio = 'efectivo' then
    v_ref := null;
  elsif v_ref is null or char_length(v_ref) < 3 then
    raise exception using errcode = 'P0001', message = 'referencia_requerida';
  end if;
  if v_ref is not null then
    select app.numero_de_recibo(s.codigo, p.anio, p.numero) into v_otro
      from public.pagos p join public.sedes s on s.id = p.sede_id
     where p.medio = p_medio and upper(p.referencia) = upper(v_ref) and p.anulado_en is null
     limit 1;
    if v_otro is not null then
      raise exception using errcode = 'P0001', message = 'referencia_repetida', detail = jsonb_build_object('recibo', v_otro)::text;
    end if;
  end if;
  if char_length(coalesce(v_nota, '')) > 300 then
    raise exception using errcode = 'P0001', message = 'datos_invalidos', detail = jsonb_build_object('campos', jsonb_build_array('nota'))::text;
  end if;

  -- B.10: el efectivo toma primero el candado de la caja de su sede.
  if p_medio = 'efectivo' then
    perform app.candado_de_caja(p_sede);
  end if;

  if p_estudiante is not null then
    select * into v_alumno from public.estudiantes e where e.id = p_estudiante;
    if not found then
      raise exception using errcode = 'P0001', message = 'alumno_no_encontrado';
    end if;
  end if;

  -- Cargos indicados: se bloquean en orden de id y se valida cada uno.
  if jsonb_typeof(p_aplicaciones) = 'array' and jsonb_array_length(p_aplicaciones) > 0 then
    if p_estudiante is null then
      raise exception using errcode = 'P0001', message = 'cargo_de_otro_alumno';
    end if;
    v_anterior := null;
    for v_aplic in
      select x.cargo, x.monto from jsonb_to_recordset(p_aplicaciones) as x(cargo uuid, monto bigint) order by x.cargo
    loop
      if v_aplic.cargo is null or v_aplic.monto is null or v_aplic.monto <= 0 then
        raise exception using errcode = 'P0001', message = 'monto_invalido';
      end if;
      if v_aplic.cargo = v_anterior then
        raise exception using errcode = 'P0001', message = 'datos_invalidos', detail = jsonb_build_object('campos', jsonb_build_array('aplicaciones'))::text;
      end if;
      v_anterior := v_aplic.cargo;
      select * into v_cargo from public.cargos c where c.id = v_aplic.cargo for update;
      if not found or v_cargo.estudiante_id is distinct from p_estudiante then
        raise exception using errcode = 'P0001', message = 'cargo_de_otro_alumno';
      end if;
      if v_cargo.anulado_en is not null then
        raise exception using errcode = 'P0001', message = 'cargo_anulado', detail = jsonb_build_object('descripcion', v_cargo.descripcion)::text;
      end if;
      v_pend := app.pendiente_de_cargo(v_cargo.id);
      if v_aplic.monto > v_pend then
        raise exception using errcode = 'P0001', message = 'aplicacion_excede_saldo',
          detail = jsonb_build_object('pendiente', v_pend, 'descripcion', v_cargo.descripcion)::text;
      end if;
      v_lista := v_lista || jsonb_build_object('cargo', v_cargo.id, 'monto', v_aplic.monto);
      v_total := v_total + v_aplic.monto;
    end loop;
  elsif p_monto is not null then
    -- Sin cargos indicados: del más antiguo al más nuevo (vencimiento, registro, id).
    if p_estudiante is null then
      raise exception using errcode = 'P0001', message = 'cobro_sin_aplicar';
    end if;
    if p_monto <= 0 then
      raise exception using errcode = 'P0001', message = 'monto_invalido';
    end if;
    perform 1 from public.cargos c where c.estudiante_id = p_estudiante and c.anulado_en is null order by c.id for update;
    v_resto := p_monto;
    for v_cargo in
      select * from public.cargos c where c.estudiante_id = p_estudiante and c.anulado_en is null
       order by c.vence_el, c.registrado_en, c.id
    loop
      exit when v_resto = 0;
      v_pend := app.pendiente_de_cargo(v_cargo.id);
      continue when v_pend <= 0;
      v_parte := least(v_resto, v_pend);
      v_lista := v_lista || jsonb_build_object('cargo', v_cargo.id, 'monto', v_parte);
      v_total := v_total + v_parte;
      v_resto := v_resto - v_parte;
    end loop;
    if v_total = 0 then
      raise exception using errcode = 'P0001', message = 'cobro_sin_aplicar';
    end if;
    if v_resto > 0 then
      raise exception using errcode = 'P0001', message = 'aplicacion_excede_saldo', detail = jsonb_build_object('pendiente', v_total)::text;
    end if;
  end if;

  -- Venta directa: primero su cargo, que este mismo cobro paga entero.
  if p_venta is not null and jsonb_typeof(p_venta) = 'object' then
    select * into v_concepto from public.conceptos k where k.codigo = p_venta ->> 'concepto' and k.activo;
    if not found or v_concepto.naturaleza <> 'ingreso' then
      raise exception using errcode = 'P0001', message = 'concepto_no_es_ingreso';
    end if;
    v_desc := nullif(btrim(coalesce(p_venta ->> 'descripcion', '')), '');
    if v_desc is null or char_length(v_desc) < 3 or char_length(v_desc) > 200 then
      raise exception using errcode = 'P0001', message = 'detalle_requerido';
    end if;
    v_monto_venta := case when (p_venta ->> 'monto') ~ '^[0-9]{1,15}$' then (p_venta ->> 'monto')::bigint end;
    if v_monto_venta is null or v_monto_venta <= 0 then
      raise exception using errcode = 'P0001', message = 'monto_invalido';
    end if;
    if p_estudiante is null then
      v_cliente := nullif(btrim(coalesce(p_venta ->> 'cliente', '')), '');
      if v_cliente is null or char_length(v_cliente) < 2 or char_length(v_cliente) > 120 then
        raise exception using errcode = 'P0001', message = 'datos_invalidos', detail = jsonb_build_object('campos', jsonb_build_array('cliente'))::text;
      end if;
    end if;
    insert into public.cargos (operacion_id, estudiante_id, cliente, concepto_id, descripcion, monto, fecha, vence_el, sede_id, origen, registrado_por)
    values (p_clave, p_estudiante, v_cliente, v_concepto.id, v_desc, v_monto_venta, app.hoy(), app.hoy(), p_sede, 'venta_directa', (select auth.uid()))
    returning id into v_cargo_venta;
    v_lista := v_lista || jsonb_build_object('cargo', v_cargo_venta, 'monto', v_monto_venta);
    v_total := v_total + v_monto_venta;
  end if;

  if v_total <= 0 or jsonb_array_length(v_lista) = 0 then
    raise exception using errcode = 'P0001', message = 'cobro_sin_aplicar';
  end if;

  v_numero := app.siguiente_recibo(p_sede, v_anio);
  insert into public.pagos (operacion_id, sede_id, fecha, anio, numero, estudiante_id, cliente, monto, medio, referencia, nota, registrado_por)
  values (p_clave, p_sede, app.hoy(), v_anio, v_numero, p_estudiante, v_cliente, v_total, p_medio, v_ref, v_nota, (select auth.uid()))
  returning id into v_pago;

  insert into public.pago_aplicaciones (pago_id, cargo_id, monto)
  select v_pago, (x ->> 'cargo')::uuid, (x ->> 'monto')::bigint from jsonb_array_elements(v_lista) as x;

  select s.codigo into v_codigo_sede from public.sedes s where s.id = p_sede;
  return app.terminar_operacion(p_clave, jsonb_build_object(
    'pago', v_pago,
    'recibo', app.numero_de_recibo(v_codigo_sede, v_anio, v_numero),
    'monto', v_total,
    'medio', p_medio,
    'estudiante', p_estudiante,
    'codigo', v_alumno.codigo,
    'saldo_pendiente', case when p_estudiante is null then 0 else app.saldo_de_alumno(p_estudiante) end
  ));
end;
$$;

-- ---------------------------------------------------------------- cargo manual (administración)

create or replace function app.crear_cargo(
  p_clave uuid,
  p_estudiante uuid,
  p_inscripcion uuid,
  p_concepto uuid,
  p_descripcion text,
  p_monto bigint,
  p_vence_el date,
  p_prestamo uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previo jsonb;
  v_alumno public.estudiantes%rowtype;
  v_sede uuid;
  v_naturaleza public.naturaleza_de_concepto;
  v_desc text := nullif(btrim(coalesce(p_descripcion, '')), '');
  v_id uuid;
begin
  perform app.exigir_permiso('contabilidad.gestionar');
  v_previo := app.iniciar_operacion(p_clave, 'cargo');
  if v_previo is not null then return v_previo; end if;

  select * into v_alumno from public.estudiantes e where e.id = p_estudiante;
  if not found then
    raise exception using errcode = 'P0001', message = 'alumno_no_encontrado';
  end if;
  v_sede := v_alumno.sede_id;
  if p_inscripcion is not null then
    select c.sede_id into v_sede from public.inscripciones i join public.cohortes c on c.id = i.cohorte_id
     where i.id = p_inscripcion and i.estudiante_id = p_estudiante;
    if not found then
      raise exception using errcode = 'P0001', message = 'inscripcion_de_otro_alumno';
    end if;
  end if;
  perform app.exigir_sede(v_sede);
  select k.naturaleza into v_naturaleza from public.conceptos k where k.id = p_concepto and k.activo;
  if v_naturaleza is distinct from 'ingreso' then
    raise exception using errcode = 'P0001', message = 'concepto_no_es_ingreso';
  end if;
  if p_monto is null or p_monto <= 0 then
    raise exception using errcode = 'P0001', message = 'monto_invalido';
  end if;
  if v_desc is null or char_length(v_desc) < 3 or char_length(v_desc) > 200 then
    raise exception using errcode = 'P0001', message = 'detalle_requerido';
  end if;

  insert into public.cargos (operacion_id, estudiante_id, inscripcion_id, concepto_id, descripcion, monto, fecha, vence_el,
                             sede_id, origen, prestamo_id, registrado_por)
  values (p_clave, p_estudiante, p_inscripcion, p_concepto, v_desc, p_monto, app.hoy(), coalesce(p_vence_el, app.hoy()),
          v_sede, 'manual', p_prestamo, (select auth.uid()))
  returning id into v_id;
  return app.terminar_operacion(p_clave, jsonb_build_object('cargo', v_id, 'monto', p_monto, 'codigo', v_alumno.codigo));
end;
$$;

-- ---------------------------------------------------------------- gasto (administración)

create or replace function app.registrar_gasto(
  p_clave uuid,
  p_sede uuid,
  p_fecha date,
  p_concepto uuid,
  p_descripcion text,
  p_monto bigint,
  p_medio public.medio_de_pago,
  p_referencia text,
  p_comprobante public.tipo_de_comprobante,
  p_numero_comprobante text,
  p_proveedor text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previo jsonb;
  v_naturaleza public.naturaleza_de_concepto;
  v_desc text := nullif(btrim(coalesce(p_descripcion, '')), '');
  v_ref text := nullif(btrim(coalesce(p_referencia, '')), '');
  v_fecha date := coalesce(p_fecha, app.hoy());
  v_id uuid;
  v_numero bigint;
begin
  perform app.exigir_permiso('contabilidad.gestionar');
  perform app.exigir_sede(p_sede);
  v_previo := app.iniciar_operacion(p_clave, 'gasto');
  if v_previo is not null then return v_previo; end if;

  select k.naturaleza into v_naturaleza from public.conceptos k where k.id = p_concepto and k.activo;
  if v_naturaleza is distinct from 'gasto' then
    raise exception using errcode = 'P0001', message = 'concepto_no_es_gasto';
  end if;
  if v_desc is null or char_length(v_desc) < 3 or char_length(v_desc) > 200 then
    raise exception using errcode = 'P0001', message = 'detalle_requerido';
  end if;
  if p_monto is null or p_monto <= 0 then
    raise exception using errcode = 'P0001', message = 'monto_invalido';
  end if;
  if p_medio is null then
    raise exception using errcode = 'P0001', message = 'datos_invalidos', detail = jsonb_build_object('campos', jsonb_build_array('medio'))::text;
  end if;
  -- En efectivo sale del cajón de hoy; por banco, hasta 30 días atrás.
  if (p_medio = 'efectivo' and v_fecha <> app.hoy()) or v_fecha > app.hoy() or v_fecha < app.hoy() - 30 then
    raise exception using errcode = 'P0001', message = 'fecha_invalida';
  end if;
  if p_medio = 'efectivo' then
    v_ref := null;
    perform app.candado_de_caja(p_sede);
  elsif v_ref is null or char_length(v_ref) < 3 then
    raise exception using errcode = 'P0001', message = 'referencia_requerida';
  end if;

  insert into public.gastos (operacion_id, sede_id, fecha, concepto_id, descripcion, monto, medio, referencia, comprobante,
                             numero_comprobante, proveedor, registrado_por)
  values (p_clave, p_sede, v_fecha, p_concepto, v_desc, p_monto, p_medio, v_ref, coalesce(p_comprobante, 'sin_comprobante'),
          nullif(btrim(coalesce(p_numero_comprobante, '')), ''), nullif(btrim(coalesce(p_proveedor, '')), ''), (select auth.uid()))
  returning id, numero into v_id, v_numero;
  return app.terminar_operacion(p_clave, jsonb_build_object('gasto', v_id, 'numero', v_numero, 'monto', p_monto));
end;
$$;

-- ---------------------------------------------------------------- caja por cerrar y cerrar caja

-- Solo totales (DEFINER): recepción no lee gastos, pero su arqueo los cuenta.
-- La MISMA cuenta que hará cerrar_caja (crítica 22: las salidas se listan sin
-- concepto ni proveedor).
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
  v_entradas bigint;
  v_salidas bigint;
  v_entradas_g bigint;
  v_salidas_g bigint;
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

  -- Fase 1: se bloquean las filas por arquear y se suman ESAS filas.
  select
    coalesce(array_agg(x.id) filter (where x.alta), '{}'),
    coalesce(array_agg(x.id) filter (where x.anul), '{}'),
    coalesce(sum(x.monto) filter (where x.alta and x.medio = 'efectivo'), 0),
    coalesce(sum(x.monto) filter (where x.anul and x.medio = 'efectivo'), 0),
    coalesce(sum(x.monto) filter (where x.alta and x.medio = 'qr'), 0),
    coalesce(sum(x.monto) filter (where x.alta and x.medio = 'transferencia'), 0),
    count(*) filter (where x.alta) + count(*) filter (where x.anul)
  into v_pagos_alta, v_pagos_anul, v_entradas, v_salidas, v_qr, v_transferencia, v_registros
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
    coalesce(sum(x.monto) filter (where x.alta and x.medio = 'efectivo'), 0),
    count(*) filter (where x.alta) + count(*) filter (where x.anul)
  into v_gastos_alta, v_gastos_anul, v_entradas_g, v_salidas_g, v_registros
  from (
    select g.id, g.medio, g.monto, g.cierre_id is null as alta, (g.anulado_en is not null and g.anulacion_cierre_id is null) as anul
      from public.gastos g
     where g.sede_id = p_sede and (g.cierre_id is null or (g.anulado_en is not null and g.anulacion_cierre_id is null))
       for update
  ) x;
  v_registros := v_registros + cardinality(v_pagos_alta) + cardinality(v_pagos_anul);
  v_entradas := v_entradas + v_entradas_g;
  v_salidas := v_salidas + v_salidas_g;

  if v_registros = 0 then
    raise exception using errcode = 'P0001', message = 'nada_que_arquear';
  end if;
  v_esperado := v_saldo + v_entradas - v_salidas;
  if p_contado <> v_esperado and (v_obs is null or char_length(v_obs) < 3) then
    raise exception using errcode = 'P0001', message = 'observacion_requerida',
      detail = jsonb_build_object('diferencia', p_contado - v_esperado)::text;
  end if;

  -- Fase 2: el arqueo y las marcas en exactamente esas filas.
  insert into public.cierres_de_caja (id, operacion_id, sede_id, fecha, saldo_inicial, entradas_efectivo, salidas_efectivo,
                                      esperado, contado, retiro, cobros_qr, cobros_transferencia, registros, observacion, cerrado_por)
  values (v_id, p_clave, p_sede, app.hoy(), v_saldo, v_entradas, v_salidas, v_esperado, p_contado, coalesce(p_retiro, 0),
          v_qr, v_transferencia, v_registros, left(v_obs, 500), (select auth.uid()))
  returning numero into v_numero;

  update public.pagos set cierre_id = v_id where id = any(v_pagos_alta);
  update public.pagos set anulacion_cierre_id = v_id where id = any(v_pagos_anul);
  update public.gastos set cierre_id = v_id where id = any(v_gastos_alta);
  update public.gastos set anulacion_cierre_id = v_id where id = any(v_gastos_anul);

  return app.terminar_operacion(p_clave, jsonb_build_object(
    'cierre', v_id, 'numero', v_numero, 'esperado', v_esperado, 'contado', p_contado,
    'diferencia', p_contado - v_esperado, 'retiro', coalesce(p_retiro, 0), 'queda', p_contado - coalesce(p_retiro, 0),
    'registros', v_registros));
end;
$$;

-- ---------------------------------------------------------------- anular (una sola forma, D8 y D9)

-- R3: cobro, cargo y gasto. La R4 añade compra, uso y baja.
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
  v_sede uuid;
  v_medio public.medio_de_pago;
  v_resultado jsonb;
begin
  if p_tipo not in ('cobro', 'cargo', 'gasto') then
    raise exception using errcode = 'P0001', message = 'datos_invalidos', detail = jsonb_build_object('campos', jsonb_build_array('tipo'))::text;
  end if;
  perform app.exigir_permiso('caja.anular');
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

  else
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
  end if;

  return app.terminar_operacion(p_clave, v_resultado);
end;
$$;

-- ---------------------------------------------------------------- cuotas de un grupo que ya tenía alumnos

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

  for v_ins in
    select i.id from public.inscripciones i where i.cohorte_id = p_cohorte and i.estado = 'inscrito' order by i.numero
  loop
    v_n := app.generar_cuotas(v_ins.id, null);
    if v_n > 0 then
      v_inscripciones := v_inscripciones + 1;
      v_cuotas := v_cuotas + v_n;
    end if;
  end loop;
  return app.terminar_operacion(p_clave, jsonb_build_object('grupo', p_cohorte, 'inscripciones', v_inscripciones, 'cuotas', v_cuotas));
end;
$$;

revoke all on function app.generar_cuotas(uuid, date) from public;
revoke all on function app.al_retirar(uuid) from public;
revoke all on function app.alumnos_que_deben(uuid) from public;
revoke all on function app.registrar_cobro(uuid, uuid, uuid, public.medio_de_pago, text, jsonb, bigint, jsonb, text) from public;
revoke all on function app.crear_cargo(uuid, uuid, uuid, uuid, text, bigint, date, uuid) from public;
revoke all on function app.registrar_gasto(uuid, uuid, date, uuid, text, bigint, public.medio_de_pago, text, public.tipo_de_comprobante, text, text) from public;
revoke all on function app.caja_por_cerrar(uuid) from public;
revoke all on function app.cerrar_caja(uuid, uuid, bigint, bigint, text, bigint) from public;
revoke all on function app.anular(uuid, text, uuid, text) from public;
revoke all on function app.generar_cuotas_de_grupo(uuid, uuid) from public;
grant execute on function app.registrar_cobro(uuid, uuid, uuid, public.medio_de_pago, text, jsonb, bigint, jsonb, text) to authenticated;
grant execute on function app.crear_cargo(uuid, uuid, uuid, uuid, text, bigint, date, uuid) to authenticated;
grant execute on function app.registrar_gasto(uuid, uuid, date, uuid, text, bigint, public.medio_de_pago, text, public.tipo_de_comprobante, text, text) to authenticated;
grant execute on function app.caja_por_cerrar(uuid) to authenticated;
grant execute on function app.cerrar_caja(uuid, uuid, bigint, bigint, text, bigint) to authenticated;
grant execute on function app.anular(uuid, text, uuid, text) to authenticated;
grant execute on function app.generar_cuotas_de_grupo(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------- fachadas (API)

create or replace function public.registrar_cobro(
  p_clave uuid,
  p_sede uuid,
  p_estudiante uuid,
  p_medio public.medio_de_pago,
  p_referencia text,
  p_aplicaciones jsonb,
  p_monto bigint,
  p_venta jsonb,
  p_nota text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select app.registrar_cobro(p_clave, p_sede, p_estudiante, p_medio, p_referencia, p_aplicaciones, p_monto, p_venta, p_nota);
$$;

create or replace function public.crear_cargo(
  p_clave uuid,
  p_estudiante uuid,
  p_inscripcion uuid,
  p_concepto uuid,
  p_descripcion text,
  p_monto bigint,
  p_vence_el date,
  p_prestamo uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select app.crear_cargo(p_clave, p_estudiante, p_inscripcion, p_concepto, p_descripcion, p_monto, p_vence_el, p_prestamo);
$$;

create or replace function public.registrar_gasto(
  p_clave uuid,
  p_sede uuid,
  p_fecha date,
  p_concepto uuid,
  p_descripcion text,
  p_monto bigint,
  p_medio public.medio_de_pago,
  p_referencia text,
  p_comprobante public.tipo_de_comprobante,
  p_numero_comprobante text,
  p_proveedor text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select app.registrar_gasto(p_clave, p_sede, p_fecha, p_concepto, p_descripcion, p_monto, p_medio, p_referencia,
                             p_comprobante, p_numero_comprobante, p_proveedor);
$$;

create or replace function public.caja_por_cerrar(p_sede uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select app.caja_por_cerrar(p_sede);
$$;

create or replace function public.cerrar_caja(
  p_clave uuid,
  p_sede uuid,
  p_contado bigint,
  p_retiro bigint,
  p_observacion text,
  p_saldo_inicial bigint
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select app.cerrar_caja(p_clave, p_sede, p_contado, p_retiro, p_observacion, p_saldo_inicial);
$$;

create or replace function public.anular(p_clave uuid, p_tipo text, p_id uuid, p_motivo text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select app.anular(p_clave, p_tipo, p_id, p_motivo);
$$;

create or replace function public.generar_cuotas_de_grupo(p_clave uuid, p_cohorte uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select app.generar_cuotas_de_grupo(p_clave, p_cohorte);
$$;

revoke all on function public.registrar_cobro(uuid, uuid, uuid, public.medio_de_pago, text, jsonb, bigint, jsonb, text) from public, anon;
revoke all on function public.crear_cargo(uuid, uuid, uuid, uuid, text, bigint, date, uuid) from public, anon;
revoke all on function public.registrar_gasto(uuid, uuid, date, uuid, text, bigint, public.medio_de_pago, text, public.tipo_de_comprobante, text, text) from public, anon;
revoke all on function public.caja_por_cerrar(uuid) from public, anon;
revoke all on function public.cerrar_caja(uuid, uuid, bigint, bigint, text, bigint) from public, anon;
revoke all on function public.anular(uuid, text, uuid, text) from public, anon;
revoke all on function public.generar_cuotas_de_grupo(uuid, uuid) from public, anon;
grant execute on function public.registrar_cobro(uuid, uuid, uuid, public.medio_de_pago, text, jsonb, bigint, jsonb, text) to authenticated;
grant execute on function public.crear_cargo(uuid, uuid, uuid, uuid, text, bigint, date, uuid) to authenticated;
grant execute on function public.registrar_gasto(uuid, uuid, date, uuid, text, bigint, public.medio_de_pago, text, public.tipo_de_comprobante, text, text) to authenticated;
grant execute on function public.caja_por_cerrar(uuid) to authenticated;
grant execute on function public.cerrar_caja(uuid, uuid, bigint, bigint, text, bigint) to authenticated;
grant execute on function public.anular(uuid, text, uuid, text) to authenticated;
grant execute on function public.generar_cuotas_de_grupo(uuid, uuid) to authenticated;
