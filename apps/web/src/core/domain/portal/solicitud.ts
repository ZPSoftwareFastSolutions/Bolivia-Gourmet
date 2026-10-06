/**
 * CAPA: Domain / Portal
 *
 * Solicitudes que un estudiante hace desde la web: inscribirse en un programa
 * o renovar su gestión (ADR 0005). Es lo único que un estudiante escribe.
 *
 * Desde el ADR 0009 la solicitud pide un GRUPO en convocatoria (la
 * institución lo abrió con horario y un plazo de inscripción): el grupo fija
 * la sede, el turno, los días, la duración y la modalidad. Aquí se valida
 * contra la oferta abierta de hoy, lo que la persona cursa y lo que ya pidió.
 *
 * La validación se repite en la base (disparadores y CHECK): la pantalla
 * anticipa, el dominio define, la base decide.
 *
 * Sin React, sin Next, sin I/O.
 */

import { ETIQUETA_DE_MODALIDAD, type Modalidad, type Programa, type Turno } from '../academico/programa';
import type { Paquete } from '../estudiantes/estudiante';
import { exito, fallo, type Id, type Resultado } from '../shared/tipos-base';
import { disponibilidadDeGrupo, type GrupoDelPortal, type MisGrupos, type SolicitudPropia } from './convocatoria';

/** Vive en `academico/programa.ts` (lo usa el nombre del grupo); se reexporta para el portal. */
export { ETIQUETA_DE_MODALIDAD };

export type TipoDeSolicitud = 'inscripcion' | 'renovacion';
export type EstadoDeSolicitud = 'pendiente' | 'en_revision' | 'aprobada' | 'rechazada' | 'cancelada';

export const ETIQUETA_DE_TIPO_DE_SOLICITUD: Record<TipoDeSolicitud, string> = {
  inscripcion: 'Inscripción',
  renovacion: 'Renovación de gestión',
};

export const ETIQUETA_DE_ESTADO: Record<EstadoDeSolicitud, string> = {
  pendiente: 'Pendiente',
  en_revision: 'En revisión',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
};

/** Qué significa cada estado para el estudiante, en una frase. */
export const EXPLICACION_DE_ESTADO: Record<EstadoDeSolicitud, string> = {
  pendiente: 'La recibimos. Recepción la revisará y te contactará.',
  en_revision: 'Recepción la está revisando. Revisa la respuesta abajo.',
  aprobada: 'Aprobada. Completa los requisitos y el pago en tu sede.',
  rechazada: 'No pudo aprobarse. Revisa la respuesta o escríbenos.',
  cancelada: 'La cancelaste. Puedes enviar una nueva cuando quieras.',
};

export const PAQUETES: readonly Paquete[] = ['economico', 'ahorrador'];

export const ETIQUETA_DE_PAQUETE: Record<Paquete, string> = {
  economico: 'Paquete Económico',
  ahorrador: 'Paquete Ahorrador',
};

/** Límite de solicitudes abiertas por estudiante. Igual que en la base. */
export const MAXIMO_DE_SOLICITUDES_ABIERTAS = 5;

const ESTADOS_ABIERTOS: readonly EstadoDeSolicitud[] = ['pendiente', 'en_revision'];

/** Lo que envía el formulario del portal. */
export interface DatosDeSolicitud {
  readonly tipo: TipoDeSolicitud;
  readonly programaCodigo: string;
  /** El grupo en convocatoria que se pide (ADR 0009). */
  readonly grupoId: string;
  readonly paquete?: Paquete;
  /** Solo renovación: de qué gestión viene («1.er año · gestión 2026»). */
  readonly gestionAnterior?: string;
  readonly mensaje?: string;
}

/** Lo que se guarda: normalizado y con la sede del grupo (la base copia del grupo el resto). */
export interface SolicitudValidada {
  readonly tipo: TipoDeSolicitud;
  readonly programaCodigo: string;
  readonly grupoId: Id;
  readonly sedeId: Id;
  readonly paquete?: Paquete;
  readonly gestionAnterior?: string;
  readonly mensaje?: string;
}

export interface Solicitud {
  readonly id: Id;
  readonly tipo: TipoDeSolicitud;
  readonly programaCodigo: string;
  readonly programaNombre: string;
  readonly sedeNombre: string;
  /** El grupo pedido. Las solicitudes de antes de las convocatorias no lo tienen. */
  readonly grupoId?: Id;
  readonly turno?: Turno;
  readonly dias?: string;
  readonly duracion?: number;
  readonly modalidad?: Modalidad;
  readonly paquete?: Paquete;
  readonly gestionAnterior?: string;
  readonly mensaje?: string;
  readonly estado: EstadoDeSolicitud;
  readonly respuesta?: string;
  readonly creadaEn: string;
}

export function estaAbierta(solicitud: Pick<Solicitud, 'estado'>): boolean {
  return ESTADOS_ABIERTOS.includes(solicitud.estado);
}

/** El estudiante solo retira lo que nadie empezó a revisar (igual que la base). */
export function puedeCancelar(solicitud: Pick<Solicitud, 'estado'>): boolean {
  return solicitud.estado === 'pendiente';
}

