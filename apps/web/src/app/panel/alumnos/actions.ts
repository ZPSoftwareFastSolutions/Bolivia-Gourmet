'use server';

/**
 * CAPA: Presentation / App — Server Actions de Alumnos (panel interno).
 *
 * Cada acción vuelve a exigir sesión y permiso (la página ya lo hizo, pero
 * una acción se puede invocar sola), lee el formulario, llama al caso de uso
 * con el repositorio de ESTA petición y, si todo sale bien, redirige a la
 * página que confirma lo hecho (`?inscrito=`, `?abierto=`…). Si algo falla,
 * devuelve las frases y el formulario conserva lo escrito.
 */

import { redirect } from 'next/navigation';
import type { Modalidad, Turno } from '@core/domain/academico/programa';
import { tienePermiso, type Permiso } from '@core/domain/identidad/contexto-de-panel';
import type { EstadoDeInscripcion, Paquete } from '@core/domain/estudiantes/estudiante';
import { parsearMonto } from '@core/domain/shared/dinero';
import type { Id } from '@core/domain/shared/tipos-base';
import {
  abrirGrupo,
  aprobarSolicitud,
  archivarAlumno,
  cambiarEstadoDeInscripcion,
  cerrarGrupo,
  crearAlumno,
  definirPrecio,
  editarAlumno,
  editarGrupo,
  guardarRequisitos,
  inscribirAlumno,
  responderSolicitud,
} from '@core/application/panel/alumnos/alumnos.usecase';
import type { DatosDeFicha, DatosDeGrupo } from '@core/application/ports/alumnos.port';
import { alumnosRepository, catalogoAcademico } from '@infra/config/composition-root';
import { RUTAS_ALUMNOS, rutaDeAlumno, rutaDeGrupo } from '@/lib/rutas';
import { campo, type EstadoDeFormulario } from '@/presentation/formularios/estado';
import { exigirPersonal } from '../_sesion';

const SIN_SESION: EstadoDeFormulario = { estado: 'error', mensaje: 'No pudimos comprobar tu sesión. Vuelve a entrar e inténtalo otra vez.' };
const SIN_PERMISO: EstadoDeFormulario = { estado: 'error', mensaje: 'Esta acción la hace administración. Si la necesitas, pídesela.' };

async function conPermiso(...permisos: Permiso[]): Promise<EstadoDeFormulario | null> {
  const lectura = await exigirPersonal();
  if (lectura.estado !== 'ok') return SIN_SESION;
  return permisos.every((p) => tienePermiso(lectura.contexto, p)) ? null : SIN_PERMISO;
}

function errores(lista: readonly string[], valores?: Record<string, string>): EstadoDeFormulario {
  return { estado: 'error', mensaje: lista.join(' '), valores };
}

function entero(texto: string): number | undefined {
  if (!/^\d+$/.test(texto)) return undefined;
  const n = Number.parseInt(texto, 10);
  return Number.isSafeInteger(n) ? n : undefined;
}

function opcional(texto: string): string | undefined {
  return texto.length > 0 ? texto : undefined;
}

function fichaDelFormulario(datos: FormData): DatosDeFicha {
  return {
    nombres: campo(datos, 'nombres'),
    apellidos: campo(datos, 'apellidos'),
    documento: opcional(campo(datos, 'documento')),
    telefono: opcional(campo(datos, 'telefono')),
    correo: opcional(campo(datos, 'correo')),
    fechaDeNacimiento: opcional(campo(datos, 'fechaDeNacimiento')),
    sedeId: opcional(campo(datos, 'sede')) as Id | undefined,
    observaciones: opcional(campo(datos, 'observaciones')),
  };
}

function requisitos(datos: FormData): readonly string[] {
  return datos.getAll('requisito').filter((v): v is string => typeof v === 'string');
}

function paquete(texto: string): Paquete | undefined {
  return texto === 'economico' || texto === 'ahorrador' ? texto : undefined;
}

// ---------------------------------------------------------------- fichas

export async function crearAlumnoAccion(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const bloqueo = await conPermiso('estudiantes.gestionar');
  if (bloqueo) return bloqueo;
  const r = await crearAlumno(await alumnosRepository(), campo(datos, 'clave'), fichaDelFormulario(datos));
  if (!r.exito) return errores(r.error);
  redirect(`${rutaDeAlumno(r.valor.codigo)}?creado=1`);
}

