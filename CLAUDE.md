# CLAUDE.md — Sistemas web de Corporación Bolivia Gourmet

> Archivo de contexto persistente. Claude Code lo carga al abrir una sesión en
> este repositorio. **Describe el proyecto tal como está HOY**, no cómo se
> llegó hasta aquí. Una sesión nueva debe poder continuar el trabajo leyendo
> este archivo, `TASKS.md`, `INFORMACION-INSTITUTO.md`,
> `docs/analisis/aclaraciones-2026-10-01.md` y `docs/`, sin depender del
> historial de conversaciones.
>
> - **Última actualización:** 2026-10-03 · **Entrega 4: sistema interno v1**
>   (panel del personal: alumnos y grupos, caja, inventario con PEPS y costo
>   promedio, uniformes y utensilios, contabilidad básica y tableros de
>   inicio), con datos de demostración del panel y revisión final; 294
>   pruebas y batería de la base del panel 165/165 (§8). Entregas 2 y 3: web pública y
>   portal de estudiantes con CSP estricta. Contexto de la conversación que no
>   está en otros documentos: §15 y §16.
> - **Ramas:** `feat/sistema-interno` lleva TODO (la web de `feat/pagina-web`
>   más el panel, R0–R9); la rama **`v1`** marca la entrega (§16.1).
>   `feat/pagina-web` sigue con la web sola. **Ninguna está fusionada con
>   `main`**: espera la aprobación del usuario.
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
| **Base de datos** | Supabase `Bolivia-Gourmet`, ref `bnobhnmurzsnffdrxeck`, `sa-east-1`, plan gratuito. 29 tablas, todas con RLS; 20 migraciones (§4) |
| **Estado** | Web pública (8 páginas + 5 de cursos; `/emprende` redirige a `/cursos`) y portal (7 páginas) **funcionando en local**, verificados. **Sistema interno v1** en `/panel` (43 páginas) para administración y recepción, con datos de demostración del panel cargados (§4). Sin desplegar. Las pantallas del personal con sesión las prueba el usuario (el asistente no inicia sesión) |
| **Fuentes de verdad** | `INFORMACION-INSTITUTO.md` + `docs/analisis/aclaraciones-2026-10-01.md` (datos), `FOTOS-GASTRO/` + `FOTOS-WEB/` + `docs/brand/identidad-visual.md` (identidad), `docs/domain/modelo-de-dominio.md` (reglas), `docs/architecture/` (decisiones), `TASKS.md` (avance) |
| **Siguiente** | 0) Que el usuario entre al panel como Carla (administración) y como Rosa (recepción) y revise las pantallas con los datos de demostración · 1) Esperar la respuesta del cliente sobre precios y detalles de cursos y licenciatura · 2) Que configure Supabase Auth (§9, E2.D1) y desactive las claves API heredadas · 3) Que confirme las decisiones de §16.3 · 4) Aprobar y fusionar en `main` · 5) Desplegar en Vercel cuando el usuario lo pida (antes, borrar los datos de demostración) · 6) v1.1 del panel (§9) |

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
8. **El panel escribe solo por RPC** (ADR 0008): fachada `public.*` SECURITY
   INVOKER que llama a un motor `app.*` DEFINER; la base exige el permiso, la
   sede y la clave de la operación (no repite un cobro por doble clic).
   Dinero en centavos enteros y cantidades en milésimas, de punta a punta.

---

## 1. Objetivo del proyecto

| Sistema | Objetivo | Estado |
|---|---|---|
| **Página web** | Presentación institucional, carrera, cursos de capacitación (con «¿Sueñas emprender?»), convenios con logotipos (carrusel y panal), contacto con mapas, sedes y redes, fiel a la identidad del folleto | ✅ Completa en `feat/pagina-web`, verificada en escritorio y móvil |
| **Portal de estudiantes** (parte de la web) | Registro, acceso, recuperación de clave, solicitud de inscripción, solicitud de renovación, estado de solicitudes, información de pago por QR | ✅ Implementado y probado hasta donde no exige crear cuentas reales (§9) |
| **Sistema interno** (`/panel`) | Recepción (atender a quien llega, inscribir, cobrar, cerrar caja, usar insumos, entregar uniformes, prestar utensilios) y administración (todo + compras, gastos y contabilidad) | ✅ **v1** (R0–R9): alumnos y grupos, bandeja de solicitudes del portal, caja con recibos y arqueos, inventario PEPS/promedio, uniformes y préstamos, contabilidad básica, tableros de inicio. Base con batería RLS; pantallas con sesión pendientes de la prueba del usuario |

