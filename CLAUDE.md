# CLAUDE.md — Sistemas web de Corporación Bolivia Gourmet

> Archivo de contexto persistente. Claude Code lo carga al abrir una sesión en
> este repositorio. **Describe el proyecto tal como está HOY**, no cómo se
> llegó hasta aquí. Una sesión nueva debe poder continuar el trabajo leyendo
> este archivo, `TASKS.md`, `INFORMACION-INSTITUTO.md`,
> `docs/analisis/aclaraciones-2026-10-01.md` y `docs/`, sin depender del
> historial de conversaciones.
>
> - **Última actualización:** 2026-10-01 · **Entrega 3** (mejoras pedidas tras
>   la presentación): logotipos de socios en carrusel (inicio) y panal
>   (convenios), universidades con logotipo, cursos y emprende unidos en
>   `/cursos`, mapas de las sedes con los enlaces del usuario y sin huecos entre
>   secciones; 124 pruebas. Entrega 2: GitHub, Supabase con RLS (39 pruebas),
>   web y portal con CSP estricta; cuentas de demostración cargadas y probadas.
>   Contexto de la conversación que no está en otros documentos: §15 y §16.
> - **Rama de la web:** `feat/pagina-web` (sale de `main`; ver §16.1 para el
>   último commit y si está publicado). **Rama del sistema interno:** `feat/sistema-interno`
>   (igual a `main` en `25500d8`, sin trabajo propio aún). **`feat/pagina-web`
>   NO está fusionada con `main`**: espera la aprobación del usuario.
> - **Regla de mantenimiento:** se actualiza al cerrar cada avance importante
>   y al final de cada sesión. Cambian sobre todo §9 (estado y pendientes) y
>   §13 (historial).

---

## 0. Para una sesión nueva: lo esencial en un minuto

| | |
|---|---|
| **Qué es** | Dos sistemas para **una** institución: (1) **sistema interno de gestión** (inventario, estudiantes, inscripciones, entregas, cobros, contabilidad) y (2) **página web** con un **portal de estudiantes** (registro, solicitud de inscripción y de renovación, estado, pago por QR). Misma base de código e identidad. |
| **Cliente** | **TEC-NIB** (Instituto Técnico Nacional de la Integración Boliviana) es la institución madre; **Corporación Bolivia Gourmet** es su área de gastronomía; **Bolivia Gastronómica** es la marca del instituto. Sedes: La Paz (Miraflores) y El Alto (La Ceja). |
| **Stack** | Next.js 16.3.8 · React 19.1 · TypeScript 5.9 estricto · Tailwind v4 · Supabase (`@supabase/ssr` 0.12.7, `supabase-js` 2.117.2) · `node --test` |
| **Repositorio** | https://github.com/ZPSoftwareFastSolutions/Bolivia-Gourmet |
| **Base de datos** | Supabase `Bolivia-Gourmet`, ref `bnobhnmurzsnffdrxeck`, `sa-east-1`, plan gratuito. 5 tablas, todas con RLS |
| **Estado** | Web pública (8 páginas + 5 de cursos; `/emprende` redirige a `/cursos`) y portal (7 páginas) **funcionando en local**, verificados. Cuentas de demostración cargadas (§4). Sin desplegar. Sistema interno: solo dominio, sin pantallas |
| **Fuentes de verdad** | `INFORMACION-INSTITUTO.md` + `docs/analisis/aclaraciones-2026-10-01.md` (datos), `FOTOS-GASTRO/` + `FOTOS-WEB/` + `docs/brand/identidad-visual.md` (identidad), `docs/domain/modelo-de-dominio.md` (reglas), `docs/architecture/` (decisiones), `TASKS.md` (avance) |
| **Siguiente** | 0) Esperar la respuesta del cliente sobre precios y detalles de cursos y licenciatura (pedida por correo); el usuario avisará para seguir con el portal · 1) Que configure Supabase Auth (§9, E2.D1) y pruebe el registro real · 2) Que confirme las decisiones de §16.3 · 3) Pedir al cliente los recursos de `aclaraciones §8` · 4) Aprobar la web y fusionar `feat/pagina-web` en `main` · 5) Desplegar en Vercel cuando el usuario lo pida · 6) Sistema interno (`feat/sistema-interno`): panel de recepción y administración |

**Antes de tocar nada, léase:** §2 (reglas), §3 (arquitectura), §4 (base de
datos), §9 (pendientes) y §11 (ambigüedades).

**Reglas que no se rompen:**

1. **La información institucional no se inventa.** Lo `[Consultar]` es
   `PENDIENTE` en el código y «Consultar» en pantalla. Un dato pasa a definido
   solo si lo confirma el usuario o el cliente, y se anota de dónde salió.
2. **La identidad visual sale de los folletos y de los logotipos oficiales.**
   Nada de diseño genérico. Los logotipos solo sobre fondo claro.
3. **Dependency Rule.** `core/domain` no importa nada de fuera; `application`
   no importa `infrastructure`; solo el composition root construye adaptadores.
4. **Sin `'unsafe-inline'`.** Ningún atributo `style`, ningún `next/image`,
   ningún script en línea propio. El navegador no habla con Supabase.
5. **La autorización vive en la base (RLS).** Todo registro web es
   `estudiante`; el rol nunca sale de los metadatos del usuario.
6. **Verificar probando, no leyendo** (§8). Una tarea no está terminada hasta
   que se verificó y se anotó cómo.
7. **Cero secretos en el repositorio.** `service_role` jamás. No se crean
   cuentas con contraseña en servicios remotos desde el asistente.

---

## 1. Objetivo del proyecto

