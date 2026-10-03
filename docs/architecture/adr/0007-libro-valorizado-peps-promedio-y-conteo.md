# ADR 0007 — Libro valorizado: PEPS por lotes, costo promedio y conteo físico

**Estado:** Aceptado · **Fecha:** 2026-10-02 · **Ámbito:** sistema interno · inventario y contabilidad · Enmienda el ADR 0003

## Contexto

El ADR 0003 dejó el inventario como un libro inmutable de **cantidades**: el
tipo del artículo decide su comportamiento, todo artículo tiene variantes y
el saldo es la suma del libro. Para corregir un saldo ofrecía un `ajuste` que
**fija** la existencia a un valor.

La v1 del sistema interno (enmiendas A.1) pide además el **valor**: cuánto
dinero está guardado en el almacén, cuánto costó lo que se usó en el mes y la
tarjeta kárdex PEPS por insumo y sede. Eso abrió preguntas que el ADR 0003 no
respondía:

- **Los artículos no se valorizan igual.** Los insumos se vencen y en cocina
  se rota lo más antiguo; los juegos de uniforme de una talla son idénticos y
  se venden a precio fijo; los utensilios se prestan y vuelven.
- **El «ajuste que fija» no funciona con lotes** (D15): si la existencia pasa
  de 10 kg a 9,5 kg, no se sabe de qué lote salió la diferencia ni a qué
  costo.
- **Las cuentas con decimales de la computadora no son exactas** (crítica 6):
  3 × 0,35 / 2,1 debería dar 0,5, pero la pantalla obtiene 0,4999… y redondea
  a 0, mientras la base de datos redondea a 1. Un centavo de diferencia entre
  la pantalla y la base ya es un descuadre (técnicamente: coma flotante en
  JavaScript frente a `numeric` en PostgreSQL).
- **Los permisos de la base deciden qué registros ve cada persona, pero no qué
  datos de cada registro** (D2). Si el costo estuviera en el mismo registro que
  la cantidad, recepción podría leerlo desde fuera de la pantalla (la RLS filtra
  filas, no columnas).
- La crítica encontró casos rotos: los lotes vencidos hacían fallar el
  faltante del conteo (5), anular y cerrar la caja podían esperarse en
  círculo (9), anular la baja de un préstamo lo descuadraba (12), el sobrante
  a costo promedio no tenía costo definido (24) y el saldo inicial no se podía
  anular (25).

Fuentes: `docs/sistema-interno/especificacion-v1.md` (§2.5, §3.5–3.12 y §5),
`enmiendas-v1.md` (A, B.5, B.6, B.10 y B.12, que mandan sobre la
especificación) y `critica-de-la-especificacion.md`.

## Decisión

1. **Dos métodos, un solo motor** (D18, especificación §5.2).
   `articulos.valuacion` es una columna generada: `peps` si el tipo es
   `insumo`; `promedio` en uniformes, utensilios y otros. En el dominio es
   `COMPORTAMIENTO_POR_TIPO[tipo].valuacion`. El método va unido al tipo y no
   cambia por mes. El tipo y la unidad no se pueden editar por la API (no
   tienen permiso de columna; solo se eligen al crear el artículo) y, como
   defensa adicional, un disparador los fija en cuanto hay movimientos
   (`tipo_bloqueado`). Los dos métodos comparten las mismas piezas: el saldo
   bloqueado, la capa de costo y la fórmula proporcional con resto exacto
   (punto 5). PEPS tiene muchas capas (los lotes); el promedio, una sola.