Roles (ADR 0005, ADR 0008): **administrador** y **recepción** en el sistema
interno; **estudiante** en el portal. Medios de cobro: efectivo, QR y
transferencia (el QR bancario de la web sigue pendiente del cliente).

Evolución:

```text
Fase 0 ✅    Análisis, arquitectura, documentación, dominio con pruebas
Entrega 2 ✅ GitHub, Supabase + RLS, aclaraciones, web pública + portal + seguridad
Entrega 3 ✅ Mejoras de la web tras la presentación
Entrega 4 ✅ Sistema interno v1 (especificación, crítica, enmiendas; R0–R9) → rama v1
v1.1         Cierre de mes, auditoría, roles por sede y lo demás de enmiendas §A.2
Web          Despliegue, dominio, SEO, QR de pago en el portal
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
  formulario (`BotonEnviar`, `CampoClave`, `ResumenDeErrores`), los
  formularios del portal (`useActionState`) y, en el panel,
  `NavegacionDelPanel`, `presentation/panel/Formulario.tsx` (formulario con
  confirmación animada), `presentation/panel/Caja.tsx` (cálculo en vivo del
  arqueo) y `presentation/formularios/Interactivos.tsx`.
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
               ├─ portal/ ────────── registro, acceso, panel del estudiante, solicitudes (Server Components + Server Actions)
               ├─ panel/ ─────────── sistema interno del personal (el personal entra por /portal/acceso y se le envía aquí)
               └─ auth/confirmar ─── canje de enlaces de correo (PKCE / token_hash)
                        │  cliente de servidor con la cookie HttpOnly del usuario (nunca service_role)
                        ▼
               Supabase Bolivia-Gourmet (sa-east-1)
               ├─ Auth ─────── cuentas; disparador crea el perfil como «estudiante»
               └─ PostgreSQL ─ 29 tablas con RLS; el panel lee vistas security_invoker y escribe
                               solo por RPC (fachada public INVOKER → motor app DEFINER)
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
    panel/                sistema interno (43 páginas): layout (menú lateral / inferior por permisos) · page (tableros de inicio)
      _sesion.ts          exigirPersonal / exigirPermiso (cada página y cada Server Action)
      alumnos/            fichas, grupos (cupo, precio por paquete), inscribir en 3 pasos, solicitudes del portal
      caja/               cobrar, recibos imprimibles, lo que deben, cerrar caja (arqueo), arqueos
      inventario/         existencias, ficha y kárdex, compra, usar, baja, contar, saldo inicial, anular,
                          entregar uniforme, prestar y recibir utensilios, historial
      contabilidad/       resumen del mes, gastos, compras, inventario valorizado, tarjeta PEPS
      ajustes/            solo un aviso «en preparación»: Ajustes › Personal pasa a la v1.1 (hasta entonces, el acceso
                          del personal se da por SQL, §4)
      mas/                menú «Más» del teléfono (Contabilidad, Ajustes, la persona, cerrar sesión)
    auth/confirmar/route.ts
  core/
    domain/               shared (centavos, milésimas, Resultado) · academico (programa, grupo, cuotas) · estudiantes
                          · inventario (PEPS, promedio, movimientos, conteo, préstamo, entrega) · caja (cobro, arqueo, recibo)
                          · contabilidad (resumen del mes, tarjeta PEPS, tablero) · identidad (rol, contexto del panel) · portal
    application/          ports (catálogo, autenticación, portal, panel, alumnos, caja, inventario, contabilidad, tablero)
                          · portal · panel/{alumnos, caja, inventario, contabilidad, tablero} (casos de uso)
  infrastructure/
    config/composition-root.ts
    catalogo/             oferta académica validada en el build
    supabase/             configuracion · cookies · cliente-servidor · autenticacion · portal · errores · tipos generados
                          · panel-*.supabase.ts (un adaptador por puerto) · rpc.ts · errores-del-panel.ts (código → frase)
                          · cantidades.ts · contabilidad-desde-base.ts · tablero-desde-base.ts (lecturas puras, con pruebas)
  presentation/
    icons/Icono.tsx · ui/ (Boton, Foto, Logos, LogoHexagonal, Marca) · patterns/ (Cabecera, Pie, menús, mapa, redes, WhatsApp)
    sections/ (Hero, Institucion, Oferta, Convenios [carrusel, panal, universidades], panal.ts, Llamadas) · formularios/ · programas.ts
    panel/                Piezas (Indicador, Mosaico, Chip, EstadoVacio…) · Formulario · Caja · GraficoSemanal · navegación
  lib/                    cn · rutas · redirecciones · politica-de-contenido · fechas · marca
  styles/globals.css      tokens de marca y semánticos; @layer base y @layer components
tests/                    294 pruebas (node --test, en serie)
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

29 tablas, todas con RLS (44 políticas), 12 vistas `security_invoker`.
Detalle de cada migración: `supabase/migrations/README.md`.

| Grupo | Tablas | Quién lee | Cómo se escribe |
|---|---|---|---|
| Identidad y portal | `sedes` (2) · `perfiles` · `permisos_de_rol` · `programas` (6) · `solicitudes` | perfiles: uno mismo o `perfiles.leer`; solicitudes: el propio estudiante o `solicitudes.leer` | perfiles por columnas concedidas (rol, estado y sede solo con `perfiles.gestionar`; guarda del último administrador); solicitudes: alta y cancelación propias, decisión con `aprobar_solicitud` / `solicitudes.gestionar` |
| Núcleo del panel | `operaciones` (clave de cada operación; sin políticas: solo la tocan funciones DEFINER) | nadie por API | `app.iniciar_operacion` / `app.terminar_operacion` |
| Alumnos | `conceptos` (semilla fija) · `estudiantes` (código BG-AAAA-NNNN) · `cohortes` (grupos) · `planes_de_pago` · `inscripciones` | `estudiantes.leer`, `cohortes.leer` | RPC `crear_estudiante`, `inscribir`, `aprobar_solicitud`, `cambiar_estado_de_inscripcion`, `cerrar_grupo`; fichas y grupos por columnas concedidas |
| Caja | `cargos` · `pagos` (recibo sin huecos por sede y año) · `pago_aplicaciones` · `gastos` · `cierres_de_caja` | `caja.leer` (gastos: `contabilidad.leer`) | RPC `registrar_cobro`, `crear_cargo`, `registrar_gasto`, `cerrar_caja`, `anular`, `generar_cuotas_de_grupo`. El libro no se edita: solo se anula (`app.solo_sellos`) |
| Inventario | `articulos` · `variantes` · `existencias` · `existencias_costo` · `compras` · `conteos` · `entregas` · `prestamos` · `movimientos` (kárdex inmutable) · `movimientos_costo` · `lotes` · `lotes_costo` · `movimiento_lotes` | `inventario.leer`; todo lo que tiene costo, solo `contabilidad.leer` | RPC `guardar_articulo`, `registrar_saldo_inicial`, `registrar_compra`, `usar_insumos`, `dar_de_baja`, `registrar_conteo`, `entregar_uniforme`, `devolver_uniforme`, `prestar_utensilios`, `recibir_devolucion`, `anular` |
| Lecturas sumadas | — | `resumen_del_mes`, `verificar_cuadre`, `tablero_de_administracion` (`contabilidad.leer`); `resumen_de_deudores` (`caja.leer`); `variantes_con_movimientos` (`inventario.leer`) | — |

Permisos (`permisos_de_rol`): administrador 26 (todo, incluidos
`contabilidad.*`, `inventario.comprar/ajustar/anular/catalogo`,
`caja.anular`, `sedes.todas`, `perfiles.gestionar`); recepción 13
(`panel.entrar`, `caja.leer/cobrar/cerrar`, `estudiantes.leer/gestionar`,
`inscripciones.gestionar`, `cohortes.leer`, `solicitudes.leer/gestionar`,
`inventario.leer/operar`, `perfiles.leer`). Recepción opera solo en su sede
(`perfiles.sede_id`; `app.exigir_sede`). Detalle: ADR 0008.

Piezas `app.*` (fuera de la API): `tiene_permiso`, `rol_actual`,
`exigir_permiso`, `exigir_sede`, `hoy` (fecha de Bolivia; simulable solo con
`app.mantenimiento = 'si'`), `iniciar_operacion` / `terminar_operacion`,
`candado_de_caja`, `sacar` / `entrar` / `valorizar` / `revertir` (motor PEPS y
promedio), `anular`, disparadores de perfiles y de solicitudes. Los errores
llevan el código en `message` y su frase está en
`errores-del-panel.ts` (una prueba exige que cada código tenga frase).

Baterías: `docs/runbooks/pruebas-rls-entrega2.sql` (portal, 39/39) y
`docs/runbooks/pruebas-rls-panel-v1.sql` (panel R1–R9, crece con cada
rebanada; resultado en §8). Tipos:
`src/infrastructure/supabase/tipos-de-base.generados.ts` (regenerar o
completar a mano tras cada migración).

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
- Las cuentas del personal entran por `/portal/acceso` y van al panel:
  Carla ve el tablero de administración y Rosa el de recepción (La Paz).
- **Datos del panel** (`datos-panel-demo.sql`, va DESPUÉS de las cuentas):
  8 semanas de actividad hasta el día de la carga (catálogo y saldo inicial
  en las dos sedes, grupos, 14 alumnos con cobros y deudas, uniformes,
  compras, usos, préstamos, bajas, un conteo, gastos y arqueos). Pasa por las
  RPC y la RLS reales simulando la sesión de Carla y Rosa, con la fecha
  simulada en modo mantenimiento. No crea cuentas ni contraseñas. Ensayo con
  `c_simular := true`; se detiene si ya existe «Harina de trigo».
- **Antes de producción, borrar todo** (`borrar-datos-demo.sql`: primero los
  datos del panel, después las cuentas): la cuenta de administración tiene
  una contraseña conocida.

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

Del sistema interno (reglas numeradas con su prueba en el modelo de dominio
§3–§6; diseño en `docs/sistema-interno/` y ADR 0007 y 0008):

- **Inventario valorizado:** insumos por PEPS (lotes, lo vencido aparte) y el
  resto por costo promedio; la salida que agota un lote o la capa se lleva el
  resto exacto; una devolución vuelve al costo con que salió; prestar no
  cambia el valor (custodia); el conteo es todo o nada.
- **Caja:** el cobro se aplica a cargos; recibo sin huecos por sede y año; el
  arqueo cuenta el efectivo (también compras y gastos en efectivo y sus
  anulaciones); nada se edita, solo se anula con motivo.
- **Contabilidad (vista de gestión, no estado oficial):** resultado = ingresos
  − costo de lo usado − gastos − diferencias de caja; una anulación cuenta en
  el mes en que se hace; las compras son dinero e inventario, nunca gasto.
- **Grupos:** el precio se congela con el primer cargo; la carrera tiene un
  plan por paquete.

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
| Memoria de la máquina | Justa. Con el panel, `npm run build` y `npm run typecheck` se quedaron sin memoria: usar `CIRCLE_NODE_TOTAL=2 npm run build` (menos procesos de Next) y `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck`, y antes cerrar servidores de vista previa que hayan quedado vivos. Si `tsc` muere con «Zone Allocation failed» con poca memoria usada, lo que se agotó es la memoria comprometida de Windows (límite ~17 GB con el archivo de paginación): mirar `Win32_OperatingSystem.FreeVirtualMemory` y pedir al usuario que cierre programas pesados; el asistente no cierra programas del usuario |
| Vista previa del asistente | `.claude/launch.json`: `web` (dev) y `web-produccion` (start), con puerto automático (el 3000 lo usa Docker) |
| Capturas reales | `node scripts/capturar-pagina.mjs <url> <ancho> <salida.png> [movil]` (desde `apps/web`): Edge por CDP con emulación de dispositivo; informa desbordamiento y errores de consola. Edge sin interfaz «normal» impone ~500 px y recorta. **Huecos entre secciones:** `node scripts/auditar-espacios.mjs <url> <ancho> movil/- [captura.png]` (tramos vacíos; `fondoUniforme: true` = hueco visible). Ambos cierran Edge por CDP y borran su perfil temporal: un script propio que lance Edge debe hacer lo mismo (el 2026-10-01 quedaron 417 procesos y el disco C: casi lleno) |
| Vercel | Sin proyecto. Desplegar solo cuando el usuario lo pida (`regions: ["gru1"]`, variables de entorno de Supabase y `NEXT_PUBLIC_SITE_URL`) |

---

## 8. Cómo se verifica

```bash
cd apps/web
NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck   # tsc --noEmit
npm test              # 294 pruebas: dominio, catálogo, casos de uso, portal, panel, lecturas de la base, seguridad, coherencia SQL
CIRCLE_NODE_TOTAL=2 npm run build                         # todas las páginas dinámicas + proxy
npm audit             # 0
```

Base del panel: pegar `docs/runbooks/pruebas-rls-panel-v1.sql` en el editor
SQL (o `execute_sql`). Simula sesiones con `set local role` y termina con
una excepción a propósito para revertirlo todo: el resultado esperado es
`ERROR: OK · N pruebas superadas (todo revertido)`; un mensaje «FALLO Nxx»
dice qué regla se rompió. Necesita las cuentas de demostración y funciona con
o sin los datos del panel cargados (sus comprobaciones miden diferencias).

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
- Entrega 4, sistema interno v1 (TASKS.md E4): especificación, crítica y
  enmiendas; R0 dominio puro; R1 núcleo y esqueleto; R2 alumnos, grupos y
  solicitudes; R3 caja; R4 inventario; R5 uniformes y utensilios; R6
  contabilidad; R7 tableros; R8 datos de demostración del panel (cargados el
  2026-10-03); R9 revisión final, documentación y rama `v1`.

### Pendiente del usuario

| # | Qué | Cómo |
|---|---|---|
| E2.D1 | **Configurar Supabase Auth** para que los correos vuelvan al sitio. Estado real (2026-10-01): confirmación de correo activada, registro abierto, solo proveedor de correo | Panel de Supabase → Authentication → URL Configuration: *Site URL* = URL del sitio (en local, la del servidor de desarrollo) y en *Redirect URLs* añadir `<sitio>/auth/confirmar`. El servidor de correo gratuito **solo entrega a miembros del equipo**: para estudiantes reales, configurar SMTP propio (Authentication → Emails → SMTP) o, para la demostración, desactivar *Confirm email* (Authentication → Sign In / Providers → Email) |
| E2.D3 | ~~Push de los commits locales~~ | **Hecho** por el usuario el 2026-10-01: las tres ramas están en GitHub con los mismos commits que en local |
| — | **Revisar el panel con sesión** | Entrar por `/portal/acceso` como Carla (administración) y como Rosa (recepción) con la contraseña de `datos-demo.local.sql`; recorrer inicio, alumnos, caja, inventario y contabilidad con los datos de demostración. El asistente no inicia sesión |
| — | Aprobar y fusionar | `feat/sistema-interno` ya contiene la web: `git checkout main && git merge feat/sistema-interno` (o la rama `v1`) |
| E2.D4 | ~~Cargar las cuentas de demostración~~ | **Hecho**: 5 cuentas cargadas; Camila, Diego y Valeria ya iniciaron sesión. **Borrarlas antes de producción** (`borrar-datos-demo.sql`) |
| — | Respuesta del cliente sobre precios y detalles de cursos y licenciatura | Pedida por correo el 2026-10-01; el usuario avisa. Hasta entonces, «Consultar» |
| — | Activar la protección de contraseñas filtradas | Authentication → Settings (aviso de `get_advisors`) |
| — | Desactivar las claves API heredadas (JWT `anon`/`service_role`) | Una `service_role` se pegó en el chat el 2026-10-01: darla por filtrada. Project Settings → API Keys → Legacy API keys. La web solo usa la clave publicable, no se ve afectada |
| — | Promover al primer administrador real cuando exista su cuenta | SQL de §4 (Ajustes › Personal llega en la v1.1) |
| — | Desplegar en Vercel | Cuando el usuario lo pida. Antes: `borrar-datos-demo.sql` (datos del panel y cuentas ficticias) |

### Pendiente del cliente (`docs/analisis/aclaraciones-2026-10-01.md` §8)

Precios y detalles de cursos y licenciatura (pedidos el 2026-10-01) ·
logotipos en blanco o SVG · QR bancario · fotos de cursos cortos, productos y
sede de El Alto · foto del Chef Oscar Mora · enlaces de Facebook, YouTube y
comunidad de WhatsApp · confirmar «UB = Unión Bolivariana» y si los Bs 650
son mensuales. (Logotipos de socios: recibidos.)

### Siguiente trabajo técnico

1. Correcciones que salgan de la revisión del usuario con sesión.
2. Panel v1.1 (TASKS «Pasa a la v1.1»): Ajustes › Personal y Conceptos,
   cierre y reapertura de mes, auditoría, verificación de QR y revisión de
   arqueos.
3. Web: QR de pago en el portal cuando llegue; dominio, `NEXT_PUBLIC_SITE_URL`,
   quitar `noindex`, `sitemap.xml`.

### Deuda reconocida

- Sin CI ni ESLint (comprobaciones a mano, §8). La batería de la base se
  corre a mano (`execute_sql` o el editor SQL).
- Pantallas del panel con sesión sin verificar por el asistente (no inicia
  sesión): las prueba el usuario.
- `/panel/ajustes` es un aviso hasta la v1.1 (acceso del personal por SQL).
- La guarda del último administrador (`app.proteger_perfil`) no se bloquea:
  dos bajas simultáneas de los dos últimos administradores podrían pasar
  ambas. Improbable con un solo instituto; se cierra en la v1.1 con
  Ajustes › Personal.
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
| Sistema interno: especificación, crítica independiente y enmiendas antes de construir; v1 en rebanadas R0–R9 | `docs/sistema-interno/` (enmiendas §A alcance, §B resoluciones, §C rebanadas) |
| Libro de inventario valorizado: PEPS en insumos, promedio en el resto, resto exacto, anulación solo de lo que no se movió después (o ya se deshizo), conteo todo o nada | ADR 0007 |
| Panel: un solo inicio de sesión; permisos por rol en tabla; alcance por sede; RPC fachada INVOKER + motor DEFINER; idempotencia con la clave del formulario; fecha de Bolivia; caja sin edición; precio del grupo congelado; contabilidad como vista de gestión | ADR 0008 |
| Ajustes › Personal y Conceptos, cierre de mes, auditoría y `caja.supervisar` pasan a la v1.1; el acceso del personal se da por SQL (§4) | enmiendas §A.2; decisión del 2026-10-03 para Personal (§16.3) |

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
| `npm run build` y `typecheck` sin memoria | El panel duplicó el código; Next lanza un proceso por CPU; quedaban servidores de vista previa vivos | `CIRCLE_NODE_TOTAL=2` en el build, `--max-old-space-size=1536` en tsc, cerrar servidores huérfanos (§7) |
| Texto con acentos graves perdido al editar | Dentro de `node -e "…"` con comillas dobles, Bash ejecuta lo que va entre acentos graves | Editar con la herramienta de edición o con un script escrito a archivo |
| Error de sintaxis en la batería | Un `case … then` dentro de la condición de un `IF` de PL/pgSQL | Poner el `case` entre paréntesis |
| Una compra de costo promedio no se podía anular nunca tras un uso, aunque el uso ya estuviera anulado | `app.anular` contaba los movimientos posteriores anulados y sus anulaciones | Migración `20261002190000`: solo cuentan los posteriores vigentes (N84–N86) |
| Con «Ambas», los avisos de caja del tablero llevaban a otra sede; lo que deben y los lotes se contaban sobre listas de 100 y 50 filas | La página contaba sobre listas recortadas y no sabía dónde estaba el problema | Migración `20261002180100` (sede del problema, `resumen_de_deudores`) y conteos exactos (N87–N89) |
| `tsc` del proyecto murió con «Zone Allocation failed» (2026-10-03) | La memoria comprometida de Windows estaba casi agotada (0,5 GB libres de 17 GB), sobre todo por programas abiertos del usuario | Comprobaciones pesadas (tipos, build) cuando el usuario libera memoria; pruebas unitarias y baterías de la base no la necesitan |
| Flujos de agentes en segundo plano se perdieron | Mueren si la sesión termina mientras corren | Esperar activamente a que terminen antes de cerrar el turno; reanudar con `resumeFromRunId` |

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
| 2026-10-02 | `feat/sistema-interno` | Diseño del sistema interno: especificación, crítica independiente y enmiendas (`01557f2`). R0 dominio puro (`b3005d0`); R1 núcleo de base y esqueleto del panel (`60772e5`); R2 alumnos, grupos y solicitudes (`a558eaa`, `237f70e`); R3 caja (`164d338`, `2413fa3`); R4 inventario PEPS y promedio (`685e4aa`, `277b585`); R5 uniformes y utensilios (`1fc3d6c`); R6 contabilidad (`3e5bf35`). Cada rebanada con su batería de la base y revisores escépticos |
| 2026-10-03 | `feat/sistema-interno` | R7 tableros de inicio y anulación de lo ya deshecho (`411883a`); R8 datos de demostración del panel, cargados (`9f268bc`); batería del panel 145/145 sobre los datos cargados; ADR 0007 y 0008; R9 revisión final con 17 defectos corregidos (`062efa1`, `7d48f50`): batería 165/165, 294 pruebas, tipos y build. Rama `v1` creada en ese punto |

---

## 14. Cómo continuar en la próxima sesión

1. Leer §0, §9, §15, §16 y `TASKS.md`.
2. `git status`, `git branch -vv`, `git ls-remote --heads origin`.
3. Comprobar que `apps/web/.env.local` tiene la URL real del proyecto (§7).
4. `cd apps/web && npm install`, y las comprobaciones de §8 (con las
   opciones de memoria de §7).
5. Si hay respuestas o recursos del cliente: actualizar `contenido/`,
   `oferta-academica.ts`, `npm run imagenes`, y los documentos.
6. Trabajo nuevo del panel o de la web: en `feat/sistema-interno` (lleva las
   dos cosas), con una rama por línea de trabajo si hace falta, nunca por
   botón. Si se toca la base: migración nueva en `supabase/migrations/` (y su
   fila en el README), sus casos en `pruebas-rls-panel-v1.sql`, tipos
   generados, `errores-del-panel.ts` si hay códigos nuevos, y
   `get_advisors`.
7. Al cerrar: `TASKS.md` con validaciones y este archivo (§9, §13, §16).

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

## 16. Estado exacto al cierre de la v1 del sistema interno (2026-10-03)

### 16.1 Repositorio y entorno

| | |
|---|---|
| Rama activa | `feat/sistema-interno` (la web de las entregas 2 y 3 + el panel R0–R9). Último commit y si está publicado: `git log -1` y `git ls-remote --heads origin` |
| `v1` | Rama que marca la entrega del sistema interno v1; sale del último commit de `feat/sistema-interno` |
| `main` | `25500d8` (fase 0 y entrega 2). Nada fusionado: espera la aprobación del usuario |
| `feat/pagina-web` | `08df150` (entrega 3), en GitHub; `feat/sistema-interno` la contiene |
| `.env.local` | Con los valores reales del proyecto (§7) |
| Base de datos | 20 migraciones (22 aplicaciones en la base, ver el README de migraciones; §4). Cuentas de demostración y datos de demostración del panel cargados (2026-10-03). Valeria tiene una solicitud creada desde el portal |
| Servidor de vista previa | `web-produccion` (puerto 3100); el asistente lo arranca para comprobar y lo detiene (la memoria es justa, §7) |
| Informes de revisión | En el directorio de la sesión (efímero). Lo confirmado y corregido está en `TASKS.md` (E4.R7 y E4.R9) |
| HawkScan | No ejecutado: la máquina no tiene `HAWK_API_KEY`. El gancho de sesión lo pide tras cada commit; se ignora mientras falte la clave |

### 16.2 Lo verificado y lo no verificado

- **Verificado (v1 del panel):** pruebas unitarias, tipos, build y greps de
  §8; batería de la base del panel completa sobre los datos de demostración
  cargados (resultado en `TASKS.md` E4.R9); `curl` sin sesión → 307 en las
  rutas del panel; advisors de seguridad sin avisos nuevos. Cada rebanada
  tuvo revisores escépticos y la v1 una revisión final con verificación
  adversarial (`TASKS.md` E4.R9).
- **Verificado (entregas 2 y 3):** RLS del portal 39/39; rutas públicas con
  su código esperado; CSP con nonce; inicio de sesión real con las cuentas de
  demostración (hecho por el usuario); maquetación en escritorio y móvil.
- **No verificado por el asistente:** las pantallas del panel con sesión
  (Carla y Rosa): el asistente no inicia sesión con contraseñas. Las revisa
  el usuario. Tampoco el registro → correo → confirmación con un correo real
  (E2.D1).

### 16.3 Decisiones tomadas que el usuario debe confirmar

De la web:

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

Del sistema interno (detalle en `docs/sistema-interno/enmiendas-v1.md` y los
ADR 0007 y 0008):

11. **Recepción opera solo en su sede** (`perfiles.sede_id`) y consulta las
    dos; administración opera en cualquiera.
12. **Recepción cobra y cierra la caja (arqueo)**; anular un cobro, un cargo
    o un movimiento de inventario es solo de administración.
13. **Ajustes › Personal pasa a la v1.1** (ninguna rebanada lo incluía): el
    acceso del personal se da por SQL (§4). Es una rebanada pequeña si se
    quiere en la v1.
14. El **precio de un grupo se congela con su primer cargo**; para cambiarlo
    se anulan las cuotas, se cambia el precio y se usa «Crear cuotas
    pendientes». Una beca (cuotas anuladas con el plan igual) no vuelve, pero
    si el precio del grupo cambia, las becas de ese grupo vuelven a cargarse
    y hay que anularlas de nuevo (la pantalla lo avisa; ADR 0008 §8).
15. La **contabilidad es una vista de gestión**, no un estado financiero
    oficial; el recibo dice «Recibo interno: no es factura».
16. **Devolver un uniforme** anula su cargo solo cuando vuelve todo, contando
    los cambios de talla, y el cargo no está cobrado; si está cobrado,
    administración anula el cobro y después el cargo.
17. Los datos de demostración del panel (alumnos, montos, compras) son
    **ficticios** y se borran antes de producción.

### 16.4 Ideas de siguiente paso ya conversadas

- Revisión del panel con sesión por el usuario y ajustes que salgan de ella.
- v1.1 del panel: Ajustes › Personal y Conceptos, cierre de mes, auditoría,
  verificación de QR y revisión de arqueos.
- Al llegar el QR bancario: mostrarlo en la tarjeta de pago del portal
  (`INSTITUTO.pago.qrDisponible`).
