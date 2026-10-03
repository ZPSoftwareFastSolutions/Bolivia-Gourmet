-- ============================================================================
-- 0011 · Sistema interno · Inventario (rebanada R4): tablas, reglas y vistas
-- ----------------------------------------------------------------------------
-- En simple (especificación §2.5): las CANTIDADES las ve todo el personal; lo
-- que COSTARON, solo administración (tablas *_costo, movimiento_lotes,
-- compras y conteos). Los insumos se valorizan por PEPS (lotes con su
-- vencimiento); uniformes, utensilios y otros, a costo promedio ponderado.
--
-- El libro (movimientos y su costo) no se edita ni se borra: un error se
-- corrige con un asiento de anulación que deshace exactamente el original.
-- Solo el motor escribe (20261002150100_panel_inventario_motor.sql).
--
-- Las tablas de entregas de uniformes y préstamos de utensilios se crean aquí
-- para que el libro tenga sus claves foráneas; sus RPC llegan en la R5.
-- ============================================================================

create type public.tipo_de_articulo as enum ('insumo', 'uniforme', 'utensilio', 'otro');
create type public.unidad_de_medida as enum ('unidad', 'kg', 'g', 'l', 'ml', 'paquete');
create type public.tipo_de_movimiento as enum (
  'saldo_inicial', 'compra', 'consumo', 'entrega', 'devolucion_entrega', 'prestamo', 'devolucion_prestamo',
  'baja', 'ajuste_faltante', 'ajuste_sobrante', 'anulacion'
);
create type public.destino_de_uso as enum ('clase', 'practica', 'evento', 'degustacion', 'uso_interno', 'otro');
create type public.motivo_de_baja as enum ('vencimiento', 'dano', 'rotura', 'perdida', 'merma', 'otro');
create type public.origen_de_lote as enum ('compra', 'saldo_inicial', 'sobrante');
create type public.contexto_de_entrega as enum ('inscripcion', 'reposicion', 'cambio_de_talla', 'otro');
create type public.clase_de_conteo as enum ('conteo', 'saldo_inicial');

-- ---------------------------------------------------------------- catálogo

create table public.articulos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (codigo ~ '^(INS|UNI|UTE|OTR)-[0-9]{4,}$'),
  nombre text not null check (char_length(nombre) between 1 and 80),
  tipo public.tipo_de_articulo not null,
  valuacion text generated always as (case when tipo = 'insumo' then 'peps' else 'promedio' end) stored,
  categoria text check (categoria is null or char_length(categoria) between 1 and 40),
  icono text not null default 'almacen'
    check (icono in ('trigo', 'huevo', 'lacteo', 'torta', 'copa', 'plato', 'chaqueta', 'gorro', 'cubiertos', 'bol', 'batidor', 'almacen', 'paquete')),
  unidad public.unidad_de_medida not null default 'unidad',
  controla_vencimiento boolean not null default false,
  stock_minimo numeric(12, 3) not null default 0 check (stock_minimo >= 0),
  precio_venta bigint check (precio_venta is null or precio_venta > 0),
  activo boolean not null default true,
  registrado_por uuid not null default auth.uid() references public.perfiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint articulos_unidad_por_tipo check (unidad in ('unidad', 'paquete') or tipo in ('insumo', 'otro')),
  constraint articulos_vencimiento_solo_insumos check (not controla_vencimiento or tipo = 'insumo'),
  constraint articulos_precio_solo_uniformes check (precio_venta is null or tipo = 'uniforme')
);

comment on table public.articulos is
  'Catálogo de inventario: insumos (PEPS con lotes y vencimientos), uniformes, utensilios y otros (costo promedio).';

create unique index articulos_nombre_unico on public.articulos (lower(nombre)) where activo;
create index articulos_tipo_idx on public.articulos (tipo, activo);
create index articulos_registrado_por_idx on public.articulos (registrado_por);

create table public.variantes (
  id uuid primary key default gen_random_uuid(),
  articulo_id uuid not null references public.articulos (id),
  etiqueta text not null check (char_length(etiqueta) between 1 and 20),
  orden smallint not null default 0,
  activa boolean not null default true
);

