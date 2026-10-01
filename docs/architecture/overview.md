# Arquitectura — Sistemas web de Corporación Bolivia Gourmet

> Documento vivo. Describe la arquitectura tal como está decidida hoy. Toda
> decisión estructural que lo contradiga se registra antes como ADR en
> `docs/architecture/adr/`. Si este documento y `CLAUDE.md` se contradicen,
> manda `CLAUDE.md`.

---

## 1. Qué se construye

Dos sistemas para una sola institución, sobre **una misma base de código**:

| Sistema | Qué es | Prioridad | Rama |
|---|---|---|---|
| **Sistema interno de gestión** | Panel privado: inventario (utensilios, insumos, uniformes), estudiantes e inscripciones, entregas, cobros y gastos, tablero | **Primera** | `feat/sistema-interno` |
| **Página web informativa** | Sitio público: institución, carrera, cursos, convenios, beneficios, requisitos, contacto | Segunda | `feat/pagina-web` |

Ambos comparten el **dominio** (programas, cohortes, sedes, contenido
institucional), la identidad visual y la infraestructura. No es un producto
enlatado multi-tenant como GYM PLATFORM: hay **un cliente**. Se hereda su
arquitectura CLEAN, sus convenciones y su tooling, **no** su capa de tenants
(ADR 0001).

## 2. Stack

| Capa | Tecnología | Versión | Por qué |
|---|---|---|---|
| Framework web | Next.js (App Router) | 16.3.8 | El mismo de los proyectos anteriores del equipo; Server Components; prerenderizado del sitio público; Server Actions para el panel |
| UI | React | 19.1.1 | |
| Lenguaje | TypeScript estricto | 5.9.3 | `strict` + `noUncheckedIndexedAccess` |
| Estilos | Tailwind CSS v4 | 4.1.14 | Tokens semánticos en `globals.css`; ningún color literal en componentes |
| Identidad y datos | Supabase (Auth + PostgreSQL) · `@supabase/ssr` 0.12.7, `supabase-js` 2.117.2 | proyecto `Bolivia-Gourmet` (sa-east-1) | RLS como garantía de autorización; sin backend propio (ADR 0002, 0005) |
| Despliegue | Vercel | — | Como los proyectos anteriores; región `gru1` |
| Pruebas | `node --test` (dominio) + SQL con sesión simulada (RLS) | Node 24 | Sin framework de pruebas ni navegador para el dominio |
| Gestor de paquetes | npm | 11 | `package-lock.json` versionado; versiones **exactas** |

**No hay backend .NET ni API propia.** La base de datos y la autenticación son
Supabase; la aplicación habla con ella con el cliente de servidor que lleva la
cookie del usuario, nunca con `service_role`.

## 3. Estructura del repositorio