| Sistema | Objetivo | Estado |
|---|---|---|
| **Página web** | Presentación institucional, carrera, cursos de capacitación (con «¿Sueñas emprender?»), convenios con logotipos (carrusel y panal), contacto con mapas, sedes y redes, fiel a la identidad del folleto | ✅ Completa en `feat/pagina-web`, verificada en escritorio y móvil |
| **Portal de estudiantes** (parte de la web) | Registro, acceso, recuperación de clave, solicitud de inscripción, solicitud de renovación, estado de solicitudes, información de pago por QR | ✅ Implementado y probado hasta donde no exige crear cuentas reales (§9) |
| **Sistema interno** | Recepción (informar oferta, cupos, precios; inscribir; inventario) y administración (todo + contabilidad) | Dominio de inventario, académico y estudiantes con pruebas; tablas de identidad listas; sin pantallas |

Roles (ADR 0005): **administrador** y **recepción** en el sistema interno;
**estudiante** en el portal. Medio de cobro: **QR**.

Evolución:

```text
Fase 0 ✅  Análisis, arquitectura, documentación, dominio con pruebas
Entrega 2 ✅  GitHub, Supabase + RLS, aclaraciones, web pública + portal + seguridad
Fase 1     Interno · panel con login de personal, bandeja de solicitudes (recepción)
Fase 2     Interno · inventario (artículos, variantes, movimientos, entregas)
Fase 3     Interno · estudiantes, cohortes, inscripciones (desde solicitudes aprobadas)
Fase 4     Interno · contabilidad (pagos por QR, gastos, tablero)
Fase 5     Web · despliegue, dominio, SEO, QR de pago en el portal
```

---

## 2. Reglas de estilo y código

### 2.1 Idioma

| Elemento | Idioma |
|---|---|
| Comentarios y documentación | **Español** |
| Nombres de dominio y componentes (`Articulo`, `validarSolicitud`, `TituloDeSeccion`) | **Español** (sin tildes en identificadores) |
| Carpetas de capa (`core/domain`, `application`, `infrastructure`, `presentation`) | Inglés técnico (herencia del equipo) |
| Tablas y columnas SQL | Español (`solicitudes`, `programa_codigo`); funciones en `app.*` en español |
| Textos visibles | **Español neutro de Bolivia** en segunda persona: «elige», «puedes». **Sin voseo.** |
| Mensajes de commit | Español, con cuerpo que explica **por qué** |

Cada archivo abre con un bloque `CAPA: …`. Los comentarios explican el porqué.

### 2.2 TypeScript

- `strict` + `noUncheckedIndexedAccess`. Cero `any`. `readonly` por defecto.
- Marcas nominales (`Id`, `Centavos`, `FechaISO`). Importes en **centavos enteros**.
- Datos no definidos: `Pendiente` / `Definido<T>`; `formatearMonto` muestra «Consultar».
- Validadores devuelven `Resultado<T, E>` con **todos** los errores.
- **Sin «parameter properties»** (`constructor(private x)`): Node ejecuta las pruebas quitando tipos y no las admite.
- Alias: `@/*`, `@core/*`, `@infra/*`, `@ui/*`, `@patterns/*`, `@sections/*`, `@contenido/*`.

### 2.3 Arquitectura — Dependency Rule

```text
presentation / app  →  application  →  domain
                            ↑
                 infrastructure (implementa los puertos)
```

Comprobación en §8. Solo `infrastructure/config/composition-root.ts` construye
adaptadores; los de Supabase se crean **por petición** con la cookie de quien
pregunta.

### 2.4 Componentes y estilos

- **Server Components por defecto.** Cliente solo en: `MenuMovil`,
  `NavegacionPrincipal` (sección activa), `MapaBajoDemanda`, piezas de
  formulario (`BotonEnviar`, `CampoClave`, `ResumenDeErrores`) y los
  formularios del portal (`useActionState`).
- Variantes como **enum**. Átomos en `presentation/ui` sin dominio.
- **Nunca un color literal** en componentes: tokens (`bg-accion`, `text-estructural`, `bg-cursos`…). Única excepción: `COLOR_DE_TEMA` en `lib/marca.ts` (meta theme-color).
- **El amarillo siempre lleva azul marino encima** (`bg-accion text-sobre-accion`).
- Clases propias de `globals.css` **dentro de `@layer components`** (fuera de capa ganan a toda utilidad) y resets en `@layer base`.
- **No pasar a un componente una utilidad que compita con las suyas** (`hidden` sobre un botón `inline-flex` no lo oculta): envolver en `<span className="hidden sm:contents">`. Así se corrigió el desbordamiento móvil de la cabecera.
- Imágenes: componente `Foto` (`srcset`, `width`/`height` reales, `relleno` para llenar contenedores). Logotipos: `Logos` (alturas responsivas por clase).
- Iconos: `presentation/icons/Icono.tsx`, set propio (retícula 24, trazo 2, `currentColor`; trazados basados en Lucide, ISC).

### 2.5 Accesibilidad — no negociable

Foco visible, 44 px táctiles, «Saltar al contenido», `aria-current` en
navegación y migas, un `h1` por página, `alt` en toda imagen (decorativas
`alt=""`), formularios con etiqueta visible, error bajo el campo
(`aria-describedby`), resumen de errores enfocable, botón para mostrar la
contraseña, `prefers-reduced-motion`.

### 2.6 Seguridad

Ver `docs/architecture/seguridad.md` y ADR 0006. Resumen: CSP con nonce,
HSTS, `frame-ancestors 'none'`, cookies `HttpOnly`/`SameSite=Lax`, sesión
comprobada en cada página y cada Server Action con `getUser()`, redirecciones
por `destinoSeguro()`, errores traducidos por código, recuperación de clave
que no revela si el correo existe.

### 2.7 Dependencias (versiones exactas)

| Dependencia | Por qué |
|---|---|
| `next` 16.3.8, `react`/`react-dom` 19.1.1 | Framework (16.3.4 tenía una CVE crítica) |
| `@supabase/ssr` 0.12.7, `@supabase/supabase-js` 2.117.2 | Auth con cookie y datos bajo RLS, solo en servidor |
| `tailwindcss` + `@tailwindcss/postcss` 4.1.14, `typescript` 5.9.3 | Estilos y lenguaje |
| `sharp` 0.35.5 (dev) | `npm run imagenes`: optimiza `FOTOS-WEB` |