comment on table public.variantes is 'Tallas de un uniforme o la variante «Única» de los demás artículos.';

create unique index variantes_etiqueta_unica on public.variantes (articulo_id, lower(etiqueta));

-- ---------------------------------------------------------------- saldos

create table public.existencias (
  variante_id uuid not null references public.variantes (id),
  sede_id uuid not null references public.sedes (id),
  disponible numeric(12, 3) not null default 0 check (disponible >= 0),
  prestado numeric(12, 3) not null default 0 check (prestado >= 0),
  total numeric(12, 3) generated always as (disponible + prestado) stored,
  actualizado_en timestamptz not null default now(),
  primary key (variante_id, sede_id)
);

comment on table public.existencias is 'Saldo vivo por variante y sede: en el estante y prestado. Solo lo escribe el motor.';

create index existencias_sede_idx on public.existencias (sede_id);

create table public.existencias_costo (
  variante_id uuid not null references public.variantes (id),
  sede_id uuid not null references public.sedes (id),
  valor bigint not null default 0 check (valor >= 0),
  primary key (variante_id, sede_id)
);

comment on table public.existencias_costo is 'Valor del saldo: la capa de costo (promedio) o la suma de los lotes (PEPS). Solo administración.';

create index existencias_costo_sede_idx on public.existencias_costo (sede_id);

-- ---------------------------------------------------------------- documentos

create table public.compras (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique,
  operacion_id uuid not null unique references public.operaciones (clave),
  sede_id uuid not null references public.sedes (id),
  fecha date not null,
  fecha_documento date,
  proveedor text check (proveedor is null or char_length(proveedor) between 2 and 120),
  comprobante public.tipo_de_comprobante not null default 'sin_comprobante',
  numero_comprobante text check (numero_comprobante is null or char_length(numero_comprobante) between 1 and 40),
  medio public.medio_de_pago not null,
  referencia text check (referencia is null or char_length(referencia) between 3 and 60),
  total bigint not null check (total > 0),
  cierre_id uuid references public.cierres_de_caja (id),
  anulado_en timestamptz,
  anulado_el date,
  anulado_por uuid references public.perfiles (id),
  anulacion_motivo text check (anulacion_motivo is null or char_length(anulacion_motivo) between 3 and 300),
  anulacion_cierre_id uuid references public.cierres_de_caja (id),
  registrado_por uuid not null default auth.uid() references public.perfiles (id),
  registrado_en timestamptz not null default now(),
  constraint compras_referencia_si_no_es_efectivo check (medio = 'efectivo' or referencia is not null),
  constraint compras_sello_completo check (
    (anulado_en is null and anulado_el is null and anulado_por is null and anulacion_motivo is null)
    or (anulado_en is not null and anulado_el is not null and anulado_por is not null and anulacion_motivo is not null)
  ),
  constraint compras_anulacion_arqueada_solo_si_anulada check (anulacion_cierre_id is null or anulado_en is not null)
);

comment on table public.compras is 'Compras de inventario: dinero que salió y se volvió existencia (nunca gasto).';

create index compras_sede_fecha_idx on public.compras (sede_id, fecha);
create index compras_sin_arqueo_idx on public.compras (sede_id) where cierre_id is null;
create index compras_anulacion_sin_arqueo_idx on public.compras (sede_id) where anulado_en is not null and anulacion_cierre_id is null;
create index compras_cierre_idx on public.compras (cierre_id);
create index compras_anulacion_cierre_idx on public.compras (anulacion_cierre_id);
create index compras_anulado_por_idx on public.compras (anulado_por);
create index compras_registrado_por_idx on public.compras (registrado_por);

create trigger compras_inmutables
  before update or delete on public.compras
  for each row execute function app.solo_sellos('anulado_en', 'anulado_el', 'anulado_por', 'anulacion_motivo', 'cierre_id', 'anulacion_cierre_id');

create table public.conteos (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique,
  operacion_id uuid not null references public.operaciones (clave),
  sede_id uuid not null references public.sedes (id),
  fecha date not null,
  clase public.clase_de_conteo not null,
  lineas jsonb not null check (jsonb_typeof(lineas) = 'array'),
  registrado_por uuid not null default auth.uid() references public.perfiles (id),
  registrado_en timestamptz not null default now()
);

