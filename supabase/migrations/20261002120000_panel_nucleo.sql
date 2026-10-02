-- ============================================================================
-- 0005 · Núcleo del panel interno (sistema interno v1, rebanada R1)
-- ----------------------------------------------------------------------------
-- Piezas que usan todas las demás migraciones del panel
-- (docs/sistema-interno/enmiendas-v1.md y especificacion-v1.md §2.1, §3.1–3.4):
--
--   · Permisos de administración y recepción (§4.1, sin los diferidos a la
--     v1.1: caja.supervisar, contabilidad.cerrar_mes, auditoria.leer).
--   · app.hoy(): la fecha de negocio de Bolivia. Solo la semilla de
--     demostración, desde el editor SQL, puede simular otra (enmiendas B.7).
--   · app.exigir_permiso / app.exigir_sede: la primera línea de cada motor.
--   · operaciones + app.iniciar_operacion / app.terminar_operacion: un doble
--     clic, una red lenta o recargar la página nunca registran dos veces.
--   · public.mi_contexto(): quién entró, su rol, sus permisos y sus sedes.
--
-- Patrón de las RPC del panel (D1): una FACHADA `security invoker` en
-- `public` (lo único que expone la API) llama a un MOTOR `security definer`
-- en `app` con `search_path = ''`, que comprueba el permiso en su primera
-- línea. Los errores se lanzan con el CÓDIGO como mensaje (`^[a-z_]+$`) y los
-- datos de la frase en `detail` (jsonb); la pantalla los traduce.
-- ============================================================================

-- ---------------------------------------------------------------- permisos

insert into public.permisos_de_rol (rol, permiso) values
  ('administrador', 'panel.entrar'),
  ('administrador', 'sedes.todas'),
  ('administrador', 'estudiantes.leer'),
  ('administrador', 'estudiantes.gestionar'),
  ('administrador', 'estudiantes.archivar'),
  ('administrador', 'cohortes.leer'),
  ('administrador', 'cohortes.gestionar'),
  ('administrador', 'inscripciones.gestionar'),
  ('administrador', 'inventario.leer'),
  ('administrador', 'inventario.operar'),
  ('administrador', 'inventario.catalogo'),
  ('administrador', 'inventario.comprar'),
  ('administrador', 'inventario.ajustar'),
  ('administrador', 'inventario.anular'),
  ('administrador', 'caja.leer'),
  ('administrador', 'caja.cobrar'),
  ('administrador', 'caja.cerrar'),
  ('administrador', 'caja.anular'),
  ('administrador', 'contabilidad.leer'),
  ('administrador', 'contabilidad.gestionar'),
  ('recepcion', 'panel.entrar'),
  ('recepcion', 'estudiantes.leer'),
  ('recepcion', 'estudiantes.gestionar'),
  ('recepcion', 'cohortes.leer'),
  ('recepcion', 'inscripciones.gestionar'),
  ('recepcion', 'inventario.leer'),
  ('recepcion', 'inventario.operar'),
  ('recepcion', 'caja.leer'),
  ('recepcion', 'caja.cobrar'),
  ('recepcion', 'caja.cerrar')
on conflict do nothing;

-- ---------------------------------------------------------------- fecha de negocio

-- Solo el editor SQL de Supabase (y el conector) corren como `postgres`. Por la
-- API la sesión es `authenticator`: nunca cumple esta condición, y ninguna
-- función expuesta fija `app.mantenimiento`.
create or replace function app.en_mantenimiento()
returns boolean
language sql
stable
set search_path = ''
as $$
  select session_user = 'postgres'
     and coalesce(current_setting('app.mantenimiento', true), '') = 'si';
$$;

-- La fecha de negocio es la de Bolivia, nunca la UTC del servidor. La semilla
-- de demostración «viaja en el tiempo» fijando `app.hoy_simulada` en modo
-- mantenimiento y llamando a las mismas RPC: todo pasa por las reglas reales.
create or replace function app.hoy()
returns date
language plpgsql
stable
set search_path = ''
as $$
declare
  v_simulada text;
begin
  if app.en_mantenimiento() then
    v_simulada := nullif(current_setting('app.hoy_simulada', true), '');
    if v_simulada is not null then
      return v_simulada::date;
    end if;
  end if;
  return (now() at time zone 'America/La_Paz')::date;
end;
$$;

revoke all on function app.en_mantenimiento() from public;
revoke all on function app.hoy() from public;
grant execute on function app.en_mantenimiento() to authenticated;
grant execute on function app.hoy() to authenticated;

-- ---------------------------------------------------------------- permiso y sede

create or replace function app.exigir_permiso(p_permiso text)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not app.tiene_permiso(p_permiso) then
    raise exception using
      errcode = '42501',
      message = 'sin_permiso',
      detail = jsonb_build_object('permiso', p_permiso)::text;
  end if;
end;
$$;

-- La sede de trabajo del personal es `perfiles.sede_id`. DEFINER porque la lee
-- sin pasar por la RLS de perfiles (como app.tiene_permiso).
create or replace function app.sede_de_sesion()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.sede_id from public.perfiles p where p.id = (select auth.uid()) and p.activo;
$$;

