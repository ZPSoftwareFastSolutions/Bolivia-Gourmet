# TASKS.md — Panel de tareas

> Estados: `[ ]` pendiente · `[~]` en progreso · `[x]` completada · `[!]` bloqueada.
>
> **Regla:** una tarea pasa a `[x]` solo cuando está implementada, verificada
> (typecheck, pruebas, build, audit y las pruebas de su nivel), sin errores
> críticos conocidos, con la documentación actualizada y con la validación
> anotada en la propia tarea. Escribir el código no es terminar la tarea.
>
> Última actualización: 2026-09-30.

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
- [~] **E2.B3 Identidad con los logotipos oficiales** — colores medidos de los PNG oficiales; logotipos e imágenes optimizados. *Validación:* tamaño de cada recurso publicado.

### E2.C Página web (rama `feat/pagina-web`)
- [ ] **E2.C1 Escudos de seguridad** — CSP estricta con nonce (sin `'unsafe-inline'`), HSTS, `frame-ancestors 'none'`, cookies de sesión `HttpOnly`, `no-store` en páginas con sesión. *Validación:* `curl -I` en cada ruta.
- [ ] **E2.C2 Sistema de diseño y componentes de marca** (skills ui-ux-pro-max, brand, design). *Validación:* contraste AA, foco visible, 44 px táctiles, sin atributos `style`.
- [ ] **E2.C3 Páginas públicas** — inicio, nosotros, carrera, cursos (índice y uno por curso), convenios, emprende, contacto, privacidad, 404. *Validación:* capturas en móvil, tablet y escritorio.
- [ ] **E2.C4 Portal de estudiantes** — registro, acceso, recuperación de clave, panel con solicitudes, nueva inscripción, renovación, cancelación, pago por QR (informativo). *Validación:* pruebas de dominio y casos de uso; flujo real pendiente de E2.D1.
- [ ] **E2.C5 Calidad** — typecheck, pruebas, build, audit, greps de capas antes y después de cada cambio.
- [ ] **E2.C6 Documentación** — `CLAUDE.md`, `TASKS.md`, ADR nuevos.

### E2.D Pendiente del usuario o del cliente
- [!] **E2.D1 Configurar URL del sitio en Supabase Auth** (Site URL y Redirect URLs) para que los correos de confirmación y recuperación vuelvan al sitio. Sin ese paso el registro crea la cuenta pero el enlace del correo apunta a `http://localhost:3000`. *Dependencia:* usuario (no hay herramienta para la configuración de Auth).
- [!] **E2.D2 Recursos a pedir al cliente** — logotipos en blanco o SVG, QR bancario para cobros, fotos de cursos cortos, sede de El Alto, Chef Oscar Mora, logotipos de socios, enlaces de Facebook, YouTube y comunidad de WhatsApp.

## Bloqueadas (dependen del usuario o del cliente)

- [x] ~~**B1 Crear el repositorio remoto en GitHub y hacer push**~~ — resuelto en E2.A1.
- [x] ~~**B2 Crear el proyecto Supabase**~~ — resuelto en E2.A3 y E2.A4.
- [~] **B3 Respuestas del cliente P1–P12** (`docs/analisis` §6) — parcialmente resueltas por el usuario el 2026-10-01 (P5 parcial, P7, P9); el resto sigue abierto para la demostración. Ver `docs/analisis/aclaraciones-2026-10-01.md`.
- [~] **B4 Material de marca** — recibidos 2 logotipos y 9 fotografías (`FOTOS-WEB`); faltan los de E2.D2.
- [~] **B5 Confirmar denominaciones y discrepancias** — jerarquía aclarada (TEC-NIB → Bolivia Gourmet); queda el nombre exacto de la UB (ver aclaraciones).

## Fase 1 — Sistema interno · base (rama `feat/sistema-interno`)

- [ ] **1.1 Cliente Supabase de servidor** — `@supabase/ssr` + `@supabase/supabase-js` exactas; cookie `HttpOnly`; validación de variables **al usar**, no al importar. *Dependencia:* B2.
- [ ] **1.2 Migración: sedes** — tabla `sedes` con semilla La Paz y El Alto; RLS. *Dependencia:* B2.
- [ ] **1.3 Migración: identidad y permisos** — `app_users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `user_sedes`; funciones `app.current_app_user_id`, `app.has_permission`, `app.puede_operar_sede`; disparador de alta; semilla de roles provisional (administrador, secretaría, almacén, dirección) hasta P9. *Dependencia:* B2.
- [ ] **1.4 Batería RLS con sesión simulada** — `docs/runbooks/pruebas-rls-fase1.sql`. *Validación:* cada rol ve y escribe solo lo suyo; una cuenta sin sede no opera en ella.
- [ ] **1.5 Login y guardas** — `/panel/acceso`, `exigirPermiso`, `contextoDeAccion`, cabecera del panel con tokens de marca. *Validación:* códigos HTTP con `curl` (sin sesión → redirección; sin permiso → 403).
- [ ] **1.6 Actualizar `CLAUDE.md` §4 y §9, `TASKS.md`**.

## Fase 2 — Sistema interno · inventario

- [ ] **2.1 Migraciones** — `categorias`, `articulos`, `variantes`, `movimientos` (sin UPDATE/DELETE), `entregas`; vista `v_stock`; `CHECK`/disparador de stock ≥ 0; RLS por permiso y sede. *Validación:* batería RLS + medición con 50 000 movimientos en transacción revertida.
- [ ] **2.2 Repositorio Supabase** que implemente `InventarioRepositoryPort` (creado por petición). *Validación:* casos de uso contra la base con sesión de prueba.
- [ ] **2.3 Pantallas** — artículos y variantes (alta, edición, inactivar), movimientos (entrada, salida, ajuste con motivo, baja con motivo), existencias por sede, bajo mínimo. *Validación:* flujo manual completo; responsive móvil; estados vacíos; errores legibles.
- [ ] **2.4 Entregas a estudiantes** — con contexto explícito; devolución. *Dependencia:* fase 3 (inscripciones) para elegir a quién. *Regla I7 pendiente de P2.*
- [ ] **2.5 Documentación y `TASKS.md`**.

## Fase 3 — Sistema interno · estudiantes

- [ ] **3.1 Migraciones** — `programas` (desde el catálogo), `cohortes`, `estudiantes`, `inscripciones` (+ documentos entregados). *Validación:* batería RLS; `CHECK` de opciones de cohorte.
- [ ] **3.2 Sustituir el catálogo estático por la base** — solo cambia el composition root. *Validación:* pruebas del puerto con ambas implementaciones.
- [ ] **3.3 Pantallas** — estudiantes (ficha, alta, archivar), cohortes (abrir con opciones del programa, costo congelado), inscripciones (checklist de requisitos, paquete solo en carrera). *Validación:* flujos manuales; búsqueda paginada en la base.
- [ ] **3.4 Documentación y `TASKS.md`**.

## Fase 4 — Sistema interno · administración

- [ ] **4.1 Migraciones** — `pagos` (inmutables), `gastos`; vistas por período en `America/La_Paz`. *Dependencia:* P5–P8.
- [ ] **4.2 Pantallas** — registrar pago / gasto, anulación por asiento inverso, tablero (6 indicadores), reportes con CSV. *Validación:* cifras cuadradas contra consultas SQL directas.
- [ ] **4.3 Documentación y `TASKS.md`**.

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
