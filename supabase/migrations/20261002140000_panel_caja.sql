-- ============================================================================
-- 0008 · Sistema interno · Caja (rebanada R3): tablas, reglas y vistas
-- ----------------------------------------------------------------------------
-- En simple (especificación §2.4): un CARGO es lo que el alumno debe; un
-- COBRO es dinero que entró y tiene recibo sin huecos; un GASTO es dinero que
-- salió para funcionar; un CIERRE DE CAJA (arqueo) cuenta el efectivo.
--
-- Nadie escribe estas tablas por la API: solo los motores DEFINER. Un
-- documento no se borra ni se edita: se ANULA (sello con quién, cuándo y por
-- qué) y la anulación mueve el dinero al revés en el arqueo siguiente.
-- Motor y API: 20261002140100_panel_caja_motor.sql.
-- ============================================================================

create type public.origen_de_cargo as enum ('plan', 'entrega', 'venta_directa', 'manual');
create type public.medio_de_pago as enum ('efectivo', 'qr', 'transferencia');
create type public.tipo_de_comprobante as enum ('factura', 'recibo', 'nota_de_venta', 'sin_comprobante');

-- ---------------------------------------------------------------- inmutabilidad

-- Un documento de dinero solo cambia en las columnas que se pasan como
-- argumentos del disparador (el sello de anulación, la marca del arqueo), y
-- cada una solo de nulo a valor, una vez. Nada se borra. En modo
-- mantenimiento (solo los scripts de la demo desde el editor SQL) se permite.
create or replace function app.solo_sellos()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_permitidas text[] := coalesce(tg_argv, '{}'::text[]);
  v_columna text;
begin
  if app.en_mantenimiento() then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    raise exception using errcode = 'P0001', message = 'libro_inmutable';
  end if;
  if (to_jsonb(new) - v_permitidas) is distinct from (to_jsonb(old) - v_permitidas) then
    raise exception using errcode = 'P0001', message = 'libro_inmutable';
  end if;
  foreach v_columna in array v_permitidas loop
    if (to_jsonb(old) ->> v_columna) is not null
       and (to_jsonb(new) ->> v_columna) is distinct from (to_jsonb(old) ->> v_columna) then
      raise exception using errcode = 'P0001', message = 'libro_inmutable';
    end if;
  end loop;
  return new;
end;
$$;

revoke all on function app.solo_sellos() from public;

-- ---------------------------------------------------------------- cierres de caja (arqueos)

create table public.cierres_de_caja (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique,
  operacion_id uuid not null references public.operaciones (clave),
  sede_id uuid not null references public.sedes (id),
  fecha date not null,
  saldo_inicial bigint not null check (saldo_inicial >= 0),
  entradas_efectivo bigint not null check (entradas_efectivo >= 0),
  salidas_efectivo bigint not null check (salidas_efectivo >= 0),
  esperado bigint not null,
  contado bigint not null check (contado >= 0),
  diferencia bigint generated always as (contado - esperado) stored,
  retiro bigint not null default 0 check (retiro >= 0),
  queda bigint generated always as (contado - retiro) stored,
  cobros_qr bigint not null default 0 check (cobros_qr >= 0),
  cobros_transferencia bigint not null default 0 check (cobros_transferencia >= 0),
  registros integer not null check (registros > 0),
  observacion text check (observacion is null or char_length(observacion) between 3 and 500),
  cerrado_por uuid not null default auth.uid() references public.perfiles (id),
  cerrado_en timestamptz not null default now(),
  constraint cierres_retiro_no_excede check (retiro <= contado),
  constraint cierres_esperado check (esperado = saldo_inicial + entradas_efectivo - salidas_efectivo),
  constraint cierres_observacion_si_no_cuadra check (contado = esperado or observacion is not null)
);

comment on table public.cierres_de_caja is
  'Arqueos de caja: cuánto efectivo debía haber, cuánto se contó, cuánto se retiró y cuánto quedó para el cambio.';

