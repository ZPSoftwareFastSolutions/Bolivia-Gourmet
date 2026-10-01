/**
 * CAPA: Presentation / App — guardas del portal.
 *
 * Cada página del portal comprueba la sesión AQUÍ (y la base vuelve a
 * comprobarla con RLS). El proxy solo renueva la cookie; no autoriza nada.
 *
 * `cache` de React: dentro de una misma petición, layout y página comparten
 * una sola validación del token contra Supabase.
 */

import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import type { EstadoDeSesion, UsuarioAutenticado } from '@core/application/ports/autenticacion.port';
import { autenticacion } from '@infra/config/composition-root';
import { RUTAS } from '@/lib/rutas';

export const estadoDeSesion = cache(async (): Promise<EstadoDeSesion> => {
  const auth = await autenticacion();
  return auth.estadoDeSesion();
});

/**
 * Exige sesión. Sin sesión → al acceso, recordando adónde volver.
 * `indisponible` (no se pudo comprobar) NO echa al estudiante: devuelve null
 * y la página muestra un aviso temporal.
 */
export async function exigirSesion(volverA: string): Promise<UsuarioAutenticado | null> {
  const sesion = await estadoDeSesion();
  if (sesion.estado === 'anonimo') redirect(`${RUTAS.acceso}?siguiente=${encodeURIComponent(volverA)}`);
  if (sesion.estado === 'indisponible') return null;
  return sesion.usuario;
}

/** En acceso y registro: quien ya tiene sesión va directo a su panel. */
export async function salirSiHaySesion(): Promise<void> {
  const sesion = await estadoDeSesion();
  if (sesion.estado === 'autenticado') redirect(RUTAS.portal);
}
