# Sistema interno v1 — Enmiendas a la especificación (MANDAN sobre ella)

> Fecha: 2026-10-02. La especificación (`especificacion-v1.md`) se escribió
> uniendo tres propuestas; la crítica (`critica-de-la-especificacion.md`)
> encontró 43 puntos. Este documento fija el **alcance real de la v1** y
> resuelve cada choque. **Si algo de aquí contradice a la especificación,
> manda esto.** Quien construya una rebanada lee los tres documentos, en este
> orden: enmiendas → especificación → crítica (solo como explicación).

---

## A. Alcance de la v1

### A.1 Entra (sin cambios respecto de la especificación salvo lo que diga B)

- Panel `/panel` con el mismo inicio de sesión del portal; guardas; navegación
  **Inicio · Alumnos · Inventario · Caja** (+ **Contabilidad** y **Ajustes ›
  Personal** para administración).
- Alumnos: fichas (carrera y capacitación), grupos con cupos y plan de pagos,
  inscripción, renovación, retiro, conclusión por grupo, bandeja de
  solicitudes del portal con «Aprobar e inscribir».
- Inventario: artículos por tipo con tallas; existencias por sede; **insumos
  con lotes PEPS y vencimientos**; uniformes, utensilios y otros con **costo
  promedio ponderado**; saldo inicial, compra, uso en clase, entrega de
  uniforme (con cargo/cobro), cambio de talla y devolución, préstamo y
  devolución de utensilios, baja, conteo físico, anulación; kárdex.
- **Tarjeta kárdex PEPS** valorada por insumo y sede (crítica 17): por cada
  movimiento, las capas (lotes) con cantidad, costo unitario y total, y el
  saldo por capa. Solo administración. Imprimible.
- Caja: cargos (cuotas del plan, uniforme, manuales), cobros (efectivo, QR,
  transferencia con número de operación), recibo interno numerado sin huecos
  e imprimible, venta directa, lo que deben, cierre de caja (arqueo).
- Contabilidad (administración): gastos, compras, resumen del mes (resultado y
  dinero), inventario valorizado, tarjeta PEPS, `verificar_cuadre`.
- Tableros por rol (recepción y administración), con un gráfico SVG.
- Animaciones de confirmación (catálogo reducido, B.14).
- Datos de demostración en `supabase/seed/datos-panel-demo.sql`.

### A.2 Se difiere a la v1.1 (crítica, «excesos de alcance»)

| Qué | Cómo queda en la v1 |
|---|---|
| Cierre y reapertura de mes (`periodos`, `cerrar_mes`, `reabrir_mes`, disparadores de período) | No existe. El tablero no muestra «Cierra septiembre». `verificar_cuadre()` sí existe (lo usan la batería y la pantalla de contabilidad) |
| Auditoría (`auditoria`, `app.auditar`, pantalla) | No existe. Los documentos ya llevan autor y fecha |
| `caja.supervisar`: verificar QR y revisar arqueos | No existe. Los arqueos con diferencia se ven en la lista de arqueos |
| Ajustes › Conceptos (pantalla) | Conceptos de la semilla fija (tabla `conceptos` sí existe) |
| Devolver un sobrante de insumos a los mismos lotes | Práctica documentada: «registra lo usado al terminar la clase»; administración puede anular el uso y registrarlo bien |
| Ajuste de valor sin cantidad | Documentado: anular los usos posteriores y la compra, y registrarla bien |
| Prueba de uso con adultos reales | Pendiente del usuario, no condiciona la rama |

---

## B. Resoluciones (cada una corrige un punto de la crítica)

**B.1 Capa de aplicación (crítica 1).** Puertos por módulo en
`core/application/ports/`: `alumnos.port.ts`, `caja.port.ts`,
`inventario.port.ts` (reemplaza a `inventario-repository.port.ts`),
`contabilidad.port.ts`, `panel.port.ts` (contexto de sesión y tableros).
Casos de uso en `core/application/panel/<modulo>/*.usecase.ts`: validan con el
dominio (forma) y llaman al puerto (la base decide lo demás). Adaptadores
`infrastructure/supabase/panel-*.supabase.ts`, creados **por petición** en el
composition root con la cookie de quien pregunta. Se eliminan
`registrar-movimiento.usecase.ts`, `inventario-repository.port.ts` y sus
pruebas de `casos-de-uso.test.ts` que ya no aplican (se reemplazan por las
nuevas). Grep nuevo en §8 de CLAUDE.md: `app/panel` no importa `@infra/supabase`
(solo el composition root).