create index cierres_de_caja_sede_idx on public.cierres_de_caja (sede_id, cerrado_en desc);
create index cierres_de_caja_operacion_idx on public.cierres_de_caja (operacion_id);
create index cierres_de_caja_cerrado_por_idx on public.cierres_de_caja (cerrado_por);

create trigger cierres_de_caja_inmutables
  before update or delete on public.cierres_de_caja
  for each row execute function app.solo_sellos();

-- ---------------------------------------------------------------- cargos (lo que deben)

create table public.cargos (
  id uuid primary key default gen_random_uuid(),
  operacion_id uuid not null references public.operaciones (clave),
  estudiante_id uuid references public.estudiantes (id),
  cliente text check (cliente is null or char_length(cliente) between 2 and 120),
  inscripcion_id uuid references public.inscripciones (id),
  concepto_id uuid not null references public.conceptos (id),
  descripcion text not null check (char_length(descripcion) between 3 and 200),
  monto bigint not null check (monto > 0),
  fecha date not null,
  vence_el date not null,
  sede_id uuid not null references public.sedes (id),
  origen public.origen_de_cargo not null,
  plan_id uuid references public.planes_de_pago (id),
  numero_de_cuota smallint check (numero_de_cuota between 1 and 24),
  entrega_id uuid,
  prestamo_id uuid,
  anulado_en timestamptz,
  anulado_el date,
  anulado_por uuid references public.perfiles (id),
  anulacion_motivo text check (anulacion_motivo is null or char_length(anulacion_motivo) between 3 and 300),
  registrado_por uuid not null default auth.uid() references public.perfiles (id),
  registrado_en timestamptz not null default now(),
  constraint cargos_de_alguien check (estudiante_id is not null or cliente is not null),
  constraint cargos_cuota_de_plan check (origen <> 'plan' or (plan_id is not null and numero_de_cuota is not null and inscripcion_id is not null)),
  constraint cargos_sello_completo check (
    (anulado_en is null and anulado_el is null and anulado_por is null and anulacion_motivo is null)
    or (anulado_en is not null and anulado_el is not null and anulado_por is not null and anulacion_motivo is not null)
  )
);

comment on table public.cargos is
  'Lo que deben los alumnos (o un cliente de fuera): cuotas del plan, uniformes entregados con cargo, ventas directas y cargos manuales.';

create unique index cargos_cuota_unica on public.cargos (inscripcion_id, plan_id, numero_de_cuota)
  where anulado_en is null and plan_id is not null;
create index cargos_estudiante_idx on public.cargos (estudiante_id, vence_el) where anulado_en is null;
create index cargos_inscripcion_idx on public.cargos (inscripcion_id);
create index cargos_operacion_idx on public.cargos (operacion_id);
create index cargos_concepto_idx on public.cargos (concepto_id);
create index cargos_sede_idx on public.cargos (sede_id, fecha);
create index cargos_plan_idx on public.cargos (plan_id);
create index cargos_anulado_por_idx on public.cargos (anulado_por);
create index cargos_registrado_por_idx on public.cargos (registrado_por);

create trigger cargos_inmutables
  before update or delete on public.cargos
  for each row execute function app.solo_sellos('anulado_en', 'anulado_el', 'anulado_por', 'anulacion_motivo');

-- ---------------------------------------------------------------- cobros (pagos) y su aplicación

