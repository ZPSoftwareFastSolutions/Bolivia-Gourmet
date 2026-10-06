/**
 * CAPA: Presentation / App — textos de un grupo en convocatoria (ADR 0009).
 *
 * Una sola forma de decir el horario, las fechas, el plazo, los cupos y el
 * precio de un grupo, para que «Nueva inscripción», «Renovar», «Mis cursos»
 * y «Mis solicitudes» digan lo mismo con las mismas palabras.
 */

import { describirHorario } from '@core/domain/academico/horario';
import { describirPlan } from '@core/domain/academico/programa';
import type { GrupoDelPortal } from '@core/domain/portal/convocatoria';
import { ETIQUETA_DE_PAQUETE } from '@core/domain/portal/solicitud';
import { formatearDia } from '@/lib/fechas';

export function horarioDeGrupo(grupo: GrupoDelPortal): string {
  return describirHorario(grupo);
}

/** «Del 7 de noviembre de 2026 al 2 de enero de 2027» o «Desde el 1 de febrero de 2027». */
export function fechasDeGrupo(grupo: GrupoDelPortal): string {
  const inicio = formatearDia(grupo.fechaInicio);
  return grupo.fechaFin ? `Del ${inicio} al ${formatearDia(grupo.fechaFin)}` : `Desde el ${inicio}`;
}

/** «Inscripciones hasta el 4 de noviembre de 2026». */
export function plazoDeGrupo(grupo: GrupoDelPortal): string | undefined {
  return grupo.inscripcionHasta ? `Inscripciones hasta el ${formatearDia(grupo.inscripcionHasta)}` : undefined;
}

export function cuposDeGrupo(grupo: GrupoDelPortal): string {
  if (grupo.libres === undefined) return 'Sin límite de cupos';
  return grupo.libres === 1 ? '1 cupo libre' : `${grupo.libres} cupos libres`;
}

/** Un precio por paquete en la carrera; sin plan cargado, «Consultar» (no se inventa). */
export function preciosDeGrupo(grupo: GrupoDelPortal): readonly string[] {
  if (grupo.precios.length === 0) return ['Precio: Consultar'];
  return grupo.precios.map((p) => (p.paquete ? `${ETIQUETA_DE_PAQUETE[p.paquete]}: ${describirPlan(p)}` : `Precio: ${describirPlan(p)}`));
}

/** Las líneas que acompañan al nombre del grupo en una tarjeta. */
export function lineasDeGrupo(grupo: GrupoDelPortal, { conPlazo = true, conCupos = true, conPrecio = true } = {}): readonly string[] {
  const plazo = conPlazo ? plazoDeGrupo(grupo) : undefined;
  return [
    `Sede ${grupo.sedeNombre}`,
    horarioDeGrupo(grupo),
    fechasDeGrupo(grupo),
    ...(plazo ? [plazo] : []),
    ...(conCupos ? [cuposDeGrupo(grupo)] : []),
    ...(conPrecio ? preciosDeGrupo(grupo) : []),
  ];
}

/** El último día del plazo entre varios grupos (para la tarjeta del programa). */
export function cierreMasLejano(grupos: readonly GrupoDelPortal[]): string | undefined {
  const fechas = grupos.map((g) => g.inscripcionHasta).filter((f): f is string => Boolean(f)).sort();
  const ultima = fechas[fechas.length - 1];
  return ultima ? formatearDia(ultima) : undefined;
}
