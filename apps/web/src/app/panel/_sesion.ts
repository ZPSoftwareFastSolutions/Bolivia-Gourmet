/**
 * CAPA: Presentation / App — guardas del panel interno.
 *
 * Cada página del panel llama a `exigirPersonal()` y, si su sección lo pide,
 * a `exigirPermiso()`. Cada Server Action vuelve a hacerlo. La base decide de
 * todos modos (RLS y la primera línea de cada motor): esto solo evita mostrar
 * lo que no se puede usar.
 *
 * Sin sesión → al acceso, recordando adónde volver. Estudiante → a su portal.
 */

import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { puedeEntrarAlPanel, tienePermiso, type ContextoDePanel, type Permiso } from '@core/domain/identidad/contexto-de-panel';
import { panelRepository } from '@infra/config/composition-root';
import { RUTAS, RUTAS_PANEL } from '@/lib/rutas';
import { estadoDeSesion } from '../portal/_sesion';

export type ContextoONulo = { readonly estado: 'ok'; readonly contexto: ContextoDePanel } | { readonly estado: 'indisponible' };

/** Una sola lectura del contexto por petición (layout y página la comparten). */
const leerContexto = cache(async (): Promise<ContextoONulo | null> => {
  const sesion = await estadoDeSesion();
  if (sesion.estado === 'anonimo') return null;
  if (sesion.estado === 'indisponible') return { estado: 'indisponible' };
  const resultado = await (await panelRepository()).contexto();
  if (!resultado.exito) return { estado: 'indisponible' };
  if (!resultado.valor || !puedeEntrarAlPanel(resultado.valor)) redirect(`${RUTAS.portal}?panel=no`);
  return { estado: 'ok', contexto: resultado.valor };
});

export async function exigirPersonal(volverA: string = RUTAS_PANEL.inicio): Promise<ContextoONulo> {
  const contexto = await leerContexto();
  if (!contexto) redirect(`${RUTAS.acceso}?siguiente=${encodeURIComponent(volverA)}`);
  return contexto;
}

/** Sin el permiso de la sección, de vuelta al inicio del panel con un aviso. */
export function exigirPermiso(contexto: ContextoDePanel, permiso: Permiso): void {
  if (!tienePermiso(contexto, permiso)) redirect(`${RUTAS_PANEL.inicio}?aviso=sin_permiso`);
}
