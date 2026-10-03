-- ============================================================================
-- Sistema interno · Devolver el uniforme anula su cargo (revisión DB-02)
-- ----------------------------------------------------------------------------
-- Enmiendas B.12, crítica 14: «devolver uniforme sin cambio de talla → si el
-- cargo no tiene cobros, la RPC lo anula; si está cobrado, devuelve el aviso
-- "anula el cobro" (administración)». La versión de R5 devolvía la pieza al
-- costo con que salió, pero el alumno seguía debiendo un uniforme que ya no
-- tenía.
--
-- Cada fila de `entregas` es una línea (una variante y su cantidad) y
-- `entregar_uniforme` le crea como mucho UN cargo (`origen = 'entrega'`,
-- `entrega_id`). El cambio de talla devuelve piezas de una fila y crea OTRA
-- (contexto `cambio_de_talla`, sin cargo): el cargo sigue en la entrega
-- original y cubre también las piezas cambiadas. Por eso se mira la CADENA:
-- la fila nueva lleva el `operacion_id` del movimiento `devolucion_entrega`
-- que la originó, y ese movimiento apunta (`entrega_id`) a la fila de la
-- que salió. Subiendo por ese enlace se llega a la raíz (la que tiene el
-- cargo); bajando desde la raíz, a todas las piezas del alumno. Ahora, sin
-- cambio de talla, si la raíz tiene un cargo vigente:
-- - Si con esta devolución el alumno ya no tiene NINGUNA pieza de la cadena
--   (se devuelva desde la raíz o desde una fila de cambio) y el cargo no
--   tiene cobros vigentes aplicados, se sella como lo hace `app.anular` (las
--   cuatro columnas que `app.solo_sellos` permite en `cargos`) con el motivo
--   «Devolución del uniforme».
-- - Si el cargo está cobrado (aunque sea en parte), no se toca: anular un
--   cobro es de administración (`caja.anular`) y `app.anular` no anula un
--   cargo con un cobro vigente, así que la respuesta trae el aviso
--   `anula_el_cobro` para que la pantalla pida los dos pasos.
-- - Si todavía le queda alguna pieza de la cadena (devolvió solo una parte,
--   o devolvió esta fila pero conserva una talla cambiada), el cargo sigue
--   igual (aviso `devolucion_parcial`).
-- El cambio de talla nunca toca el cargo: el alumno sigue con su uniforme.
--
-- Orden de candados (B.10): saldos por variante, luego la entrega y, al
-- final, el cargo de la raíz. Ese último candado también pone en fila dos
-- devoluciones de filas distintas de la misma cadena: la segunda espera y,
-- al seguir, cuenta las piezas con lo que la primera ya devolvió (si la
-- primera selló el cargo, ya no lo encuentra vigente). Anular un cargo no
-- mueve efectivo: no hay candado de caja (igual que `app.anular` con un
-- cargo).
--
-- Solo cambia `app.devolver_uniforme` (copia de su única definición, en
-- 20261002160000); la fachada `public.devolver_uniforme` sigue igual y
-- devuelve lo que devuelve el motor. La respuesta añade:
--   cargo: {id, monto, anulado} | null    aviso: 'anula_el_cobro' | 'devolucion_parcial' | null
-- ============================================================================