### 2.8 Git

Ramas por **sistema** (`main`, `feat/sistema-interno`, `feat/pagina-web`),
nunca por botón. Commits en español con el porqué y
`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Push solo cuando el
usuario lo pide. Detalle: `docs/git/estrategia-de-ramas.md`.

### 2.9 Forma de trabajar con el asistente

- Probar antes de dar por hecho (§8). Capturas reales en escritorio y móvil.
- **El asistente no crea cuentas ni escribe contraseñas en servicios
  remotos** (Supabase incluido). El registro y el acceso reales los prueba el
  usuario. Las pruebas de RLS usan usuarios simulados en una transacción que
  se revierte.
- Ante un dato que falta: `Pendiente`, documentarlo, no inventarlo.

---

## 3. Arquitectura actual

### 3.1 Vista general

```text
 Navegador ──► Next.js 16 (local; Vercel pendiente)
               ├─ proxy.ts ───────── CSP con nonce en cada página; renueva la sesión en /portal y /auth
               ├─ (publico)/ ─────── sitio informativo (dinámico por el nonce; datos del catálogo estático)
               ├─ portal/ ────────── registro, acceso, panel, solicitudes (Server Components + Server Actions)
               └─ auth/confirmar ─── canje de enlaces de correo (PKCE / token_hash)
                        │  cliente de servidor con la cookie HttpOnly del usuario (nunca service_role)
                        ▼
               Supabase Bolivia-Gourmet (sa-east-1)
               ├─ Auth ─────── cuentas; disparador crea el perfil como «estudiante»
               └─ PostgreSQL ─ sedes · perfiles · permisos_de_rol · programas · solicitudes (RLS en todas)
```

### 3.2 Mapa del código (`apps/web`)

```text
contenido/
  instituto.ts            TEC-NIB, nombres, lema y lemas secundarios, pilares, emprende, redes, pago (QR)
  convenios.ts            17 aliados y 4 universidades (nombres del usuario, orden del folleto, logotipo de cada uno)
  imagenes.ts             texto alternativo de cada foto oficial
  imagenes.generadas.ts   dimensiones de fotos y de los hexágonos de socios (lo escribe `npm run imagenes`)
public/img/               WebP optimizados de FOTOS-WEB + og.jpg + socio-<logo>-{200,400}.webp (hexágonos)
scripts/                  optimizar-imagenes.mjs · capturar-pagina.mjs · auditar-espacios.mjs (huecos entre secciones)
src/
  proxy.ts                CSP con nonce + renovación de sesión (no autoriza)
  app/
    layout.tsx            fuentes, metadatos, noindex, connection() (todo dinámico)
    not-found.tsx · robots.ts · icon.png · apple-icon.png
    (publico)/            layout (cabecera, pie, WhatsApp) · inicio · nosotros · carrera · cursos (+ emprende) · cursos/[codigo]
                          · convenios · contacto · privacidad   (/emprende → 308 a /cursos)
    portal/               layout · page (panel) · acceso · registro · recuperar · nueva-clave · solicitud · renovacion
      actions.ts          Server Actions (cada una vuelve a exigir sesión)
      _sesion.ts          exigirSesion / salirSiHaySesion (React cache)
      _componentes/       formularios, marco de acceso, panel, página de solicitud
    auth/confirmar/route.ts
  core/
    domain/               shared · academico/programa (formatearMonto) · estudiantes · inventario
                          · identidad/credenciales, rol · portal/solicitud
    application/          ports (catálogo, inventario, autenticación, portal) · inventario · portal (acceso, solicitudes)
  infrastructure/
    config/composition-root.ts
    catalogo/             oferta académica validada en el build
    supabase/             configuracion · cookies · cliente-servidor · autenticacion · portal · errores · tipos generados
  presentation/
    icons/Icono.tsx · ui/ (Boton, Foto, Logos, LogoHexagonal, Marca) · patterns/ (Cabecera, Pie, menús, mapa, redes, WhatsApp)
    sections/ (Hero, Institucion, Oferta, Convenios [carrusel, panal, universidades], panal.ts, Llamadas) · formularios/ · programas.ts
  lib/                    cn · rutas · redirecciones · politica-de-contenido · fechas · marca
  styles/globals.css      tokens de marca y semánticos; @layer base y @layer components