comment on table public.conteos is 'Conteos físicos y saldos iniciales: lo que mostraba el sistema, lo contado y el motivo de cada diferencia.';

create index conteos_sede_idx on public.conteos (sede_id, fecha);
create index conteos_operacion_idx on public.conteos (operacion_id);
create index conteos_registrado_por_idx on public.conteos (registrado_por);

create trigger conteos_inmutables
  before update or delete on public.conteos
  for each row execute function app.solo_sellos();

create table public.entregas (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique,
  operacion_id uuid not null references public.operaciones (clave),
  inscripcion_id uuid not null references public.inscripciones (id),
  sede_id uuid not null references public.sedes (id),
  variante_id uuid not null references public.variantes (id),
  cantidad integer not null check (cantidad > 0),
  devuelta integer not null default 0,
  contexto public.contexto_de_entrega not null default 'inscripcion',
  detalle text check (detalle is null or char_length(detalle) between 3 and 300),
  fecha date not null,
  registrado_por uuid not null default auth.uid() references public.perfiles (id),
  registrado_en timestamptz not null default now(),
  constraint entregas_devuelta check (devuelta between 0 and cantidad),
  constraint entregas_detalle_en_otro check (contexto <> 'otro' or detalle is not null)
);

comment on table public.entregas is 'Uniformes entregados a un alumno inscrito. Se devuelven, no se anulan.';

create index entregas_inscripcion_idx on public.entregas (inscripcion_id);
create index entregas_variante_idx on public.entregas (variante_id, sede_id);
create index entregas_sede_idx on public.entregas (sede_id, fecha);
create index entregas_operacion_idx on public.entregas (operacion_id);
create index entregas_registrado_por_idx on public.entregas (registrado_por);

create table public.prestamos (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique,
  operacion_id uuid not null references public.operaciones (clave),
  sede_id uuid not null references public.sedes (id),
  variante_id uuid not null references public.variantes (id),
  cantidad integer not null check (cantidad > 0),
  devuelta integer not null default 0 check (devuelta >= 0),
  perdida integer not null default 0 check (perdida >= 0),
  estudiante_id uuid references public.estudiantes (id),
  cohorte_id uuid references public.cohortes (id),
  persona text check (persona is null or char_length(persona) between 2 and 120),
  fecha date not null,
  devolver_el date not null,
  cerrado_en timestamptz,
  registrado_por uuid not null default auth.uid() references public.perfiles (id),
  registrado_en timestamptz not null default now(),
  constraint prestamos_no_excede check (devuelta + perdida <= cantidad),
  constraint prestamos_un_destinatario check (num_nonnulls(estudiante_id, cohorte_id, persona) = 1),
  constraint prestamos_fechas check (devolver_el >= fecha)
);

comment on table public.prestamos is 'Utensilios prestados (custodia: siguen siendo del instituto). Se devuelven o se dan por perdidos.';

create index prestamos_abiertos_idx on public.prestamos (sede_id, devolver_el) where cerrado_en is null;
create index prestamos_variante_idx on public.prestamos (variante_id);
create index prestamos_estudiante_idx on public.prestamos (estudiante_id);
create index prestamos_cohorte_idx on public.prestamos (cohorte_id);
create index prestamos_operacion_idx on public.prestamos (operacion_id);
create index prestamos_registrado_por_idx on public.prestamos (registrado_por);

-- Entregas y préstamos solo crecen en lo devuelto o perdido (y el préstamo se cierra una vez).
create or replace function app.solo_crece()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if app.en_mantenimiento() then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    raise exception using errcode = 'P0001', message = 'libro_inmutable';
  end if;
  if tg_table_name = 'entregas' then
    if (to_jsonb(new) - 'devuelta') is distinct from (to_jsonb(old) - 'devuelta') or new.devuelta < old.devuelta then
      raise exception using errcode = 'P0001', message = 'libro_inmutable';
    end if;
  else
    if (to_jsonb(new) - '{devuelta,perdida,cerrado_en}'::text[]) is distinct from (to_jsonb(old) - '{devuelta,perdida,cerrado_en}'::text[])
       or (to_jsonb(new) ->> 'devuelta')::integer < (to_jsonb(old) ->> 'devuelta')::integer
       or (to_jsonb(new) ->> 'perdida')::integer < (to_jsonb(old) ->> 'perdida')::integer
       or ((to_jsonb(old) ->> 'cerrado_en') is not null and (to_jsonb(new) ->> 'cerrado_en') is distinct from (to_jsonb(old) ->> 'cerrado_en')) then
      raise exception using errcode = 'P0001', message = 'libro_inmutable';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function app.solo_crece() from public;

