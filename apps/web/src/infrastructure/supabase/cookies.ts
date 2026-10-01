/**
 * CAPA: Infrastructure / Supabase
 *
 * Endurecimiento de la cookie de sesión.
 *
 * `@supabase/ssr` no marca la cookie `HttpOnly` porque su caso general
 * contempla un cliente de Supabase en el navegador que necesita leer el token.
 * Aquí no lo hay: acceso, registro, cierre de sesión y consultas ocurren en el
 * servidor. Con la cookie legible, un XSS se llevaría el token de acceso Y el
 * de refresco y podría renovar la sesión indefinidamente desde fuera.
 */

import type { CookieOptions } from '@supabase/ssr';

export function endurecerCookie(opciones: CookieOptions | undefined, produccion: boolean): CookieOptions {
  return {
    ...opciones,
    httpOnly: true,
    // `Secure` solo en producción: en http://localhost el navegador la
    // descartaría y la sesión sería imposible de probar.
    secure: produccion,
    // `lax` deja pasar la navegación normal desde el enlace del correo y corta
    // el envío en peticiones cruzadas de terceros (CSRF).
    sameSite: 'lax',
    path: '/',
  };
}
