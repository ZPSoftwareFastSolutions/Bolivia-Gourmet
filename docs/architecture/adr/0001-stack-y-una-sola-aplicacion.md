# ADR 0001 — Stack heredado y una sola aplicación para los dos sistemas

**Estado:** Aceptada · **Fecha:** 2026-09-30 · **Ámbito:** todo el proyecto

## Contexto

El encargo pide dos sistemas (interno de gestión y página informativa) para
una sola institución, con la **misma arquitectura CLEAN** usada en los
proyectos anteriores del equipo (GYM PLATFORM / Mítico Fitness / Gold's Gym).
Esos proyectos son Next.js 16 + TypeScript estricto + Tailwind v4 + Supabase
en Vercel, con capas `core/domain → core/application → infrastructure →
presentation`, composition root único, pruebas de dominio con `node --test` y
documentación en `CLAUDE.md` + ADR.

Había que decidir dos cosas: si repetir ese stack y si construir una o dos
aplicaciones.

## Decisión

1. **Se hereda el stack y las convenciones** de GYM PLATFORM: mismas versiones
   (Next 16.3.4, React 19.1.1, TypeScript 5.9.3, Tailwind 4.1.14), misma
   estructura de capas, mismos alias, mismo arnés de pruebas, mismas reglas de
   estilo (comentarios en español que explican el porqué, `CAPA:` al abrir cada
   archivo, `readonly` por defecto, cero `any`, versiones exactas).
2. **Una sola aplicación Next.js** (`apps/web`) con dos zonas de rutas:
   `(publico)/` para el sitio y `panel/` para el sistema interno. Un solo
   dominio, un solo despliegue.
3. **No se hereda la capa multi-tenant.** No hay `TenantConfig`, ni registro
   de tenants, ni `tenant_id` en las tablas. La institución es una; lo que sí
   hay es **sede** (dos desde el inicio).

## Motivos

- **Dominio compartido.** La carrera, los cursos, las cohortes y las sedes son
  los mismos datos para la vitrina y para el panel. Dos aplicaciones
  obligarían a duplicar el dominio o a publicar un paquete interno para un
  equipo de una persona.
- **Coste operativo.** Un despliegue, un proyecto Vercel, un proyecto Supabase.
- **Está probado.** GYM PLATFORM sirve sitio público estático y panel dinámico
  desde la misma aplicación sin sacar la vitrina del CDN.
- **Separable después.** Las dos zonas no se importan entre sí; si algún día
  conviene separarlas, es mover carpetas, no reescribir.
- **Sin multi-tenant** porque añadiría `tenant_id` a cada tabla, política y
  consulta para un caso que no existe. Si un día la institución vende el
  sistema a otra, ese día se decide (y la separación por capas lo permite).

## Consecuencias

**A favor**
- Arranque inmediato con herramientas conocidas y lecciones ya aprendidas
  (`docs/…` y `CLAUDE.md` del proyecto anterior recogen defectos que no hay
  que repetir).
- Un solo `npm run build` valida contenido, catálogo y tipos de todo.

**En contra**
- El panel y la vitrina comparten `package.json`: una dependencia pesada del
  panel no debe llegar al bundle público. Se controla cargando bajo demanda y
  midiendo el bundle.
- Renunciar al multi-tenant es una decisión consciente que habría que revertir
  con migraciones si el producto se vendiera a terceros.

## Alternativas descartadas

| Opción | Motivo |
|---|---|
| Dos aplicaciones (sitio y panel) | Dominio duplicado; dos despliegues; sin beneficio hoy |
| Reutilizar GYM PLATFORM como tenant | Es un producto para gimnasios: socios, membresías, clases. El instituto necesita inventario, inscripciones y cohortes; el dominio no encaja |
| API .NET + React | Prevista en el plan original de GYM PLATFORM y nunca construida; Supabase cubre identidad, datos y almacenamiento con RLS (ADR 0002) |
| Astro para la web pública | Excelente para lo estático, pero obligaría a un segundo framework para el panel |