```text
INST_GASTRO/
├── CLAUDE.md                     Contexto técnico principal (se lee al abrir sesión)
├── TASKS.md                      Panel de tareas
├── README.md                     Arranque rápido
├── INFORMACION-INSTITUTO.md      Fuente institucional (copia de la original)
├── FOTOS-GASTRO/                 Referencia visual (12 fotografías de folletos)
├── docs/
│   ├── brand/identidad-visual.md
│   ├── analisis/analisis-informacion-instituto.md
│   ├── architecture/overview.md (este) · adr/
│   ├── domain/modelo-de-dominio.md
│   ├── testing/estrategia-de-pruebas.md
│   └── git/estrategia-de-ramas.md
├── supabase/migrations/          SQL versionado (vacío hasta crear el proyecto)
└── apps/web/                     LA aplicación (sitio público + panel)
    ├── contenido/                Contenido institucional estático, validado en el build
    ├── src/
    │   ├── app/                  Rutas (Presentation)
    │   │   ├── (publico)/        Sitio público: prerenderizado
    │   │   └── panel/            Sistema interno: dinámico, con sesión
    │   ├── core/
    │   │   ├── domain/           Entidades, reglas y validadores puros. Sin framework.
    │   │   │   ├── shared/       Tipos base, marcas nominales, Resultado
    │   │   │   ├── academico/    Programa, Cohorte, Turno
    │   │   │   ├── estudiantes/  Estudiante, Inscripcion
    │   │   │   ├── inventario/   Articulo, Variante, Movimiento, Entrega
    │   │   │   └── administracion/ Pago, Gasto, Periodo
    │   │   └── application/      Casos de uso y puertos
    │   │       ├── ports/        Interfaces que Infrastructure implementa
    │   │       └── <modulo>/     *.usecase.ts
    │   ├── infrastructure/       Adaptadores + composition root
    │   │   ├── config/composition-root.ts   ÚNICO sitio que construye adaptadores
    │   │   ├── catalogo/         Catálogo académico estático (hasta que viva en la base)
    │   │   └── supabase/         Clientes y repositorios (cuando exista el proyecto)
    │   ├── presentation/         UI
    │   │   ├── ui/               Átomos y moléculas sin dominio
    │   │   ├── patterns/         Organismos (formularios, tablas, navegación)
    │   │   ├── sections/         Secciones del sitio público
    │   │   └── icons/            Set propio de iconos SVG
    │   ├── lib/                  Utilidades transversales (cn, formato, fechas)
    │   └── styles/globals.css    Sistema de diseño (tokens)
    └── tests/                    Pruebas de dominio y de contenido (node --test)
```

## 4. Clean Architecture

La **Dependency Rule**: las dependencias apuntan hacia adentro.

```text
        ┌──────────────────────────────────────────┐
        │  PRESENTATION   app/ · presentation/     │
        └──────────────────┬───────────────────────┘
                           │ depende de
        ┌──────────────────▼───────────────────────┐
        │  APPLICATION    casos de uso · puertos   │
        └──────────────────┬───────────────────────┘
                           │ depende de
        ┌──────────────────▼───────────────────────┐
        │  DOMAIN         entidades · reglas       │
        │  ── no depende de NADA ──                │
        └──────────────────────────────────────────┘
                           ▲
                           │ implementa puertos
        ┌──────────────────┴───────────────────────┐
        │  INFRASTRUCTURE  Supabase · catálogo     │
        │                  composition root        │
        └──────────────────────────────────────────┘
```

### Responsabilidad de cada capa

| Capa | Dónde | Qué hace | Qué NO hace |
|---|---|---|---|
| Domain | `src/core/domain` | Tipos, enums, invariantes y funciones puras (`aplicarMovimiento`, `validarCohorte`) | Importar React, Next, Supabase o cualquier otra capa |
| Application | `src/core/application` | Casos de uso que orquestan dominio y puertos; devuelven `Resultado` | Conocer de dónde vienen los datos; importar `infrastructure` |
| Infrastructure | `src/infrastructure` | Implementar puertos (Supabase, catálogo estático), validar configuración, componer | Contener reglas de negocio |
| Presentation | `src/app`, `src/presentation` | Rutas, Server Actions (que solo llaman casos de uso), componentes | Decidir reglas; construir adaptadores; leer colores de marca |

### Reglas verificables

| Regla | Comprobación |
|---|---|
| `core/domain` no importa de otra capa ni de frameworks | `grep -rnE "from '(@infra\|@/presentation\|@/app\|next\|react\|@supabase)" apps/web/src/core/domain` vacío |
| `core/application` no importa de `infrastructure` | `grep -rn "from '@infra" apps/web/src/core/application` vacío |
| Solo el composition root construye adaptadores | `grep -rn "new Supabase\|createServerClient" apps/web/src --include=*.tsx` vacío fuera de `infrastructure` |
| Ningún componente escribe un color literal | `grep -rnE "#[0-9a-fA-F]{6}" apps/web/src/presentation apps/web/src/app` vacío |
| Los importes nunca son `number` con decimales en el dominio | Tipo `Centavos` (entero) en `domain/shared` |

