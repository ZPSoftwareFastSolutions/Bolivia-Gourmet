# Migraciones — base de datos

Proyecto Supabase **`Bolivia-Gourmet`** · ref `bnobhnmurzsnffdrxeck` ·
PostgreSQL 17 · región `sa-east-1` (São Paulo) · organización «Z&P Software
Fast Solutions» (plan gratuito). Creado el 2026-10-01.

Cada archivo `.sql` de esta carpeta está **aplicado** en el proyecto con el
mismo nombre (sin el prefijo de fecha) y en el mismo orden, con estas
salvedades, todas sin efecto en el resultado:

- `panel_tablero_sedes` y `panel_anular_lo_deshecho` se aplicaron al revés,
  y también `panel_revision_final` y `panel_devolver_uniforme_cargo`: cada
  par toca funciones distintas.
- `panel_revision_final_ajuste_cuotas` y
  `panel_devolver_uniforme_cargo_ajuste` aparecen en la base como
  migraciones aparte: son la segunda ronda de la revisión final, que vuelve a
  definir `generar_cuotas_de_grupo` y `devolver_uniforme`. En la carpeta, esas
  definiciones ya están dentro de `20261003120000` y `20261003120100`
  (comprobado con el md5 del cuerpo de cada función). Se aplican con la
herramienta `apply_migration` del conector o pegándolos en el editor SQL.

## Aplicadas

