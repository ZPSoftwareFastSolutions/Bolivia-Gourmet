/**
 * CAPA: Presentation / Panel (lógica sin JSX)
 *
 * Secciones del panel interno (especificación §7.4, enmiendas A.1): pocas, con
 * nombres cotidianos y SIEMPRE icono y texto. Cada sección declara el permiso
 * que la muestra; la base vuelve a decidir en cada operación.
 */

import type { Permiso } from '@core/domain/identidad/contexto-de-panel';
import { RUTAS_PANEL } from '@/lib/rutas';
import type { NombreDeIcono } from '../icons/Icono';

export interface SeccionDelPanel {
  readonly href: string;
  readonly etiqueta: string;
  readonly icono: NombreDeIcono;
  /** Permiso que la muestra en el menú. */
  readonly permiso: Permiso;
  /** En el teléfono va en la barra inferior; si no, en «Más». */
  readonly enBarraInferior: boolean;
}

export const SECCIONES_DEL_PANEL: readonly SeccionDelPanel[] = [
  { href: RUTAS_PANEL.inicio, etiqueta: 'Inicio', icono: 'casa', permiso: 'panel.entrar', enBarraInferior: true },
  { href: RUTAS_PANEL.alumnos, etiqueta: 'Alumnos', icono: 'graduacion', permiso: 'estudiantes.leer', enBarraInferior: true },
  { href: RUTAS_PANEL.inventario, etiqueta: 'Inventario', icono: 'almacen', permiso: 'inventario.leer', enBarraInferior: true },
  { href: RUTAS_PANEL.caja, etiqueta: 'Caja', icono: 'monedas', permiso: 'caja.leer', enBarraInferior: true },
  { href: RUTAS_PANEL.contabilidad, etiqueta: 'Contabilidad', icono: 'libro', permiso: 'contabilidad.leer', enBarraInferior: false },
  { href: RUTAS_PANEL.ajustes, etiqueta: 'Ajustes', icono: 'engranaje', permiso: 'perfiles.gestionar', enBarraInferior: false },
];

/** Las secciones que puede ver quien tiene estos permisos, en orden. */
export function seccionesVisibles(permisos: ReadonlySet<string>): readonly SeccionDelPanel[] {
  return SECCIONES_DEL_PANEL.filter((s) => permisos.has(s.permiso));
}

/** Sección activa: la de prefijo más largo que coincide (Inicio solo en su ruta exacta). */
export function seccionActiva(ruta: string, secciones: readonly Pick<SeccionDelPanel, 'href'>[]): string | null {
  let mejor: string | null = null;
  for (const s of secciones) {
    const coincide = s.href === RUTAS_PANEL.inicio ? ruta === s.href : ruta === s.href || ruta.startsWith(`${s.href}/`);
    if (coincide && (mejor === null || s.href.length > mejor.length)) mejor = s.href;
  }
  return mejor;
}