tests/                    124 pruebas (node --test)
```

### 3.3 Flujos del portal

| Flujo | Recorrido |
|---|---|
| Registro | `/portal/registro` → `registrarse` → dominio valida → `signUp` con `emailRedirectTo=/auth/confirmar?siguiente=/portal` → «revisa tu correo» (o panel si la confirmación está desactivada) |
| Confirmación | Enlace del correo → `/auth/confirmar?code=` → `exchangeCodeForSession` → `/portal`. Si la URL de retorno no está autorizada, Supabase vuelve a `/?code=` y la portada lo reenvía |
| Acceso | `/portal/acceso` → `signInWithPassword` → `destinoSeguro(siguiente)` |
| Recuperación | `/portal/recuperar` → enlace → `/auth/confirmar?siguiente=/portal/nueva-clave` → `updateUser` |
| Solicitud | `/portal/solicitud` → paso 1 programa (`?programa=`) → paso 2 solo con las opciones de ese programa → dominio valida → insert bajo RLS → panel |
| Renovación | `/portal/renovacion`: igual, con «gestión anterior» obligatoria |
| Cancelación | Solo `pendiente`; el dominio y el disparador de la base lo exigen |

---

## 4. Base de datos (Supabase)

**Proyecto** `Bolivia-Gourmet` · ref `bnobhnmurzsnffdrxeck` · PostgreSQL 17 ·
`sa-east-1` · organización «Z&P Software Fast Solutions» (free). Conector de
Supabase disponible en la sesión.

| Tabla | Qué guarda | Quién lee | Quién escribe |
|---|---|---|---|
| `sedes` | 2 sedes | todos (activas) | nadie por API |
| `perfiles` | perfil de cada cuenta (rol, nombres, contacto) | uno mismo; `perfiles.leer` | uno mismo (nombres, contacto); rol/estado/sede solo `perfiles.gestionar` |
| `permisos_de_rol` | permisos de administrador (6) y recepción (3) | el propio rol | nadie por API |
| `programas` | 6 programas (referencia de FK) | todos (activos) | `programas.gestionar` |
| `solicitudes` | inscripciones y renovaciones del portal | el propio estudiante; `solicitudes.leer` | alta propia (columnas concedidas); cancelar propia pendiente; decidir con `solicitudes.gestionar` |

Funciones `app.*` (fuera de la API): `tiene_permiso`, `rol_actual`,
`crear_perfil_de_usuario` (disparador de alta), `sincronizar_correo_de_perfil`,
`proteger_perfil` (rol y último administrador), `validar_alta_de_solicitud`
(estado inicial, programa activo, paquete solo en carrera, sin duplicados,
máximo 5 abiertas), `validar_cambio_de_solicitud` (transiciones).

Migraciones y reglas: `supabase/migrations/README.md`. Batería:
`docs/runbooks/pruebas-rls-entrega2.sql` (39/39). Tipos:
`src/infrastructure/supabase/tipos-de-base.generados.ts` (regenerar tras cada migración).

**Promover al primer administrador** (no hay pantalla para autoasignarse un
rol; se hace desde el editor SQL de Supabase, sin sesión de usuario):

```sql
update public.perfiles set rol = 'administrador'
where id = (select id from auth.users where email = 'correo-del-administrador@ejemplo.com');
```

### Cuentas de demostración (`supabase/seed/`, no son migraciones)

| Cuenta | Correo | Rol | Escenario |
|---|---|---|---|
| Carla Gutiérrez | `carla.gutierrez@boliviagourmet.test` | administrador | Aprobó las tres gestiones de Camila |
| Rosa Condori | `rosa.condori@boliviagourmet.test` | recepcion | Aprobó la inscripción de Diego |
| Valeria Choque | `valeria.choque@boliviagourmet.test` | estudiante | Nueva: panel vacío |
| Diego Mamani | `diego.mamani@boliviagourmet.test` | estudiante | 1.er año (2026) aprobado; pide su renovación |
| Camila Quispe | `camila.quispe@boliviagourmet.test` | estudiante | 3.er año: inscripción 2024 + renovaciones 2025 y 2026 |

- Contraseña común: **no se versiona** (el repositorio es público). Está en
  `supabase/seed/datos-demo.local.sql` (ignorado por git) y la tiene el usuario.
- Cargar: pegar `datos-demo.local.sql` en el editor SQL de Supabase. Ensayar
  antes con `c_simular := true` (lo revierte todo). Es idempotente.
- Reiniciar la demo: `borrar-datos-demo.sql` y volver a cargar.
- El dominio `.test` no recibe correo: «recuperar contraseña» no sirve con
  estas cuentas.
- Las cuentas del personal entran al portal y ven el aviso de «panel en
  construcción»: el sistema interno aún no tiene pantallas.
- **Antes de producción, borrarlas** (`borrar-datos-demo.sql`): la cuenta de
  administración tiene una contraseña conocida.

---

## 5. Dominio y reglas de negocio

Completo en `docs/domain/modelo-de-dominio.md`. Lo nuevo de esta entrega:

- **Solicitud** (`core/domain/portal/solicitud.ts`): pide exactamente las
  opciones del programa (turno, días, duración si hay más de una, modalidad,
  paquete solo en la carrera); la carrera fija sola sus 3 años; la renovación
  exige «gestión anterior»; sin duplicados abiertos; máximo 5 abiertas; solo
  se cancela lo pendiente. La base repite todo.
- **Credenciales**: contraseña de 10+ caracteres con letras y números, sin
  palabras triviales ni el correo; permite pegar y gestores de contraseñas.
- **Catálogo**: Gastronomía con Paquete Económico Bs 650 y uniforme Bs 650
  (Ahorrador y cursos: pendientes).

---

## 6. Identidad visual y sistema de diseño

Completo en `docs/brand/identidad-visual.md` (§14: logotipos oficiales
medidos; §15: aporte de las skills `ui-ux-pro-max`, `brand` y `design`).

| | |
|---|---|
| Paleta | Azul marino `#1F2447` (estructural) + amarillo lima `#E4E03A` (acción) + blanco; rojo vino `#7A1F2D` para la línea de cursos; tricolor medido en el logotipo (`#FF0025` · `#FFFF14` · `#00C12E`) solo como microacento |
| Tipografía | Kaushan Script + Bebas Neue + Montserrat (autoalojadas) |
| Motivos | Panal hexagonal de logotipos (`.panal`, `.carrusel-panal`, docs/brand §16), `.marca-resaltado` (brochazo), `.marca-subrayado`, `.marca-rayas`, `.polaroid`, `.bloque-desplazado`, `.franja-tricolor`, `SeparadorOndulado`, `Insignia`, `ListaConCheck`, `TituloDeSeccion` (script + display) |
| Patrón de página | «Trust & Authority + Conversion»: credibilidad → pruebas → oferta → acción repetida |

---

## 7. Entorno, herramientas y despliegue

