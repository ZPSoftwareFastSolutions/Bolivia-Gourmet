-- ============================================================================
-- Borrar las cuentas y datos de demostración
-- ----------------------------------------------------------------------------
-- Se ejecuta a mano en el editor SQL de Supabase (rol postgres):
--   - para reiniciar la demo (luego se vuelven a cargar `datos-demo.sql` y
--     `datos-panel-demo.sql`);
--   - SIEMPRE antes de producción: la cuenta de administración de la demo
--     tiene una contraseña conocida.
--
-- Primero borra TODOS los datos del panel interno (los de
-- `datos-panel-demo.sql`: grupos, alumnos, inscripciones, cobros, cargos,
-- gastos, arqueos, compras, inventario, entregas y préstamos). Hay que
-- hacerlo antes que las cuentas: cada fila del panel apunta a quien la
-- registró y esas claves no se borran en cascada. Después borra las cuentas
-- del dominio `boliviagourmet.test` y, en cascada, sus perfiles, identidades,
-- sesiones y solicitudes. Es irreversible.
--
-- El panel es un libro que no se edita ni se borra; solo el modo
-- mantenimiento (`app.mantenimiento = 'si'`, que solo honra el rol postgres)
-- deja borrarlo. El orden sigue las claves foráneas, incluidos los dos
-- ciclos: movimientos ↔ lotes (se suelta `movimientos.lote_id` antes) y las
-- autorreferencias (`movimientos.anula_a`, `inscripciones.renueva_a`: primero
-- las filas que apuntan a otras). `operaciones` va al final: todo nace en una.
--
-- Guardas (se detiene sin borrar nada):
--   - si una cuenta de demostración del personal revisó solicitudes de
--     estudiantes REALES (quedarían sin revisor);
--   - si el panel tiene registros hechos por una cuenta que NO es de
--     demostración: este script borra el panel entero y no debe llevarse
--     datos reales.
-- ============================================================================

do $$
declare
  c_dominio text := 'boliviagourmet.test';
  v_ids uuid[];
  v_n integer;
  v_operaciones integer;
begin
  select array_agg(id) into v_ids from auth.users where lower(email) like '%@' || c_dominio;
  if v_ids is null then
    raise notice 'No hay cuentas de demostración.';
    return;
  end if;

  select count(*) into v_n from public.solicitudes
  where revisado_por = any (v_ids) and not (estudiante_id = any (v_ids));
  if v_n > 0 then
    raise exception '% solicitudes de estudiantes reales las revisó una cuenta de demostración. Revísalas antes de borrar.', v_n;
  end if;

  select count(*) into v_n from (
    select registrado_por from public.operaciones
    union all select registrado_por from public.cohortes
    union all select registrado_por from public.planes_de_pago
    union all select registrado_por from public.articulos
    union all select registrado_por from public.estudiantes
  ) x
  where not (x.registrado_por = any (v_ids));
  if v_n > 0 then
    raise exception '% registros del panel los hizo una cuenta que no es de demostración. Este script borra el panel entero: revísalo antes de borrar.', v_n;
  end if;

  select count(*) into v_operaciones from public.operaciones;

  -- ------------------------------------------------------------ datos del panel
  -- >>> borrado del panel
  perform set_config('app.mantenimiento', 'si', true);

  -- Inventario: el detalle de costo, luego el ciclo movimientos ↔ lotes.
  delete from public.movimiento_lotes;
  delete from public.lotes_costo;
  update public.movimientos set lote_id = null where lote_id is not null;
  delete from public.lotes;
  delete from public.movimientos_costo;
  delete from public.movimientos where anula_a is not null;
  delete from public.movimientos;

  -- Caja: a qué cargos se aplicó cada cobro, los cobros, los cargos (apuntan
  -- a entregas, préstamos, planes e inscripciones), gastos, compras y, al
  -- final, los arqueos a los que apuntaban todos ellos.
  delete from public.pago_aplicaciones;
  delete from public.pagos;
  delete from public.cargos;
  delete from public.gastos;
  delete from public.compras;
  delete from public.cierres_de_caja;

  -- Documentos de inventario y saldos; después el catálogo.
  delete from public.entregas;
  delete from public.prestamos;
  delete from public.conteos;
  delete from public.existencias_costo;
  delete from public.existencias;
  delete from public.variantes;
  delete from public.articulos;

  -- Alumnos y grupos (los planes, después de sus cargos: un plan con cargos
  -- vigentes no se deja borrar).
  delete from public.inscripciones where renueva_a is not null;
  delete from public.inscripciones;
  delete from public.planes_de_pago;
  delete from public.cohortes;
  delete from public.estudiantes;

  delete from public.operaciones;

  perform set_config('app.mantenimiento', 'no', true);
  -- <<< borrado del panel

  -- ------------------------------------------------------------ cuentas
  -- Primero las solicitudes: así ninguna queda apuntando a un revisor borrado.
  delete from public.solicitudes where estudiante_id = any (v_ids);
  delete from auth.users where id = any (v_ids);

  raise notice 'Borrados los datos del panel (% operaciones) y % cuentas de demostración.', v_operaciones, cardinality(v_ids);
end;
$$;