2. **Insumos: PEPS por lotes, con lo vencido aparte.**
   - Cada entrada (compra, saldo inicial, sobrante) crea un **lote** con la
     cantidad y el valor **de la línea entera**, no un unitario redondeado
     (el costo por unidad solo se muestra). Todo movimiento lleva la fecha de
     hoy (`app.hoy()`, D10): el orden PEPS es `(fecha_ingreso, secuencia)` y
     coincide con el orden de escritura.
   - Cada salida toma de los lotes en ese orden y deja en `movimiento_lotes`
     de qué lote, cuánto y por cuánto. Así una anulación vuelve a los mismos
     lotes y la ficha responde «¿de qué compra salió esta harina?».
   - Un lote está **vencido** si `vence_el < hoy`; el que vence hoy todavía
     se usa. El **uso en clase** salta lo vencido (D14); si lo vigente no
     alcanza, `stock_insuficiente` dice cuánto hay vencido. El **faltante de
     conteo** y las **bajas que no son por vencimiento** consumen primero lo
     vencido y después siguen el orden PEPS (B.5).
   - La **baja por vencimiento** saca **ese lote**, que es lo que se tira:
     exige el lote (`lote_requerido`), de ese artículo y sede
     (`lote_no_corresponde`), y vencido (`lote_no_vencido`).
   - `v_existencias` muestra lo vencido en su propia columna y calcula el
     estado (agotado, bajo, bien) sobre lo que se puede usar.

3. **Uniformes, utensilios y otros: costo promedio ponderado.** Una capa por
   variante y sede (`existencias_costo.valor`) sobre
   `total = disponible + prestado`: lo prestado sigue siendo del instituto y
   sigue valiendo. La entrada suma a la capa; la salida vale
   `round(valor_capa × q / total)`. **Prestar es custodia**: pasa de
   disponible a prestado con un movimiento de valor 0, y la devolución del
   préstamo, igual. El costo promedio por unidad solo se muestra.

4. **Cantidades en milésimas y dinero en centavos.** La base guarda las
   cantidades en `numeric(12,3)`; el dominio, como `Milesimas` (`bigint`:
   2,5 kg = `2500n`). Hacia la base viajan como texto con punto decimal
   (`cantidadParaLaBase`, que lee `app.leer_cantidad`): hasta 3 decimales y
   nada se redondea en silencio. Uniformes y utensilios van en piezas enteras
   (`cantidad_no_entera`). Los importes son centavos enteros (`bigint` en la
   base; `Centavos` en el dominio, que los opera como `BigInt`). La
   proporción `round(v × t / c)` redondea la mitad hacia arriba: en el
   dominio, `redondearProporcion` calcula `(2·v·t + c) / (2·c)` en enteros;
   en la base, `round(v * t / c)` sobre `numeric`, que es exacto. Ninguna
   cuenta de costo usa coma flotante (B.6).

5. **El resto exacto lo lleva la última salida.**
   - PEPS: la toma que **agota un lote** se lleva su `valor_restante`.
   - Promedio: la salida que **agota la capa** (`q = total`) se lleva todo su
     valor.
   - Devolución de uniforme: vuelve **al costo con que salió**,
     `round(valor_de_la_entrega × q / cantidad_entregada)`, sin pasar de lo
     que le queda a la entrega; la devolución que **completa la entrega** se
     lleva el resto exacto.

   Por eso la suma de las salidas es siempre lo pagado, y una entrega y su
   devolución se anulan al centavo.

6. **Los costos viven en tablas aparte que solo lee `contabilidad.leer`**
   (D2; hoy, solo administración). Son `existencias_costo`, `lotes_costo`,
   `movimientos_costo` (`delta_valor` y `valor_resultante` de cada
   movimiento), `movimiento_lotes`, `compras` y `conteos`. Las cantidades
   (`existencias`, `lotes`, `movimientos`, `entregas`, `prestamos`) se leen
   con `inventario.leer`. Las vistas son `security_invoker`:
   `v_existencias_valorizadas` y `v_kardex_valorizado` unen las tablas de
   costo y a recepción le devuelven 0 filas. Las RPC devuelven el valor solo
   a quien tiene `contabilidad.leer`. Nadie tiene permiso de escritura directa
   sobre estas tablas: escribe solo el motor.