| | |
|---|---|
| Máquina | Windows 11, Git Bash, PowerShell, Node 24.10, npm 11.11, Docker 29, Edge. **Sin** Python (las skills que lo piden se ejecutan con `docker run python:3.12-alpine`), sin `gh`, sin CLI de Supabase |
| Git | `ZPSoftwareFastSolutions`. Remoto `origin` = https://github.com/ZPSoftwareFastSolutions/Bolivia-Gourmet.git; las tres ramas siguen a su rama remota. **El push depende del Git Credential Manager de Windows**: a veces pide iniciar sesión con una ventana que el asistente no puede usar. Si un push falla por credenciales (`could not read Username`), no insistir: pedir al usuario que ejecute `git push` en su terminal. Leer (`ls-remote`, `fetch`) sí funciona. Comprobar `git ls-remote --heads origin` antes de afirmar que algo no está publicado |
| Variables | `apps/web/.env.local` (no versionado) con `NEXT_PUBLIC_SUPABASE_URL=https://bnobhnmurzsnffdrxeck.supabase.co` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (empieza por `sb_publishable_`; se obtiene con el conector `get_publishable_keys`). Plantilla en `.env.example`. `NEXT_PUBLIC_SITE_URL` obligatoria al desplegar. **Cuidado:** copiar la plantilla encima deja valores de ejemplo (`https://<ref>.supabase.co`) y el portal deja de conectar; `configuracionSupabase()` los rechaza y falla cerrado. Pasó una vez el 2026-10-01 y se restauró |
| Arranque | `cd apps/web && npm install && npm run dev`. Producción local: `npm run build && npm run start` |
| Vista previa del asistente | `.claude/launch.json`: `web` (dev) y `web-produccion` (start), con puerto automático (el 3000 lo usa Docker) |
| Capturas reales | `node scripts/capturar-pagina.mjs <url> <ancho> <salida.png> [movil]` (desde `apps/web`): Edge por CDP con emulación de dispositivo; informa desbordamiento y errores de consola. Edge sin interfaz «normal» impone ~500 px y recorta. **Huecos entre secciones:** `node scripts/auditar-espacios.mjs <url> <ancho> movil/- [captura.png]` (tramos vacíos; `fondoUniforme: true` = hueco visible). Ambos cierran Edge por CDP y borran su perfil temporal: un script propio que lance Edge debe hacer lo mismo (el 2026-10-01 quedaron 417 procesos y el disco C: casi lleno) |
| Vercel | Sin proyecto. Desplegar solo cuando el usuario lo pida (`regions: ["gru1"]`, variables de entorno de Supabase y `NEXT_PUBLIC_SITE_URL`) |

---

## 8. Cómo se verifica

```bash
cd apps/web
npm run typecheck     # tsc --noEmit
npm test              # 124 pruebas: dominio, catálogo, casos de uso, portal, convenios, seguridad, coherencia SQL
npm run build         # todas las páginas dinámicas + proxy
npm audit             # 0
```

```bash
# Dependency Rule, colores, voseo, secretos (salida vacía)
grep -rnE "from '(@infra|@/presentation|@/app|next|react|@supabase|@contenido)" apps/web/src/core/domain
grep -rn "from '@infra" apps/web/src/core/application
grep -rnE "#[0-9a-fA-F]{6}\b" apps/web/src --include=*.tsx
grep -rnE "(pagás|tenés|querés|podés|hacés|necesitás|preferís|contanos|\bsos\b)" apps/web/src apps/web/contenido --include=*.ts --include=*.tsx
grep -rnE "service_role.*=.*ey|sb_secret_|eyJhbGciOi" apps/web/src apps/web/contenido supabase docs
```

Tras cambiar la maquetación: `scripts/auditar-espacios.mjs` en cada ruta a 1440 y 375 (ningún tramo con `fondoUniforme: true` entre secciones). Tras desplegar o cambiar seguridad: `curl -I` de cada ruta (tabla en
`docs/architecture/seguridad.md` §2–3). Tras cambiar la base: batería RLS y
`get_advisors(security)` y `(performance)`.

Estado al cierre de la entrega 2: **todo en verde** (115/115, tipos limpios,
build, audit 0, greps vacíos, RLS 39/39, advisors de seguridad sin avisos,
sin desbordamiento horizontal en 375 px, consola sin violaciones de CSP).

---

## 9. Estado del proyecto y pendientes

### Hecho

- Fase 0 (análisis, arquitectura, dominio).
- Entrega 2: remoto GitHub; `FOTOS-WEB` versionado y optimizado; Supabase
  creado con 4 migraciones y RLS; aclaraciones aplicadas al catálogo y al
  contenido; web pública y portal; escudos de seguridad; ADR 0005 y 0006;
  cuentas de demostración cargadas y probadas por el usuario (E2.D4).
- Entrega 3 (TASKS.md): logotipos de socios y universidades, carrusel y
  panal, cursos + emprende en `/cursos`, mapas con los enlaces del usuario,
  auditoría y corrección de huecos entre secciones.

### Pendiente del usuario

| # | Qué | Cómo |
|---|---|---|
| E2.D1 | **Configurar Supabase Auth** para que los correos vuelvan al sitio. Estado real (2026-10-01): confirmación de correo activada, registro abierto, solo proveedor de correo | Panel de Supabase → Authentication → URL Configuration: *Site URL* = URL del sitio (en local, la del servidor de desarrollo) y en *Redirect URLs* añadir `<sitio>/auth/confirmar`. El servidor de correo gratuito **solo entrega a miembros del equipo**: para estudiantes reales, configurar SMTP propio (Authentication → Emails → SMTP) o, para la demostración, desactivar *Confirm email* (Authentication → Sign In / Providers → Email) |
| E2.D3 | ~~Push de los commits locales~~ | **Hecho** por el usuario el 2026-10-01: las tres ramas están en GitHub con los mismos commits que en local |
| — | Aprobar la web y fusionar | `git checkout main && git merge feat/pagina-web` (y luego actualizar `feat/sistema-interno` desde `main`) |
| E2.D4 | ~~Cargar las cuentas de demostración~~ | **Hecho**: 5 cuentas cargadas; Camila, Diego y Valeria ya iniciaron sesión. **Borrarlas antes de producción** (`borrar-datos-demo.sql`) |
| — | Respuesta del cliente sobre precios y detalles de cursos y licenciatura | Pedida por correo el 2026-10-01; el usuario avisa. Hasta entonces, «Consultar» |
| — | Push de los commits de la entrega 3 | `git push origin feat/pagina-web` (§16.1) |
| — | Desactivar las claves API heredadas (JWT `anon`/`service_role`) | Una `service_role` se pegó en el chat el 2026-10-01: darla por filtrada. Project Settings → API Keys → Legacy API keys. La web solo usa la clave publicable, no se ve afectada |
| — | Promover al primer administrador real cuando exista su cuenta | SQL de §4 |
| — | Desplegar en Vercel | Cuando el usuario lo pida |

