# CLAUDE.md — Sistemas web de Corporación Bolivia Gourmet

> Archivo de contexto persistente. Claude Code lo carga al abrir una sesión en
> este repositorio. **Describe el proyecto tal como está HOY**, no cómo se
> llegó hasta aquí. Una sesión nueva debe poder continuar el trabajo leyendo
> este archivo, `TASKS.md`, `INFORMACION-INSTITUTO.md` y `docs/`, sin
> depender del historial de conversaciones.
>
> - **Última actualización:** 2026-09-30 · **Fase 0 completa**: análisis
>   visual e institucional, arquitectura CLEAN, documentación, estructura base,
>   dominio inicial con 73 pruebas, repositorio local y rama `feat/sistema-interno`.
> - **Rama de trabajo vigente:** `feat/sistema-interno` (sale de `main`).
> - **Regla de mantenimiento:** se actualiza al cerrar cada avance importante
>   y al final de cada sesión. Cambian sobre todo §9 (estado y pendientes) y
>   §13 (historial); el resto solo cuando cambia una decisión de fondo.

---

## 0. Para una sesión nueva: lo esencial en un minuto

| | |
|---|---|
| **Qué es** | Dos sistemas para **una** institución: (1) **sistema interno de gestión** (inventario, estudiantes, inscripciones, entregas, cobros, tablero) y (2) **página web informativa**. Misma base de código, misma identidad visual. |
| **Cliente** | Corporación Bolivia Gourmet · Instituto Técnico Nacional de la Integración Boliviana · Bolivia Gastronómica (las tres denominaciones se respetan literalmente; ver §11). Dos sedes: La Paz (Miraflores) y El Alto (La Ceja). |
| **Stack** | Next.js 16.3.8 (App Router) · React 19.1 · TypeScript 5.9 estricto · Tailwind v4 · Supabase (pendiente de crear) · Vercel (pendiente) · `node --test` |
| **Código** | Todo en `apps/web`. Capas: `core/domain → core/application → infrastructure → presentation`. Composition root único. |
| **Estado** | Fase 0 ✅. **No hay base de datos, ni sesión, ni pantallas reales**: hay dominio, puertos, catálogo estático validado, tokens de marca y una página provisional. |
| **Prioridad** | Primero el **sistema interno**; después la página web. |
| **Fuentes de verdad** | `INFORMACION-INSTITUTO.md` (datos), `FOTOS-GASTRO/` + `docs/brand/identidad-visual.md` (identidad), `docs/domain/modelo-de-dominio.md` (reglas), `docs/architecture/` (decisiones), `TASKS.md` (avance). |
| **Siguiente** | 1) Crear el remoto en GitHub y hacer push (§7) · 2) Obtener del cliente las respuestas P1–P12 y los archivos de marca (§11) · 3) Crear el proyecto Supabase · 4) Fase 1: identidad, permisos, sedes, migraciones · 5) Fase 2: inventario |

**Antes de tocar nada, léase:** §2 (reglas), §3 (arquitectura), §5 (dominio),
§9 (pendientes) y §11 (ambigüedades).

**Reglas que no se rompen:**

1. **La información institucional no se inventa.** Lo que está `[Consultar]`
   en `INFORMACION-INSTITUTO.md` es `PENDIENTE` en el código y «Consultar» en
   pantalla. Las cifras manuscritas de los folletos (650) **no se usan**.
2. **La identidad visual sale de los folletos.** Nada de diseño genérico de
   instituto gastronómico: `docs/brand/identidad-visual.md` manda.
3. **Dependency Rule.** `core/domain` no importa nada de fuera; `application`
   no importa `infrastructure`; solo el composition root construye adaptadores.
4. **Los movimientos de inventario y los pagos son inmutables.** Se corrigen
   con el asiento inverso. El stock nunca queda negativo.
5. **El sistema registra, no decide, cuándo se entrega un uniforme** hasta que
   el cliente defina la regla (P2). La sesión de clase es un contexto opcional
   de la entrega, nunca obligatorio.
