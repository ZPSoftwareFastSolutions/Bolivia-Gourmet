# Migraciones — base de datos

Proyecto Supabase **`Bolivia-Gourmet`** · ref `bnobhnmurzsnffdrxeck` ·
PostgreSQL 17 · región `sa-east-1` (São Paulo) · organización «Z&P Software
Fast Solutions» (plan gratuito). Creado el 2026-10-01.

Cada archivo `.sql` de esta carpeta está **aplicado** en el proyecto con el
mismo nombre (sin el prefijo de fecha) y en el mismo orden. Se aplican con la
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

Estado tras aplicarlas: 5 tablas, 5 con RLS, 11 políticas, 0 avisos de
seguridad en `get_advisors`.

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
- `borrar-datos-demo.sql`: las borra con todo lo suyo. Obligatorio antes de producción.

## Pendientes previstas

| Fase | Migraciones |
|---|---|
| 2 (sistema interno) | `categorias` · `articulos` · `variantes` · `movimientos` · `entregas` · vista `v_stock` |
| 3 | `cohortes` · `estudiantes` (datos académicos) · `inscripciones`; contenido completo de `programas` |
| 4 | `pagos` (QR) · `gastos` · vistas por período |