### Pendiente del cliente (`docs/analisis/aclaraciones-2026-10-01.md` §8)

Precios y detalles de cursos y licenciatura (pedidos el 2026-10-01) ·
logotipos en blanco o SVG · QR bancario · fotos de cursos cortos, productos y
sede de El Alto · foto del Chef Oscar Mora · enlaces de Facebook, YouTube y
comunidad de WhatsApp · confirmar «UB = Unión Bolivariana» y si los Bs 650
son mensuales. (Logotipos de socios: recibidos.)

### Siguiente trabajo técnico

1. Sistema interno, fase 1: login de personal (`/panel`), bandeja de
   solicitudes para recepción (leer, poner en revisión, aprobar, rechazar con
   respuesta) usando los permisos ya creados.
2. Inventario (fase 2) y contabilidad con pagos por QR (fase 4).
3. Web: QR de pago en el portal cuando llegue; dominio, `NEXT_PUBLIC_SITE_URL`,
   quitar `noindex`, `sitemap.xml`.

### Deuda reconocida

- Sin CI ni ESLint (comprobaciones a mano, §8).
- Catálogo académico en archivo estático (la tabla `programas` solo es referencia).
- Aviso de privacidad en borrador, a revisar por el cliente.
- A 320 px la portada desborda 14 px por la sección de cifras y el botón
  flotante de WhatsApp abierto mide más que la pantalla (anterior a la
  entrega 3; no se tocó por estar fuera del pedido).

---

## 10. Decisiones importantes

| Decisión | Dónde |
|---|---|
| Stack heredado; una sola app para ambos sistemas; sin multi-tenant | ADR 0001 |
| Supabase Auth + RLS; permisos por rol en tabla | ADR 0002 |
| Inventario por tipo con libro inmutable | ADR 0003 |
| Programa → Cohorte → Inscripción | ADR 0004 |
| Tres roles fijos; portal de estudiantes en la web; todo registro es estudiante | ADR 0005 |
| CSP con nonce, todo dinámico, sin `style` ni `next/image`, sesión solo en servidor | ADR 0006 |
| Sin formulario de contacto anónimo (WhatsApp por sede) | ADR 0006 §8 |
| Bs 650 sin periodicidad hasta que se aclare | aclaraciones §4 |
| «Universidad Unión Bolivariana» (logotipo y documento) frente a «Unión Boliviana» (mensaje del usuario) | aclaraciones §6 |
| Mapa de Google solo al pulsar, centrado en el lugar de Google Maps de cada sede (enlaces del usuario) | `MapaBajoDemanda`, `Sede.ubicacion` |
| Cursos de capacitación y «¿Sueñas emprender?» en una sola página (`/cursos`); `/emprende` redirige | Pedido del usuario 2026-10-01 (son aparte de la carrera) |
| Logotipos de socios publicados como hexágonos horneados (sin color por socio en CSS) | docs/brand §16 |
| Carrusel sin flechas pero con «Pausar movimiento» (WCAG 2.2.2) | Pedido del usuario + skill ui-ux-pro-max |
| Dos secciones seguidas del mismo fondo: la segunda sin relleno superior (regla global) | `globals.css` «Ritmo entre secciones» |

---

## 11. Riesgos y ambigüedades

- **Correo de confirmación** limitado a miembros del equipo en el plan
  gratuito (E2.D1). Sin SMTP propio, un estudiante real no recibe el correo.
- **Fotos de cursos cortos:** se usan las de la carrera; el folleto muestra
  otro uniforme (polera beige y delantal negro) para los cursos.
- **Periodicidad de los Bs 650** sin confirmar.
- **Preguntas P1–P12** restantes con supuestos en `aclaraciones §7`.
- Lecciones del proyecto anterior que siguen aplicando al escribir SQL:
  `F:\Proyectos\GoldGym\SoftwareGym\CLAUDE.md` §10.

---

## 12. Problemas detectados y soluciones aplicadas

| Problema | Causa | Solución |
|---|---|---|
| Heredocs de Bash fallaban | El envoltorio no tolera apóstrofos | Escribir archivos con la herramienta de escritura |
| CVE crítica en Next 16.3.4 | GHSA-vcvr-r3jv-pc5j | Next 16.3.8 |
| Pruebas no cargaban una clase | «Parameter properties» no admitidas por Node | Campos declarados y asignados |
| Push colgado | El gestor de credenciales de Windows pidió una ventana interactiva | El usuario hizo el push desde su terminal (E2.D3, resuelto) |
| `.env.local` con valores de ejemplo | Se copió `.env.example` encima | Restaurado con los valores reales; el README usa `cp -n` |
| Política de programas para `anon` llamaba a una función privada | Una política compartida obliga a evaluar `app.tiene_permiso` | Políticas separadas por rol |
| `.t-lead` no aceptaba `text-*` | Clases propias fuera de capa ganan a las utilidades | `@layer components` |
| Cabecera desbordaba en 375 px | `hidden` en un `EnlaceBoton` perdía contra su `inline-flex` | Contenedor `hidden sm:contents` + alturas de logo responsivas |
| Subrayado script a todo el ancho | `block` anulaba el `inline-block` del subrayado | Span en línea dentro de un bloque |
| Capturas móviles recortadas | Edge sin interfaz impone ~500 px de ancho | Emulación de dispositivo por CDP |
| Favicon con trazo negro | El trazo de la «G» cruza los pétalos | Píxeles oscuros a transparentes en el script |
| La página podía leer el token viejo tras una renovación | El proxy clonaba las cabeceras antes de actualizar la cookie | Copiar la cookie renovada a las cabeceras que siguen hacia la página |
| Huecos blancos de ~225 px entre secciones | Dos `.section` seguidas del mismo fondo suman su relleno | Regla global: la segunda pierde el relleno superior |
| Franja blanca entre una onda y el pie | La onda SVG es transparente y deja ver el blanco del `body` | El pie toma el fondo de la última sección (`main:has(...)+footer`); `BandaEmprende final` |
| Disco C: casi lleno y cientos de `msedge.exe` | Los scripts de captura mataban solo el proceso lanzado; Edge seguía en otros y el perfil quedaba en %TEMP% | Cerrar por CDP (`Browser.close`) y borrar el perfil |
| Logotipo de Fusión Gourmet cortado en el hexágono | Su fondo es un degradado: no se puede recortar el margen | `aclararFondo`: grises claros a blanco antes de recortar |