6. **Verificar probando, no leyendo:** `typecheck` + `test` + `build` +
   `audit` + greps de capas antes de cada commit relevante (§8). Una tarea no
   está terminada hasta que se verificó.
7. **Cero secretos en el repositorio.** `service_role` jamás. No se asumen
   credenciales, proyectos ni repositorios.

---

## 1. Objetivo del proyecto

Digitalizar la gestión y la presencia web de la institución:

| Sistema | Objetivo | Estado |
|---|---|---|
| **Interno** | Centralizar inventario (utensilios, insumos, uniformes, otros), estudiantes e inscripciones por cohorte, entregas con trazabilidad, ingresos y gastos, y un tablero con solo lo accionable | Dominio inicial con pruebas; sin base ni pantallas |
| **Página web** | Presentación institucional, carrera, cursos, convenios, beneficios, requisitos, contacto, sedes, redes y llamadas a la acción; dinámica, responsive y fiel a la identidad | Solo tokens y página provisional |

**No es un producto enlatado multi-tenant.** Se hereda la arquitectura de GYM
PLATFORM (proyectos `SoftwareGym` y `MiticoFitness` en `F:\Proyectos`), no su
capa de tenants (ADR 0001). Sí hay **sede** como eje de alcance.

Evolución prevista:

```text
Fase 0 ✅  Análisis, arquitectura, documentación, estructura base, dominio con pruebas
Fase 1     Interno · base: proyecto Supabase, identidad y permisos, sedes, migraciones, login
Fase 2     Interno · inventario: artículos, variantes, movimientos, stock, entregas
Fase 3     Interno · estudiantes: estudiantes, cohortes, inscripciones, requisitos
Fase 4     Interno · administración: pagos, gastos, tablero, reportes
Fase 5     Web · informativa: contenido, secciones, SEO, responsive, despliegue
Fase 6     Web · dinámica: inscripción en línea, interesados, integración con el panel
```

---

## 2. Reglas de estilo y código

### 2.1 Idioma

| Elemento | Idioma |
|---|---|
| Comentarios y documentación | **Español** |
| Nombres de dominio (`Articulo`, `Movimiento`, `Inscripcion`, `validarCohorte`) | **Español** (sin tildes en identificadores) |
| Carpetas de capa (`core/domain`, `application`, `infrastructure`, `presentation`) | Inglés técnico (herencia del equipo) |
| Tablas y columnas SQL | Español (`articulos`, `movimientos`, `sede_id`); funciones en `app.*` en español |
| Textos visibles | **Español neutro de Bolivia**: «elige», «puedes». **Sin voseo.** |
| Mensajes de commit | Español, con cuerpo que explica **por qué** |

Los comentarios explican **por qué**, nunca **qué**. Cada archivo abre con un
bloque `CAPA: …` que dice a qué capa pertenece y por qué existe.

### 2.2 TypeScript

- `strict: true` **y** `noUncheckedIndexedAccess: true`. No se relajan.
- Cero `any`: `unknown` y se estrecha. Cero `@ts-ignore` sin justificación.
- `interface` para contratos, `type` para uniones. `readonly` por defecto.
- Marcas nominales para valores validados (`Id`, `Centavos`, `FechaISO`).
- Todo dato externo (formulario, base, archivo) se **valida en tiempo de
  ejecución** y devuelve `Resultado<T, E>` (`exito`/`fallo`), nunca excepciones
  por reglas de negocio. Los validadores devuelven **todos** los errores.
- Los importes son **enteros en centavos** (`Centavos`); nunca `number` con
  decimales en el dominio.
- Datos no definidos por la institución: tipo `Pendiente` / `Definido<T>`,
  nunca `null` ambiguo ni un valor inventado.
- **Sin «parameter properties»** en constructores (`constructor(private x)`):
  Node ejecuta las pruebas quitando tipos y no admite esa sintaxis.
