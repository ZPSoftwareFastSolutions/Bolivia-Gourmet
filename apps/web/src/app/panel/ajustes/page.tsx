/**
 * CAPA: Presentation / App — Ajustes (panel interno).
 *
 * Guarda de la sección: `perfiles.gestionar`. El contenido llega en su rebanada
 * (enmiendas §C); mientras tanto, un aviso claro en lugar de una página vacía.
 */

import type { Metadata } from 'next';
import { RUTAS_PANEL } from '@/lib/rutas';
import { SeccionEnPreparacion } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../_sesion';

export const metadata: Metadata = { title: 'Ajustes' };

export default async function Ajustes() {
  const lectura = await exigirPersonal(RUTAS_PANEL.ajustes);
  if (lectura.estado !== 'ok') return null;
  exigirPermiso(lectura.contexto, 'perfiles.gestionar');
  return <SeccionEnPreparacion titulo="Ajustes" icono="engranaje" texto="Aquí estará el personal: quién trabaja en el panel, con qué rol y en qué sede." />;
}