| Archivo | Qué hace |
|---|---|
| `20261001120000_base_esquema_app_y_sedes.sql` | Esquema privado `app`, `app.marcar_actualizado()`, tabla `sedes` con La Paz y El Alto |
| `20261001120100_identidad_perfiles_y_permisos.sql` | Enum `rol_de_usuario`, `perfiles` (alta automática como estudiante), `permisos_de_rol`, `app.tiene_permiso`, `app.rol_actual`, guardas de rol y de último administrador |
| `20261001120200_programas.sql` | Enum `tipo_de_programa`, tabla `programas` (referencia de FK) con los 6 programas del catálogo |
| `20261001120300_solicitudes_de_inscripcion.sql` | Enums de solicitud, tabla `solicitudes` (inscripción y renovación), validación de alta, transiciones de estado y límite de 5 abiertas |
| `20261002120000_panel_nucleo.sql` | Sistema interno (R1): permisos de administración y recepción; `app.en_mantenimiento`, `app.hoy` (fecha de Bolivia, simulable solo en mantenimiento), `app.exigir_permiso`, `app.sede_de_sesion`, `app.puede_operar_sede`, `app.exigir_sede`; tabla `operaciones` (idempotencia: sin políticas, solo la tocan funciones DEFINER) con `app.iniciar_operacion` / `app.terminar_operacion`; fachada `public.mi_contexto()`. Errores con el código como mensaje (`sin_permiso`…) y datos en `detail` |
| `20261002130000_panel_alumnos.sql` | Sistema interno (R2): `conceptos` (semilla fija), `estudiantes` (fichas con código BG-AAAA-NNNN, carnet único entre fichas vivas, archivar sin borrar), `cohortes` (grupos), `planes_de_pago` (precio del grupo, uno por paquete en la carrera), `inscripciones`; disparadores de forma (año solo en la carrera, cupo, grupo cerrado, paquete); vistas `v_grupos` y `v_alumnos`; `app.nombre_de_grupo` (gemela del dominio) |
| `20261002130100_panel_alumnos_motor.sql` | RPC `crear_estudiante`, `inscribir`, `aprobar_solicitud` (B.8: el personal elige la ficha), `cambiar_estado_de_inscripcion`, `cerrar_grupo` (B.3); piezas `app.generar_cuotas` / `app.al_retirar` / `app.alumnos_que_deben` que la R3 reemplaza |
| `20261002140000_panel_caja.sql` | Sistema interno (R3): `cargos`, `pagos` (recibo sin huecos por sede y año), `pago_aplicaciones`, `gastos`, `cierres_de_caja`; `app.solo_sellos` (un documento solo se anula; el libro no se edita); `app.congelar_plan` (precio congelado al primer cargo); vistas `v_saldos_de_cargo` y `v_saldos_de_alumno` |
| `20261002140100_panel_caja_motor.sql` | RPC `registrar_cobro` (candado de caja primero, B.10), `crear_cargo`, `registrar_gasto`, `caja_por_cerrar`, `cerrar_caja` (suma y marca las mismas filas bloqueadas), `anular` (cobro, cargo, gasto), `generar_cuotas_de_grupo`; reemplaza `app.generar_cuotas`, `app.al_retirar` y `app.alumnos_que_deben` |
| `20261002140200_panel_caja_libro.sql` | `app.solo_sellos` rechaza todo update en las tablas de libro (sin columnas permitidas) |
| `20261002150000_panel_inventario.sql` | Sistema interno (R4): `articulos` (código INS/UNI/UTE/OTR-NNNN; valuación PEPS en insumos y promedio en el resto), `variantes` (tallas), `existencias` y `existencias_costo` (el costo solo con `contabilidad.leer`), `compras`, `conteos`, `entregas`, `prestamos`, `movimientos` (kárdex inmutable con el saldo resultante), `movimientos_costo`, `lotes` y `lotes_costo` (PEPS), `movimiento_lotes`; `app.solo_crece`, `app.proteger_lote`; vistas `v_existencias`, `v_existencias_valorizadas`, `v_lotes_vigentes`, `v_kardex`, `v_kardex_valorizado` |
| `20261002150100_panel_inventario_motor.sql` | Motor: `app.sacar` (PEPS con lo vencido aparte; promedio con el resto exacto en la última salida), `app.entrar`, `app.mover`, `app.valorizar`, `app.revertir`; RPC `guardar_articulo`, `registrar_saldo_inicial`, `registrar_compra`, `usar_insumos`, `dar_de_baja`, `registrar_conteo` (todo o nada si el saldo cambió) |
| `20261002150200_panel_inventario_caja.sql` | `anular` amplía a compra, uso, baja y saldo inicial (`inventario.anular`); la caja por cerrar y el arqueo incluyen las compras en efectivo y sus anulaciones |
| `20261002160000_panel_uniformes_prestamos.sql` | Sistema interno (R5): RPC `entregar_uniforme` (cargo «Venta de uniforme» y cobro anidado con clave derivada; caja antes que saldos), `devolver_uniforme` (al costo con que salió, el resto exacto en la última pieza; cambio de talla sin cargo), `prestar_utensilios` (custodia: el valor no cambia), `recibir_devolucion` (lo que no vuelve es baja desde «prestado» a promedio); vistas `v_entregas`, `v_prestamos_abiertos`, `v_sin_uniforme` (por alumno) |
| `20261002170000_panel_contabilidad.sql` | Sistema interno (R6): `resumen_del_mes(p_mes, p_sede)` (ingresos por grupo, costo de lo usado por tipo, gastos por concepto, dinero por medio, arqueos, valor del inventario al inicio y al final, lo que deben y el valor de hoy; la anulación cuenta en el mes de `anulado_el`) y `verificar_cuadre(p_sede)` (libro contra saldos, lotes, compras y cobros). Lecturas INVOKER bajo RLS que exigen `contabilidad.leer` |
| `20261002180000_panel_tablero.sql` | Sistema interno (R7): `tablero_de_administracion(p_sede)` para el inicio de administración: efectivo de días anteriores sin arqueo, arqueos del mes con diferencia, bajas y faltantes de 7 días, lo que quedó sin precio, el dinero del mes frente al mes anterior a la misma fecha y el dinero de las últimas 8 semanas. Lectura INVOKER que exige `contabilidad.leer` |
| `20261002180100_panel_tablero_sedes.sql` | Revisión de R7: el tablero devuelve la sede del efectivo sin arqueo más antiguo y la del arqueo con diferencia más reciente (y en cuántas sedes hay), para que con «Ambas» el aviso lleve a la caja correcta; `resumen_de_deudores(p_sede)` cuenta en la base cuántos alumnos deben, cuánto, y lo vencido (exige `caja.leer`), en lugar de sumar una lista de 100 filas |
| `20261002190000_panel_anular_lo_deshecho.sql` | Revisión (R9): `app.anular` deja anular una compra de costo promedio o un saldo inicial cuando lo que vino después ya se anuló (enmiendas A.2: «anula los usos y después la compra»), y anular dos veces un saldo inicial responde `ya_anulado` |
| `20261003120000_panel_revision_final.sql` | Revisión final de la v1: `generar_cuotas_de_grupo` solo crea las cuotas de quien no tiene ninguna vigente de su plan (una beca o un descuento anulados no vuelven); si todas se anularon, solo las vuelve a crear cuando el plan cambió (monto, calendario o número de cuotas, mirando la última tanda) y desde el primer vencimiento anulado. `app.sacar`: un lote elegido también respeta el vencimiento. `registrar_saldo_inicial` vuelve a comprobar los movimientos después del candado. `resumen_del_mes`: un cargo anulado antes de su propia fecha no cuenta en ningún mes. Nueva lectura `variantes_con_movimientos(p_sede)` (`inventario.leer`) |
| `20261003120100_panel_devolver_uniforme_cargo.sql` | Revisión final (enmiendas B.12, crítica 14): devolver el uniforme sin cambio de talla anula su cargo cuando ya no queda ninguna pieza de la cadena de cambios de talla en poder del alumno y el cargo no tiene cobros; si está cobrado responde `anula_el_cobro`; si queda alguna pieza, `devolucion_parcial` |
| `20261005120000_panel_revisar_arqueo.sql` | Entrega 5: un arqueo con diferencia se marca revisado con una nota (`revisar_arqueo`, `caja.supervisar` para administración; el sello se pone una vez y la diferencia no cambia) y el tablero cuenta solo los arqueos con diferencia que faltan revisar, de cualquier mes |
| `20261005120100_panel_sellos_y_columnas_generadas.sql` | `app.solo_sellos` ignora las columnas generadas: en un disparador BEFORE aún no están calculadas y hacían fallar todo sello sobre `cierres_de_caja` (lo encontró la batería al revisar un arqueo) |
| `20261005130000_panel_convocatorias.sql` | Entrega 5, inscripciones por convocatoria (ADR 0009): los grupos ganan horario (`hora_inicio`, `hora_fin`) y plazo de inscripción por el portal (`inscripcion_desde`, `inscripcion_hasta`); `solicitudes.cohorte_id` (el grupo pedido: la base copia de él sede, turno, días, duración y modalidad y valida convocatoria, cupos, «ya inscrito» y cruces); `app.cruce_de_grupos` (gemela de `cruceDeHorarios`); lecturas del portal `oferta_abierta()` y `mis_grupos()` (DEFINER con columnas seguras, solo `authenticated`) |
| `20261005130100_panel_convocatorias_anio.sql` | Por el portal, la carrera se empieza en el 1.er año y se renueva al 2.º o 3.er año (disparador aparte, después del alta) |
| `20261005130200_panel_convocatorias_transicion.sql` | Transición: mientras el portal no elige grupo, una solicitud SIN grupo se valida como antes de `20261005130000` (el portal de hoy sigue igual); CON grupo, con todas las reglas nuevas. El grupo pasa a ser obligatorio cuando llegue el portal nuevo |
| `20261005130300_panel_convocatorias_grupo_obligatorio.sql` | Cierra la transición: con el portal nuevo (que elige grupo), una solicitud sin grupo se rechaza otra vez («Elige un grupo con inscripciones abiertas.»), salvo en modo mantenimiento (historial de demostración) |

