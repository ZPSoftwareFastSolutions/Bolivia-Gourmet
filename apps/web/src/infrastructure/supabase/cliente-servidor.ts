/**
 * CAPA: Infrastructure / Supabase
 *
 * Cliente de Supabase para el SERVIDOR (Server Components, Server Actions y
 * Route Handlers). La sesión viaja en cookies `HttpOnly` (ver `cookies.ts`),
 * nunca en `localStorage`. Este módulo jamás se importa desde un componente
 * de cliente: no hay cliente de Supabase en el navegador (`connect-src 'self'`).
 */

import 'server-only';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { exigirConfiguracionSupabase } from './configuracion';
import { endurecerCookie } from './cookies';
import type { Database } from './tipos-de-base.generados';

export type ClienteSupabase = SupabaseClient<Database>;

const PRODUCCION = process.env.NODE_ENV === 'production';

export async function crearClienteDeServidor(): Promise<ClienteSupabase> {
  const { url, clavePublicable } = exigirConfiguracionSupabase();
  const almacen = await cookies();

  return createServerClient<Database>(url, clavePublicable, {
    cookies: {
      getAll() {
        return almacen.getAll();
      },
      setAll(cookiesNuevas) {
        try {
          for (const { name, value, options } of cookiesNuevas) {
            almacen.set(name, value, endurecerCookie(options, PRODUCCION));
          }
        } catch {
          // Un Server Component no puede escribir cookies. La renovación del
          // token la hace el proxy, así que aquí se ignora sin ruido: lanzar
          // rompería la página por algo que ya está cubierto.
        }
      },
    },
  });
}

/** Cookie de sesión de Supabase: `sb-<ref>-auth-token`, que puede venir troceada. */
export async function afirmaTenerSesion(): Promise<boolean> {
  const almacen = await cookies();
  return almacen.getAll().some((c) => c.name.startsWith('sb-') && c.name.includes('auth-token'));
}
