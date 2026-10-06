/**
 * CAPA: Domain / Portal
 *
 * Inscripciones por convocatoria (ADR 0009): la institución abre un GRUPO con
 * horario y un plazo de inscripción, y el estudiante pide un grupo en
 * convocatoria. Aquí vive lo que el portal decide con esos grupos: qué se
 * ofrece en cada página, si un grupo se cruza con lo que la persona ya cursa
 * o ya pidió, y qué gestión anterior proponer al renovar.
 *
 * La base repite estas reglas al guardar (`app.validar_alta_de_solicitud` y
 * `app.validar_anio_de_solicitud`): la pantalla anticipa, la base decide.
 *
 * Sin React, sin Next, sin I/O.
 */

import { cruceDeHorarios, type HorarioDeGrupo } from '../academico/horario';
import { ordinal, type Modalidad, type TipoDePrograma, type Turno } from '../academico/programa';
import type { Paquete } from '../estudiantes/estudiante';
import type { Centavos, Id } from '../shared/tipos-base';
import type { EstadoDeSolicitud, TipoDeSolicitud } from './solicitud';

/** Precio del grupo: uno por paquete en la carrera, uno solo en los cursos. */
export interface PrecioDeGrupo {
  readonly paquete?: Paquete;
  readonly montoCuota: Centavos;
  readonly cuotas: number;
  readonly cadaMeses: number;
}

/** Un grupo tal como lo ve el estudiante: sin inscritos ni datos de nadie. */
export interface GrupoDelPortal {
  readonly id: Id;
  readonly programaCodigo: string;
  readonly programaNombre: string;
  readonly programaTipo: TipoDePrograma;
  readonly sedeId: Id;
  readonly sedeNombre: string;
  /** El nombre que arma la base (`app.nombre_de_grupo`): «Cocina · Sábados · oct 2026 · La Paz». */
  readonly nombre: string;
  readonly gestion: number;
  readonly anioDeCarrera?: number;
  readonly turno?: Turno;
  readonly dias?: string;
  readonly horaInicio?: string;
  readonly horaFin?: string;
  readonly duracion?: number;
  readonly modalidad?: Modalidad;
  readonly fechaInicio: string;
  readonly fechaFin?: string;
  readonly inscripcionDesde?: string;
  readonly inscripcionHasta?: string;
  /** Sin capacidad = sin límite de cupos. */
  readonly capacidad?: number;
  readonly libres?: number;
  readonly precios: readonly PrecioDeGrupo[];
}

export type EstadoDeInscripcionDelPortal = 'inscrito' | 'concluido';

export interface InscripcionDelPortal {
  readonly inscripcionId: Id;
  readonly estado: EstadoDeInscripcionDelPortal;
  readonly paquete?: Paquete;
  readonly grupo: GrupoDelPortal;
}

/** Lo propio de la persona: sus inscripciones y el grupo de cada solicitud que lo nombra. */
export interface MisGrupos {
  readonly inscripciones: readonly InscripcionDelPortal[];
  readonly solicitudes: readonly { readonly solicitudId: Id; readonly grupo: GrupoDelPortal }[];
}

export const SIN_GRUPOS: MisGrupos = { inscripciones: [], solicitudes: [] };

/** Lo mínimo de una solicitud que estas reglas necesitan. */
export interface SolicitudPropia {
  readonly id: Id;
  readonly programaCodigo: string;
  readonly tipo: TipoDeSolicitud;
  readonly estado: EstadoDeSolicitud;
}

const ABIERTAS: readonly EstadoDeSolicitud[] = ['pendiente', 'en_revision'];

export function horarioDelGrupo(grupo: GrupoDelPortal): HorarioDeGrupo {
  return {
    dias: grupo.dias,
    turno: grupo.turno,
    horaInicio: grupo.horaInicio,
    horaFin: grupo.horaFin,
    fechaInicio: grupo.fechaInicio,
    fechaFin: grupo.fechaFin,
  };
}

/**
 * Qué grupos de la oferta abierta corresponden a cada página (ADR 0009,
 * supuesto 4): «Nueva inscripción» ofrece los cursos y el 1.er año de la
 * carrera; «Renovar», el 2.º y el 3.er año.
 */
export function gruposPara(tipo: TipoDeSolicitud, oferta: readonly GrupoDelPortal[]): readonly GrupoDelPortal[] {
  return oferta.filter((g) =>
    tipo === 'renovacion'
      ? g.programaTipo === 'carrera' && (g.anioDeCarrera ?? 0) >= 2
      : g.programaTipo !== 'carrera' || g.anioDeCarrera === 1,
  );
}