- Alias: `@/*` → `src`, `@core/*` → `src/core`, `@infra/*` →
  `src/infrastructure`, `@ui/*`, `@patterns/*`, `@sections/*`, `@contenido/*`.

### 2.3 Arquitectura — Dependency Rule

```text
presentation / app  →  application  →  domain
                            ↑
                 infrastructure (implementa los puertos)
```

| Regla | Comprobación |
|---|---|
| `core/domain` no importa de ninguna otra capa ni de frameworks | grep de §8 vacío |
| `core/application` no importa de `infrastructure` | Los puertos se declaran en `application/ports` |
| Solo el composition root construye adaptadores | `infrastructure/config/composition-root.ts` |
| Ningún componente escribe un color literal | Solo tokens semánticos (`bg-accion`, `text-tinta`) |
| Ningún componente incrusta nombres institucionales | Se leen de `contenido/instituto.ts` |

### 2.4 Componentes

- **Server Components por defecto.** `'use client'` lo más abajo posible.
- Átomos y moléculas (`presentation/ui`) no conocen el dominio ni hacen fetch.
- Variantes como **enum**, nunca booleanos combinables.
- Un componente usado una sola vez vive junto a su feature; pasa a `ui/` con
  el **tercer** consumidor real.
- Sin librerías de iconos, gráficos ni animación: SVG propio, `transform` y
  `opacity`.

### 2.5 Estilos

- **Nunca** un color literal: tokens semánticos de `globals.css`.
- **El amarillo siempre lleva azul marino encima** (`bg-accion text-sobre-accion`);
  nunca texto amarillo sobre blanco (contraste 1.3:1).
- Resets de elementos **dentro de `@layer base`** (fuera de capa anulan las
  utilidades de Tailwind v4).
- Propiedades lógicas (`ms-`, `me-`). Mobile-first.
- Panel: operatividad antes que decoración; sin script ni display salvo el
  logotipo. Web: script + display en títulos, ondas, brochazos, checks.

### 2.6 Accesibilidad — no negociable

Foco visible siempre; objetivos táctiles de 44 px; HTML semántico antes que
ARIA; tablas reales; `prefers-reduced-motion`; contraste AA verificado sobre
la paleta real.

### 2.7 Seguridad

- Fallar cerrado: lo no configurado desactiva su parte (el composition root
  lanza si no hay Supabase); nunca un valor por defecto que parezca dato.
- La autorización vive en la base (RLS); ocultar un botón no es seguridad.
- El responsable de un movimiento o pago **sale de la sesión**, nunca del
  formulario.
- `service_role` jamás en el repo, el navegador ni `NEXT_PUBLIC_*`.
- Cabeceras de seguridad en `next.config.ts`; `rel="noopener noreferrer"`.
- `npm audit` en 0 antes de commitear (Next se subió a 16.3.8 por una CVE
  crítica en 16.3.4: GHSA-vcvr-r3jv-pc5j).

### 2.8 Dependencias

Tres preguntas antes de instalar: ¿cuánto pesa?, ¿qué arrastra?, ¿cuántas
líneas propias ahorra? Versiones **exactas**, sin `^`.

| Dependencia | Por qué está |
|---|---|
| `next` 16.3.8, `react`/`react-dom` 19.1.1 | Framework |
| `tailwindcss` + `@tailwindcss/postcss` 4.1.14 | Estilos |
| `typescript` 5.9.3 + tipos | Lenguaje |

Se añadirán `@supabase/ssr` y `@supabase/supabase-js` (versiones exactas) al
crear el proyecto Supabase. No hay ESLint configurado todavía (deuda, §9).

### 2.9 Git

- Ramas: `main` + una rama por **sistema** (`feat/sistema-interno`,
  `feat/pagina-web`). **Nunca** una rama por botón, formulario o color.
  Detalle en `docs/git/estrategia-de-ramas.md`.
- Commits en español con cuerpo que explica el **porqué**; firma
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Push y creación del remoto solo cuando el usuario lo pide o lo hace.

