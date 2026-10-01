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