create trigger entregas_solo_crecen before update or delete on public.entregas
  for each row execute function app.solo_crece();
create trigger prestamos_solo_crecen before update or delete on public.prestamos
  for each row execute function app.solo_crece();

-- Los cargos ya tenían las columnas; ahora apuntan a su entrega o préstamo.
alter table public.cargos add constraint cargos_entrega_fkey foreign key (entrega_id) references public.entregas (id);
alter table public.cargos add constraint cargos_prestamo_fkey foreign key (prestamo_id) references public.prestamos (id);
create index cargos_entrega_idx on public.cargos (entrega_id);
create index cargos_prestamo_idx on public.cargos (prestamo_id);

-- ---------------------------------------------------------------- libro (kárdex)

create table public.movimientos (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique,
  operacion_id uuid not null references public.operaciones (clave),
  variante_id uuid not null references public.variantes (id),
  sede_id uuid not null references public.sedes (id),
  tipo public.tipo_de_movimiento not null,
  fecha date not null,
  cantidad numeric(12, 3) not null check (cantidad > 0),
  delta_disponible numeric(12, 3) not null,
  delta_prestado numeric(12, 3) not null default 0,
  disponible_resultante numeric(12, 3) not null check (disponible_resultante >= 0),
  prestado_resultante numeric(12, 3) not null check (prestado_resultante >= 0),
  destino public.destino_de_uso,
  cohorte_id uuid references public.cohortes (id),
  detalle text check (detalle is null or char_length(detalle) <= 300),
  motivo_baja public.motivo_de_baja,
  compra_id uuid references public.compras (id),
  entrega_id uuid references public.entregas (id),
  prestamo_id uuid references public.prestamos (id),
  conteo_id uuid references public.conteos (id),
  lote_id uuid,
  anula_a uuid unique references public.movimientos (id),
  registrado_por uuid not null default auth.uid() references public.perfiles (id),
  registrado_en timestamptz not null default now(),
  constraint movimientos_signos check (
    (tipo in ('saldo_inicial', 'compra', 'devolucion_entrega', 'ajuste_sobrante') and delta_disponible > 0 and delta_prestado = 0)
    or (tipo in ('consumo', 'entrega', 'ajuste_faltante') and delta_disponible < 0 and delta_prestado = 0)
    or (tipo = 'prestamo' and delta_disponible < 0 and delta_prestado > 0)
    or (tipo = 'devolucion_prestamo' and delta_disponible > 0 and delta_prestado < 0)
    or (tipo = 'baja' and delta_disponible <= 0 and delta_prestado <= 0 and delta_disponible + delta_prestado < 0)
    or tipo = 'anulacion'
  ),
  constraint movimientos_anulacion check ((tipo = 'anulacion') = (anula_a is not null)),
  constraint movimientos_baja_con_motivo check ((tipo = 'baja') = (motivo_baja is not null)),
  constraint movimientos_destino_solo_consumo check (destino is null or tipo = 'consumo'),
  constraint movimientos_documento check (
    (tipo <> 'compra' or compra_id is not null)
    and (tipo not in ('entrega', 'devolucion_entrega') or entrega_id is not null)
    and (tipo not in ('prestamo', 'devolucion_prestamo') or prestamo_id is not null)
    and (tipo not in ('saldo_inicial', 'ajuste_faltante', 'ajuste_sobrante') or conteo_id is not null)
  )
);

comment on table public.movimientos is 'Libro de inventario (kárdex): cada entrada y salida con el saldo que quedó. Inmutable.';

