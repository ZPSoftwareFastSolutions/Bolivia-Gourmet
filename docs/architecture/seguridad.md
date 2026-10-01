# Seguridad de la web y del portal

> Qué protege cada capa, dónde vive y cómo se comprobó. Decisión de fondo en
> el [ADR 0006](adr/0006-escudos-de-seguridad-de-la-web.md); autorización en
> la base en los ADR [0002](adr/0002-identidad-y-autorizacion-en-supabase.md)
> y [0005](adr/0005-tres-roles-y-portal-de-estudiantes.md).

## 1. Capas

| Capa | Qué decide | Dónde |
|---|---|---|
| Cabeceras HTTP | Qué puede cargar y ejecutar el navegador | `src/proxy.ts`, `src/lib/politica-de-contenido.ts`, `next.config.ts` |
| Proxy | Renueva la cookie de sesión en `/portal` y `/auth` | `src/proxy.ts` |
| Página | Exige sesión (`exigirSesion`) | `src/app/portal/_sesion.ts` |
| Server Action | Vuelve a exigir sesión; Next rechaza Origin ajeno (CSRF) | `src/app/portal/actions.ts` |
| Dominio | Valida datos y reglas antes de llamar al proveedor | `src/core/domain/*` |
| Base de datos | **Lo único que protege los datos de verdad**: RLS, grants por columna, disparadores | `supabase/migrations/*` |

## 2. Cabeceras medidas (servidor de producción, 2026-10-01)

| Cabecera | Valor |
|---|---|
| `Content-Security-Policy` (páginas) | `default-src 'self'; script-src 'self' 'nonce-…' 'strict-dynamic'; style-src 'self' 'nonce-…'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; media-src 'self'; frame-src https://www.google.com https://maps.google.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'; manifest-src 'self'; worker-src 'self'; upgrade-insecure-requests` |
| `Content-Security-Policy` (archivos) | `default-src 'none'; style-src 'self'; img-src 'self' data:; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), browsing-topics=()` |
| `Cross-Origin-Opener-Policy` / `-Resource-Policy` | `same-origin` / `same-origin` |
| `Cache-Control` (páginas) | `private, no-cache, no-store, max-age=0, must-revalidate` |
| `X-Powered-By` | ausente (`poweredByHeader: false`) |

Comprobaciones hechas: el nonce cambia en cada respuesta; los 10 scripts del
HTML de inicio llevan el nonce; 0 atributos `style`; consola del navegador
sin violaciones de CSP ni errores en escritorio y en móvil emulado.

## 3. Códigos de respuesta medidos

| Ruta | Sin sesión |
|---|---|
| Páginas públicas (8; Emprende se unió a Cursos el 2026-10-01) | 200 |
| `/cursos/no-existe`, rutas inexistentes | 404 real |
| `/portal`, `/portal/solicitud`, `/portal/renovacion` | 307 → `/portal/acceso?siguiente=…` |
| `/portal/acceso`, `/registro`, `/recuperar`, `/nueva-clave` | 200 |
| `/auth/confirmar?code=falso&siguiente=https://malicioso.com` | 307 → `/portal/acceso?aviso=enlace` (no sale del sitio) |
| `/favicon.ico` | 308 → `/icon.png` |
| `/emprende` | 308 → `/cursos` |

## 4. RLS vista desde fuera (API REST con la clave publicable)

| Petición | Resultado |
|---|---|
| `GET /sedes`, `GET /programas` | 200, solo filas activas |
| `GET /perfiles`, `/solicitudes`, `/permisos_de_rol` | 42501 (sin permiso) |
| `POST /solicitudes`, `POST /sedes` como anónimo | 42501 |
| `POST /rpc/tiene_permiso` | PGRST202: la función vive en `app`, fuera de la API |

Batería con sesiones simuladas: 39/39 (`docs/runbooks/pruebas-rls-entrega2.sql`).
`get_advisors(security)`: sin avisos.

## 5. Lo que queda fuera de esta capa (y por qué)

- **Contraseñas filtradas:** Supabase solo las comprueba en planes de pago.
  La política propia exige 10 caracteres, letras y números, y rechaza las
  triviales y las que contienen el correo.
- **Límites de intentos:** los aplica Supabase Auth (429 traducido a un
  mensaje legible). No hay WAF propio hasta desplegar.
- **Correo de confirmación:** el servidor de correo de Supabase del plan
  gratuito solo entrega a direcciones del equipo del proyecto. Para
  estudiantes reales hace falta SMTP propio o desactivar la confirmación
  (TASKS E2.D1).
- **Escaneo dinámico (HawkScan):** sin `HAWK_API_KEY` en la máquina (T3).
