/**
 * CAPA: Presentation / App — Inventario (panel interno).
 *
 * Guarda de la sección: `inventario.leer`. El contenido llega en su rebanada
 * (enmiendas §C); mientras tanto, un aviso claro en lugar de una página vacía.
 */

import type { Metadata } from 'next';
import { RUTAS_PANEL } from '@/lib/rutas';
import { SeccionEnPreparacion } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../_sesion';

export const metadata: Metadata = { title: 'Inventario' };

export default async function Inventario() {
  const lectura = await exigirPersonal(RUTAS_PANEL.inventario);
  if (lectura.estado !== 'ok') return null;
  exigirPermiso(lectura.contexto, 'inventario.leer');
  return <SeccionEnPreparacion titulo="Inventario" icono="almacen" texto="Aquí estarán las existencias por sede, las compras, el uso de insumos en clase, las entregas de uniformes y los préstamos de utensilios." />;
}