create index movimientos_kardex_idx on public.movimientos (variante_id, sede_id, numero);
create index movimientos_sede_fecha_idx on public.movimientos (sede_id, fecha);
create index movimientos_operacion_idx on public.movimientos (operacion_id);
create index movimientos_tipo_fecha_idx on public.movimientos (tipo, fecha);
create index movimientos_cohorte_idx on public.movimientos (cohorte_id);
create index movimientos_compra_idx on public.movimientos (compra_id);
create index movimientos_entrega_idx on public.movimientos (entrega_id);
create index movimientos_prestamo_idx on public.movimientos (prestamo_id);
create index movimientos_conteo_idx on public.movimientos (conteo_id);
create index movimientos_lote_idx on public.movimientos (lote_id);
create index movimientos_registrado_por_idx on public.movimientos (registrado_por);

create trigger movimientos_inmutables
  before update or delete on public.movimientos
  for each row execute function app.solo_sellos();

create table public.movimientos_costo (
  movimiento_id uuid primary key references public.movimientos (id),
  delta_valor bigint not null,
  valor_resultante bigint not null check (valor_resultante >= 0)
);

comment on table public.movimientos_costo is 'Cuánto valor entró o salió con cada movimiento y el valor que quedó. Solo administración.';

create trigger movimientos_costo_inmutables
  before update or delete on public.movimientos_costo
  for each row execute function app.solo_sellos();

-- ---------------------------------------------------------------- lotes (solo insumos, PEPS)

create table public.lotes (
  id uuid primary key default gen_random_uuid(),
  secuencia bigint generated always as identity unique,
  variante_id uuid not null references public.variantes (id),
  sede_id uuid not null references public.sedes (id),
  origen public.origen_de_lote not null,
  fecha_ingreso date not null,
  vence_el date,
  cantidad_inicial numeric(12, 3) not null check (cantidad_inicial > 0),
  cantidad_restante numeric(12, 3) not null,
  movimiento_entrada_id uuid not null unique references public.movimientos (id),
  constraint lotes_restante check (cantidad_restante between 0 and cantidad_inicial)
);

comment on table public.lotes is 'Lo que llegó en una compra (o un saldo inicial o un sobrante) de un insumo: cantidad que queda y vencimiento.';

create index lotes_peps_idx on public.lotes (variante_id, sede_id, fecha_ingreso, secuencia) where cantidad_restante > 0;
create index lotes_vencimiento_idx on public.lotes (sede_id, vence_el) where cantidad_restante > 0 and vence_el is not null;

alter table public.movimientos add constraint movimientos_lote_fkey foreign key (lote_id) references public.lotes (id);

create table public.lotes_costo (
  lote_id uuid primary key references public.lotes (id),
  valor_inicial bigint not null check (valor_inicial >= 0),
  valor_restante bigint not null,
  constraint lotes_costo_restante check (valor_restante between 0 and valor_inicial)
);

comment on table public.lotes_costo is 'Valor inicial y restante de cada lote. Solo administración.';

create table public.movimiento_lotes (
  movimiento_id uuid not null references public.movimientos (id),
  lote_id uuid not null references public.lotes (id),
  cantidad numeric(12, 3) not null check (cantidad > 0),
  valor bigint not null check (valor >= 0),
  primary key (movimiento_id, lote_id)
);

comment on table public.movimiento_lotes is 'De qué lote salió (o a cuál entró) cada parte de un movimiento. Solo administración.';

create index movimiento_lotes_lote_idx on public.movimiento_lotes (lote_id);

create trigger movimiento_lotes_inmutables
  before update or delete on public.movimiento_lotes
  for each row execute function app.solo_sellos();

-- Un lote solo cambia lo que le queda; nunca más que lo que entró. Solo insumos.
create or replace function app.proteger_lote()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if app.en_mantenimiento() then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    raise exception using errcode = 'P0001', message = 'libro_inmutable';
  end if;
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.variantes v join public.articulos a on a.id = v.articulo_id
                    where v.id = new.variante_id and a.tipo = 'insumo') then
      raise exception using errcode = 'P0001', message = 'lote_solo_insumos';
    end if;
    return new;
  end if;
  if tg_table_name = 'lotes' then
    if (to_jsonb(new) - 'cantidad_restante') is distinct from (to_jsonb(old) - 'cantidad_restante') then
      raise exception using errcode = 'P0001', message = 'libro_inmutable';
    end if;
  elsif (to_jsonb(new) - 'valor_restante') is distinct from (to_jsonb(old) - 'valor_restante') then
    raise exception using errcode = 'P0001', message = 'libro_inmutable';
  end if;
  return new;
