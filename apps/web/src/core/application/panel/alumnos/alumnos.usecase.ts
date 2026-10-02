/**
 * CAPA: Application / Panel · Alumnos
 *
 * Casos de uso de alumnos, grupos, inscripciones y solicitudes del portal
 * (enmiendas B.1). Cada uno valida la FORMA con el dominio y devuelve todos
 * los errores juntos; luego llama al puerto, donde la base decide lo que
 * depende de datos (cupos, carnet repetido, sede, permisos).
 *
 * Todos devuelven `Resultado<T, readonly string[]>`: la pantalla muestra una
 * lista de frases, sea un error de forma o uno de la base.
 */

import { validarCohorte, validarPlanDePago, type Programa } from '../../../domain/academico/programa';
import { validarCambioDeEstado, validarEstudiante, type EstadoDeInscripcion } from '../../../domain/estudiantes/estudiante';
import { exito, fallo, type FechaISO, type Id, type Resultado } from '../../../domain/shared/tipos-base';
import type {
  AlumnosPort,
  CierreDeGrupo,
  DatosDeAprobacion,
  DatosDeFicha,
  DatosDeGrupo,
  DatosDeInscripcionNueva,
  DatosDePlan,
  InscripcionHecha,
} from '../../ports/alumnos.port';

type Res<T> = Promise<Resultado<T, readonly string[]>>;

function comoLista<T>(r: Resultado<T>): Resultado<T, readonly string[]> {
  return r.exito ? r : fallo([r.error]);
}

const MAX_REQUISITOS = 20;

/** Requisitos marcados: sin vacíos ni repetidos, como los guarda la base. */
export function limpiarRequisitos(documentos: readonly string[]): readonly string[] {
  return [...new Set(documentos.map((d) => d.trim()).filter((d) => d.length > 0))].slice(0, MAX_REQUISITOS);
}

// ---------------------------------------------------------------- fichas

export function validarFicha(ficha: DatosDeFicha): Resultado<DatosDeFicha, readonly string[]> {
  const validada = validarEstudiante({
    nombres: ficha.nombres,
    apellidos: ficha.apellidos,
    documento: ficha.documento,
    telefono: ficha.telefono,
    correo: ficha.correo,
    fechaDeNacimiento: ficha.fechaDeNacimiento as FechaISO | undefined,
  });
  if (!validada.exito) return validada;
  const observaciones = ficha.observaciones?.trim() ?? '';
  if (observaciones.length > 500) return fallo(['Las observaciones admiten hasta 500 caracteres.']);
  const v = validada.valor;
  return exito({
    ...ficha,
    nombres: v.nombres,
    apellidos: v.apellidos,
    documento: v.documento?.toUpperCase(),
    telefono: v.telefono,
    correo: v.correo,
    observaciones: observaciones || undefined,
  });
}

export async function crearAlumno(port: AlumnosPort, clave: string, ficha: DatosDeFicha): Res<{ readonly estudianteId: Id; readonly codigo: string }> {
  const valida = validarFicha(ficha);
  if (!valida.exito) return valida;
  return comoLista(await port.crearAlumno(clave, valida.valor));
}

export async function editarAlumno(port: AlumnosPort, id: Id, ficha: DatosDeFicha): Res<void> {
  const valida = validarFicha(ficha);
  if (!valida.exito) return valida;
  return comoLista(await port.editarAlumno(id, valida.valor));
}

export async function archivarAlumno(port: AlumnosPort, id: Id, motivo: string): Res<void> {
  const limpio = motivo.trim();
  if (limpio.length < 3) return fallo(['Escribe el motivo para archivar la ficha.']);
  if (limpio.length > 300) return fallo(['El motivo admite hasta 300 caracteres.']);
  return comoLista(await port.archivarAlumno(id, limpio));
}

// ---------------------------------------------------------------- grupos

export async function abrirGrupo(port: AlumnosPort, programa: Programa | null, datos: DatosDeGrupo): Res<{ readonly id: Id }> {
  const validacion = validarGrupo(programa, datos);
  if (!validacion.exito) return validacion;
  return comoLista(await port.crearGrupo(datos));
}

export async function editarGrupo(
  port: AlumnosPort,
  programa: Programa | null,
  id: Id,
  datos: DatosDeGrupo,
): Res<void> {
  const validacion = validarGrupo(programa, datos);
  if (!validacion.exito) return validacion;
  const { programaCodigo: _p, sedeId: _s, ...cambios } = datos;
  void _p;
  void _s;
  return comoLista(await port.editarGrupo(id, cambios));
}

/** Regla A1 y B.4 (`validarCohorte`): el grupo solo elige entre las opciones de su programa. */
export function validarGrupo(programa: Programa | null, datos: DatosDeGrupo): Resultado<true, readonly string[]> {
  if (!programa) return fallo(['Elige un programa del catálogo.']);
  const validacion = validarCohorte(programa, {
    programaCodigo: datos.programaCodigo,
    sedeId: datos.sedeId,
    gestion: datos.gestion,
    anioDeCarrera: datos.anioDeCarrera,
    fechaInicio: datos.fechaInicio as FechaISO,
    fechaFin: datos.fechaFin as FechaISO | undefined,
    duracionElegida: datos.duracion,
    turno: datos.turno,
    diasDeClase: datos.dias,
    modalidad: datos.modalidad,
    capacidad: datos.capacidad,
    estado: datos.estado,
  });
  return validacion.exito ? exito(true) : validacion;
}