### 2.10 Forma de trabajar con el asistente

- **Probar antes de dar por hecho** (§8). El asistente no inicia sesión con
  contraseñas ni cuentas de demostración; las pantallas con sesión las
  recorre una persona.
- Ante un dato que falta: documentarlo en §11 y en `TASKS.md`, modelarlo
  como `Pendiente`, **no** inventarlo.
- Actualizar este archivo y `TASKS.md` al cerrar cada avance.
- HawkScan (DAST) está configurado como gancho de sesión, pero sin
  `HAWK_API_KEY` y sin superficie HTTP con sesión no se ejecuta; queda
  anotado para cuando exista el panel.

---

## 3. Arquitectura actual

### 3.1 Vista general

```text
 Navegador ──► Vercel (Next.js 16)               [pendiente de desplegar]
               ├─ (publico)/  ─── sitio informativo, estático (SSG)
               └─ panel/      ─── sistema interno, dinámico, con sesión   [no existe aún]
                        │  cliente de servidor con la cookie del usuario (nunca service_role)
                        ▼
               Supabase (Auth + PostgreSQL con RLS + Storage)               [pendiente de crear]
```

Hoy solo existe la página provisional `/` (lista la oferta y las sedes desde el
catálogo estático) y `/_not-found`.

### 3.2 Mapa del código (`apps/web`)

```text
contenido/instituto.ts            Nombres, lema, fundador, pilares, redes (INFORMACION-INSTITUTO.md §1, §7)
src/
  app/
    layout.tsx                    Fuentes (Montserrat, Bebas Neue, Kaushan Script) + metadatos (noindex)
    page.tsx                      PÁGINA PROVISIONAL de la fase 0 (no es el sitio)
    not-found.tsx                 404 genérica
  core/
    domain/
      shared/tipos-base.ts        Branded, Id, Centavos, FechaISO, Resultado, Pendiente/Definido, validadores
      shared/sede.ts              Sede, esCelularBoliviano, enlaceDeWhatsApp
      academico/programa.ts       Programa, Cohorte, Turno, Modalidad; validarPrograma, validarCohorte, describirDuracion
      estudiantes/estudiante.ts   Estudiante, Inscripcion; validarEstudiante, validarInscripcion
      inventario/articulo.ts      TipoDeArticulo, COMPORTAMIENTO_POR_TIPO, Articulo, Variante, Unidad
      inventario/movimiento.ts    TipoDeMovimiento, Movimiento; validarMovimiento, aplicarMovimiento, calcularStock
      inventario/entrega.ts       Entrega, ContextoDeEntrega; validarEntrega, movimientoDeEntrega/Devolucion
    application/
      ports/                      catalogo-academico.port.ts · inventario-repository.port.ts
      inventario/                 registrar-movimiento.usecase.ts
  infrastructure/
    config/composition-root.ts    ÚNICO sitio que construye adaptadores (catálogo estático; inventario lanza)
    catalogo/oferta-academica.ts  LA OFERTA transcrita del documento, con PENDIENTE donde dice [Consultar]
    catalogo/catalogo.validator.ts   Valida el catálogo; rompe el build si hay errores
    catalogo/catalogo-estatico.repository.ts   Implementa el puerto
  lib/cn.ts                       Composición de clases
  styles/globals.css              Tokens de marca y semánticos, base en @layer, utilidades de marca
tests/                            73 pruebas: inventario, académico, estudiantes, casos de uso (node --test)
```

### 3.3 Capas y piezas clave

**Composition root.** `catalogoAcademico()` es singleton de proceso (datos
estáticos). `inventarioRepository()` **lanza** hasta que exista Supabase: fallar
cerrado antes que mostrar un cero que parece dato. Los repositorios de datos se
crearán **por petición** con el cliente de la sesión.

**Puertos asíncronos desde el día uno.** Sustituir el catálogo estático por la
base no cambia ningún consumidor.

