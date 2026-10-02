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