export async function definirPrecio(
  port: AlumnosPort,
  programa: Programa | null,
  grupoId: Id,
  plan: DatosDePlan,
  planId?: Id,
): Res<void> {
  if (!programa) return fallo(['El grupo apunta a un programa que no está en el catálogo.']);
  const validacion = validarPlanDePago(
    {
      paquete: plan.paquete,
      montoCuota: plan.montoCuota,
      cuotas: plan.cuotas,
      primerVencimiento: plan.primerVencimiento as FechaISO,
      cadaMeses: plan.cadaMeses,
      nota: plan.nota,
    },
    programa.tipo,
  );
  if (!validacion.exito) return validacion;
  return comoLista(await port.guardarPlan(grupoId, { ...plan, nota: validacion.valor.nota }, planId));
}

export async function cerrarGrupo(port: AlumnosPort, clave: string, id: Id): Res<CierreDeGrupo> {
  return comoLista(await port.cerrarGrupo(clave, id));
}

// ---------------------------------------------------------------- inscripciones

/**
 * Inscribir (6.9 y 6.10): con ficha existente o nueva. El paquete es
 * obligatorio en la carrera y no existe en los cursos (E5); cupos, sede,
 * duplicados y renovación los decide la base con el grupo bloqueado.
 */
export async function inscribirAlumno(
  port: AlumnosPort,
  esCarrera: boolean,
  clave: string,
  datos: DatosDeInscripcionNueva,
): Res<InscripcionHecha> {
  const errores: string[] = [];
  let ficha = datos.ficha;
  if (!datos.estudianteId) {
    if (!ficha) errores.push('Busca al alumno o completa los datos de la persona nueva.');
    else {
      const valida = validarFicha(ficha);
      if (valida.exito) ficha = valida.valor;
      else errores.push(...valida.error);
    }
  }
  if (esCarrera && !datos.paquete) errores.push('Elige el paquete (Económico o Ahorrador).');
  if (!esCarrera && datos.paquete) errores.push('Solo la carrera se inscribe por paquete.');
  const observaciones = datos.observaciones?.trim() ?? '';
  if (observaciones.length > 500) errores.push('Las observaciones admiten hasta 500 caracteres.');
  if (errores.length > 0) return fallo(errores);

  return comoLista(
    await port.inscribir(clave, {
      ...datos,
      ficha: datos.estudianteId ? undefined : ficha,
      documentos: limpiarRequisitos(datos.documentos),
      observaciones: observaciones || undefined,
    }),
  );
}

export async function cambiarEstadoDeInscripcion(
  port: AlumnosPort,
  clave: string,
  inscripcionId: Id,
  nuevo: Exclude<EstadoDeInscripcion, 'inscrito'>,
  motivo?: string,
): Res<{ readonly estado: EstadoDeInscripcion }> {
  const validado = validarCambioDeEstado('inscrito', nuevo, motivo);
  if (!validado.exito) return validado;
  return comoLista(await port.cambiarEstadoDeInscripcion(clave, inscripcionId, nuevo, validado.valor.motivo));
}

export async function guardarRequisitos(port: AlumnosPort, inscripcionId: Id, documentos: readonly string[]): Res<void> {
  return comoLista(await port.guardarRequisitos(inscripcionId, limpiarRequisitos(documentos)));
}

// ---------------------------------------------------------------- solicitudes del portal

export async function aprobarSolicitud(
  port: AlumnosPort,
  esCarrera: boolean,
  clave: string,
  datos: DatosDeAprobacion,
): Res<InscripcionHecha> {
  const errores: string[] = [];
  if (esCarrera && !datos.paquete) errores.push('Elige el paquete (Económico o Ahorrador).');
  const respuesta = datos.respuesta.trim();
  if (respuesta.length > 500) errores.push('La respuesta admite hasta 500 caracteres.');
  if (errores.length > 0) return fallo(errores);
  return comoLista(
    await port.aprobarSolicitud(clave, {
      ...datos,
      paquete: esCarrera ? datos.paquete : undefined,
      documentos: limpiarRequisitos(datos.documentos),
      respuesta,
    }),
  );
}

/**
 * «Pedir más datos» pone la solicitud en revisión; «Rechazar» la cierra. En
 * los dos casos el alumno lee la respuesta en su portal, así que es
 * obligatoria (B.9).
 */
export async function responderSolicitud(
  port: AlumnosPort,
  id: Id,
  estado: 'en_revision' | 'rechazada',
  respuesta: string,
): Res<void> {
  const limpia = respuesta.trim();
  if (limpia.length < 3) {
    return fallo([estado === 'rechazada' ? 'Escribe por qué se rechaza: el alumno lo verá.' : 'Escribe qué datos faltan: el alumno lo verá.']);
  }
  if (limpia.length > 500) return fallo(['La respuesta admite hasta 500 caracteres.']);
  return comoLista(await port.responderSolicitud(id, estado, limpia));
}
