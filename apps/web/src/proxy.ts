/**
 * CAPA: Infraestructura HTTP — proxy de Next 16 (antes «middleware»).
 *
 * Dos trabajos, ninguno de autorización:
 *
 * 1. CSP ESTRICTA CON NONCE en cada página (ADR 0006). El nonce viaja en la
 *    respuesta (la que aplica el navegador) y en la petición que sigue hacia
 *    la página: Next lo lee de ahí y se lo pone a sus scripts.
 *
 * 2. RENOVAR LA SESIÓN en el portal y en el panel interno. Los tokens de Supabase caducan en una
 *    hora; sin esto la sesión se caería mientras el estudiante rellena una
 *    solicitud. Solo en `/portal` y `/auth`: en las páginas públicas no hay
 *    sesión que renovar y consultar a Supabase en cada visita sumaría latencia
 *    sin motivo.
 *
 * NO decide accesos. Cada página del portal comprueba la sesión con
 * `getUser()` y, sobre todo, la base aplica RLS. Un proxy se salta con un
 * cambio de `matcher`; confiar en él para autorizar es dejar huecos.
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { endurecerCookie } from '@infra/supabase/cookies';
import { configuracionSupabase } from '@infra/supabase/configuracion';
import { nuevoNonce, politicaDeContenido } from '@/lib/politica-de-contenido';

const PRODUCCION = process.env.NODE_ENV === 'production';

function conSesion(ruta: string): boolean {
  return (
    ruta === '/portal' ||
    ruta.startsWith('/portal/') ||
    ruta === '/panel' ||
    ruta.startsWith('/panel/') ||
    ruta.startsWith('/auth/')
  );
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const nonce = nuevoNonce();
  const politica = politicaDeContenido({ nonce, desarrollo: !PRODUCCION });

  const cabeceras = new Headers(request.headers);
  cabeceras.set('x-nonce', nonce);
  cabeceras.set('Content-Security-Policy', politica);

  let respuesta = NextResponse.next({ request: { headers: cabeceras } });

  const configuracion = configuracionSupabase();
  if (configuracion && conSesion(request.nextUrl.pathname)) {
    const supabase = createServerClient(configuracion.url, configuracion.clavePublicable, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesNuevas) {
          for (const { name, value } of cookiesNuevas) request.cookies.set(name, value);
          // `cabeceras` se clonó ANTES de renovar el token: sin copiar la cookie
          // actualizada, la página de esta misma petición leería el token viejo
          // (el `middleware.ts` del proyecto anterior pasaba la petición mutada
          // justo por esto).
          cabeceras.set('cookie', request.headers.get('cookie') ?? '');
          respuesta = NextResponse.next({ request: { headers: cabeceras } });
          for (const { name, value, options } of cookiesNuevas) {
            // Mismo endurecimiento que en el cliente de servidor: si el proxy
            // reescribiera la cookie con las opciones por defecto, desharía el
            // HttpOnly en la siguiente renovación del token.
            respuesta.cookies.set(name, value, endurecerCookie(options, PRODUCCION));
          }
        },
      },
    });
    // `getUser()` valida el token contra el servidor y dispara la renovación.
    await supabase.auth.getUser();
  }

  respuesta.headers.set('Content-Security-Policy', politica);
  return respuesta;
}

export const config = {
  matcher: [
    {
      // Solo PÁGINAS (y las acciones de servidor, que van a la ruta de su
      // página). Quedan fuera los archivos: no necesitan nonce y se sirven
      // sin ejecutar esta función. La lista de extensiones debe coincidir con
      // ARCHIVOS en next.config.ts: Next exige que el matcher sea un literal.
      source:
        '/((?!_next/static|_next/image|.+\\.(?:ico|png|jpe?g|webp|avif|gif|svg|woff2?|css|js|map|txt|xml|json|webmanifest)$).*)',
      // Las precargas de <Link> traen datos, no HTML: no ejecutan scripts.
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
