# ADR 0002 — Identidad en Supabase Auth y autorización con RLS, sin multi-tenant

**Estado:** Aceptada · **Fecha:** 2026-09-30 · **Ámbito:** sistema interno

## Contexto

El sistema interno maneja datos personales de estudiantes, cobros e
inventario, con varios usuarios de distintos puestos en dos sedes. Hace falta
identidad (cuentas, contraseñas, sesión) y autorización (quién puede qué).
GYM PLATFORM resolvió lo mismo con Supabase Auth + Row Level Security (ADR
0004 de aquel proyecto), y las lecciones de esa implementación están
documentadas.

## Decisión

- **Supabase Auth** gestiona las cuentas. No se implementa hashing, tokens ni
  recuperación de contraseña propios.
- **RLS en la base garantiza la autorización.** La aplicación decide qué
  mostrar; la base decide qué se puede leer y escribir. Esconder un botón no
  es seguridad.
- **Modelo Usuario → Rol → Permiso en tablas** (`app_users`, `roles`,
  `permissions`, `role_permissions`, `user_roles`). Un rol nuevo es un
  insert.
- **Alcance por sede**: `user_sedes` (qué sedes opera cada cuenta) y
  `app.puede_operar_sede(sede_id)` en las políticas de escritura de las tablas
  operativas.
- **Sin `tenant_id`.** Una sola institución. Las funciones de contexto son
  `app.current_app_user_id()`, `app.has_permission(text)` y
  `app.puede_operar_sede(uuid)`.
- **Esquema `app` fuera de la API** para toda función `SECURITY DEFINER`;
  las RPC públicas son `SECURITY INVOKER`.
- **Políticas evaluadas una vez por consulta**: el contexto siempre va
  envuelto en `(select …)`.
- **`service_role` nunca** en el repositorio, en el navegador ni en variables
  `NEXT_PUBLIC_*`. La aplicación usa el cliente de servidor con la cookie del
  usuario.

## Motivos

- Reimplementar autenticación es donde más se pierde; Supabase la trae
  auditada.
- RLS se evalúa en el motor, debajo de cualquier consulta; un filtro en el
  código de aplicación es una convención que un desarrollador con prisa
  puede saltarse.
- El proyecto anterior ya pagó el aprendizaje (políticas por fila lentas,
  vistas sin `security_invoker`, `upsert` sobre columnas sin grant, RPC que
  nombran columnas no concedidas). Se heredan las reglas, no los errores.

## Consecuencias

- La autorización queda repartida entre tablas de permisos y políticas SQL:
  hay que leer ambas para saber quién puede qué. Se documenta en `CLAUDE.md` §4.
- Dependencia real de Supabase Auth: migrar de proveedor obligaría a reemitir
  credenciales.
- Cada tabla nueva nace con RLS, con `sede_id` si es operativa, y con su
  prueba de aislamiento con sesión simulada (`docs/testing/…`).

## Pendiente

- Crear el proyecto Supabase (acción externa del usuario; no se asumen
  credenciales ni proyectos existentes).
- Definir con el cliente los roles reales (P9 del análisis).
