/**
 * CAPA: Presentation / App — Contabilidad (panel interno).
 *
 * Guarda de la sección: `contabilidad.leer`. El contenido llega en su rebanada
 * (enmiendas §C); mientras tanto, un aviso claro en lugar de una página vacía.
 */

import type { Metadata } from 'next';
import { RUTAS_PANEL } from '@/lib/rutas';
import { SeccionEnPreparacion } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../_sesion';

export const metadata: Metadata = { title: 'Contabilidad' };

export default async function Contabilidad() {
  const lectura = await exigirPersonal(RUTAS_PANEL.contabilidad);
  if (lectura.estado !== 'ok') return null;
  exigirPermiso(lectura.contexto, 'contabilidad.leer');
  return <SeccionEnPreparacion titulo="Contabilidad" icono="libro" texto="Aquí estarán el resumen del mes, los gastos, las compras y el inventario valorizado." />;
}