**B.2 Estados de grupo (crítica 2).** `planificado` (no admite
inscripciones), `abierto` (admite), `en_curso` (admite), `cerrado` (no). Los
grupos de destino de la demo (2.º año 2027 de Diego, 1.er año 2027 de
Valeria) quedan **abiertos**.

**B.3 Renovar no concluye (crítica 3).** `inscribir` con `p_renueva_a` solo
enlaza; la inscripción anterior sigue `inscrito` hasta que se cierre su grupo.
RPC nueva `cerrar_grupo(p_clave, p_cohorte)`: pasa el grupo a `cerrado` y sus
inscritos a `concluido`; devuelve cuántos alumnos tienen cuotas pendientes
(aviso, no bloquea). Permiso `cohortes.gestionar`.

**B.4 Cursos de temporada (crítica 4).** Se admiten grupos de temporada con
`modalidad` y fechas, **sin** días ni duración. `validarCohorte` y los `check`
de `cohortes` se ajustan: días y duración obligatorios solo si el programa los
define (no pendientes); modalidad obligatoria si el programa tiene modalidades.

**B.5 Lotes vencidos (crítica 5).** `app.sacar(..., p_incluir_vencidos
boolean)`. Uso en clase: `false` (salta vencidos). Faltante de conteo y bajas
que no son por vencimiento: `true` y consumen **primero lo vencido** y
después el orden PEPS. El conteo compara `existencia_vista` con `disponible`
(que incluye lo vencido) y la pantalla lo dice («de los cuales 1 kg vencido»).
Caso añadido a las pruebas.

**B.6 Aritmética exacta (crítica 6).** El dominio guarda cantidades en
**milésimas enteras** (`bigint` en TypeScript, `numeric(12,3)` en la base) y
redondea la mitad hacia arriba con `(2·v·t + c) / (2·c)` en enteros
(`BigInt`). Ningún cálculo de costo usa coma flotante. Caso `3 × 0,350 / 2,100`
añadido. La base usa `round(v * t / c)` sobre `numeric` (exacto).

**B.7 Puesta en marcha y demo (crítica 7, 11).**
- No hay cierre de mes (A.2), así que la demo no cierra nada.
- **Fecha de puesta en marcha de la demo:** día 1 del mes anterior al de
  carga. Lo anterior es solo historia académica (inscripciones de Camila 2024
  y 2025 `concluido`, **sin cargos ni cobros**).
- `inscribir` acepta `p_desde date null`: no genera cuotas que vencen antes
  de esa fecha (para alumnos que ya pagaban antes del sistema).
- **Fecha simulada:** `app.hoy()` devuelve `current_setting('app.hoy_simulada')`
  **solo** si `app.en_mantenimiento()` (`session_user = 'postgres'` y
  `app.mantenimiento = 'si'`; comprobado: el editor SQL y `execute_sql`
  corren como `postgres`; por la API la sesión es `authenticator` y nunca lo
  cumple). La semilla «viaja en el tiempo»: fija la fecha y llama a las
  **mismas RPC** con la sesión simulada de Carla o Rosa; así todo pasa por las
  reglas reales. El modo mantenimiento **no salta ninguna otra regla**, salvo
  el enlace de `solicitud_id` histórico (B.9).

**B.8 Enlace por documento (crítica 8).** `aprobar_solicitud(p_clave,
p_solicitud, p_cohorte, p_paquete, p_documentos, p_respuesta, p_estudiante
uuid null)`: si la solicitud viene de un perfil que ya tiene ficha
(`estudiantes.perfil_id`), usa esa. Si no, **el personal elige** en pantalla:
«Crear ficha nueva» (`p_estudiante = null`, con los datos del perfil) o una
ficha existente **sin cuenta** que la pantalla sugiere por carnet o nombre
(`p_estudiante = <id>`). La base nunca enlaza sola.

**B.9 «Aprobar = inscribir» sin disparador nuevo.** La bandeja del panel solo
ofrece «Aprobar e inscribir» (`aprobar_solicitud`), «Pedir más datos» y
«Rechazar». **No** se añade el disparador `aprobar_inscribiendo` (obligaría a
reescribir `datos-demo.sql`). Rechazar exige respuesta en el caso de uso.

