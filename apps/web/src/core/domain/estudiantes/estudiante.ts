/**
 * CAPA: Domain / Estudiantes
 *
 * La persona y su vínculo con una cohorte (la inscripción). El estudiante no
 * lleva «tipo», «turno» ni «gestión»: eso lo dice su inscripción (ADR 0004).
 *
 * Sin React, sin Next, sin I/O.
 */

import { esCelularBoliviano } from '../shared/sede';
import { exito, fallo, fechaISO, textoObligatorio, type FechaISO, type Id, type Resultado } from '../shared/tipos-base';
import type { TipoDePrograma } from '../academico/programa';

// ---------------------------------------------------------------- Estudiante

export interface Estudiante {
  readonly id: Id;
  readonly nombres: string;
  readonly apellidos: string;
  /** Carnet de identidad. Opcional al crear; único si se informa. */
  readonly documento?: string;
  /** Celular boliviano de 8 dígitos. */
  readonly telefono?: string;
  readonly correo?: string;
  readonly fechaDeNacimiento?: FechaISO;
  readonly sedeHabitualId?: Id;
  /** Los estudiantes no se borran: se archivan (regla E3). */
  readonly archivadoEn?: string;
}

export type DatosDeEstudiante = Omit<Estudiante, 'id' | 'archivadoEn'>;

const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Valida y normaliza los datos de un estudiante. Devuelve todos los errores.
 * Lo que no viene (teléfono, correo, documento) no es error: el documento
 * institucional no exige ninguno para los cursos («sin límites de edad»).
 */
export function validarEstudiante(datos: DatosDeEstudiante): Resultado<DatosDeEstudiante, readonly string[]> {
  const errores: string[] = [];

  const nombres = textoObligatorio(datos.nombres, 'El nombre');
  if (!nombres.exito) errores.push(nombres.error);
  const apellidos = textoObligatorio(datos.apellidos, 'El apellido');
  if (!apellidos.exito) errores.push(apellidos.error);

  const telefono = datos.telefono?.replace(/\s+/g, '');
  if (telefono && !esCelularBoliviano(telefono)) {
    errores.push('El teléfono debe ser un celular boliviano de 8 dígitos (empieza por 6 o 7).');
  }

  const correo = datos.correo?.trim().toLowerCase();
  if (correo && !PATRON_CORREO.test(correo)) errores.push('El correo no tiene un formato válido.');

  const documento = datos.documento?.trim();
  if (documento !== undefined && documento.length > 0 && !/^[0-9A-Za-z-]{4,20}$/.test(documento)) {
    errores.push('El documento de identidad solo admite letras, números y guiones (4 a 20 caracteres).');
  }

  if (datos.fechaDeNacimiento) {
    const fecha = fechaISO(datos.fechaDeNacimiento);
    if (!fecha.exito) errores.push(fecha.error);
  }

  if (errores.length > 0) return fallo(errores);

  return exito({
    ...datos,
    nombres: nombres.exito ? nombres.valor : datos.nombres,
    apellidos: apellidos.exito ? apellidos.valor : datos.apellidos,
    telefono: telefono || undefined,
    correo: correo || undefined,
    documento: documento || undefined,
  });
}

export function nombreCompleto(estudiante: Pick<Estudiante, 'nombres' | 'apellidos'>): string {
  return `${estudiante.nombres} ${estudiante.apellidos}`.trim();
}

// ---------------------------------------------------------------- Inscripción

export type EstadoDeInscripcion = 'preinscrito' | 'inscrito' | 'en_curso' | 'retirado' | 'concluido';

/** Solo la carrera se paga por paquete (regla E5). Qué incluye cada uno: pendiente (P6). */
export type Paquete = 'economico' | 'ahorrador';

export interface Inscripcion {
  readonly id: Id;
  readonly estudianteId: Id;
  readonly cohorteId: Id;
  readonly fecha: FechaISO;
  readonly estado: EstadoDeInscripcion;
  readonly paquete?: Paquete;
  /** Descripciones de los requisitos ya entregados (contra `programa.requisitos`). */
  readonly documentosEntregados: readonly string[];
  readonly observaciones?: string;
}

export type DatosDeInscripcion = Omit<Inscripcion, 'id'>;

/** Estados que cuentan como «vigente»: impiden inscribirse otra vez en la misma cohorte. */
const ESTADOS_VIGENTES: readonly EstadoDeInscripcion[] = ['preinscrito', 'inscrito', 'en_curso'];

export function esInscripcionVigente(inscripcion: Pick<Inscripcion, 'estado'>): boolean {
  return ESTADOS_VIGENTES.includes(inscripcion.estado);
}

/**
 * Reglas E1 y E5: no repetir cohorte vigente; paquete solo en la carrera.
 * Recibe las inscripciones que el estudiante ya tiene para no depender de un
 * repositorio: el caso de uso las trae y el dominio decide.
 */
export function validarInscripcion(
  datos: DatosDeInscripcion,
  tipoDePrograma: TipoDePrograma,
  inscripcionesDelEstudiante: readonly Pick<Inscripcion, 'cohorteId' | 'estado'>[],
): Resultado<DatosDeInscripcion, readonly string[]> {
  const errores: string[] = [];

  const fecha = fechaISO(datos.fecha);
  if (!fecha.exito) errores.push(fecha.error);

  const yaVigente = inscripcionesDelEstudiante.some(
    (i) => i.cohorteId === datos.cohorteId && esInscripcionVigente(i),
  );
  if (yaVigente) errores.push('El estudiante ya tiene una inscripción vigente en esta cohorte.');

  if (tipoDePrograma === 'carrera') {
    if (!datos.paquete) errores.push('La inscripción a la carrera debe indicar el paquete (económico o ahorrador).');
  } else if (datos.paquete) {
    errores.push('Solo la carrera se inscribe por paquete.');
  }

  return errores.length > 0 ? fallo(errores) : exito(datos);
}