create table public.pagos (
  id uuid primary key default gen_random_uuid(),
  operacion_id uuid not null references public.operaciones (clave),
  sede_id uuid not null references public.sedes (id),
  fecha date not null,
  anio smallint not null check (anio between 2020 and 2100),
  numero integer not null check (numero > 0),
  estudiante_id uuid references public.estudiantes (id),
  cliente text check (cliente is null or char_length(cliente) between 2 and 120),
  monto bigint not null check (monto > 0),
  medio public.medio_de_pago not null,
  referencia text check (referencia is null or char_length(referencia) between 3 and 60),
  nota text check (nota is null or char_length(nota) <= 300),
  cierre_id uuid references public.cierres_de_caja (id),
  anulado_en timestamptz,
  anulado_el date,
  anulado_por uuid references public.perfiles (id),
  anulacion_motivo text check (anulacion_motivo is null or char_length(anulacion_motivo) between 3 and 300),
  anulacion_cierre_id uuid references public.cierres_de_caja (id),
  registrado_por uuid not null default auth.uid() references public.perfiles (id),
  registrado_en timestamptz not null default now(),
  constraint pagos_recibo_unico unique (sede_id, anio, numero),
  constraint pagos_de_alguien check (estudiante_id is not null or cliente is not null),
  constraint pagos_referencia_si_no_es_efectivo check (medio = 'efectivo' or referencia is not null),
  constraint pagos_sello_completo check (
    (anulado_en is null and anulado_el is null and anulado_por is null and anulacion_motivo is null)
    or (anulado_en is not null and anulado_el is not null and anulado_por is not null and anulacion_motivo is not null)
  ),
  constraint pagos_anulacion_arqueada_solo_si_anulado check (anulacion_cierre_id is null or anulado_en is not null)
);

comment on table public.pagos is
  'Cobros (en pantalla «cobros»): cada uno es un recibo interno numerado sin huecos por sede y año.';

-- Un mismo número de operación de QR o transferencia no se registra dos veces.
create unique index pagos_referencia_unica on public.pagos (medio, upper(referencia))
  where referencia is not null and anulado_en is null;
create index pagos_sede_fecha_idx on public.pagos (sede_id, fecha);
create index pagos_sin_arqueo_idx on public.pagos (sede_id) where cierre_id is null;
create index pagos_anulacion_sin_arqueo_idx on public.pagos (sede_id) where anulado_en is not null and anulacion_cierre_id is null;
create index pagos_estudiante_idx on public.pagos (estudiante_id, fecha desc);
create index pagos_operacion_idx on public.pagos (operacion_id);
create index pagos_cierre_idx on public.pagos (cierre_id);
create index pagos_anulacion_cierre_idx on public.pagos (anulacion_cierre_id);
create index pagos_anulado_por_idx on public.pagos (anulado_por);
create index pagos_registrado_por_idx on public.pagos (registrado_por);

create trigger pagos_inmutables
  before update or delete on public.pagos
  for each row execute function app.solo_sellos('anulado_en', 'anulado_el', 'anulado_por', 'anulacion_motivo', 'cierre_id', 'anulacion_cierre_id');

create table public.pago_aplicaciones (
  pago_id uuid not null references public.pagos (id),
  cargo_id uuid not null references public.cargos (id),
  monto bigint not null check (monto > 0),
  primary key (pago_id, cargo_id)
);

comment on table public.pago_aplicaciones is
  'A qué cargos se aplicó cada cobro. Invariante: la suma por cobro es el monto del cobro.';

create index pago_aplicaciones_cargo_idx on public.pago_aplicaciones (cargo_id);

create trigger pago_aplicaciones_inmutables
  before update or delete on public.pago_aplicaciones
  for each row execute function app.solo_sellos();

-- ---------------------------------------------------------------- gastos

create table public.gastos (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique,
  operacion_id uuid not null references public.operaciones (clave),
  sede_id uuid not null references public.sedes (id),
  fecha date not null,
  concepto_id uuid not null references public.conceptos (id),
  descripcion text not null check (char_length(descripcion) between 3 and 200),
  monto bigint not null check (monto > 0),
  medio public.medio_de_pago not null,
  referencia text check (referencia is null or char_length(referencia) between 3 and 60),
  comprobante public.tipo_de_comprobante not null default 'sin_comprobante',
  numero_comprobante text check (numero_comprobante is null or char_length(numero_comprobante) between 1 and 40),
  proveedor text check (proveedor is null or char_length(proveedor) between 2 and 120),
  cierre_id uuid references public.cierres_de_caja (id),
  anulado_en timestamptz,
  anulado_el date,
  anulado_por uuid references public.perfiles (id),
  anulacion_motivo text check (anulacion_motivo is null or char_length(anulacion_motivo) between 3 and 300),
  anulacion_cierre_id uuid references public.cierres_de_caja (id),
  registrado_por uuid not null default auth.uid() references public.perfiles (id),
  registrado_en timestamptz not null default now(),
  constraint gastos_referencia_si_no_es_efectivo check (medio = 'efectivo' or referencia is not null),
  constraint gastos_sello_completo check (
    (anulado_en is null and anulado_el is null and anulado_por is null and anulacion_motivo is null)
    or (anulado_en is not null and anulado_el is not null and anulado_por is not null and anulacion_motivo is not null)
  ),
  constraint gastos_anulacion_arqueada_solo_si_anulado check (anulacion_cierre_id is null or anulado_en is not null)
);

