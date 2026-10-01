-- ============================================================================
-- Borrar las cuentas y datos de demostración
-- ----------------------------------------------------------------------------
-- Se ejecuta a mano en el editor SQL de Supabase (rol postgres):
--   - para reiniciar la demo (luego se vuelve a cargar `datos-demo.sql`);
--   - SIEMPRE antes de producción: la cuenta de administración de la demo
--     tiene una contraseña conocida.
--
-- Borra las cuentas del dominio `boliviagourmet.test` y, en cascada, sus
-- perfiles, identidades, sesiones y solicitudes. Es irreversible.
--
-- Guarda: si una cuenta de demostración del personal revisó solicitudes de
-- estudiantes REALES, se detiene sin borrar nada (quedarían sin revisor).
-- ============================================================================

do $$
declare
  c_dominio text := 'boliviagourmet.test';
  v_ids uuid[];
  v_n integer;
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

  -- Primero las solicitudes: así ninguna queda apuntando a un revisor borrado.
  delete from public.solicitudes where estudiante_id = any (v_ids);
  delete from auth.users where id = any (v_ids);

  raise notice 'Borradas % cuentas de demostración.', cardinality(v_ids);
end;
$$;