7. **El libro es inmutable; lo que se corrige deja huella.**
   - `movimientos`, `movimientos_costo`, `movimiento_lotes` y `conteos`
     rechazan todo `update` y `delete`, también del motor (`app.solo_sellos()`
     sin columnas → `libro_inmutable`). De un lote solo cambia lo que le queda
     (`app.proteger_lote`); de una compra, los sellos de anulación y de
     arqueo; de una entrega o un préstamo, lo devuelto, lo perdido y el
     cierre, que solo crecen (`app.solo_crece`). La única excepción es el
     modo mantenimiento de los scripts de la demo.
   - **Anular es registrar el movimiento inverso**: `app.revertir` escribe un
     movimiento `anulacion` (`anula_a`, único) con los deltas opuestos, y
     devuelve o saca **los mismos lotes y el mismo valor**, aunque el lote ya
     estuviera agotado. Solo administración anula (`inventario.anular`). Se
     anulan: la **compra**, si nada de lo comprado se movió después (lotes
     intactos en PEPS; ningún movimiento posterior de esa variante y sede en
     promedio; si no, `compra_con_movimientos_posteriores`). Lo posterior que
     ya se anuló, y la anulación misma, no cuentan (migración
     `20261002190000_panel_anular_lo_deshecho.sql`). También se anulan el
     **uso en clase**, entero, por su operación; la **baja**; y el **saldo
     inicial** (punto 9), con la misma regla. Anular dos veces da
     `ya_anulado`, también en el saldo inicial.
   - **Las entregas y los préstamos no se anulan: se devuelven**
     (`devolver_uniforme`, `recibir_devolucion`). Es lo que pasó y la
     historia queda completa. `anular` no los admite, y el dominio tampoco
     (`TIPOS_ANULABLES`).
   - **La pérdida o la rotura en un préstamo es una baja desde «prestado»**,
     a costo promedio: resta de lo prestado y no del estante. Esa baja no se
     anula (`baja_de_prestamo`): volvería a «prestado» sin deshacer lo perdido
     ni el cierre del préstamo (B.12, crítica 12).
   - Una diferencia de conteo no se anula: se corrige con otro conteo.

8. **Desaparece el «ajuste que fija»: el conteo es todo o nada, con faltante
   y sobrante** (D15, D16, B.5). `registrar_conteo` (`inventario.ajustar`,
   solo administración) recibe, por línea, lo que mostraba la pantalla
   (`existencia_vista`), lo contado y el motivo.
   - Bloquea los saldos en orden y compara cada línea con `disponible`, que
     incluye lo vencido. Si **una sola** cambió mientras se contaba, rechaza
     el conteo entero con `existencia_cambio` (con las líneas que cambiaron)
     y no escribe nada: se vuelve a contar.
   - Si nada cambió, guarda un documento `conteos` con todas las líneas,
     también las que coincidieron (constancia), y por cada diferencia, que
     exige motivo:
     - **Faltante** → `ajuste_faltante`: salida PEPS, con lo vencido primero,
       o a costo promedio.
     - **Sobrante** → `ajuste_sobrante`. En PEPS, un lote nuevo de origen
       `sobrante`, con fecha de hoy (va al final de la cola) y con
       vencimiento si el artículo lo controla, al costo por unidad del
       **último lote ingresado**, aunque esté agotado:
       `round(valor_inicial × q / cantidad_inicial)`. En promedio, a la
       **capa**: al promedio vigente si `total > 0`; si no, al costo unitario
       de la última compra o saldo inicial no anulados.
     - Solo si no hay ninguna de esas referencias se usa el **valor que
       indica administración**; sin él, `costo_requerido`. Un conteo no es la
       vía para revalorizar el inventario.
   - El conteo compara lo que hay en el estante; lo prestado se controla con
     los préstamos abiertos.

