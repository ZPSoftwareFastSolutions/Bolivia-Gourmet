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

const DIA_BOLIVIA = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: ZONA });

/** Fecha de calendario de La Paz (AAAA-MM-DD) de un instante. */
export function diaEnBolivia(instante: Date): string {
  return DIA_BOLIVIA.format(instante);
}

/** «hoy», «ayer», «hace 3 días», «hace 2 semanas», «hace 3 meses» (días de calendario de La Paz). */
export function haceCuanto(iso: string, ahora: Date = new Date()): string {
  const momento = new Date(iso);
  if (Number.isNaN(momento.getTime())) return '—';
  const dias = Math.round((Date.parse(diaEnBolivia(ahora)) - Date.parse(diaEnBolivia(momento))) / 86_400_000);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 14) return `hace ${dias} días`;
  if (dias < 60) return `hace ${Math.floor(dias / 7)} semanas`;
  return `hace ${Math.floor(dias / 30)} meses`;
}

const DIA_CORTO = new Intl.DateTimeFormat('es-BO', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });

/** Fecha de negocio `AAAA-MM-DD` en largo («5 de septiembre de 2026»), sin correrse de día. */
export function formatearDia(fecha: string): string {
  return formatearFecha(`${fecha}T12:00:00Z`);
}

/** «05/09»: así se nombra un lote en pantalla («la compra del 05/09»). */
export function formatearDiaCorto(fecha: string): string {
  const valor = new Date(`${fecha}T12:00:00Z`);
  return Number.isNaN(valor.getTime()) ? '—' : DIA_CORTO.format(valor);
}
