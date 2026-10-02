/**
 * CAPA: Presentation / App — Alumnos (panel interno).
 *
 * Guarda de la sección: `estudiantes.leer`. El contenido llega en su rebanada
 * (enmiendas §C); mientras tanto, un aviso claro en lugar de una página vacía.
 */

import type { Metadata } from 'next';
import { RUTAS_PANEL } from '@/lib/rutas';
import { SeccionEnPreparacion } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../_sesion';

export const metadata: Metadata = { title: 'Alumnos' };

export default async function Alumnos() {
  const lectura = await exigirPersonal(RUTAS_PANEL.alumnos);
  if (lectura.estado !== 'ok') return null;
  exigirPermiso(lectura.contexto, 'estudiantes.leer');
  return <SeccionEnPreparacion titulo="Alumnos" icono="graduacion" texto="Aquí estarán las fichas de los alumnos, los grupos con sus cupos, las inscripciones y la bandeja de solicitudes del portal." />;
}
