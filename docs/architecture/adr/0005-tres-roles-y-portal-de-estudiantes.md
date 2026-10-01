# ADR 0005 — Tres roles fijos y un portal de estudiantes en la web

**Estado:** Aceptada · **Fecha:** 2026-10-01 · **Ámbito:** ambos sistemas · Modifica el ADR 0002

## Contexto

El ADR 0002 dejó la identidad en Supabase Auth con un modelo
Usuario → Rol → Permiso en tablas, sin decidir qué roles existían (P9). El
2026-10-01 el usuario aclaró:

- En la **página web** solo habrá acceso para **estudiantes**: inscripciones,
  formularios y renovaciones, como una pequeña «intranet» simulada.
- En el **sistema interno**, **recepción** (atención presencial, información
  de oferta, cupos y precios, inventario) y **administrador** (todo, incluida
  la parte contable).
- «Con los roles no hay que perder la cabeza».

## Decisión

1. **Tres roles fijos** como `enum` de PostgreSQL (`rol_de_usuario`):
   `administrador`, `recepcion`, `estudiante`. Un rol nuevo es una migración,
   no un insert: se acepta porque el usuario pidió explícitamente no
   complicarlo y un cambio de rol de ese calibre merece revisión.
2. **Permisos por rol en una tabla** (`permisos_de_rol`). Lo que cambia con
   frecuencia —qué puede hacer recepción— sigue siendo un insert. Las
   políticas preguntan por permisos (`app.tiene_permiso('solicitudes.leer')`),
   nunca por el nombre del rol.
3. **El estudiante no tiene permisos de módulo**: accede a lo suyo por
   identidad (`estudiante_id = auth.uid()`). Así no hay forma de darle, por
   error, un permiso que abra los datos de los demás.
4. **Todo registro web nace estudiante.** El perfil lo crea un disparador
   sobre `auth.users`; el rol nunca se lee de los metadatos del registro (los
   escribe el propio usuario). Cambiar rol, estado, sede o correo exige
   `perfiles.gestionar` y lo vigila un disparador; el instituto nunca se queda
   sin un administrador activo.
5. **El portal es parte de la página web** (rama `feat/pagina-web`), no del
   sistema interno: comparte su diseño, su dominio y su despliegue. El
   personal entrará por el panel del sistema interno con la misma
   autenticación.
6. **El primer administrador se promueve por SQL** desde el panel de
   Supabase (runbook en `CLAUDE.md` §4). No existe ninguna pantalla que
   permita autoasignarse un rol.

## Consecuencias

- Las solicitudes del portal (inscripción y renovación) son la única
  escritura de un estudiante. Recepción y administración las leen y deciden;
  el estudiante solo puede cancelar una solicitud pendiente.
- Las cuentas del personal se crean registrándose y siendo promovidas por un
  administrador. Cuando exista el panel, la promoción tendrá pantalla propia.
- 39 pruebas RLS con sesión simulada cubren estas reglas
  (`docs/runbooks/pruebas-rls-entrega2.sql`).