**B.10 Orden de candados (crítica 9).** Toda operación que mueva efectivo
(cobro, gasto, compra en efectivo, anulación de cualquiera de ellos,
`cerrar_caja`) toma **primero** el candado de caja de su sede
(`pg_advisory_xact_lock(hashtext('caja:' || sede))`), luego existencias (por
`variante_id`), lotes, grupo, cargos (por id), recibo.

**B.11 Prueba de funciones DEFINER (crítica 10).** `tests/base-de-datos.test.ts`
lee la cabecera completa (hasta `as $$`), y comprueba además: vistas `v_*` con
`security_invoker`; fachadas de `public` que no son DEFINER; `revoke ... from
anon` en cada función nueva.

**B.12 Correcciones medias adoptadas.**
- Crítica 12: **no** se anula una baja con `prestamo_id`.
- Crítica 13: `crear_cargo` con `p_entrega` y `p_cliente`.
- Crítica 14: devolver uniforme sin cambio de talla → si el cargo no tiene
  cobros, la RPC lo anula; si está cobrado, devuelve el aviso «anula el
  cobro» (administración).
- Crítica 15: retirar (recepción y administración) **anula automáticamente las
  cuotas sin cobros con `vence_el > hoy`**; las vencidas quedan.
- Crítica 16: si un lote nuevo vence antes que uno antiguo, `usar_insumos`
  admite elegir el lote por línea (`lote` opcional); por defecto, PEPS.
- Crítica 19: no hay disparadores de período (A.2).
- Crítica 20: las FK y funciones que dependen de tablas posteriores se crean
  con `alter table` / `create or replace` en la migración de esas tablas.
- Crítica 21: **la base exige** aplicar del más antiguo al más nuevo
  (`vence_el`, `created_at`) cuando el cobro no indica cargos; si los indica,
  respeta lo indicado y solo exige `aplicado ≤ pendiente`. La pantalla
  propone el orden antiguo → nuevo.
- Crítica 22: `caja_por_cerrar` lista las salidas en efectivo como «Salida
  registrada por Carla · 10:20 · Bs 150» (sin concepto ni proveedor).
- Crítica 23: compra con líneas repetidas si cambia `vence_el`; saldo inicial
  con varias líneas por variante (cada una un lote, con su `fecha_ingreso`).
- Crítica 24: sobrante en promedio → al promedio vigente si `total > 0`; si
  `total = 0`, al último costo unitario de compra; si nunca hubo compras, lo
  escribe administración.
- Crítica 25: se puede anular un **saldo inicial** sin movimientos posteriores.
- Crítica 26: las RPC comprueban antes y lanzan sus códigos (`ultimo_administrador`,
  etc.); los mensajes en frase de los disparadores existentes se traducen por
  código SQLSTATE con el genérico.
- Crítica 27: la demo usa insumos en **clases de capacitación**, demostraciones
  del docente y degustaciones (no en la carrera: allí los compran los
  estudiantes, regla I8). La nota «periodicidad por confirmar» va también en
  el recibo y en «Lo que deben». «Solo en su sede» y «recepción cobra y
  arquea» son **supuestos** (van a §16.3 de CLAUDE.md).
- Crítica 28: al guardar el plan de un grupo de la carrera o el precio del
  juego de uniforme, si no coincide con el catálogo (Bs 650) la pantalla
  avisa (no bloquea).
- Crítica 29: **tableros más livianos**. Recepción: saludo, buscador, **4
  acciones** (Cobrar, Inscribir alumno, Usar insumos, Entregar uniforme),
  hasta 4 pendientes, tarjeta de caja. Administración: saludo, **4 acciones**
  (Registrar compra, Registrar gasto, Inscribir alumno, Cobrar), hasta 4
  alertas, 4 cifras del mes y 1 gráfico.
- Crítica 30: A2 pasa a «el precio se congela con el primer cargo» (se
  documenta en el ADR 0008); `EstadoDeCohorte` en masculino (`planificado`…);
  `Cohorte.nombre` y `costoVigente` se eliminan del dominio.