9. **El saldo inicial se anula si no tiene movimientos posteriores** (B.12,
   crítica 25). `registrar_saldo_inicial` (`inventario.ajustar`) escribe un
   documento `conteos` de clase `saldo_inicial` y un movimiento
   `saldo_inicial` por línea (un lote o una entrada a la capa). No es salida
   de dinero. Rechaza la variante que ya tiene movimientos en la sede
   (`ya_tiene_movimientos`) y admite varias líneas de una misma variante
   (cada una, un lote con su vencimiento). `anular('saldo_inicial', …)`
   recibe el movimiento de una línea y exige que esa variante no tenga
   movimientos posteriores en la sede; si los tiene, responde
   `compra_con_movimientos_posteriores`.

10. **Orden de candados: caja, luego saldos por variante, luego lotes**
    (B.10, crítica 9).
    - Lo que mueve efectivo (cobros, gastos, compras en efectivo, sus
      anulaciones, la entrega de uniforme cobrada en efectivo y el cierre de
      caja) toma **primero** el candado de la caja de su sede
      (`app.candado_de_caja`:
      `pg_advisory_xact_lock(hashtext('caja:' || sede))`).
    - Después, los saldos de cada variante con `app.bloquear_saldo` (crea la
      fila si falta y la bloquea `for update`), en orden de `variante_id`.
    - Al final, los lotes `for update`: en orden PEPS dentro de `app.sacar` y
      por `secuencia` en `app.revertir`.
    - Si la entrega se cobra en el acto, siguen los cargos (por id) y el
      candado del recibo.

    Reemplaza el orden de la especificación §3.12, que dejaba la caja al
    final: `anular` bloqueaba un cobro y esperaba la caja, mientras
    `cerrar_caja`, con la caja ya tomada, esperaba ese mismo cobro.

## Qué cambia del ADR 0003

| Punto del ADR 0003 | Antes | Ahora |
|---|---|---|
| 1. Tipo con comportamiento | Si se entrega, si admite devolución, si usa tallas, si admite fracción | Gana `valuacion` (`peps` o `promedio`), `admiteUso`, `admitePrestamo`, `controlaVencimiento` y `admitePrecioVenta`; la devolución va dentro de `admiteEntrega`. El utensilio ya no se entrega: se presta |
| 3. Libro de movimientos | `entrada · salida · entrega · devolucion · ajuste · baja`; `ajuste` fija la existencia | 11 tipos: `saldo_inicial`, `compra`, `consumo`, `entrega`, `devolucion_entrega`, `prestamo`, `devolucion_prestamo`, `baja`, `ajuste_faltante`, `ajuste_sobrante` y `anulacion`. El ajuste que fija desaparece |
| 3. Libro de movimientos | Solo cantidades | Cantidades y, aparte, su valor (punto 6) |
| 4. Nunca negativo | `aplicarMovimiento` en el dominio; `CHECK` o disparador en la base, a elegir | `aplicarMovimiento` en el dominio; `check` en `existencias`, `existencias_costo`, `lotes`, `lotes_costo`, `movimientos_costo` y en el saldo que deja cada movimiento |
| 5. Entrega con contexto | `inscripcion`, `sesion`, `reposicion`, `otro` | `inscripcion`, `reposicion`, `cambio_de_talla`, `otro`: no hay sesiones en la v1 (P10) |
| Consecuencias: el stock | Sumar en una vista o leer una columna mantenida por disparador, a decidir | `existencias` es el saldo vivo: lo escribe el motor en la misma transacción que el movimiento, y cada movimiento guarda el saldo que dejó |
| Consecuencias: corregir una cantidad | «Registrar ajuste con motivo» | Contar: el conteo de administración, con motivo por cada diferencia |

Siguen en pie los puntos 2 (variantes) y 6 (el sistema registra, no decide,
cuándo toca entregar el uniforme), y el rechazo de la tabla plana y de una
tabla por tipo.

## Motivos

