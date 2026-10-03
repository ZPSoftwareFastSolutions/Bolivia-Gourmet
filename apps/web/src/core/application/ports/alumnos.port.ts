/**
 * CAPA: Application / Ports
 *
 * Alumnos, grupos e inscripciones del panel interno (enmiendas B.1). Las
 * lecturas devuelven modelos de lectura ya listos para la pantalla (nombre del
 * grupo armado por la base, inscritos contados); las escrituras que cruzan
 * tablas son RPC que deciden en la base. La pantalla nunca recibe un error
 * técnico: el adaptador lo traduce a una frase.
 */

import type { EstadoDeCohorte, Modalidad, TipoDePrograma, Turno } from '@core/domain/academico/programa';
import type { EstadoDeInscripcion, Paquete } from '@core/domain/estudiantes/estudiante';
import type { Centavos, FechaISO, Id, Resultado } from '@core/domain/shared/tipos-base';

// ---------------------------------------------------------------- lecturas

export type FiltroDePrograma = 'todos' | 'carrera' | 'capacitacion' | 'sin_inscripcion';

export interface FiltroDeAlumnos {
  /** Nombre, carnet o código (BG-2026-0007). */
  readonly texto?: string;
  readonly programa?: FiltroDePrograma;
  readonly sedeId?: Id;
  readonly incluirArchivados?: boolean;
}

export interface AlumnoEnLista {
  readonly id: Id;
  readonly codigo: string;
  readonly nombres: string;
  readonly apellidos: string;
  readonly documento: string | null;
  readonly telefono: string | null;
  readonly sedeNombre: string;
  readonly programaTipo: TipoDePrograma | null;
  readonly programaNombre: string | null;
  readonly anioDeCarrera: number | null;
  readonly grupoNombre: string | null;
  readonly inscripcionesVigentes: number;
  readonly archivado: boolean;
  readonly conCuenta: boolean;
}

export interface InscripcionDeAlumno {
  readonly id: Id;
  readonly numero: number;
  readonly grupoId: Id;
  readonly grupoNombre: string;
  readonly programaCodigo: string;
  readonly programaTipo: TipoDePrograma;
  readonly anioDeCarrera: number | null;
  readonly gestion: number;
  readonly grupoEstado: EstadoDeCohorte;
  readonly estado: EstadoDeInscripcion;
  readonly paquete: Paquete | null;
  readonly fecha: FechaISO;
  readonly documentosEntregados: readonly string[];
  readonly motivoDeRetiro: string | null;
  readonly renuevaA: Id | null;
  readonly renovada: boolean;
  readonly desdeElPortal: boolean;
}

export interface FichaDeAlumno {
  readonly id: Id;
  readonly codigo: string;
  readonly nombres: string;
  readonly apellidos: string;
  readonly documento: string | null;
  readonly telefono: string | null;
  readonly correo: string | null;
  readonly fechaDeNacimiento: FechaISO | null;
  readonly sedeId: Id;
  readonly sedeNombre: string;
  readonly observaciones: string | null;
  readonly conCuenta: boolean;
  readonly archivadoEn: string | null;
  readonly archivadoMotivo: string | null;
  readonly creadoEn: string;
  readonly inscripciones: readonly InscripcionDeAlumno[];
}

export interface FiltroDeGrupos {
  readonly sedeId?: Id;
  readonly programaCodigo?: string;
  /** Por defecto, los que no están cerrados. */
  readonly estados?: readonly EstadoDeCohorte[];
}

export interface GrupoEnLista {
  readonly id: Id;
  readonly programaCodigo: string;
  readonly programaNombre: string;
  readonly programaTipo: TipoDePrograma;
  readonly sedeId: Id;
  readonly sedeNombre: string;
  readonly gestion: number;
  readonly anioDeCarrera: number | null;
  readonly turno: Turno | null;
  readonly dias: string | null;
  readonly duracion: number | null;
  readonly modalidad: Modalidad | null;
  readonly fechaInicio: FechaISO;
  readonly fechaFin: FechaISO | null;
  readonly capacidad: number | null;
  readonly estado: EstadoDeCohorte;
  readonly nombre: string;
  readonly inscritos: number;
  readonly planes: number;
  /** Precio para informar: una línea por paquete (carrera) o una sola (cursos). */
  readonly precios: readonly PrecioDeGrupo[];
}