---

## 13. Historial

| Fecha | Rama | Qué |
|---|---|---|
| 2026-09-30 | `main` | Fase 0: análisis, arquitectura (ADR 0001–0004), dominio con 73 pruebas |
| 2026-10-01 | `main` | Remoto GitHub; `FOTOS-WEB`; Supabase con 4 migraciones y RLS 39/39; aclaraciones; ADR 0005; catálogo con Bs 650; 83 pruebas |
| 2026-10-01 | `feat/pagina-web` | Web pública (14 rutas) y portal de estudiantes (7 páginas + confirmación); CSP con nonce y cabeceras; ADR 0006; 115 pruebas; verificado en escritorio y móvil (`85cab90`) |
| 2026-10-01 | `feat/pagina-web` | Cookie renovada propagada en el proxy; HTML válido en la tarjeta de pago; etiqueta del menú móvil; fotos verticales en el portal (`978cdbc`, `91f0d6d`). Push de las tres ramas hecho por el usuario |
| 2026-10-01 | `feat/pagina-web` | Cuentas y datos de demostración en `supabase/seed/` (5 cuentas `.test`, historial de 3 gestiones), ensayados y revertidos; contraseña fuera del repositorio. El usuario los cargó y probó el acceso |
| 2026-10-01 | `feat/pagina-web` | Entrega 3: logotipos de socios horneados como hexágonos; carrusel automático sin flechas (inicio); panel de universidades; panal del folleto (convenios); cursos + emprende en `/cursos` (308 desde `/emprende`); mapas con los enlaces del usuario; ritmo entre secciones y ondas del pie; `auditar-espacios.mjs`; fuga de procesos de Edge corregida. Auditoría base y revisión con 4 revisores + verificadores; 11 defectos confirmados y corregidos; 124 pruebas |

---

## 14. Cómo continuar en la próxima sesión

1. Leer §0, §9, §15, §16 y `TASKS.md`.
2. `git status`, `git branch -vv`, `git ls-remote --heads origin`.
3. Comprobar que `apps/web/.env.local` tiene la URL real del proyecto (§7).
4. `cd apps/web && npm install && npm run typecheck && npm test && npm run build && npm audit`.
5. Si hay respuestas o recursos del cliente: actualizar `contenido/`,
   `oferta-academica.ts`, `npm run imagenes`, y los documentos.
6. Web: seguir en `feat/pagina-web`. Sistema interno: `git checkout feat/sistema-interno && git merge main` (o rebase; si la web ya se fusionó, traerá también la capa Supabase y el portal) y empezar la fase 1 (§9).
7. Al cerrar: `TASKS.md` con validaciones y este archivo (§9, §13).

---

## 15. Instrucciones permanentes del usuario

Lo que pidió en sus mensajes y sigue vigente en todas las sesiones. Si algo
de aquí choca con otra sección, manda lo que el usuario dijo.

### 15.1 Del encargo inicial (2026-09-30)

- **Actuar como arquitecto y desarrollador responsable**, no como generador de
  código: analizar, razonar, verificar, documentar, implementar, probar,
  validar.
- **Arquitectura CLEAN** como en sus proyectos anteriores (GYM PLATFORM en
  `F:\Proyectos\GoldGym\SoftwareGym` y `F:\Proyectos\SoftwareGym\MiticoFitness`):
  nada de lógica de negocio en la interfaz, acceso a datos centralizado,
  dependencias sustituibles.
- **No inventar información institucional.** `[Consultar]` se documenta y se
  modela como pendiente; valores temporales solo si son técnicamente
  necesarios y marcados como tales.
- **La web debe sentirse como una digitalización profesional de la identidad
  existente**, no como una plantilla genérica de instituto gastronómico.
- **Dashboard del sistema interno:** solo información importante y
  accionable; nada de tarjetas redundantes ni gráficos decorativos.
  Operatividad antes que decoración en el panel.
- **Ramas por línea de trabajo**, nunca una por botón o formulario. Commits
  organizados; no mezclar desarrollos no relacionados.
- **Una tarea solo es `[x]`** si está implementada, revisada, probada, sin
  errores críticos, documentada y validada.
- **Documentar todo en `CLAUDE.md`** (este archivo) y mantener `TASKS.md`
  como panel con estados `[ ]` `[~]` `[x]` `[!]`. No depender del historial.
- **Revisar nombres, credenciales, repositorios y servicios** antes de tocar
  nada; no confundir las tres denominaciones institucionales; nunca exponer
  secretos.

### 15.2 De las aclaraciones (2026-10-01)

- **Es una demostración escalable**: se trabaja con los requerimientos base;
  si el cliente pide quitar o cambiar algo, se cambia. Ante un hueco, elegir
  la opción más simple que el modelo soporte y anotarla como supuesto.
- **Roles sin complicarse**: administrador y recepción (sistema interno),
  estudiante (portal web). Recepción informa oferta, cupos, precios y planes
  a quien llega en persona, y opera inventario. Administración hace todo,
  incluida la **contabilidad**, que es un módulo importante.
- **Cobro por QR**, como en proyectos anteriores. Paquete Económico y
  uniforme a Bs 650.