Estado tras aplicarlas (2026-10-03, 22 migraciones en la base): 29 tablas, 29 con RLS, 44 políticas,
12 vistas `security_invoker`. `get_advisors(security)`: un aviso
informativo esperado (`operaciones` tiene RLS sin políticas a propósito: solo
la tocan funciones DEFINER) y uno de configuración de Auth (protección de
contraseñas filtradas, se activa en el panel de Supabase).

## Reglas para cada migración (ADR 0002 y 0005, `CLAUDE.md` §4)

1. Toda tabla nace con RLS activo y con sus políticas escritas para evaluarse
   **una vez por consulta**: `(select app.tiene_permiso('modulo.accion'))`.
2. Toda tabla retira primero los permisos que Supabase concede por defecto
   (`revoke all … from anon, authenticated`) y concede solo lo necesario,
   **columna por columna** cuando el cliente escribe.
3. Las políticas para `anon` no llaman a funciones de `app` (anon no tiene
   permiso sobre ese esquema): se escriben aparte.
4. Las funciones `SECURITY DEFINER` viven en `app` y fijan `search_path = ''`.
5. Las vistas se crean con `security_invoker = true`.
6. Cada migración se acompaña de su batería RLS en `docs/runbooks/` (sistema
   interno: `pruebas-rls-panel-v1.sql`, que crece con cada rebanada).
