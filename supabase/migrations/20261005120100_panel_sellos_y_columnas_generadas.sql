-- ============================================================================
-- 0022 · Sistema interno · La guarda del libro ignora las columnas generadas
-- ----------------------------------------------------------------------------
-- `app.solo_sellos` compara la fila vieja con la nueva (menos las columnas de
-- sello permitidas) para que el libro no se edite. En un disparador BEFORE,
-- las columnas generadas (en un arqueo, `diferencia` y `queda`) todavía no
-- están calculadas en NEW, así que parecían cambiar y TODO sello sobre
-- `cierres_de_caja` fallaba con `libro_inmutable` (lo encontró la batería al
-- revisar un arqueo, 20261005120000). Se derivan de columnas que sí se
-- comparan: ignorarlas no deja editar nada.
-- ============================================================================

create or replace function app.solo_sellos()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_permitidas text[] := coalesce(tg_argv, '{}'::text[]);
  v_generadas text[];
  v_columna text;
begin
  if app.en_mantenimiento() then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' or cardinality(v_permitidas) = 0 then
    raise exception using errcode = 'P0001', message = 'libro_inmutable';
  end if;
  select coalesce(array_agg(a.attname::text), '{}'::text[]) into v_generadas
    from pg_catalog.pg_attribute a
   where a.attrelid = tg_relid and a.attnum > 0 and not a.attisdropped and a.attgenerated <> '';
  if (to_jsonb(new) - v_permitidas - v_generadas) is distinct from (to_jsonb(old) - v_permitidas - v_generadas) then
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