comment on table public.gastos is
  'Dinero que salió para que el instituto funcione (no las compras de inventario).';

create index gastos_sede_fecha_idx on public.gastos (sede_id, fecha);
create index gastos_sin_arqueo_idx on public.gastos (sede_id) where cierre_id is null;
create index gastos_anulacion_sin_arqueo_idx on public.gastos (sede_id) where anulado_en is not null and anulacion_cierre_id is null;
create index gastos_concepto_idx on public.gastos (concepto_id);
create index gastos_operacion_idx on public.gastos (operacion_id);
create index gastos_cierre_idx on public.gastos (cierre_id);
create index gastos_anulacion_cierre_idx on public.gastos (anulacion_cierre_id);
create index gastos_anulado_por_idx on public.gastos (anulado_por);
create index gastos_registrado_por_idx on public.gastos (registrado_por);

create trigger gastos_inmutables
  before update or delete on public.gastos
  for each row execute function app.solo_sellos('anulado_en', 'anulado_el', 'anulado_por', 'anulacion_motivo', 'cierre_id', 'anulacion_cierre_id');

-- ---------------------------------------------------------------- precio congelado (regla A2)

-- En cuanto un plan tiene un cargo vigente, su monto, cuotas y fechas no
-- cambian ni el plan se borra: lo cobrado y lo por cobrar no se mueven por
-- debajo (enmiendas B.12 30: «el precio se congela con el primer cargo»).
create or replace function app.congelar_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.cargos c where c.plan_id = old.id and c.anulado_en is null) then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE'
     or new.monto_cuota <> old.monto_cuota or new.cuotas <> old.cuotas
     or new.primer_vencimiento <> old.primer_vencimiento or new.cada_meses <> old.cada_meses
     or new.paquete is distinct from old.paquete then
    raise exception using errcode = 'P0001', message = 'plan_congelado';
  end if;
  return new;
end;
$$;

revoke all on function app.congelar_plan() from public;

create trigger planes_de_pago_congelados
  before update or delete on public.planes_de_pago
  for each row execute function app.congelar_plan();

-- ---------------------------------------------------------------- RLS y grants

alter table public.cierres_de_caja enable row level security;
alter table public.cargos enable row level security;
alter table public.pagos enable row level security;
alter table public.pago_aplicaciones enable row level security;
alter table public.gastos enable row level security;

revoke all on table public.cierres_de_caja from anon, authenticated;
revoke all on table public.cargos from anon, authenticated;
revoke all on table public.pagos from anon, authenticated;
revoke all on table public.pago_aplicaciones from anon, authenticated;
revoke all on table public.gastos from anon, authenticated;

-- Solo lectura por la API; escribe el motor. Recepción lee TODOS los cargos y
-- cobros para que las sumas de saldos sean ciertas (especificación §3.10).
grant select on table public.cierres_de_caja to authenticated;
grant select on table public.cargos to authenticated;
grant select on table public.pagos to authenticated;
grant select on table public.pago_aplicaciones to authenticated;
grant select on table public.gastos to authenticated;

create policy cierres_de_caja_lectura on public.cierres_de_caja for select to authenticated
  using ((select app.tiene_permiso('caja.leer')));
create policy cargos_lectura on public.cargos for select to authenticated
  using ((select app.tiene_permiso('caja.leer')));