**Casos de uso que orquestan, no deciden.** `registrarMovimiento` trae el
artículo, deja validar al dominio, comprueba existencia y solo entonces guarda.
Si una regla falla, el repositorio no se toca (probado).

**Guardas previstas para el panel** (como en GYM PLATFORM, sin tenant): página
(`exigirPermiso`), Server Action (`contextoDeAccion`, que re-resuelve sesión,
sede y permiso en cada envío) y base (RLS). Ninguna sustituye a la siguiente.

---

## 4. Datos y seguridad (Supabase) — pendiente de crear

Principios fijados (ADR 0002), para escribir las migraciones de la fase 1:

1. RLS en toda tabla; sin política = denegado.
2. Contexto desde la sesión: `app.current_app_user_id()`, `app.has_permission('modulo.accion')`,
   `app.puede_operar_sede(sede_id)`. Siempre envuelto en `(select …)` en las políticas.
3. Esquema `app` fuera de la API para funciones `SECURITY DEFINER`; en `public`, solo `INVOKER`.
4. Vistas con `security_invoker = true`.
5. `sede_id` en toda tabla operativa.
6. `movimientos` y `pagos` sin política de UPDATE ni DELETE.
7. Stock derivado (vista o columna por disparador con `CHECK >= 0`); se decide midiendo con volumen.
8. Usuario → Rol → Permiso en tablas; roles reales pendientes (P9).
9. Autoría por default `app.current_app_user_id()`, nunca del formulario.
10. Batería de pruebas RLS con sesión simulada por cada migración.

Tablas previstas (nombres en español): `sedes`, `app_users`, `roles`,
`permissions`, `role_permissions`, `user_roles`, `user_sedes`, `programas`,
`cohortes`, `estudiantes`, `inscripciones`, `categorias`, `articulos`,
`variantes`, `movimientos`, `entregas`, `pagos`, `gastos`. Detalle de campos en
`docs/domain/modelo-de-dominio.md`.

---

## 5. Dominio y reglas de negocio

Resumen (completo en `docs/domain/modelo-de-dominio.md`):

- **Programa → Cohorte → Inscripción** (ADR 0004). La cohorte elige entre las
  opciones del programa (A1) y congela el costo (A2). Las categorías de
  estudiante se derivan de la inscripción, no son atributos de la persona.
- **Inventario** (ADR 0003): el `tipo` decide el comportamiento (I1);
  variantes por talla o presentación; libro inmutable (I4); stock nunca
  negativo (I2); ajuste y baja con motivo (I3); entrega → un movimiento (I5);
  entrega con contexto explícito y sesión opcional (I6); **cuándo** toca
  entregar es pendiente (I7 / P2).
- **Estudiantes**: no se repite cohorte vigente (E1); inscripciones
  simultáneas permitidas (E2); no se borran, se archivan (E3); paquete solo
  en la carrera (E5).
- **Administración**: pagos y gastos inmutables por sede, en centavos, con
  períodos en `America/La_Paz`. Tablero con seis indicadores accionables y
  ningún gráfico decorativo.

Catálogo vigente (transcrito, validado en el build): Gastronomía (carrera, 3
años, 22 materias, inicio febrero 2027, turnos 08:30/15:00/18:00/especial),
Cocina (1-3 meses), Coctelería (1-2), Repostería y Panadería (2/4/6, turnos
mañana/noche/único), Tortas (2/4/6), Cursos de temporada (práctico/magistral/
virtual). **Todos los costos y uniformes: pendientes.**

---

## 6. Identidad visual y sistema de diseño

Completo en `docs/brand/identidad-visual.md`. Lo esencial:

