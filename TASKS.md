# TASKS.md — Panel de tareas

> Estados: `[ ]` pendiente · `[~]` en progreso · `[x]` completada · `[!]` bloqueada.
>
> **Regla:** una tarea pasa a `[x]` solo cuando está implementada, verificada
> (typecheck, pruebas, build, audit y las pruebas de su nivel), sin errores
> críticos conocidos, con la documentación actualizada y con la validación
> anotada en la propia tarea. Escribir el código no es terminar la tarea.
>
> Última actualización: 2026-10-02 (entrega 4 en curso).

---

## Fase 0 — Análisis, arquitectura y base (rama `main`)

- [x] **0.1 Revisar entorno** — Node 24.10, npm 11.11, Git 2.49, Docker; sin `gh`, sin Python, sin CLI de Supabase. *Validación:* comandos de versión ejecutados; anotado en `CLAUDE.md` §7.
- [x] **0.2 Revisar Git y credenciales** — usuario `ZPSoftwareFastSolutions`; sin credential helper global ni tokens; proyectos anteriores en `F:\Proyectos\SoftwareGym` y `GoldGym` identificados como referencia de arquitectura. *Validación:* `git config`, `git remote -v` en los proyectos vecinos.
- [x] **0.3 Leer `INFORMACION-INSTITUTO.md` completo** → `docs/analisis/analisis-informacion-instituto.md` (entidades, relaciones, categorías, 9 reglas definidas, 12 preguntas abiertas, erratas). *Validación:* revisión cruzada con el catálogo transcrito (prueba «el catálogo contiene la carrera y los cinco cursos»).
- [x] **0.4 Analizar `FOTOS-GASTRO` (12 imágenes, una por una)** → `docs/brand/identidad-visual.md`. *Validación:* cada imagen inventariada en la tabla §1; discrepancias con el documento listadas en §11.
- [x] **0.5 Documentar identidad visual** — paleta aproximada, tipografía y alternativas, patrones, componentes, recomendaciones, mantener/modernizar, tokens. *Validación:* tokens implementados en `globals.css` y visibles en la página provisional.
- [x] **0.6 Diseñar arquitectura CLEAN** → `docs/architecture/overview.md` + ADR 0001–0004. *Validación:* greps de la Dependency Rule vacíos sobre el código escrito.
- [x] **0.7 Definir estructura del proyecto** → `apps/web` con capas, alias, `contenido/`, `tests/`. *Validación:* `npm run build` genera 2 rutas estáticas.
- [x] **0.8 Crear repositorio local** — `git init`, `.gitignore`, `.editorconfig`, primer commit en `main`. *Validación:* `git log`, `git status` limpio.
- [x] **0.9 Crear estructura de ramas** — `main` + `feat/sistema-interno`. *Validación:* `git branch`. Ver `docs/git/estrategia-de-ramas.md`.
- [x] **0.10 Crear `CLAUDE.md`** — contexto completo para sesiones futuras. *Validación:* §14 permite continuar sin historial.
- [x] **0.11 Crear `TASKS.md`** — este archivo.
- [x] **0.12 Definir modelos y reglas principales** → `docs/domain/modelo-de-dominio.md` + dominio en `src/core/domain`. *Validación:* 73 pruebas de dominio y casos de uso en verde.
- [x] **0.13 Definir estrategia de pruebas** → `docs/testing/estrategia-de-pruebas.md`; arnés `node --test` con alias funcionando. *Validación:* `npm test` 73/73.
- [x] **0.14 Primera línea funcional (dominio de inventario + catálogo académico)** — `aplicarMovimiento`, `calcularStock`, `validarMovimiento`, `validarEntrega`, `validarCohorte`, `validarEstudiante`, `validarInscripcion`, caso de uso `registrarMovimiento` con puerto y doble en memoria, catálogo estático validado en el build, composition root. *Validación:* typecheck limpio · 73/73 pruebas · build OK · `npm audit` 0 · greps vacíos.
- [x] **0.15 Página provisional con tokens de marca** — `/` lista oferta y sedes desde el composition root; `/_not-found`. *Validación:* build estático; vista previa en el navegador (fuentes y tokens cargan).

