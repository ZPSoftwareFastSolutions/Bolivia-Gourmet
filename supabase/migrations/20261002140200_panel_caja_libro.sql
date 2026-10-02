-- ============================================================================
-- 0010 · Sistema interno · Caja: el libro rechaza todo update (rebanada R3)
-- ----------------------------------------------------------------------------
-- `app.solo_sellos()` sin columnas permitidas (pago_aplicaciones, arqueos)
-- debe rechazar CUALQUIER update, aunque no cambie nada: es un libro
-- (especificación §2.8). La versión anterior solo rechazaba los cambios.
-- ============================================================================

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
  if tg_op = 'DELETE' or cardinality(v_permitidas) = 0 then
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
