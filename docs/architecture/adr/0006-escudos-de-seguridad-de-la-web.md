# ADR 0006 — Escudos de seguridad de la web: CSP estricta con nonce, sesión solo en el servidor

**Estado:** Aceptada · **Fecha:** 2026-10-01 · **Ámbito:** página web y portal de estudiantes

## Contexto

El usuario pidió la página «con todos los escudos de seguridad arriba y con
las políticas establecidas». A diferencia de una landing estática, este sitio
tiene un portal con cuentas, datos personales (carnet, teléfono) y escrituras
en la base. El proyecto anterior del equipo (Mítico Fitness, ADR 0013 de aquel
repositorio) ya resolvió una CSP estricta con nonce en Next 16 y documentó lo
que falla al intentarlo sin nonce.

## Decisión

1. **CSP estricta con nonce en todas las páginas.** `src/proxy.ts` genera 128
   bits aleatorios por respuesta y publica la política de
   `src/lib/politica-de-contenido.ts`: `script-src 'self' 'nonce-…'
   'strict-dynamic'`, `style-src 'self' 'nonce-…'`, sin `'unsafe-inline'` ni
   `'unsafe-eval'` en producción. Next pone el nonce a sus scripts.
2. **Todas las páginas son dinámicas** (`connection()` en el layout raíz): un
   HTML generado en el build no puede llevar un nonce que cambia por visita.
   Las imágenes, fuentes, CSS y JS no pasan por el proxy y siguen saliendo
   como archivos.
3. **Ningún atributo `style` y ningún `next/image`.** La CSP los ignora y los
   anota como violación. Las imágenes oficiales se optimizan una vez
   (`npm run imagenes`) y se sirven con `<img srcset>` y dimensiones reales.
   Esto contradice la recomendación de la skill ui-ux-pro-max («usa
   next/image»); manda la seguridad. Una prueba lo vigila.
4. **El navegador nunca habla con Supabase** (`connect-src 'self'`). Registro,
   acceso, recuperación, lecturas y escrituras del portal ocurren en Server
   Components y Server Actions con `@supabase/ssr`. La cookie de sesión sale
   `HttpOnly`, `SameSite=Lax` y `Secure` en producción. Ningún componente de
   cliente importa Supabase (una prueba lo vigila).
5. **El proxy renueva la sesión solo en `/portal` y `/auth`.** No autoriza:
   cada página y cada Server Action vuelven a comprobar la sesión con
   `getUser()`, y la base decide con RLS.
6. **Cabeceras comunes** en `next.config.ts`: HSTS de dos años con subdominios
   (sin `preload` hasta tener dominio), `X-Frame-Options: DENY`,
   `nosniff`, `Referrer-Policy`, `Permissions-Policy` cerrada, COOP y CORP
   `same-origin`, CSP propia y cerrada para archivos.
7. **Redirecciones seguras.** Todo destino tras autenticarse pasa por
   `destinoSeguro()`: solo rutas internas del portal (sin redirección abierta).
8. **Sin formulario anónimo.** El contacto va por WhatsApp; las solicitudes
   exigen cuenta. Un formulario abierto sin captcha ni bandeja sería spam.
9. **Errores traducidos por código**, nunca mensajes técnicos de PostgreSQL o
   de Auth en pantalla. La recuperación de contraseña responde igual exista o
   no la cuenta.

## Consecuencias

**A favor**
- Un script o manejador inyectado no se ejecuta. Verificado: 10 de 10 scripts
  del HTML llevan el nonce, 0 atributos `style`, consola sin violaciones.
- La clave publicable ni siquiera viaja al navegador.
- La sesión no se puede robar con un XSS (cookie `HttpOnly`).

**En contra**
- Cada visita ejecuta el proxy y la página en vez de servir un archivo. Para
  el tráfico de un instituto está muy por debajo de lo que cubre el plan
  gratuito de Vercel.
- No se puede usar `next/image` ni estilos en línea: todo diseño se expresa
  con clases.

## Verificación

`tests/seguridad.test.ts` (CSP de producción, nonce, redirecciones, `style`,
`next/image`, secretos, Supabase en cliente, cookies, matcher) y `curl -I`
sobre el servidor de producción (`docs/architecture/seguridad.md`).