end;
$$;

revoke all on function app.proteger_lote() from public;

create trigger lotes_protegidos before insert or update or delete on public.lotes
  for each row execute function app.proteger_lote();
create trigger lotes_costo_protegidos before update or delete on public.lotes_costo
  for each row execute function app.proteger_lote();

-- ---------------------------------------------------------------- artículo: código y reglas de edición

create or replace function app.preparar_articulo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prefijo text;
  v_ultimo integer;
begin
  new.nombre := regexp_replace(btrim(new.nombre), '\s+', ' ', 'g');
  new.categoria := nullif(btrim(coalesce(new.categoria, '')), '');
  if tg_op = 'INSERT' then
    v_prefijo := case new.tipo when 'insumo' then 'INS' when 'uniforme' then 'UNI' when 'utensilio' then 'UTE' else 'OTR' end;
    perform pg_advisory_xact_lock(hashtext('codigo_articulo:' || v_prefijo));
    select coalesce(max(substring(a.codigo from 5)::integer), 0) into v_ultimo from public.articulos a where a.codigo like v_prefijo || '-%';
    new.codigo := v_prefijo || '-' || lpad((v_ultimo + 1)::text, 4, '0');
    return new;
  end if;
  new.codigo := old.codigo;
  if (new.tipo <> old.tipo or new.unidad <> old.unidad)
     and exists (select 1 from public.movimientos m join public.variantes v on v.id = m.variante_id where v.articulo_id = old.id) then
    raise exception using errcode = 'P0001', message = 'tipo_bloqueado';
  end if;
  return new;
end;
$$;

revoke all on function app.preparar_articulo() from public;

create trigger articulos_preparar before insert or update on public.articulos
  for each row execute function app.preparar_articulo();
create trigger articulos_actualizado before update on public.articulos
  for each row execute function app.marcar_actualizado();

-- Un insumo tiene una sola variante («Única»).
create or replace function app.validar_variante()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.etiqueta := btrim(new.etiqueta);
  if (select a.tipo from public.articulos a where a.id = new.articulo_id) = 'insumo'
     and exists (select 1 from public.variantes v where v.articulo_id = new.articulo_id and v.id <> new.id) then
    raise exception using errcode = 'P0001', message = 'insumo_una_variante';
  end if;
  if tg_op = 'UPDATE' and new.articulo_id <> old.articulo_id then
    raise exception using errcode = 'P0001', message = 'libro_inmutable';
  end if;
  return new;
end;
$$;

revoke all on function app.validar_variante() from public;

create trigger variantes_validar before insert or update on public.variantes
  for each row execute function app.validar_variante();

-- ---------------------------------------------------------------- RLS y grants

alter table public.articulos enable row level security;
alter table public.variantes enable row level security;
alter table public.existencias enable row level security;
alter table public.existencias_costo enable row level security;
alter table public.compras enable row level security;
alter table public.conteos enable row level security;
alter table public.entregas enable row level security;
alter table public.prestamos enable row level security;
alter table public.movimientos enable row level security;
alter table public.movimientos_costo enable row level security;
alter table public.lotes enable row level security;
alter table public.lotes_costo enable row level security;
alter table public.movimiento_lotes enable row level security;

revoke all on table public.articulos from anon, authenticated;
revoke all on table public.variantes from anon, authenticated;
revoke all on table public.existencias from anon, authenticated;
revoke all on table public.existencias_costo from anon, authenticated;
revoke all on table public.compras from anon, authenticated;
revoke all on table public.conteos from anon, authenticated;
revoke all on table public.entregas from anon, authenticated;
revoke all on table public.prestamos from anon, authenticated;
revoke all on table public.movimientos from anon, authenticated;
revoke all on table public.movimientos_costo from anon, authenticated;
revoke all on table public.lotes from anon, authenticated;
revoke all on table public.lotes_costo from anon, authenticated;
revoke all on table public.movimiento_lotes from anon, authenticated;

