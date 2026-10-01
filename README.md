# Sistemas web — Corporación Bolivia Gourmet

Dos sistemas para **Corporación Bolivia Gourmet**, área de gastronomía del
**TEC-NIB** (Instituto Técnico Nacional de la Integración Boliviana), y su
instituto **Bolivia Gastronómica** (La Paz y El Alto, Bolivia), sobre una
misma base de código con arquitectura CLEAN:

1. **Página web** con **portal de estudiantes**: institución, carrera técnica
   en Gastronomía, cursos de capacitación (con «¿Sueñas emprender?»), convenios,
   contacto; registro, solicitud de inscripción y de renovación, estado de
   solicitudes y pago por QR.
2. **Sistema interno de gestión** (en desarrollo): recepción y administración,
   inventario, inscripciones y contabilidad.

> **Estado (2026-10-01):** web y portal completos y verificados en local en la
> rama `feat/pagina-web`; base de datos Supabase con RLS; sin desplegar.
> Ver [`CLAUDE.md`](CLAUDE.md) §0 y §9, y [`TASKS.md`](TASKS.md).

## Arranque rápido

```bash
cd apps/web
cp -n .env.example .env.local   # -n: NO sobrescribe un .env.local que ya exista
# Completar en .env.local la URL y la clave publicable reales de Supabase (CLAUDE.md §7)
npm install
npm run dev
```

### Verificación antes de commitear

```bash
cd apps/web
npm run typecheck
npm test
npm run build
npm audit
```

Más comprobaciones (capas, colores, voseo, secretos, cabeceras, RLS) en
[`CLAUDE.md`](CLAUDE.md) §8.

## Estructura

```text
CLAUDE.md · TASKS.md            Contexto técnico y panel de tareas
INFORMACION-INSTITUTO.md        Fuente institucional del cliente (no se edita)
FOTOS-GASTRO/ · FOTOS-WEB/      Folletos (referencia) y recursos oficiales (logotipos, fotos)
docs/
  analisis/                     Análisis del documento y aclaraciones del 2026-10-01
  brand/identidad-visual.md     Identidad visual, logotipos medidos, aporte de las skills
  architecture/                 Visión general, seguridad, ADR 0001–0006
  domain/ · testing/ · git/     Modelo de dominio, estrategia de pruebas y de ramas
  runbooks/                     Batería de pruebas RLS
supabase/migrations/            SQL aplicado en el proyecto Bolivia-Gourmet
apps/web/                       Next.js 16 · TypeScript · Tailwind v4 · Supabase
  contenido/                    Contenido institucional, convenios, textos alternativos
  src/core/                     Dominio y casos de uso (sin framework)
  src/infrastructure/           Catálogo, Supabase, composition root
  src/app · src/presentation    Rutas, portal y UI
  scripts/                      Optimización de imágenes y capturas por CDP
  tests/                        node --test
```

## Fuentes de verdad

- Datos: `INFORMACION-INSTITUTO.md` y `docs/analisis/aclaraciones-2026-10-01.md`.
  Lo no definido es **pendiente** en el código y «Consultar» en pantalla.
- Identidad: folletos, logotipos oficiales y `docs/brand/identidad-visual.md`.
- Decisiones: `docs/architecture/adr/`.

Si un documento contradice a `CLAUDE.md`, manda `CLAUDE.md`.