| | |
|---|---|
| Paleta principal | Azul marino `#1F2447` (estructural) + amarillo lima `#E4E03A` (acción) + blanco. **Aproximados** hasta recibir los oficiales |
| Línea Cursos | Rojo vino `#7A1F2D` (secciones, tarjetas) + rojo vivo `#D9262E` (títulos, promos) |
| Microacento | Franja tricolor boliviana, solo pequeña (logotipo) |
| Tipografía | Kaushan Script (script) + Bebas Neue (display) + Montserrat (cuerpo); script + display juntos en los títulos |
| Motivos | Gorro de chef en línea, rayas de brillo amarillas, brochazo detrás de la palabra clave, ondas entre secciones, checks en círculo, insignias circulares, polaroids |
| Panel | Solo Montserrat; amarillo únicamente en la acción principal; rojo para peligro |

Los tokens viven en `apps/web/src/styles/globals.css` (`--marca-*` →
`--t-*` → utilidades `bg-accion`, `text-estructural`, `bg-cursos`…).

Pendiente de marca (bloquea publicar la web): logotipos vectoriales, hex
oficiales, fotografías propias, logotipos de socios con autorización, enlaces
reales de redes y comunidad de WhatsApp.

---

## 7. Entorno, herramientas y despliegue

| | |
|---|---|
| Máquina | Windows 11, Git Bash y PowerShell. Node 24.10, npm 11.11, pnpm 10.30 (no se usa), Docker 29. **Sin** `gh`, sin Python, sin CLI de Supabase |
| Git | Usuario `ZPSoftwareFastSolutions` · `zapasoftwarefastsolutions@gmail.com`. Credential helper `manager` a nivel de sistema (Git Credential Manager: el push pedirá o reutilizará la cuenta de GitHub); sin tokens en el entorno ni `gh` para crear repositorios |
| Repositorio | Local en `F:\Proyectos\INST_GASTRO`, ramas `main` y `feat/sistema-interno`. **Remoto pendiente**: lo crea el usuario en GitHub (organización de los anteriores: `ZPSoftwareFastSolutions`); después `git remote add origin …` y push. Comprobar `git remote -v` antes de cualquier push |
| Supabase | **Sin proyecto.** Crearlo es acción externa del usuario (coste, credenciales). Existe un MCP de Supabase en la sesión; no se usa para crear proyectos sin que el usuario lo pida |
| Vercel | **Sin proyecto.** Se creará al desplegar la fase 5 o antes si se quiere una vista previa |
| Arranque local | `cd apps/web && npm install && npm run dev` → http://localhost:3000. Sin variables de entorno |
| Vista previa desde el asistente | `.claude/launch.json` → configuración `web` |

---

## 8. Cómo se verifica

```bash
cd apps/web
npm run typecheck     # tsc --noEmit
npm test              # node --test: 73 pruebas de dominio, catálogo y casos de uso
npm run build         # next build; valida además el catálogo académico
npm audit             # debe dar 0
```

```bash
# Dependency Rule (salida vacía)
grep -rnE "from '(@infra|@/presentation|@/app|next|react|@supabase|@contenido)" apps/web/src/core/domain
grep -rn "from '@infra" apps/web/src/core/application
# Colores literales en componentes (salida vacía)
grep -rnE "#[0-9a-fA-F]{6}\b" apps/web/src/presentation apps/web/src/app --include=*.tsx
# Voseo en textos (salida vacía)
grep -rnE "(pagás|tenés|querés|podés|hacés|necesitás|preferís|contanos|\bsos\b)" apps/web/src apps/web/contenido --include=*.ts --include=*.tsx
```

Estado al cierre de la fase 0: **todo en verde** (73/73, typecheck limpio,
build con 2 rutas estáticas, 0 vulnerabilidades, greps vacíos).

Estrategia completa y niveles futuros (RLS, rendimiento, manuales, Lighthouse):
`docs/testing/estrategia-de-pruebas.md`.

---

## 9. Estado del proyecto y pendientes

### Hecho (fase 0)

- Análisis de las 12 imágenes de `FOTOS-GASTRO` → `docs/brand/identidad-visual.md`.
- Análisis de `INFORMACION-INSTITUTO.md` → `docs/analisis/analisis-informacion-instituto.md`.
- Arquitectura CLEAN y 4 ADR → `docs/architecture/`.
- Modelo de dominio con reglas y estados → `docs/domain/modelo-de-dominio.md`.
- Estrategias de pruebas y de ramas → `docs/testing/`, `docs/git/`.
- `apps/web` con Next 16.3.8, tokens de marca, dominio, puertos, catálogo
  estático validado, composition root, 73 pruebas, build estático.