grant select on table public.articulos, public.variantes, public.existencias, public.entregas, public.prestamos,
  public.movimientos, public.lotes to authenticated;
grant select on table public.existencias_costo, public.compras, public.conteos, public.movimientos_costo,
  public.lotes_costo, public.movimiento_lotes to authenticated;
-- Catálogo: el alta va por guardar_articulo; la edición, directa por columnas.
grant update (nombre, categoria, icono, stock_minimo, controla_vencimiento, precio_venta, activo) on table public.articulos to authenticated;
grant insert (articulo_id, etiqueta, orden, activa) on table public.variantes to authenticated;
grant update (etiqueta, orden, activa) on table public.variantes to authenticated;

create policy articulos_lectura on public.articulos for select to authenticated using ((select app.tiene_permiso('inventario.leer')));
create policy articulos_edicion on public.articulos for update to authenticated
  using ((select app.tiene_permiso('inventario.catalogo'))) with check ((select app.tiene_permiso('inventario.catalogo')));
create policy variantes_lectura on public.variantes for select to authenticated using ((select app.tiene_permiso('inventario.leer')));
create policy variantes_alta on public.variantes for insert to authenticated with check ((select app.tiene_permiso('inventario.catalogo')));
create policy variantes_edicion on public.variantes for update to authenticated
  using ((select app.tiene_permiso('inventario.catalogo'))) with check ((select app.tiene_permiso('inventario.catalogo')));
create policy existencias_lectura on public.existencias for select to authenticated using ((select app.tiene_permiso('inventario.leer')));
create policy entregas_lectura on public.entregas for select to authenticated using ((select app.tiene_permiso('inventario.leer')));
create policy prestamos_lectura on public.prestamos for select to authenticated using ((select app.tiene_permiso('inventario.leer')));
create policy movimientos_lectura on public.movimientos for select to authenticated using ((select app.tiene_permiso('inventario.leer')));
create policy lotes_lectura on public.lotes for select to authenticated using ((select app.tiene_permiso('inventario.leer')));
create policy existencias_costo_lectura on public.existencias_costo for select to authenticated using ((select app.tiene_permiso('contabilidad.leer')));
create policy compras_lectura on public.compras for select to authenticated using ((select app.tiene_permiso('contabilidad.leer')));
create policy conteos_lectura on public.conteos for select to authenticated using ((select app.tiene_permiso('contabilidad.leer')));
create policy movimientos_costo_lectura on public.movimientos_costo for select to authenticated using ((select app.tiene_permiso('contabilidad.leer')));
create policy lotes_costo_lectura on public.lotes_costo for select to authenticated using ((select app.tiene_permiso('contabilidad.leer')));
create policy movimiento_lotes_lectura on public.movimiento_lotes for select to authenticated using ((select app.tiene_permiso('contabilidad.leer')));

-- ---------------------------------------------------------------- vistas

-- Toda variante en toda sede activa (aunque nunca tuvo movimientos), con lo
-- vencido aparte: lo vencido está en el estante pero no se usa (B.5).
create or replace view public.v_existencias with (security_invoker = true) as
select
  a.id as articulo_id,
  a.codigo,
  a.nombre,
  a.tipo,
  a.valuacion,
  a.icono,
  a.categoria,
  a.unidad,
  a.controla_vencimiento,
  a.stock_minimo,
  a.precio_venta,
  a.activo,
  v.id as variante_id,
  v.etiqueta,
  v.orden,
  s.id as sede_id,
  s.nombre as sede_nombre,
  coalesce(e.disponible, 0) as disponible,
  coalesce(e.prestado, 0) as prestado,
  coalesce(e.total, 0) as total,
  coalesce(l.vencido, 0) as vencido,
  l.proximo_vencimiento,
  case
    when coalesce(e.disponible, 0) - coalesce(l.vencido, 0) <= 0 then 'agotado'
    when coalesce(e.disponible, 0) - coalesce(l.vencido, 0) < a.stock_minimo then 'bajo'
    else 'bien'
  end as estado