Estas comprobaciones están en `docs/testing/estrategia-de-pruebas.md` y se
ejecutan antes de cada commit relevante.

## 5. Datos y seguridad (cuando exista el proyecto Supabase)

Principios heredados de GYM PLATFORM, sin la parte multi-tenant:

1. **RLS activo en toda tabla**, sin política = denegado.
2. **La autorización sale de la sesión**: `app.current_app_user_id()`,
   `app.has_permission('modulo.accion')`, `app.puede_operar_sede(sede_id)`.
   Nunca de un campo del formulario.
3. **Esquema `app` fuera de la API** para las funciones `SECURITY DEFINER`;
   en `public` solo funciones `SECURITY INVOKER`.
4. **Políticas evaluadas una vez por consulta**: `(select app.has_permission('x'))`.
5. **Vistas con `security_invoker = true`**.
6. **`sede_id` en toda tabla operativa** e índices que empiezan por ella
   cuando se filtra por sede.
7. **Movimientos y pagos son inmutables**: sin política de UPDATE ni DELETE;
   corrección por asiento inverso.
8. **Stock derivado**: vista `v_stock` (suma de movimientos) o columna
   mantenida por disparador con `CHECK (stock >= 0)`. Se decide al escribir
   la migración, midiendo con volumen.
9. **`service_role` jamás** en el repositorio, el navegador ni `NEXT_PUBLIC_*`.
10. Usuario → Rol → Permiso en tablas.

Proyecto creado el 2026-10-01 (`supabase/migrations/README.md`). Seguridad de
la web y del portal: `docs/architecture/seguridad.md`.

## 6. Renderizado

| Zona | Estrategia |
|---|---|
| Sitio público `(publico)/` | Estático (SSG) en el build; contenido desde `contenido/` y el catálogo académico. Cuando los datos vivan en la base, ISR con revalidación |
| Panel `panel/` | Dinámico: Server Components con el cliente de Supabase de la sesión; Server Actions para escribir; guardas por página y por acción |
| Cliente | Mínimo: `'use client'` solo donde hay interacción (menú móvil, formularios con estado) |

## 7. Seguridad de la aplicación

Cabeceras (`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`,
`Permissions-Policy`, CSP) en `next.config.ts`; `rel="noopener noreferrer"`
en enlaces externos; validación en tiempo de ejecución de todo dato externo;
fallar cerrado (una capacidad no configurada desactiva su parte, nunca abre
un valor por defecto); `npm audit` limpio antes de desplegar.

## 8. Evolución prevista

```text
Fase 0  ✅  Análisis, arquitectura, documentación, estructura base, dominio inicial con pruebas
Entrega 2 ✅ GitHub, Supabase con RLS, aclaraciones, web pública y portal de estudiantes con CSP estricta (ADR 0005, 0006)
Fase 1      Sistema interno · base: proyecto Supabase, identidad y permisos, sedes, migraciones iniciales
Fase 2      Sistema interno · inventario: artículos, variantes, movimientos, stock, entregas
Fase 3      Sistema interno · estudiantes: estudiantes, cohortes, inscripciones, requisitos
Fase 4      Sistema interno · administración: pagos, gastos, tablero, reportes
Fase 5      Página web · informativa: contenido, secciones, SEO, responsive, despliegue
Fase 6      Página web · dinámica: inscripción en línea, interesados, integración con el panel
```

## 9. Deuda reconocida desde el inicio

1. El catálogo académico vive en un archivo estático hasta que exista la base;
   el puerto `CatalogoAcademicoPort` ya es asíncrono para sustituirlo sin tocar
   consumidores.
2. Sin CI: `typecheck`, `test`, `build` y `audit` se ejecutan a mano. Debe
   existir antes de que haya más de una persona desarrollando.
3. Sin logotipos vectoriales ni fotografías propias: la web no se publica sin
   ellos.