export interface PrecioDeGrupo {
  readonly paquete: Paquete | null;
  readonly montoCuota: Centavos;
  readonly cuotas: number;
  readonly cadaMeses: number;
}

export interface PlanDeGrupo {
  readonly id: Id;
  readonly paquete: Paquete | null;
  readonly montoCuota: Centavos;
  readonly cuotas: number;
  readonly primerVencimiento: FechaISO;
  readonly cadaMeses: number;
  readonly nota: string | null;
}

export interface InscritoEnGrupo {
  readonly inscripcionId: Id;
  readonly estudianteId: Id;
  readonly codigo: string;
  readonly nombres: string;
  readonly apellidos: string;
  readonly telefono: string | null;
  readonly estado: EstadoDeInscripcion;
  readonly paquete: Paquete | null;
  readonly fecha: FechaISO;
}

export interface FichaDeGrupo {
  readonly grupo: GrupoEnLista;
  readonly planes: readonly PlanDeGrupo[];
  readonly inscritos: readonly InscritoEnGrupo[];
}

export type EstadoDeSolicitudEnBandeja = 'pendiente' | 'en_revision' | 'aprobada' | 'rechazada' | 'cancelada';

export interface SolicitudEnBandeja {
  readonly id: Id;
  readonly tipo: 'inscripcion' | 'renovacion';
  readonly programaCodigo: string;
  readonly sedeId: Id;
  readonly sedeNombre: string;
  readonly turno: string | null;
  readonly dias: string | null;
  readonly duracion: number | null;
  readonly modalidad: string | null;
  readonly paquete: Paquete | null;
  readonly gestionAnterior: string | null;
  readonly mensaje: string | null;
  readonly estado: EstadoDeSolicitudEnBandeja;
  readonly respuesta: string | null;
  readonly creadaEn: string;
  readonly perfilId: Id;
  readonly nombres: string;
  readonly apellidos: string;
  readonly correo: string | null;
  readonly telefono: string | null;
  readonly documento: string | null;
  /** Ficha ya enlazada a la cuenta, si existe. */
  readonly fichaCodigo: string | null;
}

/** Ficha sin cuenta que podría ser la misma persona (B.8: el personal decide). */
export interface FichaSugerida {
  readonly id: Id;
  readonly codigo: string;
  readonly nombre: string;
  readonly documento: string | null;
  readonly porDocumento: boolean;
}

// ---------------------------------------------------------------- escrituras

export interface DatosDeFicha {
  readonly nombres: string;
  readonly apellidos: string;
  readonly documento?: string;
  readonly telefono?: string;
  readonly correo?: string;
  readonly fechaDeNacimiento?: string;
  readonly sedeId?: Id;
  readonly observaciones?: string;
}

export interface DatosDeGrupo {
  readonly programaCodigo: string;
  readonly sedeId: Id;
  readonly gestion: number;
  readonly anioDeCarrera?: number;
  readonly turno?: Turno;
  readonly dias?: string;
  readonly duracion?: number;
  readonly modalidad?: Modalidad;
  readonly fechaInicio: string;
  readonly fechaFin?: string;
  readonly capacidad?: number;
  readonly estado: Exclude<EstadoDeCohorte, 'cerrado'>;
}

export interface DatosDePlan {
  readonly paquete?: Paquete;
  readonly montoCuota: Centavos;
  readonly cuotas: number;
  readonly primerVencimiento: string;
  readonly cadaMeses: number;
  readonly nota?: string;
}