from public.articulos a
join public.variantes v on v.articulo_id = a.id and v.activa
cross join public.sedes s
left join public.existencias e on e.variante_id = v.id and e.sede_id = s.id
left join lateral (
  select
    sum(lo.cantidad_restante) filter (where lo.vence_el < app.hoy()) as vencido,
    min(lo.vence_el) filter (where lo.vence_el >= app.hoy()) as proximo_vencimiento
  from public.lotes lo
  where lo.variante_id = v.id and lo.sede_id = s.id and lo.cantidad_restante > 0
) l on true
where s.activa;

create or replace view public.v_existencias_valorizadas with (security_invoker = true) as
select
  x.*,
  coalesce(c.valor, 0) as valor,
  case when x.total > 0 then round(coalesce(c.valor, 0) / x.total)::bigint end as costo_promedio
from public.v_existencias x
join public.existencias_costo c on c.variante_id = x.variante_id and c.sede_id = x.sede_id;

create or replace view public.v_lotes_vigentes with (security_invoker = true) as
select
  lo.id,
  lo.secuencia,
  lo.variante_id,
  a.id as articulo_id,
  a.nombre as articulo_nombre,
  a.unidad,
  lo.sede_id,
  s.nombre as sede_nombre,
  lo.origen,
  lo.fecha_ingreso,
  lo.vence_el,
  lo.cantidad_inicial,
  lo.cantidad_restante,
  (lo.vence_el - app.hoy()) as dias_para_vencer,
  case
    when lo.vence_el is null then 'sin_vencimiento'
    when lo.vence_el < app.hoy() then 'vencido'
    when lo.vence_el <= app.hoy() + 7 then 'por_vencer'
    else 'bien'
  end as estado
from public.lotes lo
join public.variantes v on v.id = lo.variante_id
join public.articulos a on a.id = v.articulo_id
join public.sedes s on s.id = lo.sede_id
where lo.cantidad_restante > 0;

-- Kárdex en frases: qué pasó, entra, sale, queda y quién. Sin costos.
create or replace view public.v_kardex with (security_invoker = true) as
select
  m.id,
  m.numero,
  m.operacion_id,
  m.variante_id,
  a.id as articulo_id,
  a.nombre as articulo_nombre,
  a.unidad,
  v.etiqueta,
  m.sede_id,
  s.nombre as sede_nombre,
  m.tipo,
  m.fecha,
  m.registrado_en,
  case when m.delta_disponible + m.delta_prestado > 0 then m.delta_disponible + m.delta_prestado else 0 end as entra,
  case when m.delta_disponible + m.delta_prestado < 0 then -(m.delta_disponible + m.delta_prestado) else 0 end as sale,
  m.delta_disponible,
  m.delta_prestado,
  m.disponible_resultante,
  m.prestado_resultante,
  m.destino,
  m.motivo_baja,
  m.detalle,
  m.cohorte_id,
  case when m.cohorte_id is null then null
       else (select g.nombre from public.v_grupos g where g.id = m.cohorte_id) end as grupo_nombre,
  m.compra_id,
  m.entrega_id,
  m.prestamo_id,
  m.conteo_id,
  m.lote_id,
  m.anula_a,
  exists (select 1 from public.movimientos r where r.anula_a = m.id) as anulado,
  pf.nombres as registrado_por_nombre
from public.movimientos m
join public.variantes v on v.id = m.variante_id
join public.articulos a on a.id = v.articulo_id
join public.sedes s on s.id = m.sede_id
left join public.perfiles pf on pf.id = m.registrado_por;

create or replace view public.v_kardex_valorizado with (security_invoker = true) as
select k.*, c.delta_valor, c.valor_resultante
from public.v_kardex k
join public.movimientos_costo c on c.movimiento_id = k.id;

revoke all on public.v_existencias, public.v_existencias_valorizadas, public.v_lotes_vigentes, public.v_kardex,
  public.v_kardex_valorizado from anon, authenticated;
grant select on public.v_existencias, public.v_existencias_valorizadas, public.v_lotes_vigentes, public.v_kardex,
  public.v_kardex_valorizado to authenticated;