create or replace function app.puede_operar_sede(p_sede uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_sede is not null
     and (app.tiene_permiso('sedes.todas') or app.sede_de_sesion() = p_sede);
$$;

-- Recepción opera SOLO en su sede (supuesto anotado en CLAUDE.md §16.3);
-- administración, en cualquiera. Un miembro del personal sin sede no opera.
create or replace function app.exigir_sede(p_sede uuid)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_sede is null or not exists (select 1 from public.sedes s where s.id = p_sede and s.activa) then
    raise exception using errcode = 'P0001', message = 'sede_no_operable',
      detail = jsonb_build_object('sede', p_sede)::text;
  end if;
  if app.tiene_permiso('sedes.todas') then
    return;
  end if;
  if app.sede_de_sesion() is null then
    raise exception using errcode = 'P0001', message = 'sede_no_asignada';
  end if;
  if app.sede_de_sesion() <> p_sede then
    raise exception using errcode = 'P0001', message = 'sede_no_operable',
      detail = jsonb_build_object('sede', p_sede)::text;
  end if;
end;
$$;

revoke all on function app.exigir_permiso(text) from public;
revoke all on function app.sede_de_sesion() from public;
revoke all on function app.puede_operar_sede(uuid) from public;
revoke all on function app.exigir_sede(uuid) from public;
grant execute on function app.exigir_permiso(text) to authenticated;
grant execute on function app.sede_de_sesion() to authenticated;
grant execute on function app.puede_operar_sede(uuid) to authenticated;
grant execute on function app.exigir_sede(uuid) to authenticated;

-- ---------------------------------------------------------------- idempotencia

-- Cada formulario del panel lleva una clave uuid que se genera al dibujarlo.
-- Todo documento nace dentro de una operación; si el envío se repite con la
-- misma clave, el motor devuelve el resultado guardado sin repetir nada.
create table public.operaciones (
  clave uuid primary key,
  tipo text not null check (tipo ~ '^[a-z_]+$'),
  registrado_por uuid not null default auth.uid() references public.perfiles (id),
  resultado jsonb,
  created_at timestamptz not null default now()
);

comment on table public.operaciones is
  'Una fila por envío de formulario del panel. Evita registrar dos veces lo mismo. Solo la escribe el motor.';

create index operaciones_registrado_por_idx on public.operaciones (registrado_por);

alter table public.operaciones enable row level security;
revoke all on table public.operaciones from anon, authenticated;
-- Sin políticas: nadie la lee ni la escribe por la API; solo el motor (DEFINER).

-- Devuelve NULL si la operación es nueva (el motor sigue) o el resultado
-- guardado si la clave ya se usó para lo mismo (el motor lo devuelve tal cual).
-- Si otra transacción tiene la misma clave sin confirmar, el índice único hace
-- esperar a que termine: si falló, su fila no existe y esta sigue normalmente.
create or replace function app.iniciar_operacion(p_clave uuid, p_tipo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fila public.operaciones%rowtype;
begin
  if p_clave is null then
    raise exception using errcode = 'P0001', message = 'datos_invalidos',
      detail = jsonb_build_object('campos', jsonb_build_array('clave'))::text;
  end if;

  insert into public.operaciones (clave, tipo, registrado_por)
  values (p_clave, p_tipo, (select auth.uid()))
  on conflict (clave) do nothing;
  if found then
    return null;
  end if;

  select * into v_fila from public.operaciones where clave = p_clave;
  if v_fila.registrado_por is distinct from (select auth.uid()) or v_fila.tipo <> p_tipo then
    raise exception using errcode = 'P0001', message = 'clave_reutilizada';
  end if;
  return coalesce(v_fila.resultado, '{}'::jsonb) || jsonb_build_object('repetida', true);
end;
$$;

create or replace function app.terminar_operacion(p_clave uuid, p_resultado jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.operaciones
     set resultado = p_resultado
   where clave = p_clave
     and resultado is null
     and registrado_por = (select auth.uid());
  return p_resultado;
end;
$$;

revoke all on function app.iniciar_operacion(uuid, text) from public;
revoke all on function app.terminar_operacion(uuid, jsonb) from public;
grant execute on function app.iniciar_operacion(uuid, text) to authenticated;
grant execute on function app.terminar_operacion(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------- contexto de la sesión

-- INVOKER: lee el propio perfil, los permisos del propio rol y las sedes
-- activas, todo bajo RLS. Un estudiante recibe permisos vacíos y el panel lo
-- devuelve al portal.
create or replace function public.mi_contexto()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'rol', p.rol,
    'nombres', p.nombres,
    'apellidos', p.apellidos,
    'correo', p.correo,
    'activo', p.activo,
    'sede_id', p.sede_id,
    'hoy', app.hoy(),
    'permisos', coalesce(
      (select jsonb_agg(r.permiso order by r.permiso) from public.permisos_de_rol r where r.rol = p.rol and p.activo),
      '[]'::jsonb
    ),
    'sedes', coalesce(
      (select jsonb_agg(jsonb_build_object('id', s.id, 'codigo', s.codigo, 'nombre', s.nombre, 'zona', s.zona) order by s.codigo)
         from public.sedes s
        where s.activa
          and (app.tiene_permiso('sedes.todas') or s.id = p.sede_id)),
      '[]'::jsonb
    )
  )
  from public.perfiles p
  where p.id = (select auth.uid());
$$;

revoke all on function public.mi_contexto() from public, anon;
grant execute on function public.mi_contexto() to authenticated;
