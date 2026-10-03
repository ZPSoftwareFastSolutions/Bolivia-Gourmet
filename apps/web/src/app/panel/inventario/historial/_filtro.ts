/**
 * CAPA: Presentation / App — filtros del historial del inventario leídos de la URL.
 *
 * `?tipo=baja,ajuste_faltante` y `?desde=100` llegan de los avisos del inicio
 * («Revisar bajas», «Ver entregas y pérdidas»), de los enlaces de la propia
 * página o escritos a mano. Se validan aquí, sin I/O, para que la página solo
 * pida a la base valores conocidos: un tipo desconocido se ignora (no rompe la
 * página ni filtra por algo que no existe) y un `desde` que no es un número
 * vale 0 (la primera página).
 */

import { TIPOS_DE_MOVIMIENTO, type TipoDeMovimiento } from '@core/domain/inventario/movimiento';

/** Movimientos por página del historial. */
export const MOVIMIENTOS_POR_PAGINA = 100;

/**
 * «baja,ajuste_faltante» → los tipos conocidos, sin repetir y en el orden en
 * que vienen. Vacío = sin filtro (todos los tipos).
 */
export function tiposDeParametro(texto: string): readonly TipoDeMovimiento[] {
  const tipos: TipoDeMovimiento[] = [];
  for (const parte of texto.split(',')) {
    const pedido = parte.trim();
    const tipo = TIPOS_DE_MOVIMIENTO.find((t) => t === pedido);
    if (tipo !== undefined && !tipos.includes(tipo)) tipos.push(tipo);
  }
  return tipos;
}

/**
 * Cuántas filas saltar: un entero sin signo de hasta 7 cifras; cualquier otra
 * cosa (vacío, negativo, decimales, letras), 0. Un salto mayor que el
 * historial no falla: la página dice que no hay más.
 */
export function desdeDeParametro(texto: string): number {
  const limpio = texto.trim();
  return /^\d{1,7}$/.test(limpio) ? Number(limpio) : 0;
}
