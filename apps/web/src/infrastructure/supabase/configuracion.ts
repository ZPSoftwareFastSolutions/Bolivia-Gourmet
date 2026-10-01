/**
 * CAPA: Infrastructure / Supabase
 *
 * Configuración del proyecto Supabase, leída de las variables de entorno AL
 * USARLA, nunca al importar: validar al importar acopla el arranque de todo el
 * sitio a una sola pieza (en el proyecto anterior, un `throw` aquí tumbó el
 * build de las 25 páginas públicas, que no dependen de Supabase).
 *
 * Los dos valores son públicos por diseño (la clave publicable no concede
 * nada; decide RLS). Aun así no se versionan: viven en `.env.local` y en las
 * variables del despliegue. La clave `service_role` JAMÁS se usa en esta
 * aplicación.
 */

export interface ConfiguracionSupabase {
  readonly url: string;
  readonly clavePublicable: string;
}

export function configuracionSupabase(): ConfiguracionSupabase | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const clavePublicable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !clavePublicable) return null;
  // Una URL que no es https de supabase.co es casi seguro un error de copia:
  // mejor fallar cerrado que mandar credenciales a otro sitio.
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url)) return null;
  return { url, clavePublicable };
}

export function exigirConfiguracionSupabase(): ConfiguracionSupabase {
  const configuracion = configuracionSupabase();
  if (!configuracion) {
    throw new Error(
      'Falta la configuración de Supabase: definir NEXT_PUBLIC_SUPABASE_URL y ' +
        'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en apps/web/.env.local (ver .env.example).',
    );
  }
  return configuracion;
}
