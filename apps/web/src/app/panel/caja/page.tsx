/**
 * CAPA: Presentation / App — Caja (panel interno).
 *
 * Guarda de la sección: `caja.leer`. El contenido llega en su rebanada
 * (enmiendas §C); mientras tanto, un aviso claro en lugar de una página vacía.
 */

import type { Metadata } from 'next';
import { RUTAS_PANEL } from '@/lib/rutas';
import { SeccionEnPreparacion } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../_sesion';

export const metadata: Metadata = { title: 'Caja' };

export default async function Caja() {
  const lectura = await exigirPersonal(RUTAS_PANEL.caja);
  if (lectura.estado !== 'ok') return null;
  exigirPermiso(lectura.contexto, 'caja.leer');
  return <SeccionEnPreparacion titulo="Caja" icono="monedas" texto="Aquí estarán los cobros con recibo, lo que deben los alumnos y el cierre de caja del día." />;
}
