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
import {
  admiteInscripciones,
  ETIQUETA_DE_ESTADO_DE_COHORTE,
  type Cohorte,
  type EstadoDeCohorte,
  type TipoDePrograma,
} from '../academico/programa';

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

/**
 * D6: `inscrito`, `retirado` o `concluido`. «En curso» no es un estado de la
 * inscripción: se deduce del grupo. Renovar NO concluye la inscripción
 * anterior (B.3): sigue `inscrito` hasta que se cierra su grupo.
 */
export type EstadoDeInscripcion = 'inscrito' | 'retirado' | 'concluido';

export const ETIQUETA_DE_ESTADO_DE_INSCRIPCION: Record<EstadoDeInscripcion, string> = {
  inscrito: 'Inscrito',
  retirado: 'Retirado',
  concluido: 'Concluido',
};

/** Solo la carrera se paga por paquete (regla E5). Qué incluye cada uno: pendiente (P6). */
export type Paquete = 'economico' | 'ahorrador';

export interface Inscripcion {
  readonly id: Id;
  readonly estudianteId: Id;
  readonly cohorteId: Id;
  readonly fecha: FechaISO;
  readonly estado: EstadoDeInscripcion;
  readonly paquete?: Paquete;
  /** Descripciones de los requisitos ya entregados (regla E4: se anotan, no bloquean). */
  readonly documentosEntregados: readonly string[];
  /** La solicitud del portal de la que nació, si nació de una. */
  readonly solicitudId?: Id;
  /** La inscripción del año anterior que esta renueva (el 2.º año viene del 1.º). */
  readonly renuevaA?: Id;
  /** Obligatorio si está `retirado`. */
  readonly motivoDeRetiro?: string;
  readonly observaciones?: string;
}

export type DatosDeInscripcion = Omit<Inscripcion, 'id'>;

/** Estados que cuentan como «vigente»: impiden inscribirse otra vez en el mismo grupo (E1). */
export const ESTADOS_VIGENTES: readonly EstadoDeInscripcion[] = ['inscrito'];

export function esInscripcionVigente(inscripcion: Pick<Inscripcion, 'estado'>): boolean {
  return ESTADOS_VIGENTES.includes(inscripcion.estado);
}

/** Lo que el caso de uso sabe del grupo elegido para comprobar estado y cupo. */
export interface GrupoParaInscribir {
  readonly estado: EstadoDeCohorte;
  /** Sin capacidad = sin límite. */
  readonly capacidad?: number;
  /** Inscripciones `inscrito` que ya tiene. */
  readonly inscritos: number;
}

/**
 * Reglas E1 y E5 y lo que admite el grupo (B.2): no repetir grupo vigente;
 * paquete solo en la carrera; el grupo debe estar abierto o en curso y tener
 * cupo. Recibe lo que el estudiante ya tiene para no depender de un
 * repositorio: el caso de uso lo trae y el dominio decide. La base lo repite.
 */
export function validarInscripcion(
  datos: DatosDeInscripcion,
  tipoDePrograma: TipoDePrograma,
  inscripcionesDelEstudiante: readonly Pick<Inscripcion, 'cohorteId' | 'estado'>[],
  grupo?: GrupoParaInscribir,
): Resultado<DatosDeInscripcion, readonly string[]> {
  const errores: string[] = [];

  const fecha = fechaISO(datos.fecha);
  if (!fecha.exito) errores.push(fecha.error);

  if (datos.estado !== 'inscrito') errores.push('Una inscripción nueva empieza como «Inscrito».');

  const yaVigente = inscripcionesDelEstudiante.some(
    (i) => i.cohorteId === datos.cohorteId && esInscripcionVigente(i),
  );
  if (yaVigente) errores.push('El estudiante ya está inscrito en este grupo.');

  if (tipoDePrograma === 'carrera') {
    if (!datos.paquete) errores.push('La inscripción a la carrera debe indicar el paquete (económico o ahorrador).');
  } else if (datos.paquete) {
    errores.push('Solo la carrera se inscribe por paquete.');
  }

  if (grupo) {
    if (!admiteInscripciones(grupo.estado)) {
      errores.push(`El grupo está ${ETIQUETA_DE_ESTADO_DE_COHORTE[grupo.estado].toLowerCase()} y no admite inscripciones.`);
    }
    if (grupo.capacidad !== undefined && grupo.inscritos >= grupo.capacidad) {
      errores.push(`El grupo está lleno (${grupo.capacidad} cupos).`);
    }
  }

  const observaciones = datos.observaciones?.trim() ?? '';
  if (observaciones.length > 500) errores.push('Las observaciones admiten hasta 500 caracteres.');

  return errores.length > 0 ? fallo(errores) : exito(datos);
}

/**
 * Cambiar el estado (§3.7 `cambiar_estado_de_inscripcion`): solo desde
 * `inscrito`, a `retirado` (con motivo) o a `concluido`.
 */
export function validarCambioDeEstado(
  actual: EstadoDeInscripcion,
  nuevo: EstadoDeInscripcion,
  motivo?: string,
): Resultado<{ readonly estado: EstadoDeInscripcion; readonly motivo?: string }, readonly string[]> {
  const errores: string[] = [];
  if (actual !== 'inscrito' || nuevo === 'inscrito') {
    errores.push(`No se puede pasar de «${ETIQUETA_DE_ESTADO_DE_INSCRIPCION[actual]}» a «${ETIQUETA_DE_ESTADO_DE_INSCRIPCION[nuevo]}».`);
  }
  const limpio = motivo?.trim() ?? '';
  if (nuevo === 'retirado' && limpio.length === 0) errores.push('Indica el motivo del retiro.');
  if (limpio.length > 500) errores.push('El motivo admite hasta 500 caracteres.');
  return errores.length > 0 ? fallo(errores) : exito({ estado: nuevo, motivo: limpio.length > 0 ? limpio : undefined });
}

/** Lo que hace falta de cada grupo para decidir si una inscripción renueva a otra. */
export type GrupoDeRenovacion = Pick<Cohorte, 'programaCodigo' | 'gestion' | 'anioDeCarrera'>;

/**
 * Renovación (§3.7, `renovacion_no_corresponde`): el grupo nuevo es del MISMO
 * programa y de una gestión posterior; en la carrera, además, del año de
 * carrera siguiente. La inscripción anterior debe seguir vigente (renovar
 * solo enlaza, B.3).
 */
export function validarRenovacion(
  anterior: Pick<Inscripcion, 'estado'> & { readonly grupo: GrupoDeRenovacion },
  grupoNuevo: GrupoDeRenovacion,
  tipoDePrograma: TipoDePrograma,
): Resultado<true, readonly string[]> {
  const errores: string[] = [];
  if (!esInscripcionVigente(anterior)) errores.push('Solo se renueva una inscripción vigente.');
  if (anterior.grupo.programaCodigo !== grupoNuevo.programaCodigo) errores.push('La renovación debe ser del mismo programa.');
  if (grupoNuevo.gestion <= anterior.grupo.gestion) errores.push('La renovación debe ser de una gestión posterior.');
  if (tipoDePrograma === 'carrera') {
    const anio = anterior.grupo.anioDeCarrera;
    if (anio === undefined || grupoNuevo.anioDeCarrera !== anio + 1) {
      errores.push('La renovación de la carrera debe ser al año siguiente.');
    }
  }
  return errores.length > 0 ? fallo(errores) : exito(true);
}