- **PEPS en insumos** porque la comida se rota por antigüedad, el
  vencimiento es de cada lote y la pregunta «¿de qué compra salió?» tiene
  respuesta. **Promedio en el resto** porque las piezas de una talla son
  intercambiables: un solo número por talla («cada juego M nos cuesta en
  promedio Bs 320») se explica en una frase, y con PEPS cada pieza devuelta
  tendría que volver a un lote concreto. La NIC 2 admite los dos métodos;
  **el contador del instituto debe validar la elección** (especificación
  §10.2, punto 1).
- **Milésimas enteras y resto exacto** porque el inventario tiene que cuadrar
  al centavo con lo pagado, y la pantalla y la base tienen que dar el mismo
  número.
- **Tablas de costo aparte** porque es la única forma de que la RLS oculte el
  costo a recepción sin ocultarle las cantidades que necesita para trabajar.
- **Anular con el inverso exacto** (y devolver en lugar de anular) porque es
  la misma regla que ya rige los pagos: lo registrado no se edita y el libro
  cuenta la historia completa.
- **Conteo todo o nada** porque si alguien usó harina mientras se contaba, la
  diferencia ya no es real; volver a contar es más simple que adivinar.
- **Sobrante a un costo de referencia** porque entrar a costo 0 subvaluaría el
  inventario (D16) y dejar el costo libre permitiría revalorizarlo con un
  conteo.
- **Un solo orden de candados** porque así dos documentos simultáneos nunca
  se esperan en círculo.

## Consecuencias

- **El libro se puede comprobar.** `verificar_cuadre(p_sede)` compara el libro
  con los saldos (cantidad y valor), los lotes con el saldo de cada insumo,
  cada compra con la suma de sus líneas y cada cobro con sus aplicaciones. La
  **tarjeta PEPS** (`contabilidad/tarjeta-peps.ts`) se arma con lo que guardó
  `movimiento_lotes` y no vuelve a calcular el PEPS: muestra exactamente los
  centavos que se descontaron.
- **El costo de lo usado sale del libro.** `resumen_del_mes` suma el valor de
  todo lo que salió (y lo que volvió) en el mes, salvo compras y saldos
  iniciales; una anulación cuenta en el mes en que se hace, como su original
  al revés.
- **Hay dos implementaciones gemelas** del cálculo (`valuacion.ts` y
  `app.sacar`) que deben dar los mismos números. Los ejemplos de la
  especificación §5.8 son pruebas en las dos: `tests/valuacion.test.ts` y la
  batería SQL. Cambiar la fórmula es cambiar las dos y sus pruebas.
- **El personal no ve PEPS ni promedio**: ve «la compra del 12/09», cuánto
  queda y cuánto está vencido. El costo solo lo ve administración.
- **Una compra ya usada en parte no se anula.** Para corregirla hay que anular
  primero lo que vino después (los usos y las bajas; en insumos, los que
  tomaron de su lote) y después la compra. El ajuste de valor sin cantidad y
  la devolución de un sobrante de clase a los mismos lotes quedan para la
  v1.1 (enmiendas A.2); la práctica es registrar lo usado al terminar la
  clase.
- **Anular un uso puede devolver cantidad vencida**: vuelve a sus lotes, y si
  alguno ya venció, reaparece como vencido.
- **Un conteo equivocado no se borra**: se corrige con otro conteo, y las dos
  diferencias quedan en el libro.
- **Sin depreciación** y con los equipos mayores fuera del inventario
  (especificación §5.5 y §5.6), a confirmar con el contador.

### Límites del código actual

Se anotan aquí para no perderlos; ninguno descuadra el libro.

- En un saldo inicial con varias líneas de la misma variante, todos los lotes
  entran con la fecha del día y se ordenan por `secuencia` (el orden de las
  líneas). La enmienda B.12 (crítica 23) pedía una `fecha_ingreso` por línea.
- De esas líneas solo se puede anular la última: cada línea es un movimiento
  y las siguientes cuentan como posteriores.
- Después de anular un saldo inicial, `registrar_saldo_inicial` rechaza esa
  variante (`ya_tiene_movimientos`: la anulación también es un movimiento).
  Lo que falte solo puede entrar por un conteo (sobrante) o por una compra.