create policy pagos_lectura on public.pagos for select to authenticated
  using ((select app.tiene_permiso('caja.leer')));
create policy pago_aplicaciones_lectura on public.pago_aplicaciones for select to authenticated
  using ((select app.tiene_permiso('caja.leer')));
create policy gastos_lectura on public.gastos for select to authenticated
  using ((select app.tiene_permiso('contabilidad.leer')));

-- ---------------------------------------------------------------- vistas de saldos

-- Prefijo del recibo: iniciales del código de la sede (la-paz → LP).
create or replace function app.prefijo_de_sede(p_codigo text)
returns text
language sql
immutable
set search_path = ''
as $$
  select string_agg(upper(left(parte, 1)), '' order by n)
    from unnest(string_to_array(p_codigo, '-')) with ordinality as t(parte, n);
$$;

-- «LP-2026-000123» (gemela de formatearRecibo del dominio).
create or replace function app.numero_de_recibo(p_codigo_de_sede text, p_anio smallint, p_numero integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select app.prefijo_de_sede(p_codigo_de_sede) || '-' || p_anio || '-' || lpad(p_numero::text, 6, '0');
$$;

revoke all on function app.prefijo_de_sede(text) from public;
revoke all on function app.numero_de_recibo(text, smallint, integer) from public;
grant execute on function app.prefijo_de_sede(text) to authenticated;
grant execute on function app.numero_de_recibo(text, smallint, integer) to authenticated;

create or replace view public.v_saldos_de_cargo with (security_invoker = true) as
select
  c.id,
  c.estudiante_id,
  c.cliente,
  c.inscripcion_id,
  c.sede_id,
  c.concepto_id,
  k.nombre as concepto_nombre,
  c.descripcion,
  c.origen,
  c.monto,
  coalesce(a.aplicado, 0)::bigint as aplicado,
  case when c.anulado_en is not null then 0 else greatest(c.monto - coalesce(a.aplicado, 0), 0) end::bigint as pendiente,
  case
    when c.anulado_en is not null then 'anulado'
    when coalesce(a.aplicado, 0) >= c.monto then 'pagado'
    when coalesce(a.aplicado, 0) > 0 then 'parcial'
    else 'pendiente'
  end as estado,
  c.fecha,
  c.vence_el,
  (c.anulado_en is null and coalesce(a.aplicado, 0) < c.monto and c.vence_el < app.hoy()) as vencido,
  greatest(app.hoy() - c.vence_el, 0) as dias_de_atraso,
  c.anulado_en,
  c.registrado_en
from public.cargos c
join public.conceptos k on k.id = c.concepto_id
left join lateral (
  select sum(pa.monto) as aplicado
    from public.pago_aplicaciones pa
    join public.pagos p on p.id = pa.pago_id
   where pa.cargo_id = c.id and p.anulado_en is null
) a on true;

create or replace view public.v_saldos_de_alumno with (security_invoker = true) as
select
  e.id as estudiante_id,
  e.codigo,
  e.nombres,
  e.apellidos,
  e.telefono,
  e.sede_id,
  s.nombre as sede_nombre,
  sum(sc.pendiente)::bigint as total_pendiente,
  coalesce(sum(sc.pendiente) filter (where sc.vencido), 0)::bigint as total_vencido,
  count(*)::integer as cargos_pendientes,
  min(sc.vence_el) as vence_el_mas_antiguo,
  max(sc.dias_de_atraso)::integer as dias_de_atraso
from public.v_saldos_de_cargo sc
join public.estudiantes e on e.id = sc.estudiante_id
join public.sedes s on s.id = e.sede_id
where sc.pendiente > 0
group by e.id, e.codigo, e.nombres, e.apellidos, e.telefono, e.sede_id, s.nombre;

revoke all on public.v_saldos_de_cargo from anon, authenticated;
revoke all on public.v_saldos_de_alumno from anon, authenticated;
grant select on public.v_saldos_de_cargo to authenticated;
grant select on public.v_saldos_de_alumno to authenticated;