- **El cliente abrió la puerta a pedir más recursos**: pedirlos (lista en
  `aclaraciones §8`) en lugar de sustituirlos por imágenes de banco.
- **Diseño a la altura del renombre del instituto**, usando las skills
  `ui-ux-pro-max:ui-ux-pro-max`, `ui-ux-pro-max:brand` y
  `ui-ux-pro-max:design` cuando se trabaje la interfaz (sus scripts Python se
  ejecutan con `docker run --rm -v "<skill>:/skill:ro" python:3.12-alpine
  python /skill/scripts/search.py …`, porque la máquina no tiene Python).
- **Establecer objetivos y subtareas e ir marcándolos** en `TASKS.md` para que
  el avance se vea.
- **Pruebas de calidad siempre, antes y después de cada cambio** (§8).
- **Respetar el flujo y la arquitectura establecidos.**

### 15.3 Preferencias de trabajo observadas

- Escribe en español y espera respuestas y documentación en español.
- Hace él mismo las acciones que necesitan sus credenciales (push a GitHub,
  configuración del panel de Supabase) cuando se le indica el comando o los
  pasos exactos.

---

## 16. Estado exacto al cierre de la entrega 3 (2026-10-01)

### 16.1 Repositorio y entorno

| | |
|---|---|
| Rama activa | `feat/pagina-web`: commit de la entrega 3 sobre `2ffbd35` (que ya está en GitHub). El de la entrega 3 queda **solo en local** hasta que el usuario haga `git push origin feat/pagina-web` |
| `main` y `feat/sistema-interno` | `25500d8`, igual que en GitHub; `feat/pagina-web` sin fusionar |
| `.env.local` | Con los valores reales del proyecto (§7) |
| Base de datos | 5 cuentas de demostración cargadas por el usuario (§4); Valeria tiene una solicitud creada desde el portal |
| Servidor de vista previa | `web-produccion` (`npm run start`, puerto 3100) arrancado por el asistente; efímero |
| Capturas e informes de revisión | En el scratchpad de la sesión (efímero). Herramientas reproducibles: `scripts/capturar-pagina.mjs` y `scripts/auditar-espacios.mjs` |
| HawkScan | No ejecutado: la máquina no tiene `HAWK_API_KEY`. El gancho de sesión lo pide tras cada commit; se ignora mientras falte la clave |

### 16.2 Lo verificado y lo no verificado

- **Verificado (entrega 3):** 124 pruebas; tipos; build; audit 0; greps de
  §8 vacíos; 0 atributos `style` en el HTML servido. Auditoría de huecos en
  las rutas públicas a 1440 y 375 (antes y después). Revisión independiente
  con 4 revisores y verificadores escépticos:
  - panal con la geometría exacta (hueco de 8 px en horizontal y en diagonal,
    filas 4/4/5/4 en el orden del folleto);
  - carrusel en bucle sin salto (68 celdas, periodo 34) y 68/68 imágenes
    cargadas;
  - pausa con ratón, teclado, botón y movimiento reducido; árbol de
    accesibilidad (17 logotipos con nombre y copias ocultas);
  - mapas con las coordenadas de los enlaces del usuario y sin violaciones de
    CSP; `/emprende` responde 308.
  
  Los 11 defectos que encontró se corrigieron y se volvieron a verificar
  (TASKS.md, entrega 3).
- **Verificado (entrega 2):** RLS 39/39; 23 rutas con su código esperado; CSP
  con nonce; API REST con clave pública (solo sedes y programas). Inicio de
  sesión real con las cuentas de demostración (hecho por el usuario).
- **No verificado:** registro → correo → confirmación con un correo real
  (depende de E2.D1: SMTP o desactivar *Confirm email*).

### 16.3 Decisiones tomadas que el usuario debe confirmar

1. «Universidad **Unión Bolivariana**» (logotipo y documento) en lugar de
   «Unión Boliviana» (su mensaje).
2. Bs 650 mostrados **sin periodicidad** (no se dijo si son mensuales).
3. El precio del uniforme (Bs 650) aplicado **solo a la carrera**; cursos
   cortos siguen en «Consultar».
4. **Sin formulario de contacto anónimo**: contacto por WhatsApp a cada sede;
   las solicitudes exigen cuenta.
5. Sitio con **`noindex`** y sin desplegar hasta tener dominio.
6. «800 profesionales formados», «+16 áreas de formación» y los convenios
   BTH/Técnico Medio del folleto **no se publican** hasta que el cliente los
   confirme (no están en el documento).
7. Las fotos de la carrera ilustran también los cursos cortos (no hay fotos
   propias de cursos).
8. Cursos y «¿Sueñas emprender?» unidos en **`/cursos`** (el usuario dio a
   elegir entre Emprendimiento y Cursos). El menú dice «Cursos». Cambiarlo a
   `/emprende` es invertir una redirección.
9. El carrusel no tiene flechas, como se pidió, pero sí un botón «Pausar
   movimiento». Es obligatorio por accesibilidad (WCAG 2.2.2) y la skill
   `ui-ux-pro-max` lo exige para carruseles de logotipos.
10. Ajustes de orden fuera de lo pedido literalmente, hechos al validar los
    espacios:
    - el contenido de un solo bloque (Cocina, Coctelería) se centra en dos
      columnas;
    - el pie deja sitio al botón flotante de WhatsApp;
    - la 404 se centra;
    - la caja amarilla de contacto tiene margen en móvil;
    - los requisitos se alinean con la ficha.

### 16.4 Ideas de siguiente paso ya conversadas

- Sistema interno, fase 1: login del personal y bandeja de solicitudes para
  recepción (aprobar, rechazar, poner en revisión con respuesta), sobre los
  permisos `solicitudes.leer` y `solicitudes.gestionar` que ya existen.
- Contabilidad con pagos por QR (módulo importante para administración).
- Al llegar el QR bancario: mostrarlo en la tarjeta de pago del portal
  (`INSTITUTO.pago.qrDisponible`).