- El sobrante PEPS toma el último lote aunque venga de una compra o de un
  saldo inicial anulados; el de promedio, en cambio, descarta los anulados.
- `usar_insumos` acepta un `lote` por línea (B.12, crítica 16) y, con lote
  elegido, `app.sacar` no comprueba que esté vigente; el dominio
  (`salidaPeps`) sí lo rechaza. La pantalla de uso todavía no envía el lote.
- Anular un saldo inicial con movimientos posteriores vigentes reutiliza el
  código `compra_con_movimientos_posteriores`.
- Una diferencia de conteo no se anula (se corrige con otro conteo). Por eso,
  si un faltante tomó del lote de una compra de insumos, o si después de una
  compra de costo promedio hubo un conteo con diferencia, esa compra ya no se
  puede anular.

## Evidencia

| Qué | Dónde |
|---|---|
| Tablas, `check`, columna `valuacion`, protección de lotes, entregas y préstamos, RLS por permiso y vistas | `supabase/migrations/20261002150000_panel_inventario.sql` |
| Motor (`app.bloquear_saldo`, `app.sacar`, `app.aplicar_tomas`, `app.entrar`, `app.revertir`) y RPC (`registrar_saldo_inicial`, `registrar_compra`, `usar_insumos`, `dar_de_baja`, `registrar_conteo`) | `supabase/migrations/20261002150100_panel_inventario_motor.sql` |
| `anular` de compra, uso, baja y saldo inicial; las compras en el arqueo | `supabase/migrations/20261002150200_panel_inventario_caja.sql` |
| Entrega, devolución y cambio de talla; préstamo y pérdida desde «prestado» | `supabase/migrations/20261002160000_panel_uniformes_prestamos.sql` |
| `app.candado_de_caja` | `supabase/migrations/20261002140100_panel_caja_motor.sql` |
| `app.solo_sellos()` sin columnas rechaza todo `update` | `supabase/migrations/20261002140200_panel_caja_libro.sql` |
| `resumen_del_mes` y `verificar_cuadre` | `supabase/migrations/20261002170000_panel_contabilidad.sql` |
| Permisos por rol (`inventario.*`, `contabilidad.leer`) | `supabase/migrations/20261002120000_panel_nucleo.sql` |
| PEPS, promedio, devolución y sobrante | `apps/web/src/core/domain/inventario/valuacion.ts` |
| Milésimas y `redondearProporcion` | `apps/web/src/core/domain/shared/cantidad.ts` |
| Tipos de movimiento, conteo y qué se anula | `apps/web/src/core/domain/inventario/movimiento.ts` |
| Comportamiento por tipo, entrega y préstamo | `apps/web/src/core/domain/inventario/articulo.ts`, `entrega.ts` y `prestamo.ts` |
| Tarjeta PEPS | `apps/web/src/core/domain/contabilidad/tarjeta-peps.ts` |
| Cantidades entre la base y el dominio | `apps/web/src/infrastructure/supabase/cantidades.ts` |
| Pruebas del dominio con los números de §5.8, B.5, B.6 y la crítica 24 | `apps/web/tests/valuacion.test.ts` y `apps/web/tests/inventario.test.ts` |

**Batería SQL** (`docs/runbooks/pruebas-rls-panel-v1.sql`, con los ejemplos
de §5.8; N51, N52, N54, N66 y N69 usan las mismas cifras que
`valuacion.test.ts`):