## Entrega 2 — Configuración del proyecto y página web (2026-10-01)

Objetivo: dejar el repositorio y la base de datos configurados, aplicar las
aclaraciones del usuario y presentar la página web completa y funcional, con
portal de estudiantes, cabeceras de seguridad y políticas RLS.

### E2.A Configuración
- [x] **E2.A1 Vincular el remoto y publicar ramas** — `origin` = `ZPSoftwareFastSolutions/Bolivia-Gourmet`; push de `main` y `feat/sistema-interno`. *Validación:* `git ls-remote --heads origin` muestra ambas en `0f30c29`.
- [x] **E2.A2 Versionar `FOTOS-WEB`** (2 logotipos y 9 fotografías oficiales enviadas por el cliente). *Validación:* commit `0f30c29` en `main`.
- [x] **E2.A3 Crear el proyecto Supabase gratuito** — `Bolivia-Gourmet`, ref `bnobhnmurzsnffdrxeck`, región `sa-east-1`, organización «Z&P Software Fast Solutions» (plan free, coste 0). *Validación:* `get_project` → `ACTIVE_HEALTHY`.
- [x] **E2.A4 `.env.local`** con URL y clave publicable (ignorado por Git). *Validación:* `git check-ignore`.
- [x] **E2.A5 Migraciones de base**: sedes, identidad (perfiles con rol `administrador`/`recepcion`/`estudiante`, permisos por rol), programas, solicitudes de inscripción y renovación; RLS en todo. *Validación:* 4 migraciones aplicadas; batería RLS 39/39 (`docs/runbooks/pruebas-rls-entrega2.sql`), todo revertido; `get_advisors(security)` sin avisos; 5/5 tablas con RLS, 11 políticas; prueba de coherencia SQL ↔ catálogo.

### E2.B Aclaraciones del usuario
- [x] **E2.B1 Registrar las aclaraciones** (jerarquía TEC-NIB → Bolivia Gourmet, roles, cobro por QR, paquete económico y uniforme a Bs 650, socios y universidades con su nombre completo) en `docs/analisis/aclaraciones-2026-10-01.md` y en los documentos afectados. ADR 0005 (tres roles y portal).
- [x] **E2.B2 Catálogo y contenido** — costos de la carrera, convenios completos, jerarquía institucional. *Validación:* pruebas del catálogo reescritas (Bs 650 en carrera, cursos pendientes, 17 aliados, 4 universidades, erratas ausentes); 83/83.
- [x] **E2.B3 Identidad con los logotipos oficiales** — colores medidos en los PNG oficiales (docs/brand §14); tricolor medido en los tokens; logotipos recortados solo en su margen transparente; favicon con el isotipo de pétalos; 8 fotos en WebP a 3 anchos (`npm run imagenes`). *Validación:* `FOTOS-WEB` 16 MB → `public/img` 1,2 MB (el logo de 11,6 MB queda en 30 KB); revisión visual del favicon y los logotipos sobre blanco.

