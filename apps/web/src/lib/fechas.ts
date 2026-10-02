/**
 * Fechas en la zona horaria de Bolivia. La base guarda UTC; mostrar UTC haría
 * que una solicitud enviada a las 21:00 en La Paz figure con fecha del día
 * siguiente (lección del proyecto anterior).
 */

const ZONA = 'America/La_Paz';

const FECHA = new Intl.DateTimeFormat('es-BO', { dateStyle: 'long', timeZone: ZONA });
const FECHA_Y_HORA = new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeStyle: 'short', timeZone: ZONA });

export function formatearFecha(iso: string): string {
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? '—' : FECHA.format(fecha);
}

export function formatearFechaYHora(iso: string): string {
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? '—' : FECHA_Y_HORA.format(fecha);
}

const DIA_LARGO = new Intl.DateTimeFormat('es-BO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const HORA = new Intl.DateTimeFormat('es-BO', { hour: 'numeric', hourCycle: 'h23', timeZone: ZONA });

/** «viernes, 2 de octubre» a partir de una fecha de negocio `AAAA-MM-DD`. */
export function formatearDiaLargo(fecha: string): string {
  const valor = new Date(`${fecha}T12:00:00Z`);
  return Number.isNaN(valor.getTime()) ? '—' : DIA_LARGO.format(valor);
}

/** Hora actual en La Paz (0–23), para el saludo. */
export function horaEnBolivia(ahora: Date = new Date()): number {
  return Number(HORA.format(ahora));
}