**B.13 Correcciones bajas adoptadas.** 31 (un solo permiso `caja.cerrar` y
fachada única), 32 (lista blanca de columnas de `inscripciones` con
`documentos_entregados`, `observaciones`, `motivo_de_retiro`), 33 (concepto
`internet` dentro de `servicios-basicos`; `vence_el` del cargo de uniforme =
fecha de entrega), 34 (el flujo incluye diferencias de caja), 35
(`inscripciones.solicitud_id ... on delete set null`), 36 (prueba que compara
`nombreDeGrupo` con `app.nombre_de_grupo` en los mismos casos), 37 (la página
marca la fila nueva con `data-nuevo` desde el servidor; `panel.css` con
`@reference` a `globals.css` o las clases dentro de `globals.css`), 38
(`destinoSeguro` admite `/panel`; su prueba se amplía), 39 (filtros de alumnos
por estado, año, grupo y sede), 40 (el tablero muestra **lo vencido**; lo por
vencer aparte), 41 (con «Ambas», cada formulario pide la sede), 42 (códigos
correlativos con candado consultivo), 43 (Capacitación con chip de contorno
vino e icono propio; lo irreversible usa `peligro` con icono de alerta).

**B.14 Animaciones de la v1.** `anim-sello` (con `anim-check`), `anim-cambio`,
`anim-destello` (fila nueva con `data-nuevo`), `anim-entrar`, `anim-sacudir`
(resumen de errores), `anim-girar` (botón que guarda) y `.mosaico` (botones
de acción). Todas en `@layer components`, con alternativa para
`prefers-reduced-motion`.

**B.15 Búsqueda.** Sin `pg_trgm` en la v1: `nombre_busqueda` (sin tildes, en
minúsculas) con `ilike`, más búsqueda exacta por carnet y código.

**B.16 Rama.** El usuario pidió «una rama v1»: la rama de entrega se llama
**`v1`** (foto de todo el producto: web, portal y panel). El trabajo sigue en
`feat/sistema-interno`.

**B.17 Memoria del equipo.** Agentes **de uno en uno** para construir; un solo
servidor de vista previa (lo maneja el orquestador); navegadores solo con
`scripts/capturar-pagina.mjs` o `scripts/auditar-espacios.mjs`, nunca dos a la
vez; nada de `isolation: worktree`.

---

## C. Rebanadas (orden de construcción definitivo)

| # | Rebanada | Contenido |
|---|---|---|
| R0 | Dominio puro | `valuacion.ts` (milésimas enteras, PEPS y promedio, remanente exacto), `movimiento.ts`, `articulo.ts`, `prestamo.ts`, `estudiante.ts`, `programa.ts` (grupos, temporada, `nombreDeGrupo`, planes y cuotas), `caja/` (cargo, cobro y su aplicación, arqueo, `montoEnLetras`), `contabilidad/resumen.ts`, `shared/cantidad.ts`; pruebas con los ejemplos de la especificación §5.8 + B.5 + B.6; se retiran el caso de uso y el puerto de inventario viejos |
| R1 | Núcleo de base y esqueleto del panel | Migración `panel_nucleo` (permisos, `app.*`, `operaciones`, `mi_contexto`); `proxy.ts`, `destinoSeguro`, redirección del personal desde `/portal`; `app/panel/layout.tsx` con guardas; navegación; iconos nuevos; animaciones; bloque de confirmación; `traducirErrorDePanel` y su prueba; prueba DEFINER ampliada (B.11) |
| R2 | Alumnos y grupos | Migración de alumnos (sin dinero aún salvo `conceptos` y `planes_de_pago`); RPC de alumnos; pantallas |
| R3 | Caja | `cargos`, `pagos`, `pago_aplicaciones`, `gastos`, `cierres_de_caja`; RPC de caja y `anular` (cobro, cargo, gasto); recibo; lo que deben; arqueo |
| R4 | Inventario | Motor PEPS y promedio; saldo inicial, compra, uso, baja, conteo, anulación (compra, uso, baja, saldo inicial); existencias, ficha, kárdex |
| R5 | Uniformes y utensilios | Entrega con cargo/cobro, cambio de talla y devolución, préstamo y devolución |
| R6 | Contabilidad | Resumen del mes, flujo, gastos, compras, inventario valorizado, tarjeta PEPS, `verificar_cuadre` |
| R7 | Tableros | Recepción y administración, gráfico SVG (entró y salió, últimas 8 semanas), estados vacíos |
| R8 | Demo | `datos-panel-demo.sql` con fecha simulada; `borrar-datos-demo.sql` ampliado |
| R9 | Revisión y entrega | Revisión independiente, documentación, rama `v1` y push |

Cada rebanada: migración ensayada en transacción revertida y luego aplicada;
tipos regenerados; batería RLS de la rebanada en
`docs/runbooks/pruebas-rls-panel-v1.sql` (se va ampliando); `get_advisors`;
`typecheck`, `test`, `build` en serie; TASKS.md con validación; un commit.