/** Los programas con grupos en convocatoria, en el orden de la oferta, con sus grupos. */
export function programasEnConvocatoria(
  grupos: readonly GrupoDelPortal[],
): readonly { readonly codigo: string; readonly grupos: readonly GrupoDelPortal[] }[] {
  const porPrograma = new Map<string, GrupoDelPortal[]>();
  for (const g of grupos) porPrograma.set(g.programaCodigo, [...(porPrograma.get(g.programaCodigo) ?? []), g]);
  return [...porPrograma.entries()].map(([codigo, lista]) => ({ codigo, grupos: lista }));
}

/** Los cursos que la persona cursa ahora (inscripción vigente). */
export function cursosVigentes(mios: MisGrupos): readonly InscripcionDelPortal[] {
  return mios.inscripciones.filter((i) => i.estado === 'inscrito');
}

/** Los grupos de sus solicitudes todavía abiertas (pendientes o en revisión). */
export function gruposPedidos(mios: MisGrupos, solicitudes: readonly SolicitudPropia[]): readonly GrupoDelPortal[] {
  const abiertas = new Set(solicitudes.filter((s) => ABIERTAS.includes(s.estado)).map((s) => s.id));
  return mios.solicitudes.filter((s) => abiertas.has(s.solicitudId)).map((s) => s.grupo);
}

export type Disponibilidad =
  | { readonly estado: 'disponible'; readonly aviso?: string }
  | { readonly estado: 'bloqueado'; readonly motivo: string };

/**
 * ¿Puede pedir este grupo? Las comprobaciones de la base, en su orden y con
 * sus frases: cupos, ya inscrito, cruce con un curso vigente (en una
 * renovación no se compara con su propia carrera: pasa de un año al
 * siguiente) y cruce con un grupo que ya pidió. Si un horario no se puede
 * comparar, el grupo se puede pedir con un aviso.
 */
export function disponibilidadDeGrupo(
  grupo: GrupoDelPortal,
  tipo: TipoDeSolicitud,
  mios: MisGrupos,
  solicitudes: readonly SolicitudPropia[],
): Disponibilidad {
  if (grupo.libres === 0) return { estado: 'bloqueado', motivo: 'Ese grupo ya no tiene cupos.' };
  const vigentes = cursosVigentes(mios);
  if (vigentes.some((i) => i.grupo.id === grupo.id)) return { estado: 'bloqueado', motivo: 'Ya estás inscrito en ese grupo.' };
  const pedidos = gruposPedidos(mios, solicitudes);
  if (pedidos.some((p) => p.id === grupo.id)) {
    return { estado: 'bloqueado', motivo: 'Ya pediste este grupo. Espera la respuesta de recepción.' };
  }

  const horario = horarioDelGrupo(grupo);
  const avisos: string[] = [];
  for (const curso of vigentes) {
    if (tipo === 'renovacion' && curso.grupo.programaCodigo === grupo.programaCodigo) continue;
    const cruce = cruceDeHorarios(horarioDelGrupo(curso.grupo), horario);
    if (cruce === 'se_cruza') return { estado: 'bloqueado', motivo: `Ese horario se cruza con tu curso «${curso.grupo.nombre}».` };
    if (cruce === 'sin_horario') avisos.push(curso.grupo.nombre);
  }
  for (const pedido of pedidos) {
    const cruce = cruceDeHorarios(horarioDelGrupo(pedido), horario);
    if (cruce === 'se_cruza') return { estado: 'bloqueado', motivo: `Ese horario se cruza con el grupo que ya pediste: «${pedido.nombre}».` };
    if (cruce === 'sin_horario') avisos.push(pedido.nombre);
  }
  return avisos.length > 0
    ? { estado: 'disponible', aviso: `No pudimos comparar el horario con «${avisos[0]}»: confírmalo con recepción.` }
    : { estado: 'disponible' };
}

/**
 * Lo que se propone como «gestión anterior» al renovar: su inscripción más
 * reciente en la carrera («1.er año · gestión 2026»). Sin historial en el
 * sistema, nada: la persona lo escribe y recepción lo comprueba.
 */
export function gestionAnteriorSugerida(mios: MisGrupos): string | undefined {
  const enLaCarrera = mios.inscripciones
    .filter((i) => i.grupo.programaTipo === 'carrera' && i.grupo.anioDeCarrera !== undefined)
    .sort((a, b) => (a.grupo.fechaInicio < b.grupo.fechaInicio ? 1 : -1));
  const ultima = enLaCarrera[0];
  if (!ultima || ultima.grupo.anioDeCarrera === undefined) return undefined;
  return `${ordinal(ultima.grupo.anioDeCarrera)} año · gestión ${ultima.grupo.gestion}`;
}