export interface DatosDeInscripcionNueva {
  /** Ficha existente; si falta, `ficha` crea una nueva en la misma operación. */
  readonly estudianteId?: Id;
  readonly ficha?: DatosDeFicha;
  readonly grupoId: Id;
  readonly paquete?: Paquete;
  readonly documentos: readonly string[];
  readonly renuevaA?: Id;
  readonly observaciones?: string;
}

export interface InscripcionHecha {
  readonly inscripcionId: Id;
  readonly numero: number;
  readonly estudianteId: Id;
  readonly codigo: string;
  readonly alumno: string;
  readonly grupoNombre: string;
  readonly cuotas: number;
  readonly sinPlan: boolean;
  readonly fichaNueva: boolean;
  readonly repetida: boolean;
}

export interface DatosDeAprobacion {
  readonly solicitudId: Id;
  readonly grupoId: Id;
  readonly paquete?: Paquete;
  readonly documentos: readonly string[];
  readonly respuesta: string;
  /** B.8: ficha existente sin cuenta elegida por el personal; vacío = ficha nueva. */
  readonly estudianteId?: Id;
}

export interface CierreDeGrupo {
  readonly concluidos: number;
  readonly conDeuda: number;
}

// ---------------------------------------------------------------- puerto

export interface AlumnosPort {
  buscarAlumnos(filtro: FiltroDeAlumnos): Promise<Resultado<readonly AlumnoEnLista[]>>;
  fichaDeAlumno(codigo: string): Promise<Resultado<FichaDeAlumno | null>>;
  sugerirFichas(documento: string | null, nombres: string, apellidos: string): Promise<Resultado<readonly FichaSugerida[]>>;
  crearAlumno(clave: string, ficha: DatosDeFicha): Promise<Resultado<{ readonly estudianteId: Id; readonly codigo: string }>>;
  editarAlumno(id: Id, ficha: DatosDeFicha): Promise<Resultado<void>>;
  archivarAlumno(id: Id, motivo: string): Promise<Resultado<void>>;

  listarGrupos(filtro: FiltroDeGrupos): Promise<Resultado<readonly GrupoEnLista[]>>;
  fichaDeGrupo(id: Id): Promise<Resultado<FichaDeGrupo | null>>;
  crearGrupo(datos: DatosDeGrupo): Promise<Resultado<{ readonly id: Id }>>;
  editarGrupo(id: Id, datos: Omit<DatosDeGrupo, 'programaCodigo' | 'sedeId'>): Promise<Resultado<void>>;
  cerrarGrupo(clave: string, id: Id): Promise<Resultado<CierreDeGrupo>>;
  guardarPlan(grupoId: Id, plan: DatosDePlan, planId?: Id): Promise<Resultado<void>>;
  borrarPlan(planId: Id): Promise<Resultado<void>>;

  inscribir(clave: string, datos: DatosDeInscripcionNueva): Promise<Resultado<InscripcionHecha>>;
  cambiarEstadoDeInscripcion(
    clave: string,
    inscripcionId: Id,
    estado: Exclude<EstadoDeInscripcion, 'inscrito'>,
    motivo?: string,
  ): Promise<Resultado<{ readonly estado: EstadoDeInscripcion }>>;
  guardarRequisitos(inscripcionId: Id, documentos: readonly string[]): Promise<Resultado<void>>;

  listarSolicitudes(estados: readonly EstadoDeSolicitudEnBandeja[]): Promise<Resultado<readonly SolicitudEnBandeja[]>>;
  solicitud(id: Id): Promise<Resultado<SolicitudEnBandeja | null>>;
  /** Pendientes y en revisión. Sin sede = todas. */
  contarSolicitudesAbiertas(sedeId?: Id): Promise<Resultado<number>>;
  aprobarSolicitud(clave: string, datos: DatosDeAprobacion): Promise<Resultado<InscripcionHecha>>;
  responderSolicitud(id: Id, estado: 'en_revision' | 'rechazada', respuesta: string): Promise<Resultado<void>>;
}
