# Sistemas web — Corporación Bolivia Gourmet

Dos sistemas para el **Instituto Técnico Nacional de la Integración Boliviana /
Corporación Bolivia Gourmet / Bolivia Gastronómica** (La Paz y El Alto,
Bolivia), sobre una misma base de código con arquitectura CLEAN:

1. **Sistema interno de gestión** (prioritario): inventario de utensilios,
   insumos y uniformes; estudiantes e inscripciones por cohorte; entregas con
   trazabilidad; ingresos y gastos; tablero.
2. **Página web informativa**: institución, carrera técnica, cursos,
   convenios, beneficios, requisitos, contacto y sedes, fiel a la identidad
   visual de los folletos.

> **Estado: fase 0 completa** (2026-09-30). Hay análisis, arquitectura,
> documentación, dominio con pruebas y estructura base. **No hay base de datos,
> ni sesión, ni pantallas reales todavía.** Ver [`CLAUDE.md`](CLAUDE.md) §0 y
> [`TASKS.md`](TASKS.md).

## Arranque rápido

```bash
cd apps/web
npm install
npm run dev
```

Abre http://localhost:3000. No hace falta ninguna variable de entorno en esta
fase.

### Verificación antes de commitear

```bash
cd apps/web
npm run typecheck
npm test
npm run build
npm audit
```

Más comprobaciones (Dependency Rule, colores literales, voseo) en
[`CLAUDE.md`](CLAUDE.md) §8.

## Estructura

```text
CLAUDE.md                   Contexto técnico principal (leer primero)
TASKS.md                    Panel de tareas
INFORMACION-INSTITUTO.md    Fuente institucional (no se inventa nada que no esté aquí)
FOTOS-GASTRO/               Referencia visual (12 fotografías de los folletos)
docs/
  brand/identidad-visual.md            Análisis visual y tokens
  analisis/analisis-informacion-instituto.md
  architecture/overview.md · adr/      Arquitectura y decisiones
  domain/modelo-de-dominio.md          Entidades, relaciones y reglas
  testing/estrategia-de-pruebas.md
  git/estrategia-de-ramas.md
apps/web/                   La aplicación (Next.js 16 · TypeScript · Tailwind v4)
  contenido/                Contenido institucional estático
  src/core/domain           Reglas puras (sin framework)
  src/core/application      Casos de uso y puertos
  src/infrastructure        Adaptadores y composition root
  src/app · src/presentation   Rutas y UI
  tests/                    node --test
supabase/migrations/        SQL versionado (vacío hasta crear el proyecto)
```

## Fuentes de verdad

- Datos: `INFORMACION-INSTITUTO.md`. Lo que dice `[Consultar]` es
  **pendiente** en el código y «Consultar» en pantalla.
- Identidad: `FOTOS-GASTRO/` y `docs/brand/identidad-visual.md`.
- Decisiones: `docs/architecture/adr/`.

Si un documento contradice a `CLAUDE.md`, manda `CLAUDE.md`.