### E2.C Página web (rama `feat/pagina-web`)
- [x] **E2.C1 Escudos de seguridad** — CSP con nonce sin `'unsafe-inline'`/`'unsafe-eval'` en producción, HSTS, `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP/CORP, CSP cerrada para archivos, cookies `HttpOnly`/`SameSite=Lax`/`Secure`, `no-store` en páginas, redirecciones seguras, sesión solo en el servidor. ADR 0006 y `docs/architecture/seguridad.md`. *Validación:* `curl -I` en servidor de producción (cabeceras y nonce distinto por respuesta), 10/10 scripts con nonce, 0 atributos `style`, consola sin violaciones en 5 páginas y 3 anchos; 23 rutas con su código esperado (200/307/308/404); `/auth/confirmar` con destino externo no sale del sitio; API REST con la clave pública: solo sedes y programas legibles, resto 42501, funciones privadas no expuestas; `tests/seguridad.test.ts`.
- [x] **E2.C2 Sistema de diseño y componentes de marca** — skills `ui-ux-pro-max` (patrón Trust & Authority + Conversion, reglas de formularios y autenticación accesible, lista de entrega), `brand` (reglas de logotipo, medición de color) y `design` (reglas de iconos); lo que se tomó y lo que se descartó, en docs/brand §15. Motivos del folleto como componentes y clases con máscara (brochazo, subrayado, rayas, polaroid, ondas, insignias, checks). *Validación:* tipos y greps (sin colores literales ni `style`), contraste del par amarillo/azul, foco visible, áreas de 44 px, `aria-*` comprobado en el formulario de registro.
- [x] **E2.C3 Páginas públicas** — inicio, nosotros, carrera, cursos, 5 cursos, convenios, emprende, contacto (mapas bajo demanda), privacidad (borrador), 404 de marca, `robots.txt` (noindex), favicon. *Validación:* capturas de página completa a 1440 px (inicio), 1024 px (contacto), 768 px (inicio, carrera) y 375 px emulado por CDP (inicio, coctelería, registro); `scrollWidth = clientWidth` en las 9 páginas a 375 px; 0 errores de consola; un `h1` por página y todas las imágenes con `alt`. Correcciones aplicadas: desbordamiento de la cabecera móvil, subrayado script, altura de la galería, pie en tablet.
- [~] **E2.C4 Portal de estudiantes** — registro, acceso, recuperación y nueva clave, panel con solicitudes y estados explicados, nueva inscripción y renovación en dos pasos (solo las opciones del programa), cancelación de pendientes, pago por QR informativo, datos del estudiante, aviso al personal. *Validación hecha:* 21 pruebas de dominio y casos de uso del portal y 11 de seguridad; RLS 39/39; guardas medidas (307 al acceso sin sesión); formulario de registro probado en el navegador con datos inválidos (resumen enfocado, errores por campo, la contraseña no vuelve, los demás datos se conservan) sin llegar a Supabase. *Falta:* recorrido con una cuenta real (registro, confirmación, solicitud, cancelación), que depende de E2.D1 y lo hace el usuario: el asistente no crea cuentas en servicios remotos.
- [x] **E2.C5 Calidad** — antes y después de cada cambio. *Validación:* 115/115 pruebas, `tsc` limpio, build con todas las páginas dinámicas y el proxy, `npm audit` 0, greps de capas, colores, voseo y secretos vacíos.
- [x] **E2.C6 Documentación** — `CLAUDE.md` reescrito con el estado actual; ADR 0005 y 0006; `docs/architecture/seguridad.md`; aclaraciones; identidad visual §14–15; migraciones y batería RLS; `.env.example`; script `scripts/capturar-pagina.mjs`.

### E2.D Pendiente del usuario o del cliente
- [!] **E2.D1 Configurar Supabase Auth** — *Estado real leído de `/auth/v1/settings` el 2026-10-01:* confirmación de correo **activada** (`mailer_autoconfirm: false`), registro abierto, solo proveedor de correo. *Site URL* y *Redirect URLs* (`<sitio>/auth/confirmar`) en Authentication → URL Configuration. El correo gratuito de Supabase **solo llega a miembros del equipo del proyecto**: para estudiantes reales, SMTP propio; para la demostración, basta con usar un correo del equipo o desactivar *Confirm email*. Si la URL de retorno no está autorizada, el enlace vuelve a `/?code=` y la portada lo reenvía al canje. *Dependencia:* usuario (el conector no expone la configuración de Auth).
- [!] **E2.D2 Recursos a pedir al cliente** — logotipos en blanco o SVG, QR bancario, fotos de cursos cortos y de la sede de El Alto, foto del Chef Oscar Mora, logotipos de socios con autorización, enlaces de Facebook, YouTube y comunidad de WhatsApp, confirmación de «Unión Bolivariana» y de la periodicidad de los Bs 650.
- [x] **E2.D3 Push de los commits locales** — hecho por el usuario desde su terminal. *Validación:* `git ls-remote --heads origin` muestra `main` y `feat/sistema-interno` en `25500d8` y `feat/pagina-web` en `91f0d6d`, igual que en local.
- [x] **E2.D4 Cuentas y datos de demostración** — `supabase/seed/datos-demo.sql`: 5 cuentas ficticias `@boliviagourmet.test` (administración, recepción, estudiante nuevo, que renueva y de 3.er año) con su historial, cargado con sesiones simuladas que pasan por los mismos disparadores y políticas que el portal. Contraseña fuera del repositorio (copia local ignorada por git). *Validación:* ensayo revertido correcto; el usuario lo ejecutó y la base muestra 5 cuentas confirmadas con su identidad de correo, los roles esperados y el historial (Camila 3 solicitudes, Diego 1); Camila, Diego y Valeria **iniciaron sesión** (`last_sign_in_at`) y Valeria creó una solicitud desde el portal. **Borrar estas cuentas antes de producción** (`borrar-datos-demo.sql`).
- [x] **E2.D5 Push de `a06f492` y siguientes** — hecho por el usuario. *Validación:* `git ls-remote` muestra `feat/pagina-web` en `2ffbd35`, igual que en local.

## Entrega 3 — Mejoras pedidas tras la presentación (2026-10-01, rama `feat/pagina-web`)

Pedido: solo estos cambios, sin rediseñar nada más. Diseño con las skills
`ui-ux-pro-max` (consultadas: carrusel de logotipos con pausa, que se detenga
con el puntero, el foco y movimiento reducido; prueba social de logotipos).
El portal de estudiantes y los precios esperan la respuesta del cliente.

- [x] **E3.1 Logotipos de socios** — 21 archivos de `FOTOS-WEB/LOGOS-SOCIOS` (17 socios + 4 universidades) horneados por `npm run imagenes` como hexágonos de panal con el fondo de cada logotipo (WebP 200/400 px, contorno en los claros), sin color por socio en el CSS ni `style`. *Validación:* hoja de contactos revisada; Fusión Gourmet (fondo en degradado) y Cuissine (anillo que toca el borde) corregidos y medidos (anillo redondo en 360/360 ángulos, residuo 0,3 px); prueba «cada socio y universidad tiene su hexágono y sus archivos».
- [x] **E3.2 Inicio · carrusel automático sin flechas** — cinta de panal de dos filas que se desplaza sola en bucle continuo; «Pausar movimiento» (interruptor sin JavaScript, relleno azul cuando está activo), pausa con el puntero (solo dispositivos con puntero) y con el foco de teclado; quieta, sin control y desplazable con movimiento reducido. *Validación:* revisión y reverificación por CDP a 1440/768/375 y a 1920/2560: se mueve (≈38 px/s), 68 celdas con periodo 34 sin salto ni hueco al reiniciar, 68/68 imágenes cargadas, pausa/reanudación con clic, toque y Tab, árbol de accesibilidad con 17 logotipos con nombre y copias ocultas, consola sin errores; prueba de paridad del bucle.
- [x] **E3.3 Inicio · convenios a nivel licenciatura** — panel blanco con el texto de convalidación y las 4 universidades (hexágono, sigla y nombre). *Validación:* revisado a 1440, 768 y 375 (dos columnas en escritorio, 2×2 apilado en móvil), contraste del nombre ≈5,8:1.
- [x] **E3.4 Convenios · panal del folleto** — filas 4 / 4 desplazada / 5 / 4 desplazada desde 768 px y 2/3 alternas en móvil, en el orden del folleto; universidades con logotipo. *Validación:* geometría medida (hueco de 8 px horizontal y diagonal a todos los anchos), comparado con `Portada1 (5).jpg`; sin desbordamiento a 320/360/375 (el hexágono se adapta); realce al pasar el ratón solo con puntero; la maqueta oculta no descarga imágenes; prueba de filas.
- [x] **E3.5 Cursos de capacitación y emprende en una sola página** — `/cursos` reúne los cursos y «¿Sueñas emprender?»; `/emprende` redirige (308) a `/cursos` y sale del menú y del pie; en la portada la banda de emprender va junto a los cursos. *Validación:* `curl -sI` 308 → `/cursos`; 0 enlaces a `/emprende` en el HTML; sin franja blanca entre la banda y el pie (píxeles medidos); prueba de menú y redirección.
- [x] **E3.6 Contacto · mapas** — cada sede con su lugar de Google Maps (enlaces del usuario resueltos a «Bolivia Gourmet Miraflores» e «Instituto Bolivia Gastronomica El Alto»): el mapa se centra en sus coordenadas y «Abrir en Google Maps» usa el enlace dado, también después de cargar el mapa. *Validación:* iframes con las coordenadas de los enlaces, sin violaciones de CSP, a 375/768/1440; pruebas de catálogo y de `direccionesDeMapa`.
- [x] **E3.7 Espacios entre secciones** — auditoría base de 16 rutas a 1440 y 375 (`scripts/auditar-espacios.mjs`) y corrección mínima: relleno doble entre secciones del mismo color (inicio, nosotros, ficha de cursos de temporada), franjas blancas bajo las ondas (pie sobre beige o rojo vino), bloque único de contenido de Cocina y Coctelería, caja amarilla de contacto sin margen en móvil, hueco de la tarjeta sin insignias, copyright tapado por el botón de WhatsApp (móvil y 768–1344 px, ahora con 16 px de holgura), requisitos alineados con la ficha y 404 centrada. *Validación:* 24 auditorías después de los cambios sin ningún tramo de un solo color entre secciones de `<main>`, sin desbordamiento ni errores de consola. Los ajustes fuera de la letra del pedido están en `CLAUDE.md` §16.3 para confirmar.
- [x] **E3.8 Herramientas de captura sin fugas** — `capturar-pagina.mjs` y la nueva `auditar-espacios.mjs` cierran Edge por CDP y borran su perfil. *Validación:* tras una ejecución quedan 0 procesos y 0 carpetas temporales (antes se acumularon 417 procesos y el disco C: quedó con 1 GB libre).
- [x] **E3.9 Revisión independiente** — 4 revisores (portada, convenios, cursos/contacto, código) y un verificador escéptico por revisor; 11 defectos confirmados, todos corregidos y reverificados sin regresiones. *Validación:* typecheck, 124 pruebas, build, `npm audit` 0, greps de §8 vacíos, 0 atributos `style` en el HTML servido.
- [ ] **E3.10 Deuda anterior detectada (fuera del pedido)** — a 320 px la portada desborda 14 px por la sección de cifras y el encabezado de páginas interiores 1 px; el botón de WhatsApp abierto mide más que la pantalla. Sin tocar hasta que el usuario lo pida.

## Bloqueadas (dependen del usuario o del cliente)

- [x] ~~**B1 Crear el repositorio remoto en GitHub y hacer push**~~ — resuelto en E2.A1.
- [x] ~~**B2 Crear el proyecto Supabase**~~ — resuelto en E2.A3 y E2.A4.
- [~] **B3 Respuestas del cliente P1–P12** (`docs/analisis` §6) — parcialmente resueltas por el usuario el 2026-10-01 (P5 parcial, P7, P9); el resto sigue abierto para la demostración. Ver `docs/analisis/aclaraciones-2026-10-01.md`.
- [~] **B4 Material de marca** — recibidos 2 logotipos y 9 fotografías (`FOTOS-WEB`); faltan los de E2.D2.
- [~] **B5 Confirmar denominaciones y discrepancias** — jerarquía aclarada (TEC-NIB → Bolivia Gourmet); queda el nombre exacto de la UB (ver aclaraciones).

## Entrega 4 — Sistema interno v1 (2026-10-02, rama `feat/sistema-interno` → `v1`)

Pedido del usuario: avanzar el sistema interno mientras llega la información
del cliente. Tableros atractivos y no saturados para personas con poca
experiencia en informática; insumos con **PEPS**; el resto con el método que
mejor convenga; administración gestiona inventarios y alumnos (carrera y
capacitación); contabilidad básica comprensible; iconos, imágenes y botones
intuitivos; la esencia de la marca; animaciones que confirman cada cambio; al
terminar, rama **v1**. Base de prueba: libertad para modificarla.

Diseño: `docs/sistema-interno/especificacion-v1.md` (3 propuestas
independientes unidas en una), `critica-de-la-especificacion.md` (43 puntos)
y `enmiendas-v1.md` (alcance real y resoluciones; **manda**).

- [x] **E4.0 Diseño y alcance** — tres propuestas (datos y control, facilidad de uso, contabilidad e inventario), síntesis, crítica de completitud y enmiendas. *Validación:* las 43 observaciones de la crítica tienen resolución o pasan a la v1.1 (enmiendas §A.2 y §B).
- [x] **E4.R0 Dominio puro** — valuación PEPS (insumos, con vencidos según el caso) y costo promedio (resto) con cantidades en milésimas enteras (BigInt) y remanente exacto; movimientos con deltas (sin el ajuste que fija), conteo, préstamo, entrega; inscripciones inscrito/retirado/concluido con solicitud y renovación; grupos en masculino, de temporada, nombre visible, planes y cuotas con fecha de puesta en marcha; caja (cargo, cobro con aplicación, arqueo, monto en letras); resumen contable. Se retiraron el caso de uso y el puerto viejos de inventario. *Validación:* typecheck limpio; 187/187 pruebas (las de §5.8 de la especificación al centavo, B.5, B.6). La revisión escéptica se cortó dos veces por cierre de sesión; se revisó a mano el motor de costos (valuacion.ts, cantidad.ts). Las pruebas corren en serie (`--test-concurrency=1`) por la memoria del equipo.
- [x] **E4.R1 Núcleo de base y esqueleto del panel** — migración `panel_nucleo` (permisos de administración y recepción, `app.hoy`, `app.exigir_permiso`, `app.exigir_sede`, tabla `operaciones` para no repetir un cobro por doble clic, `mi_contexto`); `/panel` con guardas, menú lateral (escritorio) e inferior (teléfono) por permisos, «Más», inicio con saludo, fecha de Bolivia, sede y cuatro acciones; secciones con aviso «en preparación»; iconos nuevos; animaciones de confirmación; traducción de errores; el personal que entra al portal pasa al panel (`?panel=no` evita el bucle si la cuenta está desactivada). *Validación:* batería `pruebas-rls-panel-v1.sql` 13/13 (revertida); typecheck limpio; 202/202 pruebas (errores de panel, menú por rol, fechas, B.11: cabecera DEFINER completa, fachadas INVOKER con `revoke … anon`, vistas `security_invoker`); build; `curl` sin sesión → 307 al acceso en `/panel`, `/panel/caja`, `/panel/mas`, con CSP y cabeceras; en la base `anon` no ejecuta ninguna función; advisors sin avisos nuevos salvo INFO (`operaciones` sin políticas a propósito). *No verificado por el asistente:* el panel con sesión del personal (lo prueba el usuario con las cuentas de demostración; el asistente no escribe contraseñas en servicios remotos). Sin sesión, `/panel/caja` vuelve a `/panel` tras el acceso (el layout no conoce la ruta).
- [x] **E4.R2 Alumnos y grupos** — fichas (crear, editar, archivar sin borrar), grupos con cupos y precio por paquete, inscribir en tres pasos (persona existente o nueva, grupo, revisión), renovar al año siguiente, retirar con motivo, requisitos entregados, cerrar grupo (concluye a sus inscritos), bandeja de solicitudes del portal con «Aprobar e inscribir», «Pedir más datos» y «Rechazar». Dos commits: base y aplicación (`a558eaa`); pantallas. *Validación:* batería 48/48 (R1 + N11–N29, revertida); typecheck; 216/216 pruebas (casos de uso con puerto falso, nombre del grupo = `app.nombre_de_grupo`, lector de montos, «hace cuánto»); build con las 13 rutas nuevas; `curl` sin sesión → 307 al acceso en todas; advisors sin avisos nuevos. Formularios del panel que no borran lo escrito ante un error y botón que no envía dos veces. *No verificado por el asistente:* las pantallas con sesión del personal (las prueba el usuario con Carla y Rosa). Las cuotas llegan con la caja (R3).
- [x] **E4.R3 Caja** — cuotas y cargos, cobros (efectivo, QR, transferencia) con recibo sin huecos e imprimible (monto en letras, «Recibo interno: no es factura»), lo que deben con WhatsApp, cerrar caja con cálculo en vivo («¡La caja cuadra!» / «Faltan Bs 5,00»), arqueos, anular cobro y cargo, cargo manual, cuotas de un grupo, cuenta en la ficha del alumno. Gasto: RPC lista; su pantalla va con Contabilidad (R6). Dos commits: base (`164d338`) y pantallas. *Validación:* batería de caja 30/30 (revertida); typecheck; 222/222 pruebas (casos de uso de caja con puerto falso); build con las 7 rutas de caja; `curl` sin sesión → 307; greps vacíos; advisors sin avisos nuevos. *No verificado por el asistente:* las pantallas con sesión del personal.
- [ ] **E4.R4 Inventario** — motor PEPS (insumos) y promedio (resto), saldo inicial, compra, uso en clase, baja, conteo físico, anulación, existencias y kárdex.
- [ ] **E4.R5 Uniformes y utensilios** — entrega con cargo o cobro, cambio de talla, devolución, préstamo y devolución con pérdidas.
- [ ] **E4.R6 Contabilidad** — resumen del mes, dinero que entró y salió, gastos, compras, inventario valorizado, tarjeta kárdex PEPS, cuadre.
- [ ] **E4.R7 Tableros** — recepción y administración, pocas tarjetas con acción, gráfico SVG, estados vacíos con la marca.
- [ ] **E4.R8 Datos de demostración** — semilla con fecha simulada que pasa por las RPC reales; borrado ampliado.
- [ ] **E4.R9 Revisión y entrega** — revisión independiente, documentación, rama `v1` y push.

### Pasa a la v1.1 (enmiendas §A.2)

- [ ] Cierre y reapertura de mes · auditoría · verificación de QR y revisión de arqueos · pantalla de conceptos · devolver sobrantes de insumos a sus lotes · ajuste de valor · prueba de uso con adultos reales (pendiente del usuario).

## Fase 5 — Página web informativa (rama `feat/pagina-web`)

- [ ] **5.1 Crear la rama** desde `main` cuando empiece esta línea.
- [ ] **5.2 Contenido** — completar `contenido/` (convenios, beneficios, sección emprender, requisitos) desde el documento; sin inventar. *Dependencia:* B4, B5 para publicar.
- [ ] **5.3 Componentes de marca** — `TituloDeMarca`, `RayasDeBrillo`, `Insignia`, `ListaConCheck`, `SeparadorOndulado`, `CajaDeFicha`, `CintaDeContacto`, `EtiquetaPromo` (docs/brand §7).
- [ ] **5.4 Páginas** — inicio, quiénes somos, carrera (plan de estudios, horarios, requisitos), cursos (uno por curso, línea rojo vino), convenios, emprender, contacto y sedes (WhatsApp por sede, mapa bajo demanda). *Validación:* responsive móvil/tablet/escritorio; Lighthouse; contraste AA; `curl` de rutas y 404.
- [ ] **5.5 SEO y despliegue** — metadatos, `sitemap`, `robots` (quitar `noindex`), proyecto Vercel, dominio (P12).
- [ ] **5.6 Documentación y `TASKS.md`**.

## Fase 6 — Página web dinámica

- [ ] **6.1 Registro de interesados / solicitud de inscripción** con integración al panel. *Dependencia:* fase 3.
- [ ] **6.2 Renovación de gestión para antiguos alumnos.** *Dependencia:* definición del cliente.

## Transversal

- [ ] **T1 ESLint** (configuración propia; `next lint` ya no existe en Next 16).
- [ ] **T2 CI** — `typecheck`, `test`, `build`, `audit` y greps en cada push. *Dependencia:* B1.
- [ ] **T3 HawkScan** cuando exista `HAWK_API_KEY` y superficie HTTP con sesión.
- [ ] **T4 Corregir en el documento y en el catálogo** las erratas confirmadas por el cliente (B5).