/** Su solicitud abierta de este programa y tipo, si tiene (una por programa y tipo, como la base). */
export function solicitudAbiertaDe<T extends Pick<Solicitud, 'programaCodigo' | 'tipo' | 'estado'>>(
  solicitudes: readonly T[],
  programaCodigo: string,
  tipo: TipoDeSolicitud,
): T | undefined {
  return solicitudes.find((s) => estaAbierta(s) && s.programaCodigo === programaCodigo && s.tipo === tipo);
}

/** ¿Llegó al límite de solicitudes abiertas? */
export function alcanzoElLimite(solicitudes: readonly Pick<Solicitud, 'estado'>[]): boolean {
  return solicitudes.filter(estaAbierta).length >= MAXIMO_DE_SOLICITUDES_ABIERTAS;
}

export interface ContextoDeSolicitud {
  /** El programa del catálogo (`null` si no existe). */
  readonly programa: Programa | null;
  /** Los grupos en convocatoria hoy (`oferta_abierta()`). */
  readonly oferta: readonly GrupoDelPortal[];
  readonly misGrupos: MisGrupos;
  readonly solicitudes: readonly SolicitudPropia[];
}

/**
 * Valida una solicitud contra el grupo elegido, la oferta abierta, lo que la
 * persona cursa y lo que ya pidió. Devuelve todos los errores y, si no hay,
 * los datos normalizados (sin espacios sobrantes ni campos que no aplican).
 */
export function validarSolicitud(datos: DatosDeSolicitud, contexto: ContextoDeSolicitud): Resultado<SolicitudValidada, readonly string[]> {
  const errores: string[] = [];
  const { programa } = contexto;

  if (datos.tipo !== 'inscripcion' && datos.tipo !== 'renovacion') errores.push('Tipo de solicitud desconocido.');
  if (!programa) return fallo(['Elige un programa de la lista.']);
  if (!programa.activo) errores.push(`El programa «${programa.nombre}» no está disponible.`);
  if (datos.tipo === 'renovacion' && programa.tipo !== 'carrera') errores.push('La renovación es para la carrera.');

  const grupoId = datos.grupoId.trim();
  const grupo = grupoId ? contexto.oferta.find((g) => g.id === grupoId) : undefined;
  if (!grupoId) errores.push('Elige un grupo con inscripciones abiertas.');
  else if (!grupo) errores.push('Las inscripciones de ese grupo no están abiertas.');
  else {
    if (grupo.programaCodigo !== programa.codigo) errores.push('El grupo elegido no es de ese programa.');
    else if (programa.tipo === 'carrera') {
      const anio = grupo.anioDeCarrera ?? 0;
      if (datos.tipo === 'inscripcion' && anio !== 1) {
        errores.push('Por el portal, la carrera empieza en el 1.er año. Para pasar de año, pide tu renovación.');
      }
      if (datos.tipo === 'renovacion' && anio < 2) errores.push('La renovación es para el 2.º o el 3.er año de la carrera.');
    }
    const disponibilidad = disponibilidadDeGrupo(grupo, datos.tipo, contexto.misGrupos, contexto.solicitudes);
    if (disponibilidad.estado === 'bloqueado') errores.push(disponibilidad.motivo);
  }

  if (programa.tipo === 'carrera') {
    if (datos.tipo === 'inscripcion' && !datos.paquete) errores.push('Elige el paquete de pago.');
    if (datos.paquete && !PAQUETES.includes(datos.paquete)) errores.push('Paquete desconocido.');
  } else if (datos.paquete) {
    errores.push('Solo la carrera se inscribe por paquete.');
  }

  const gestion = datos.gestionAnterior?.trim() ?? '';
  if (datos.tipo === 'renovacion') {
    if (gestion.length === 0) errores.push('Indica de qué gestión vienes (por ejemplo, «1.er año · gestión 2026»).');
    else if (gestion.length > 60) errores.push('La gestión anterior admite hasta 60 caracteres.');
  }

  const mensaje = datos.mensaje?.trim() ?? '';
  if (mensaje.length > 500) errores.push('El mensaje admite hasta 500 caracteres.');

  if (solicitudAbiertaDe(contexto.solicitudes, programa.codigo, datos.tipo)) {
    errores.push('Ya tienes una solicitud abierta para este programa.');
  } else if (alcanzoElLimite(contexto.solicitudes)) {
    errores.push('Tienes demasiadas solicitudes en curso. Espera la respuesta de la institución.');
  }

  if (errores.length > 0 || !grupo) return fallo(errores);

  return exito({
    tipo: datos.tipo,
    programaCodigo: programa.codigo,
    grupoId: grupo.id,
    sedeId: grupo.sedeId,
    paquete: programa.tipo === 'carrera' ? datos.paquete : undefined,
    gestionAnterior: datos.tipo === 'renovacion' ? gestion : undefined,
    mensaje: mensaje.length > 0 ? mensaje : undefined,
  });
}