| Caso | Qué comprueba |
|---|---|
| N50 | Código por tipo, nombre único, una sola variante en insumos y uniforme sin kg |
| N51 | PEPS de §5.3: salidas de 20 600, 240 y 14 160 c; quedan 0 kg y 0 c |
| N52 | Fracciones: 3 kg por Bs 10 usados de a 1 kg → 333 + 334 + 333 c |
| N53 | Lo vencido no se usa en clase; la baja por vencimiento saca ese lote y rechaza uno vigente |
| N54 | Promedio: un juego M sale a 32 000 c; 3 juegos por Bs 100 → 3 333 + 3 334 + 3 333 c; `cantidad_no_entera` |
| N55 | Conteo: `existencia_cambio`; faltante de 250 c por PEPS; sobrante de 250 c al costo del último lote |
| N56 | Anular un uso deja los lotes del artículo con la misma cantidad y el mismo valor totales que antes del uso; la segunda vez, `ya_anulado` |
| N57 | La compra en efectivo sale de la caja y vuelve al anularse; ya usada, `compra_con_movimientos_posteriores` |
| N58 | Recepción no recibe el costo, no compra, no anula, no opera en otra sede y ve 0 filas con costo |
| N59 | `libro_inmutable` al editar un movimiento o lo que entró a un lote |
| N60 | Lotes = saldo; saldo 0 ⇒ valor 0; compra = suma de sus líneas; anulación = inverso exacto del valor |
| N61 | El estudiante no ve el inventario |
| N62–N64 | El alumno de carrera sin uniforme aparece en la lista; entrega a costo promedio (32 000 c) con cargo y cobro, sin repetirse al reenviar; lo que no se entrega |
| N65 | Cambio de talla: vuelve a 32 000 c y la nueva entrega va sin cargo |
| N66 | Devolución en partes: 3 333, 3 333 y la última se lleva el resto (3 334 c) |
| N67 | No se devuelve más de lo entregado (`devolucion_excede`) |
| N68 | Prestar no cambia el valor (45 000 c antes y después; movimiento de valor 0) |
| N69 | Lo perdido en un préstamo es baja desde «prestado» a 4 500 c; el préstamo se cierra |
| N70 | La baja de un préstamo no se anula (`baja_de_prestamo`) |
| N71 | Recepción no presta en otra sede; el estudiante no ve entregas ni préstamos |
| N72 | Todo movimiento tiene su costo; saldo en cero ⇒ valor en cero |
| N84–N86 | Anular lo que vino después y ya se deshizo: en promedio, anular el uso y después la compra deja 0 y 0 c; anular dos veces un saldo inicial da `ya_anulado`; un saldo inicial con un uso anulado se puede anular |

Sin caso propio en la batería (lo cubren el código y, donde se indica, el
dominio): el faltante que consume primero lo vencido (`valuacion.test.ts`,
B.5), el sobrante a costo promedio (`valuacion.test.ts`, crítica 24), el
rechazo de anular un saldo inicial con movimientos posteriores vigentes
(`compra_con_movimientos_posteriores`) y el orden de candados.

## Alternativas descartadas

| Opción | Motivo |
|---|---|
| PEPS para todo | Cada pieza devuelta tendría que volver a un lote concreto; los juegos de una talla son idénticos |
| Promedio para todo | Pierde el vencimiento por lote y la respuesta a «¿de qué compra salió?» |
| PEPS estricto, que también usa lo vencido | Regla sanitaria de cocina: lo vencido no se usa (D14) |
| Mantener el ajuste que fija (ADR 0003) | Con lotes no se sabe de qué lote sale o entra la diferencia (D15) |
| Sobrante a costo 0 con aviso | Subvalúa el inventario (D16) |
| Costos en las mismas tablas, ocultos en pantalla | RLS filtra filas, no columnas: recepción los leería por la API (D2) |
| Cantidades como `number` con decimales | `3 × 0,35 / 2,1` da `0,4999…` y el costo no coincide con la base (B.6) |
| Anular entregas y préstamos | Borra lo que pasó; la devolución deja la historia completa (§3.6) |
| Anular la baja de un préstamo | Volvería a «prestado» sin deshacer lo perdido ni el cierre del préstamo (crítica 12) |
| Candado de caja al final (§3.12 original) | `anular` y `cerrar_caja` podían esperarse en círculo (crítica 9) |
