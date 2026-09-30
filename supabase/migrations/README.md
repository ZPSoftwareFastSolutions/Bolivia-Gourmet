# Migraciones — base de datos del sistema interno

> **Todavía no existe el proyecto Supabase** (tarea B2 de `TASKS.md`). Esta
> carpeta está reservada para el SQL versionado de cada migración, en orden
> cronológico: `AAAAMMDDHHMMSS_<fase>_<que_hace>.sql`.

## Reglas para cada migración (ADR 0002, `CLAUDE.md` §4)

1. Toda tabla nace con RLS activo y con sus políticas escritas para evaluarse
   **una vez por consulta**: `(select app.has_permission('modulo.accion'))`.
2. Toda tabla operativa lleva `sede_id`.
3. `movimientos` y `pagos` no tienen política de UPDATE ni DELETE.
4. Las funciones `SECURITY DEFINER` viven en el esquema `app` (fuera de la API);
   en `public` solo funciones `SECURITY INVOKER`.
5. Las vistas se crean con `security_invoker = true`.
6. Cada migración se acompaña de su batería de pruebas RLS con sesión simulada
   en `docs/runbooks/pruebas-rls-<fase>.sql` (transacción revertida).
7. Las vistas y políticas nuevas se miden con volumen (50 000 filas en una
   transacción revertida) antes de darlas por buenas.

## Orden previsto

| Fase | Migraciones |
|---|---|
| 1 | sedes · identidad y permisos (`app_users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `user_sedes`) · funciones `app.*` · semilla de roles |
| 2 | `categorias` · `articulos` · `variantes` · `movimientos` · `entregas` · vista `v_stock` |
| 3 | `programas` · `cohortes` · `estudiantes` · `inscripciones` |
| 4 | `pagos` · `gastos` · vistas por período |