- Repositorio local con `main` y `feat/sistema-interno`.

### Bloqueado por el usuario o el cliente

| # | Qué | Quién |
|---|---|---|
| B1 | Crear el repositorio remoto y hacer push | Usuario |
| B2 | Crear el proyecto Supabase y entregar URL + clave publicable (nunca `service_role`) | Usuario |
| B3 | Responder las preguntas P1–P12 (§11) | Cliente |
| B4 | Entregar logotipos vectoriales, colores oficiales, fotografías, logotipos de socios y enlaces reales | Cliente |
| B5 | Confirmar denominaciones institucionales y discrepancias del folleto (§11) | Cliente |

### Siguiente trabajo (fase 1, rama `feat/sistema-interno`)

1. Añadir `@supabase/ssr` y `@supabase/supabase-js` (exactas) y el cliente de
   servidor con cookie `HttpOnly`.
2. Migraciones: `sedes`, identidad (`app_users`, roles, permisos, `user_sedes`),
   funciones `app.*`, RLS y semilla de roles. Batería RLS con sesión simulada.
3. Login (`/panel/acceso`) y guardas de página y acción.
4. Después, fase 2 (inventario): tablas `categorias`, `articulos`, `variantes`,
   `movimientos`, `entregas`; vista de stock; repositorio Supabase que implemente
   `InventarioRepositoryPort`; pantallas de artículos, movimientos y entregas.

### Deuda reconocida

- Sin ESLint ni CI (`typecheck`/`test`/`build`/`audit` a mano).
- Catálogo académico en archivo estático hasta que viva en la base.
- `Sesion` definida en el modelo pero sin implementar (P2, P10).
- Página provisional `/` debe sustituirse por el sitio real (fase 5).

---

## 10. Decisiones importantes

| Decisión | Dónde |
|---|---|
| Stack heredado de GYM PLATFORM; una sola app Next para ambos sistemas; sin multi-tenant | ADR 0001 |
| Supabase Auth + RLS; Usuario → Rol → Permiso; alcance por sede | ADR 0002 |
| Inventario: tipo con comportamiento, variantes, libro inmutable, entrega con contexto | ADR 0003 |
| Programa → Cohorte → Inscripción; costo congelado; categorías derivadas | ADR 0004 |
| Nombres de dominio en español; carpetas de capa en inglés | §2.1 |
| Importes en centavos enteros; fechas `AAAA-MM-DD`; zona `America/La_Paz` | §2.2, modelo C3–C4 |
| `Pendiente`/`Definido<T>` para lo que la institución no ha definido | §2.2 |
| Tres familias tipográficas (no cuatro): la línea Cursos se distingue por color | docs/brand §4.2 |
| Next 16.3.8 (no 16.3.4) por CVE crítica | §2.7 |
| `CLAUDE.md` en mayúsculas (el encargo dice `claude.md`; Windows no distingue y Claude Code lo carga así) | este archivo |
| `FOTOS-GASTRO/` e `INFORMACION-INSTITUTO.md` se versionan en el repositorio como fuentes | §0 |

---

## 11. Riesgos y ambigüedades detectadas

### Preguntas abiertas para el cliente (detalle en `docs/analisis` §6)

