/**
 * CAPA: Domain / Académico
 *
 * Horario de un grupo y cruce de horarios (ADR 0009 §3). Es la gemela de
 * `app.dias_de_clase` y `app.cruce_de_grupos` en la base: las mismas reglas,
 * en el mismo orden, probadas con los mismos casos. La pantalla anticipa (un
 * grupo que se cruza aparece desactivado con su motivo) y la base decide.
 *
 * Sin React, sin Next, sin I/O.
 */

import { etiquetaCortaDeDias, type Turno } from './programa';

export type DiaDeLaSemana = 'lun' | 'mar' | 'mie' | 'jue' | 'vie' | 'sab' | 'dom';

export const SEMANA: readonly DiaDeLaSemana[] = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];

export const NOMBRE_DEL_DIA: Record<DiaDeLaSemana, string> = {
  lun: 'Lunes',
  mar: 'Martes',
  mie: 'Miércoles',
  jue: 'Jueves',
  vie: 'Viernes',
  sab: 'Sábado',
  dom: 'Domingo',
};

/** Lo que el cruce necesita de un grupo. Fechas ISO (`2026-10-24`) y horas `HH:MM`. */
export interface HorarioDeGrupo {
  readonly dias?: string;
  readonly turno?: Turno;
  readonly horaInicio?: string;
  readonly horaFin?: string;
  readonly fechaInicio: string;
  readonly fechaFin?: string;
}

export type Cruce = 'se_cruza' | 'no_se_cruza' | 'sin_horario';

/** `lun-vie` → lunes a viernes; `sab` → sábado; sin días o desconocido → ninguno. */
export function diasDeClase(codigo: string | undefined): readonly DiaDeLaSemana[] {
  if (!codigo) return [];
  const [desde, hasta, ...resto] = codigo.split('-');
  if (resto.length > 0) return [];
  const inicio = SEMANA.indexOf(desde as DiaDeLaSemana);
  const fin = hasta === undefined ? inicio : SEMANA.indexOf(hasta as DiaDeLaSemana);
  if (inicio < 0 || fin < 0 || fin < inicio) return [];
  return SEMANA.slice(inicio, fin + 1);
}

const SIN_FIN = '9999-12-31';
const TURNOS_COMPARABLES: readonly Turno[] = ['manana', 'tarde', 'noche'];

function tieneHoras(g: HorarioDeGrupo): g is HorarioDeGrupo & { readonly horaInicio: string; readonly horaFin: string } {
  return Boolean(g.horaInicio && g.horaFin);
}

/**
 * ¿Se cruzan dos grupos? En este orden (ADR 0009 §3):
 * 1. si las fechas no se tocan (sin fin = sigue abierto), no se cruzan;
 * 2. si a alguno le faltan los días, no se sabe (`sin_horario`);
 * 3. si no comparten ningún día, no se cruzan;
 * 4. con horas en los dos, se cruzan si las horas se solapan (terminar a la
 *    hora en que el otro empieza no es cruce);
 * 5. sin horas pero con turno (mañana, tarde o noche) en los dos, se cruzan
 *    si es el mismo turno;
 * 6. si no, no se sabe.
 */
export function cruceDeHorarios(a: HorarioDeGrupo, b: HorarioDeGrupo): Cruce {
  if (a.fechaInicio > (b.fechaFin ?? SIN_FIN) || b.fechaInicio > (a.fechaFin ?? SIN_FIN)) return 'no_se_cruza';
  const diasA = diasDeClase(a.dias);
  const diasB = diasDeClase(b.dias);
  if (diasA.length === 0 || diasB.length === 0) return 'sin_horario';
  if (!diasA.some((d) => diasB.includes(d))) return 'no_se_cruza';
  if (tieneHoras(a) && tieneHoras(b)) {
    return a.horaInicio < b.horaFin && b.horaInicio < a.horaFin ? 'se_cruza' : 'no_se_cruza';
  }
  if (a.turno && b.turno && TURNOS_COMPARABLES.includes(a.turno) && TURNOS_COMPARABLES.includes(b.turno)) {
    return a.turno === b.turno ? 'se_cruza' : 'no_se_cruza';
  }
  return 'sin_horario';
}

/** «Sábados · 09:00–13:00», «Lun–Vie · 18:00–21:00», «Horario por confirmar». */
export function describirHorario(g: Pick<HorarioDeGrupo, 'dias' | 'horaInicio' | 'horaFin'>): string {
  const dias = g.dias ? etiquetaCortaDeDias(g.dias) : undefined;
  const horas = g.horaInicio && g.horaFin ? `${g.horaInicio}–${g.horaFin}` : undefined;
  const partes = [dias, horas].filter((p): p is string => Boolean(p));
  return partes.length > 0 ? partes.join(' · ') : 'Horario por confirmar';
}

export interface BloqueDelHorario<T> {
  readonly inicio: string;
  readonly fin: string;
  readonly elemento: T;
}

export interface DiaDelHorario<T> {
  readonly dia: DiaDeLaSemana;
  readonly bloques: readonly BloqueDelHorario<T>[];
}

export interface HorarioSemanal<T> {
  /** Solo los días con clase, de lunes a domingo; cada día ordenado por hora. */
  readonly dias: readonly DiaDelHorario<T>[];
  /** Lo que no tiene días u horas: se lista aparte («horario por confirmar»). */
  readonly sinHora: readonly T[];
}

/** El horario personal: cada elemento en los días y horas de su grupo. */
export function horarioSemanal<T>(elementos: readonly T[], horarioDe: (elemento: T) => HorarioDeGrupo): HorarioSemanal<T> {
  const porDia = new Map<DiaDeLaSemana, BloqueDelHorario<T>[]>();
  const sinHora: T[] = [];
  for (const elemento of elementos) {
    const horario = horarioDe(elemento);
    const dias = diasDeClase(horario.dias);
    if (dias.length === 0 || !tieneHoras(horario)) {
      sinHora.push(elemento);
      continue;
    }
    for (const dia of dias) {
      const bloques = porDia.get(dia) ?? [];
      bloques.push({ inicio: horario.horaInicio, fin: horario.horaFin, elemento });
      porDia.set(dia, bloques);
    }
  }
  const dias = SEMANA.filter((d) => porDia.has(d)).map((dia) => ({
    dia,
    bloques: [...(porDia.get(dia) ?? [])].sort((x, y) => (x.inicio === y.inicio ? x.fin.localeCompare(y.fin) : x.inicio.localeCompare(y.inicio))),
  }));
  return { dias, sinHora };
}