export async function editarAlumnoAccion(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const bloqueo = await conPermiso('estudiantes.gestionar');
  if (bloqueo) return bloqueo;
  const r = await editarAlumno(await alumnosRepository(), campo(datos, 'id') as Id, fichaDelFormulario(datos));
  if (!r.exito) return errores(r.error);
  redirect(`${rutaDeAlumno(campo(datos, 'codigo'))}?editado=1`);
}

export async function archivarAlumnoAccion(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const bloqueo = await conPermiso('estudiantes.archivar');
  if (bloqueo) return bloqueo;
  const r = await archivarAlumno(await alumnosRepository(), campo(datos, 'id') as Id, campo(datos, 'motivo'));
  if (!r.exito) return errores(r.error);
  redirect(`${rutaDeAlumno(campo(datos, 'codigo'))}?archivado=1`);
}

// ---------------------------------------------------------------- inscribir

export async function inscribirAccion(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const bloqueo = await conPermiso('inscripciones.gestionar');
  if (bloqueo) return bloqueo;
  const estudianteId = opcional(campo(datos, 'alumno')) as Id | undefined;
  const r = await inscribirAlumno(await alumnosRepository(), campo(datos, 'esCarrera') === 'si', campo(datos, 'clave'), {
    estudianteId,
    ficha: estudianteId ? undefined : fichaDelFormulario(datos),
    grupoId: campo(datos, 'grupo') as Id,
    paquete: paquete(campo(datos, 'paquete')),
    documentos: requisitos(datos),
    renuevaA: opcional(campo(datos, 'renueva')) as Id | undefined,
    observaciones: opcional(campo(datos, 'observaciones')),
  });
  if (!r.exito) return errores(r.error);
  const avisoSinPrecio = r.valor.sinPlan ? '&sinprecio=1' : '';
  redirect(`${rutaDeAlumno(r.valor.codigo)}?inscrito=${r.valor.numero}${avisoSinPrecio}`);
}

export async function cambiarEstadoAccion(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const bloqueo = await conPermiso('inscripciones.gestionar');
  if (bloqueo) return bloqueo;
  const nuevo = campo(datos, 'estado') === 'concluido' ? 'concluido' : 'retirado';
  const r = await cambiarEstadoDeInscripcion(
    await alumnosRepository(),
    campo(datos, 'clave'),
    campo(datos, 'inscripcion') as Id,
    nuevo satisfies Exclude<EstadoDeInscripcion, 'inscrito'>,
    opcional(campo(datos, 'motivo')),
  );
  if (!r.exito) return errores(r.error);
  redirect(`${rutaDeAlumno(campo(datos, 'codigo'))}?${nuevo}=${encodeURIComponent(campo(datos, 'numero'))}`);
}

export async function guardarRequisitosAccion(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const bloqueo = await conPermiso('inscripciones.gestionar');
  if (bloqueo) return bloqueo;
  const r = await guardarRequisitos(await alumnosRepository(), campo(datos, 'inscripcion') as Id, requisitos(datos));
  if (!r.exito) return errores(r.error);
  redirect(`${rutaDeAlumno(campo(datos, 'codigo'))}?requisitos=${encodeURIComponent(campo(datos, 'numero'))}`);
}

// ---------------------------------------------------------------- grupos

function grupoDelFormulario(datos: FormData): DatosDeGrupo {
  const estado = campo(datos, 'estado');
  return {
    programaCodigo: campo(datos, 'programa'),
    sedeId: campo(datos, 'sede') as Id,
    gestion: entero(campo(datos, 'gestion')) ?? 0,
    anioDeCarrera: entero(campo(datos, 'anioDeCarrera')),
    turno: (opcional(campo(datos, 'turno')) as Turno | undefined) ?? undefined,
    dias: opcional(campo(datos, 'dias')),
    duracion: entero(campo(datos, 'duracion')),
    modalidad: opcional(campo(datos, 'modalidad')) as Modalidad | undefined,
    fechaInicio: campo(datos, 'fechaInicio'),
    fechaFin: opcional(campo(datos, 'fechaFin')),
    horaInicio: opcional(campo(datos, 'horaInicio')),
    horaFin: opcional(campo(datos, 'horaFin')),
    inscripcionDesde: opcional(campo(datos, 'inscripcionDesde')),
    inscripcionHasta: opcional(campo(datos, 'inscripcionHasta')),
    capacidad: entero(campo(datos, 'capacidad')),
    estado: estado === 'abierto' || estado === 'en_curso' ? estado : 'planificado',
  };
}

