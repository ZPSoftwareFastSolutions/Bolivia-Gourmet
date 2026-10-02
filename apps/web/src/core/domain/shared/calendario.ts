/**
 * CAPA: Domain / Shared
 *
 * Cuentas de calendario sobre `FechaISO` (`AAAA-MM-DD`), sin hora ni zona.
 * La fecha de negocio la da la base (`app.hoy()`, hora de La Paz); aquí solo
 * se suman meses y se cuentan días, igual que lo hace PostgreSQL.
 *
 * Sin React, sin Next, sin I/O.
 */

import type { FechaISO } from './tipos-base';

const MS_POR_DIA = 86_400_000;

function aUtc(fecha: FechaISO): number {
  return Date.parse(`${fecha}T00:00:00Z`);
}

function desdeUtc(milisegundos: number): FechaISO {
  return new Date(milisegundos).toISOString().slice(0, 10) as FechaISO;
}

/**
 * `fecha + interval 'n months'` de PostgreSQL: si el día no existe en el mes
 * de llegada, se queda en el último día de ese mes (31/01 + 1 mes = 28/02).
 * Se calcula siempre desde la fecha dada, nunca encadenando: 31/01 + 2 meses
 * es 31/03, no 28/03.
 */
export function sumarMeses(fecha: FechaISO, meses: number): FechaISO {
  const [anio = 0, mes = 1, dia = 1] = fecha.split('-').map(Number);
  const indice = anio * 12 + (mes - 1) + meses;
  const anioDestino = Math.floor(indice / 12);
  const mesDestino = indice - anioDestino * 12; // 0..11
  const ultimoDia = new Date(Date.UTC(anioDestino, mesDestino + 1, 0)).getUTCDate();
  return desdeUtc(Date.UTC(anioDestino, mesDestino, Math.min(dia, ultimoDia)));
}

/** Días de `desde` a `hasta` (negativo si `hasta` es anterior). */
export function diasEntre(desde: FechaISO, hasta: FechaISO): number {
  return Math.round((aUtc(hasta) - aUtc(desde)) / MS_POR_DIA);
}

/** `AAAA-MM` de una fecha: el mes en que cuenta en el resumen. */
export function mesDe(fecha: FechaISO): string {
  return fecha.slice(0, 7);
}

export function anioDe(fecha: FechaISO): number {
  return Number(fecha.slice(0, 4));
}

/** Abreviaturas que usa el nombre de un grupo («oct 2026»). */
export const MES_ABREVIADO: readonly string[] = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** «oct 2026». */
export function mesYAnio(fecha: FechaISO): string {
  const mes = Number(fecha.slice(5, 7));
  return `${MES_ABREVIADO[mes - 1] ?? '?'} ${fecha.slice(0, 4)}`;
}