| # | Pregunta | Bloquea |
|---|---|---|
| P1 | Piezas y tallas de cada uniforme (carrera y cursos) | Variantes de uniformes |
| P2 | Cuándo se entrega el uniforme (inscripción, sesión, pago) y si hay reposiciones | Automatizar entregas; entidad `Sesion` |
| P3 | ¿El instituto almacena insumos? ¿Unidades? | Alcance de insumos |
| P4 | ¿Los utensilios se prestan y devuelven? | Dos booleanos en `COMPORTAMIENTO_POR_TIPO` |
| P5 | Importes de paquetes, uniforme y cursos | Publicar costos; cobros |
| P6 | Qué incluye cada paquete (Económico / Ahorrador) | Modelo de pagos de la carrera |
| P7 | Medios de cobro y quién registra | Módulo de pagos |
| P8 | Qué gastos quiere ver | Alcance de gastos |
| P9 | Usuarios y roles reales; cuentas por sede | Semilla de roles |
| P10 | ¿Se registra asistencia por sesión? | `Sesion` |
| P11 | Fechas y horarios concretos de los cursos | Cohortes iniciales; contenido web |
| P12 | Dominio web y correo institucional | Despliegue, SEO |

### Discrepancias entre folleto y documento (detalle en `docs/brand` §11)

Denominación del instituto (tres variantes + parche «TEC-NIB»); «650»
manuscrito en costo y uniforme (no se usa); «800 profesionales», «+16 áreas»,
convenios BTH/Técnico Medio (no están en el documento); «+15 años» frente a
«16 años»; socios «Alt Paocha/Alí Pacha», «La Carindera/La Cordobesa»,
«Auroras/Aurora», «UNIGEN/UNICEN»; referencia extra en la dirección de El Alto.

### Riesgos técnicos

- Colores y tipografías **aproximados**: si los oficiales difieren mucho, se
  cambian los `--marca-*` (un solo archivo).
- Logotipos de terceros: no publicar sin archivo y autorización.
- `next/font` descarga las fuentes en el build: sin red, el build falla.
- Lecciones heredadas de GYM PLATFORM que hay que respetar al escribir SQL
  (políticas por fila lentas, `upsert` sobre columnas sin grant, RPC que
  nombran columnas no concedidas, `loading.tsx` sobre rutas con guardas):
  `F:\Proyectos\GoldGym\SoftwareGym\CLAUDE.md` §10.

---

## 12. Problemas detectados y soluciones aplicadas

| Problema | Causa | Solución |
|---|---|---|
| Los heredocs de Bash fallaban al escribir documentos | El envoltorio del comando no soporta apóstrofos en el contenido («Manq'a», `'Única'`) | Escribir archivos con la herramienta de escritura, no con heredocs |
| `npm audit`: 1 vulnerabilidad crítica | `next@16.3.4` (RCE en `next/og`, GHSA-vcvr-r3jv-pc5j) | `next@16.3.8` exacto; audit en 0 |
| Un archivo de pruebas fallaba al cargar | `constructor(private readonly x)` no lo admite el modo «solo quitar tipos» de Node | Campo declarado + asignación en el constructor; regla en §2.2 |

---

## 13. Historial

| Fecha | Rama | Qué |
|---|---|---|
| 2026-09-30 | `main` | Fase 0: análisis visual e institucional, arquitectura CLEAN (4 ADR), modelo de dominio, estrategias de pruebas y ramas, `apps/web` con dominio inicial (73 pruebas), tokens de marca, catálogo validado, página provisional. Repositorio local creado; rama `feat/sistema-interno` abierta |

---

## 14. Cómo continuar en la próxima sesión

1. Leer §0, §9 y `TASKS.md`.
2. `cd apps/web && npm install && npm run typecheck && npm test && npm run build && npm audit`.
3. Comprobar `git status` y `git branch`: trabajar en `feat/sistema-interno`.
4. Si hay respuestas del cliente (P1–P12) o archivos de marca: actualizar
   `oferta-academica.ts`, `contenido/instituto.ts`, `globals.css` y los docs
   correspondientes **antes** de seguir con código.
5. Si existe el proyecto Supabase: fase 1 (§9). Si no: se puede avanzar en
   dominio y pruebas de estudiantes/administración, o en la página web
   (`feat/pagina-web`) con el contenido ya validado.
6. Al cerrar: `TASKS.md` con validaciones anotadas y este archivo (§9, §13).