8. Sistema interno: las RPC son fachadas `public.*` SECURITY INVOKER (con
   `revoke all … from public, anon`) que llaman a un motor `app.*` DEFINER.
   Los errores llevan el código en `message` y su frase está en
   `apps/web/src/infrastructure/supabase/errores-del-panel.ts` (lo exige
   `tests/errores-de-panel.test.ts`).
7. Una prueba del repositorio (`apps/web/tests/base-de-datos.test.ts`) vigila
   RLS, revocación de permisos, funciones DEFINER y que los programas
   sembrados coincidan con el catálogo.

## Datos de demostración (no son migraciones)

`supabase/seed/` guarda scripts que se ejecutan a mano en el editor SQL y
**nunca** en producción:

- `datos-demo.sql`: cinco cuentas ficticias `@boliviagourmet.test` (administración,
  recepción y tres estudiantes) con su historial. Plantilla sin contraseña; la
  copia lista para pegar es `datos-demo.local.sql`, ignorada por git.
- `datos-panel-demo.sql`: datos ficticios del panel interno (8 semanas hasta el
  día de la carga) para que cada pantalla y cada aviso del tablero tengan qué
  mostrar: catálogo y saldo inicial en las dos sedes, grupos (la carrera con
  plan de Bs 650; Cocina y Tortas sin plan), 14 alumnos con cobros, deudas,
  uniformes y un cambio de talla, compras (una anulada), usos, préstamos (uno
  atrasado), bajas, un conteo, gastos y arqueos, y hoy caja por cerrar en La
  Paz y efectivo sin arquear en El Alto. Va DESPUÉS de `datos-demo.sql` (usa a
  Carla y a Rosa) y pasa por las RPC y la RLS reales simulando su sesión, con
  la fecha simulada en modo mantenimiento. `c_simular := true` lo ensaya y lo
  revierte («OK · simulación…»); es idempotente (se detiene si existe «Harina
  de trigo»).
- `convocatorias-demo.sql` (ADR 0009): va DESPUÉS de las dos anteriores. Pone
  horario a los grupos vigentes, abre tres convocatorias con fechas relativas
  al día de la carga (Cocina sábados en La Paz, Tortas de lunes a miércoles en
  El Alto, Gastronomía 2.º año de la gestión siguiente) y deja la carrera de
  1.er año sin convocatoria. Inscribe a Diego en su 1.er año con una ficha
  enlazada a su cuenta (su cuota queda por cobrar). `c_simular := true` lo
  ensaya y lo revierte; se detiene si Diego ya tiene ficha.
- `borrar-datos-demo.sql`: borra primero todos los datos del panel (en modo
  mantenimiento y en orden de claves foráneas) y después las cuentas con todo
  lo suyo. Se detiene sin borrar nada si el panel tiene registros de cuentas
  que no son de demostración. Obligatorio antes de producción.

## Pendientes previstas (v1.1, enmiendas §A.2)

Cierre y reapertura de mes (`periodos`), auditoría (`auditoria`),
`caja.supervisar` (verificar QR y revisar arqueos) y las pantallas de
Ajustes (Personal y Conceptos), que usan tablas que ya existen.