export async function abrirGrupoAccion(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const bloqueo = await conPermiso('cohortes.gestionar');
  if (bloqueo) return bloqueo;
  const grupo = grupoDelFormulario(datos);
  const r = await abrirGrupo(await alumnosRepository(), await catalogoAcademico().programaPorCodigo(grupo.programaCodigo), grupo);
  if (!r.exito) return errores(r.error);
  redirect(`${rutaDeGrupo(r.valor.id)}?abierto=1`);
}

export async function editarGrupoAccion(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const bloqueo = await conPermiso('cohortes.gestionar');
  if (bloqueo) return bloqueo;
  const grupo = grupoDelFormulario(datos);
  const id = campo(datos, 'id') as Id;
  const r = await editarGrupo(await alumnosRepository(), await catalogoAcademico().programaPorCodigo(grupo.programaCodigo), id, grupo);
  if (!r.exito) return errores(r.error);
  redirect(`${rutaDeGrupo(id)}?editado=1`);
}

export async function cerrarGrupoAccion(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const bloqueo = await conPermiso('cohortes.gestionar');
  if (bloqueo) return bloqueo;
  if (campo(datos, 'confirmo') !== 'si') return errores(['Marca la casilla para confirmar que el grupo terminó.']);
  const id = campo(datos, 'id') as Id;
  const r = await cerrarGrupo(await alumnosRepository(), campo(datos, 'clave'), id);
  if (!r.exito) return errores(r.error);
  redirect(`${rutaDeGrupo(id)}?cerrado=${r.valor.concluidos}&deuda=${r.valor.conDeuda}`);
}

export async function guardarPlanAccion(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const bloqueo = await conPermiso('contabilidad.gestionar');
  if (bloqueo) return bloqueo;
  const grupoId = campo(datos, 'grupo') as Id;
  const monto = parsearMonto(campo(datos, 'monto'));
  if (!monto.exito) return errores([monto.error]);
  const r = await definirPrecio(
    await alumnosRepository(),
    await catalogoAcademico().programaPorCodigo(campo(datos, 'programa')),
    grupoId,
    {
      paquete: paquete(campo(datos, 'paquete')),
      montoCuota: monto.valor,
      cuotas: entero(campo(datos, 'cuotas')) ?? 0,
      primerVencimiento: campo(datos, 'primerVencimiento'),
      cadaMeses: entero(campo(datos, 'cadaMeses')) ?? 0,
      nota: opcional(campo(datos, 'nota')),
    },
    opcional(campo(datos, 'plan')) as Id | undefined,
  );
  if (!r.exito) return errores(r.error);
  redirect(`${rutaDeGrupo(grupoId)}?precio=1`);
}

export async function borrarPlanAccion(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const bloqueo = await conPermiso('contabilidad.gestionar');
  if (bloqueo) return bloqueo;
  const r = await (await alumnosRepository()).borrarPlan(campo(datos, 'plan') as Id);
  if (!r.exito) return errores([r.error]);
  redirect(`${rutaDeGrupo(campo(datos, 'grupo'))}?precio=borrado`);
}

// ---------------------------------------------------------------- solicitudes del portal

export async function aprobarSolicitudAccion(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const bloqueo = await conPermiso('solicitudes.gestionar', 'inscripciones.gestionar');
  if (bloqueo) return bloqueo;
  const ficha = campo(datos, 'ficha');
  const r = await aprobarSolicitud(await alumnosRepository(), campo(datos, 'esCarrera') === 'si', campo(datos, 'clave'), {
    solicitudId: campo(datos, 'solicitud') as Id,
    grupoId: campo(datos, 'grupo') as Id,
    paquete: paquete(campo(datos, 'paquete')),
    documentos: requisitos(datos),
    respuesta: campo(datos, 'respuesta'),
    estudianteId: ficha && ficha !== 'nueva' ? (ficha as Id) : undefined,
  });
  if (!r.exito) return errores(r.error);
  const avisoSinPrecio = r.valor.sinPlan ? '&sinprecio=1' : '';
  redirect(`${rutaDeAlumno(r.valor.codigo)}?inscrito=${r.valor.numero}&solicitud=1${avisoSinPrecio}`);
}

export async function responderSolicitudAccion(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const bloqueo = await conPermiso('solicitudes.gestionar');
  if (bloqueo) return bloqueo;
  const estado = campo(datos, 'estado') === 'rechazada' ? 'rechazada' : 'en_revision';
  const r = await responderSolicitud(await alumnosRepository(), campo(datos, 'solicitud') as Id, estado, campo(datos, 'respuesta'));
  if (!r.exito) return errores(r.error);
  redirect(`${RUTAS_ALUMNOS.solicitudes}?respondida=${estado}`);
}