create or replace function app.devolver_uniforme(p_clave uuid, p_entrega uuid, p_cantidad text, p_motivo text, p_cambiar_por uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previo jsonb;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_entrega public.entregas%rowtype;
  v_articulo public.articulos%rowtype;
  v_nueva_articulo uuid;
  v_cantidad integer;
  v_pendiente integer;
  v_valor_salida bigint;
  v_ya bigint;
  v_valor bigint;
  v_mov uuid;
  v_antes numeric;
  v_nueva uuid;
  v_salida jsonb;
  v_etiqueta text;
  v_confirmacion jsonb := '[]'::jsonb;
  v_cargo public.cargos%rowtype;
  v_cargo_json jsonb;
  v_aviso text;
  v_raiz uuid;
  v_en_poder bigint;
begin
  perform app.exigir_permiso('inventario.operar');
  select * into v_entrega from public.entregas e where e.id = p_entrega;
  if not found then
    raise exception using errcode = 'P0001', message = 'documento_no_encontrado';
  end if;
  perform app.exigir_sede(v_entrega.sede_id);
  v_previo := app.iniciar_operacion(p_clave, 'devolucion_entrega');
  if v_previo is not null then return v_previo; end if;

  if v_motivo is null or char_length(v_motivo) < 3 then
    raise exception using errcode = 'P0001', message = 'motivo_requerido';
  end if;
  v_articulo := app.articulo_de_variante(v_entrega.variante_id);
  v_cantidad := app.exigir_cantidad(p_cantidad, v_articulo.tipo)::integer;
  if p_cambiar_por is not null then
    select v.articulo_id into v_nueva_articulo from public.variantes v where v.id = p_cambiar_por and v.activa;
    if v_nueva_articulo is null or v_nueva_articulo <> v_articulo.id then
      raise exception using errcode = 'P0001', message = 'pieza_distinta';
    end if;
    if p_cambiar_por = v_entrega.variante_id then
      raise exception using errcode = 'P0001', message = 'talla_igual';
    end if;
  end if;

  -- Saldos en orden de id; la entrega bloqueada después, y se vuelve a leer.
  perform app.bloquear_saldo(x.v, v_entrega.sede_id)
     from (select distinct v from unnest(array[v_entrega.variante_id, p_cambiar_por]) as t(v) where v is not null order by 1) x;
  select * into v_entrega from public.entregas e where e.id = p_entrega for update;
  v_pendiente := v_entrega.cantidad - v_entrega.devuelta;
  if v_cantidad > v_pendiente then
    raise exception using errcode = 'P0001', message = 'devolucion_excede', detail = jsonb_build_object('pendiente', v_pendiente)::text;
  end if;

  -- Sin cambio de talla: el cargo vigente de la raíz de la cadena, bloqueado
  -- al final (B.10). Un cobro que llegue a la vez espera y después lo ve
  -- anulado; otra devolución de la misma cadena espera y cuenta después.
  if p_cambiar_por is null then
    -- Subir: de una fila de cambio a la fila de la que salió. El padre
    -- siempre es anterior (`numero` menor), así que la subida termina.
    with recursive arriba (id, operacion_id, contexto, numero, nivel) as (
      select e.id, e.operacion_id, e.contexto, e.numero, 0
        from public.entregas e where e.id = p_entrega
      union all
      select padre.id, padre.operacion_id, padre.contexto, padre.numero, a.nivel + 1
        from arriba a
        join public.movimientos m on m.operacion_id = a.operacion_id and m.tipo = 'devolucion_entrega'
        join public.entregas padre on padre.id = m.entrega_id and padre.numero < a.numero
       where a.contexto = 'cambio_de_talla'
    )
    select a.id into v_raiz from arriba a order by a.nivel desc limit 1;

    select * into v_cargo from public.cargos c
     where c.entrega_id = v_raiz and c.anulado_en is null
     for update;
    if found then
      -- Bajar desde la raíz, en otra sentencia DESPUÉS del candado: así ve lo
      -- que otra devolución de la cadena dejó hecho mientras esta esperaba.
      -- Lo que vuelve ahora se anota más abajo (`devuelta`): aquí se resta.
      with recursive cadena (id, numero) as (
        select e.id, e.numero from public.entregas e where e.id = v_raiz
        union all
        select hija.id, hija.numero
          from cadena c
          join public.movimientos m on m.entrega_id = c.id and m.tipo = 'devolucion_entrega'
          join public.entregas hija on hija.operacion_id = m.operacion_id and hija.contexto = 'cambio_de_talla'
                                    and hija.numero > c.numero
      )
      select coalesce(sum(e.cantidad - e.devuelta), 0) - v_cantidad into v_en_poder
        from cadena c join public.entregas e on e.id = c.id;
      if v_en_poder > 0 then
        -- Le queda alguna pieza de la cadena (de esta fila o de una talla cambiada).
        v_aviso := 'devolucion_parcial';
        v_cargo_json := jsonb_build_object('id', v_cargo.id, 'monto', v_cargo.monto, 'anulado', false);
      elsif exists (select 1 from public.pago_aplicaciones pa join public.pagos p on p.id = pa.pago_id
                     where pa.cargo_id = v_cargo.id and p.anulado_en is null) then
        -- Cobrado: administración anula el cobro y después el cargo
        -- (`app.anular` no anula un cargo con un cobro vigente); aquí solo se avisa.
        v_aviso := 'anula_el_cobro';
        v_cargo_json := jsonb_build_object('id', v_cargo.id, 'monto', v_cargo.monto, 'anulado', false);
      else
        -- El mismo sello que `app.anular` (las columnas que permite `app.solo_sellos`).
        update public.cargos
           set anulado_en = now(), anulado_el = app.hoy(), anulado_por = (select auth.uid()),
               anulacion_motivo = 'Devolución del uniforme'
         where id = v_cargo.id;
        v_cargo_json := jsonb_build_object('id', v_cargo.id, 'monto', v_cargo.monto, 'anulado', true);
      end if;
    end if;
  end if;

  select -c.delta_valor into v_valor_salida
    from public.movimientos m join public.movimientos_costo c on c.movimiento_id = m.id
   where m.entrega_id = p_entrega and m.tipo = 'entrega';
  select coalesce(sum(c.delta_valor), 0) into v_ya
    from public.movimientos m join public.movimientos_costo c on c.movimiento_id = m.id
   where m.entrega_id = p_entrega and m.tipo = 'devolucion_entrega';
  v_valor := case when v_cantidad = v_pendiente then v_valor_salida - v_ya
                  else least(round(v_valor_salida::numeric * v_cantidad / v_entrega.cantidad)::bigint, v_valor_salida - v_ya) end;

  select e.disponible into v_antes from public.existencias e where e.variante_id = v_entrega.variante_id and e.sede_id = v_entrega.sede_id;
  v_mov := app.mover(p_clave, v_entrega.variante_id, v_entrega.sede_id, 'devolucion_entrega', v_cantidad, v_cantidad, 0,
                     jsonb_build_object('entrega', p_entrega, 'detalle', left(v_motivo, 300)));
  perform app.valorizar(v_mov, v_entrega.variante_id, v_entrega.sede_id, v_valor);
  update public.entregas set devuelta = devuelta + v_cantidad where id = p_entrega;
  v_confirmacion := v_confirmacion || app.linea_de_confirmacion(v_entrega.variante_id, v_entrega.sede_id, v_cantidad, v_antes);

  -- Cambio de talla: otra entrega del mismo artículo, sin cargo.
  if p_cambiar_por is not null then
    select v.etiqueta into v_etiqueta from public.variantes v where v.id = v_entrega.variante_id;
    select e.disponible into v_antes from public.existencias e where e.variante_id = p_cambiar_por and e.sede_id = v_entrega.sede_id;
    v_salida := app.sacar(p_cambiar_por, v_entrega.sede_id, v_cantidad, false, null, false);
    insert into public.entregas (operacion_id, inscripcion_id, sede_id, variante_id, cantidad, contexto, detalle, fecha, registrado_por)
    values (p_clave, v_entrega.inscripcion_id, v_entrega.sede_id, p_cambiar_por, v_cantidad, 'cambio_de_talla',
            left('Cambio de la talla ' || v_etiqueta, 300), app.hoy(), (select auth.uid()))
    returning id into v_nueva;
    v_mov := app.mover(p_clave, p_cambiar_por, v_entrega.sede_id, 'entrega', v_cantidad, -v_cantidad, 0,
                       jsonb_build_object('entrega', v_nueva, 'detalle', left('Cambio de la talla ' || v_etiqueta, 300)));
    perform app.valorizar(v_mov, p_cambiar_por, v_entrega.sede_id, -(v_salida ->> 'valor')::bigint);
    v_confirmacion := v_confirmacion || app.linea_de_confirmacion(p_cambiar_por, v_entrega.sede_id, v_cantidad, v_antes);
  end if;

  return app.terminar_operacion(p_clave, jsonb_build_object(
    'entrega', p_entrega, 'devuelta', v_cantidad, 'nueva_entrega', v_nueva, 'lineas', v_confirmacion,
    'cargo', v_cargo_json, 'aviso', v_aviso));
end;
$$;

revoke all on function app.devolver_uniforme(uuid, uuid, text, text, uuid) from public;
grant execute on function app.devolver_uniforme(uuid, uuid, text, text, uuid) to authenticated;
