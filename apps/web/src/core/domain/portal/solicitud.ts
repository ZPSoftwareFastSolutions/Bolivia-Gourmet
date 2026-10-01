/**
 * CAPA: Domain / Portal
 *
 * Solicitudes que un estudiante hace desde la web: inscribirse en un programa
 * o renovar su gestión (ADR 0005). Es lo único que un estudiante escribe.
 *
 * La validación vive aquí y se repite en la base (disparadores y CHECK): la
 * pantalla anticipa, el dominio define, la base decide. Lo que solo el
 * dominio puede comprobar —que el turno, los días y la duración estén entre
 * las opciones de ESE programa— se comprueba aquí contra el catálogo.
 *
 * Sin React, sin Next, sin I/O.
 */

import { enumerar, esPendiente, exito, fallo, type Id, type Resultado } from '../shared/tipos-base';
import { ETIQUETA_DE_TURNO, type Modalidad, type Programa, type Turno } from '../academico/programa';
import type { Paquete } from '../estudiantes/estudiante';

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

export const ETIQUETA_DE_MODALIDAD: Record<Modalidad, string> = {
  practico: 'Curso práctico',
  magistral: 'Clase magistral',
  virtual: 'Virtual',
};

/** Límite de solicitudes abiertas por estudiante. Igual que en la base. */
export const MAXIMO_DE_SOLICITUDES_ABIERTAS = 5;

const ESTADOS_ABIERTOS: readonly EstadoDeSolicitud[] = ['pendiente', 'en_revision'];

export interface DatosDeSolicitud {
  readonly tipo: TipoDeSolicitud;
  readonly programaCodigo: string;
  /** Código de la sede (`la-paz`, `el-alto`). El repositorio resuelve su id. */
  readonly sedeCodigo: string;
  readonly turno?: Turno;
  readonly dias?: string;
  readonly duracion?: number;
  readonly modalidad?: Modalidad;
  readonly paquete?: Paquete;
  /** Solo renovación: de qué gestión viene («Gestión 2026», «2.º año»). */
  readonly gestionAnterior?: string;
  readonly mensaje?: string;
}

export interface Solicitud {
  readonly id: Id;
  readonly tipo: TipoDeSolicitud;
  readonly programaCodigo: string;
  readonly programaNombre: string;
  readonly sedeNombre: string;
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

/**
 * Valida una solicitud contra el programa elegido y las sedes disponibles.
 * Devuelve todos los errores y los datos normalizados (sin espacios
 * sobrantes, sin campos que el programa no usa).
 */
export function validarSolicitud(
  datos: DatosDeSolicitud,
  programa: Programa | null,
  sedesDisponibles: readonly string[],
  abiertasDelEstudiante: readonly Pick<Solicitud, 'programaCodigo' | 'tipo' | 'estado'>[] = [],
): Resultado<DatosDeSolicitud, readonly string[]> {
  const errores: string[] = [];

  if (datos.tipo !== 'inscripcion' && datos.tipo !== 'renovacion') errores.push('Tipo de solicitud desconocido.');
  if (!programa) return fallo(['Elige un programa de la lista.']);
  if (!programa.activo) errores.push(`El programa «${programa.nombre}» no está disponible.`);
  if (!sedesDisponibles.includes(datos.sedeCodigo)) errores.push('Elige una sede de la lista.');

  // Opciones del programa: obligatorias si existen, prohibidas si no.
  if (programa.turnos.length > 0) {
    if (!datos.turno) errores.push('Elige un turno.');
    else if (!programa.turnos.includes(datos.turno)) errores.push(`El turno «${ETIQUETA_DE_TURNO[datos.turno] ?? datos.turno}» no está disponible para este programa.`);
  }

  if (programa.diasDeClase.length > 0) {
    if (!datos.dias) errores.push('Elige los días de clase.');
    else if (!programa.diasDeClase.some((d) => d.codigo === datos.dias)) errores.push('Los días elegidos no están disponibles para este programa.');
  }

  if (!esPendiente(programa.duracion) && programa.duracion.opciones.length > 1) {
    if (datos.duracion === undefined) errores.push('Elige la duración.');
    else if (!programa.duracion.opciones.includes(datos.duracion)) {
      errores.push(`La duración debe ser ${enumerar(programa.duracion.opciones)}.`);
    }
  }

  if (programa.modalidades.length > 0) {
    if (!datos.modalidad) errores.push('Elige la modalidad.');
    else if (!programa.modalidades.includes(datos.modalidad)) errores.push('La modalidad elegida no está disponible.');
  }

  if (programa.tipo === 'carrera') {
    if (datos.tipo === 'inscripcion' && !datos.paquete) errores.push('Elige el paquete de pago.');
    if (datos.paquete && !PAQUETES.includes(datos.paquete)) errores.push('Paquete desconocido.');
  } else if (datos.paquete) {
    errores.push('Solo la carrera se inscribe por paquete.');
  }

  const gestion = datos.gestionAnterior?.trim() ?? '';
  if (datos.tipo === 'renovacion') {
    if (gestion.length === 0) errores.push('Indica de qué gestión vienes (por ejemplo, «Gestión 2026» o «1.er año»).');
    else if (gestion.length > 60) errores.push('La gestión anterior admite hasta 60 caracteres.');
  }

  const mensaje = datos.mensaje?.trim() ?? '';
  if (mensaje.length > 500) errores.push('El mensaje admite hasta 500 caracteres.');

  const abiertas = abiertasDelEstudiante.filter(estaAbierta);
  if (abiertas.some((s) => s.programaCodigo === programa.codigo && s.tipo === datos.tipo)) {
    errores.push('Ya tienes una solicitud abierta para este programa.');
  } else if (abiertas.length >= MAXIMO_DE_SOLICITUDES_ABIERTAS) {
    errores.push('Tienes demasiadas solicitudes en curso. Espera la respuesta de la institución.');
  }

  if (errores.length > 0) return fallo(errores);

  // Normalizado: solo viajan los campos que este programa usa.
  const duracionUnica = !esPendiente(programa.duracion) && programa.duracion.opciones.length === 1 ? programa.duracion.opciones[0] : undefined;
  return exito({
    tipo: datos.tipo,
    programaCodigo: programa.codigo,
    sedeCodigo: datos.sedeCodigo,
    turno: programa.turnos.length > 0 ? datos.turno : undefined,
    dias: programa.diasDeClase.length > 0 ? datos.dias : undefined,
    duracion: duracionUnica ?? (!esPendiente(programa.duracion) ? datos.duracion : undefined),
    modalidad: programa.modalidades.length > 0 ? datos.modalidad : undefined,
    paquete: programa.tipo === 'carrera' ? datos.paquete : undefined,
    gestionAnterior: datos.tipo === 'renovacion' ? gestion : undefined,
    mensaje: mensaje.length > 0 ? mensaje : undefined,
  });
}
