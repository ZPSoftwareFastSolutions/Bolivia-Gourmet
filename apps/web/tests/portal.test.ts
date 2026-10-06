/**
 * Pruebas del portal de estudiantes: dominio de solicitudes, credenciales y
 * casos de uso con puertos falsos en memoria.
 *
 * QUÉ SE PRUEBA. Que una solicitud pida un grupo en convocatoria del
 * programa elegido (ADR 0009) y se rechace con las frases de la base, que la
 * política de contraseñas sea la acordada, que los casos de uso no llamen al
 * proveedor con datos inválidos, y que cancelar respete «solo pendientes».
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  cambiarClave,
  iniciarSesion,
  registrarEstudiante,
  solicitarRecuperacion,
} from '../src/core/application/portal/acceso.usecase.ts';
import { cancelarSolicitud, crearSolicitud, obtenerConvocatoria, obtenerPanel } from '../src/core/application/portal/solicitudes.usecase.ts';
import type {
  AutenticacionPort,
  EstadoDeSesion,
  ResultadoDeRegistro,
  SolicitudDeRegistro,
} from '../src/core/application/ports/autenticacion.port.ts';
import type { PerfilDelPortal, PortalRepositoryPort } from '../src/core/application/ports/portal-repository.port.ts';
import type { Programa } from '../src/core/domain/academico/programa.ts';
import { validarClave, validarCorreo, validarRegistro, type DatosDeRegistro } from '../src/core/domain/identidad/credenciales.ts';
import { esPersonal, esRol } from '../src/core/domain/identidad/rol.ts';
import { SIN_GRUPOS, type GrupoDelPortal, type MisGrupos } from '../src/core/domain/portal/convocatoria.ts';
import {
  MAXIMO_DE_SOLICITUDES_ABIERTAS,
  puedeCancelar,
  validarSolicitud,
  type ContextoDeSolicitud,
  type DatosDeSolicitud,
  type Solicitud,
  type SolicitudValidada,
} from '../src/core/domain/portal/solicitud.ts';
import { exito, fallo, type Id, type Resultado } from '../src/core/domain/shared/tipos-base.ts';
import { traducirErrorDeAuth, traducirErrorDeBase } from '../src/infrastructure/supabase/errores.ts';
import { PROGRAMAS } from '../src/infrastructure/catalogo/oferta-academica.ts';
import { CatalogoEstaticoRepository } from '../src/infrastructure/catalogo/catalogo-estatico.repository.ts';

const programa = (codigo: string): Programa => {
  const p = PROGRAMAS.find((x) => x.codigo === codigo);
  assert.ok(p);
  return p;
};

// ---------------------------------------------------------------- solicitudes

const LA_PAZ = 'sede-la-paz' as Id;

function grupo(id: string, cambios: Partial<GrupoDelPortal> = {}): GrupoDelPortal {
  return {
    id: id as Id,
    programaCodigo: 'tortas',
    programaNombre: 'Tortas',
    programaTipo: 'curso',
    sedeId: LA_PAZ,
    sedeNombre: 'La Paz',
    nombre: `Grupo ${id}`,
    gestion: 2026,
    dias: 'sab',
    horaInicio: '14:00',
    horaFin: '17:00',
    fechaInicio: '2026-11-07',
    fechaFin: '2027-01-02',
    inscripcionDesde: '2026-10-01',
    inscripcionHasta: '2026-11-04',
    capacidad: 12,
    libres: 12,
    precios: [],
    ...cambios,
  };
}

const CARRERA_1 = grupo('c1', {
  programaCodigo: 'gastronomia',
  programaNombre: 'Gastronomía',
  programaTipo: 'carrera',
  anioDeCarrera: 1,
  turno: 'noche',
  dias: 'lun-vie',
  horaInicio: '18:00',
  horaFin: '21:00',
  fechaInicio: '2027-02-01',
  fechaFin: undefined,
  nombre: 'Gastronomía · 1.er año · Noche · 2027 · La Paz',
});
const CARRERA_2 = grupo('c2', { ...CARRERA_1, id: 'c2' as Id, anioDeCarrera: 2, nombre: 'Gastronomía · 2.º año · Noche · 2027 · La Paz' });
const TORTAS = grupo('t1');
const TORTAS_SEMANA = grupo('t2', { dias: 'lun-mie', horaInicio: '19:00', horaFin: '21:00', fechaInicio: '2027-02-08', fechaFin: '2027-04-02' });
const OFERTA = [CARRERA_1, CARRERA_2, TORTAS, TORTAS_SEMANA];

const contexto = (cambios: Partial<ContextoDeSolicitud> = {}): ContextoDeSolicitud => ({
  programa: programa('gastronomia'),
  oferta: OFERTA,
  misGrupos: SIN_GRUPOS,
  solicitudes: [],
  ...cambios,
});

const CARRERA: DatosDeSolicitud = { tipo: 'inscripcion', programaCodigo: 'gastronomia', grupoId: 'c1', paquete: 'economico' };
const DE_TORTAS: DatosDeSolicitud = { tipo: 'inscripcion', programaCodigo: 'tortas', grupoId: 't1' };

/** Los errores de un resultado fallido, para comparar frases. */
function errores(resultado: Resultado<unknown, readonly string[]>): readonly string[] {
  return resultado.exito ? [] : resultado.error;
}

test('la solicitud pide un grupo en convocatoria y guarda la sede del grupo', () => {
  const ok = validarSolicitud(CARRERA, contexto());
  assert.ok(ok.exito);
  assert.deepEqual(ok.valor, {
    tipo: 'inscripcion',
    programaCodigo: 'gastronomia',
    grupoId: 'c1',
    sedeId: LA_PAZ,
    paquete: 'economico',
    gestionAnterior: undefined,
    mensaje: undefined,
  });
  assert.deepEqual(errores(validarSolicitud({ ...CARRERA, grupoId: '  ' }, contexto())), ['Elige un grupo con inscripciones abiertas.']);
  assert.deepEqual(errores(validarSolicitud({ ...CARRERA, grupoId: 'cerrado' }, contexto())), ['Las inscripciones de ese grupo no están abiertas.']);
});

test('el grupo tiene que ser del programa pedido', () => {
  assert.deepEqual(errores(validarSolicitud({ ...CARRERA, grupoId: 't1' }, contexto())), ['El grupo elegido no es de ese programa.']);
});

test('por el portal, la carrera empieza en el 1.er año y se renueva al 2.º o al 3.er año', () => {
  assert.deepEqual(errores(validarSolicitud({ ...CARRERA, grupoId: 'c2' }, contexto())), [
    'Por el portal, la carrera empieza en el 1.er año. Para pasar de año, pide tu renovación.',
  ]);
  const renovarAlPrimero = validarSolicitud({ tipo: 'renovacion', programaCodigo: 'gastronomia', grupoId: 'c1', gestionAnterior: '1.er año' }, contexto());
  assert.deepEqual(errores(renovarAlPrimero), ['La renovación es para el 2.º o el 3.er año de la carrera.']);
  const renovar = validarSolicitud({ tipo: 'renovacion', programaCodigo: 'gastronomia', grupoId: 'c2', gestionAnterior: ' 1.er año · gestión 2026 ' }, contexto());
  assert.ok(renovar.exito, 'la renovación no obliga a elegir paquete');
  assert.equal(renovar.valor.gestionAnterior, '1.er año · gestión 2026');
});

test('la carrera exige el paquete; un curso no lo acepta', () => {
  assert.deepEqual(errores(validarSolicitud({ ...CARRERA, paquete: undefined }, contexto())), ['Elige el paquete de pago.']);
  const tortas = contexto({ programa: programa('tortas') });
  assert.deepEqual(errores(validarSolicitud({ ...DE_TORTAS, paquete: 'economico' }, tortas)), ['Solo la carrera se inscribe por paquete.']);
  const ok = validarSolicitud(DE_TORTAS, tortas);
  assert.ok(ok.exito && ok.valor.paquete === undefined && ok.valor.grupoId === 't1');
});

test('la renovación es de la carrera y exige la gestión anterior; la inscripción no la guarda', () => {
  const sinGestion = validarSolicitud({ tipo: 'renovacion', programaCodigo: 'gastronomia', grupoId: 'c2' }, contexto());
  assert.equal(errores(sinGestion).length, 1);
  const deUnCurso = validarSolicitud({ ...DE_TORTAS, tipo: 'renovacion', gestionAnterior: '2026' }, contexto({ programa: programa('tortas') }));
  assert.ok(errores(deUnCurso).includes('La renovación es para la carrera.'));
  const inscripcion = validarSolicitud({ ...CARRERA, gestionAnterior: 'algo' }, contexto());
  assert.ok(inscripcion.exito && inscripcion.valor.gestionAnterior === undefined);
});

test('programa inexistente o inactivo y mensaje largo se rechazan; el mensaje vacío no viaja', () => {
  assert.equal(validarSolicitud(CARRERA, contexto({ programa: null })).exito, false);
  assert.equal(validarSolicitud(CARRERA, contexto({ programa: { ...programa('gastronomia'), activo: false } })).exito, false);
  assert.equal(validarSolicitud({ ...CARRERA, mensaje: 'x'.repeat(501) }, contexto()).exito, false);
  const vacio = validarSolicitud({ ...CARRERA, mensaje: '   ' }, contexto());
  assert.ok(vacio.exito && vacio.valor.mensaje === undefined);
});

test('lo que cursa y lo que ya pidió se comparan con las frases de la base', () => {
  const cursaElPrimero: MisGrupos = { inscripciones: [{ inscripcionId: 'i1' as Id, estado: 'inscrito', grupo: CARRERA_1 }], solicitudes: [] };
  assert.deepEqual(errores(validarSolicitud(CARRERA, contexto({ misGrupos: cursaElPrimero }))), ['Ya estás inscrito en ese grupo.']);
  const deTortas = validarSolicitud({ ...DE_TORTAS, grupoId: 't2' }, contexto({ programa: programa('tortas'), misGrupos: cursaElPrimero }));
  assert.deepEqual(errores(deTortas), ['Ese horario se cruza con tu curso «Gastronomía · 1.er año · Noche · 2027 · La Paz».']);
  assert.ok(validarSolicitud(DE_TORTAS, contexto({ programa: programa('tortas'), misGrupos: cursaElPrimero })).exito, 'los sábados no chocan');
});

test('no se duplica una solicitud abierta y se respeta el límite de abiertas', () => {
  const abierta = { id: 'a' as Id, programaCodigo: 'gastronomia', tipo: 'inscripcion' as const, estado: 'pendiente' as const };
  assert.deepEqual(errores(validarSolicitud(CARRERA, contexto({ solicitudes: [abierta] }))), ['Ya tienes una solicitud abierta para este programa.']);
  // Una cancelada no cuenta.
  assert.ok(validarSolicitud(CARRERA, contexto({ solicitudes: [{ ...abierta, estado: 'cancelada' }] })).exito);
  const muchas = Array.from({ length: MAXIMO_DE_SOLICITUDES_ABIERTAS }, (_, i) => ({
    id: `m${i}` as Id,
    programaCodigo: `otro-${i}`,
    tipo: 'inscripcion' as const,
    estado: 'en_revision' as const,
  }));
  assert.deepEqual(errores(validarSolicitud(CARRERA, contexto({ solicitudes: muchas }))), [
    'Tienes demasiadas solicitudes en curso. Espera la respuesta de la institución.',
  ]);
});

test('solo se cancela lo pendiente', () => {
  assert.equal(puedeCancelar({ estado: 'pendiente' }), true);
  for (const estado of ['en_revision', 'aprobada', 'rechazada', 'cancelada'] as const) assert.equal(puedeCancelar({ estado }), false);
});

// ---------------------------------------------------------------- credenciales y roles

test('la contraseña exige longitud, letras y números, y no ser trivial', () => {
  assert.ok(validarClave('cocina andina 2027').exito);
  assert.equal(validarClave('corta1').exito, false);
  assert.equal(validarClave('solamenteletras').exito, false);
  assert.equal(validarClave('12345678901234').exito, false);
  assert.equal(validarClave('MiPassword2027').exito, false, 'contiene «password»');
  assert.equal(validarClave('aaaaaaaaaaaa').exito, false);
  assert.equal(validarClave('ana.quispe2027', 'ana.quispe@correo.bo').exito, false, 'contiene el usuario del correo');
  assert.equal(validarClave(`${'ñ'.repeat(37)}1`).exito, false, 'más de 72 bytes');
});

test('el correo se normaliza y valida', () => {
  assert.deepEqual(validarCorreo('  Ana@Correo.BO '), { exito: true, valor: 'ana@correo.bo' });
  assert.equal(validarCorreo('ana@correo').exito, false);
  assert.equal(validarCorreo('').exito, false);
});

const REGISTRO: DatosDeRegistro = {
  nombres: 'Ana',
  apellidos: 'Quispe',
  telefono: '77712345',
  documento: '1234567-LP',
  correo: 'ana@correo.bo',
  clave: 'marraqueta caliente 7',
  confirmacion: 'marraqueta caliente 7',
  aceptaPrivacidad: true,
};

test('el registro devuelve errores por campo', () => {
  assert.ok(validarRegistro(REGISTRO).exito);
  const malo = validarRegistro({ ...REGISTRO, nombres: '', telefono: '123', confirmacion: 'otra', aceptaPrivacidad: false });
  assert.equal(malo.exito, false);
  assert.ok(!malo.exito);
  assert.ok(malo.error.nombres && malo.error.telefono && malo.error.confirmacion && malo.error.aceptaPrivacidad);
});

test('los roles son los tres acordados y el personal se distingue del estudiante', () => {
  assert.equal(esRol('administrador'), true);
  assert.equal(esRol('superusuario'), false);
  assert.equal(esPersonal('recepcion'), true);
  assert.equal(esPersonal('estudiante'), false);
});

// ---------------------------------------------------------------- traducción de errores

test('los errores del proveedor se traducen por código y nunca muestran texto técnico', () => {
  assert.match(traducirErrorDeAuth({ code: 'invalid_credentials' }), /incorrectos/);
  assert.match(traducirErrorDeAuth({ status: 429 }), /intentos/);
  assert.match(traducirErrorDeAuth({ code: 'algo_raro', message: 'stack trace' }), /No pudimos/);
  // Los mensajes que escriben los disparadores (para personas) pasan tal cual…
  assert.equal(traducirErrorDeBase({ code: '23505', message: 'Ya tienes una solicitud abierta para este programa.' }), 'Ya tienes una solicitud abierta para este programa.');
  // …los técnicos de PostgreSQL no.
  assert.doesNotMatch(traducirErrorDeBase({ code: '42501', message: 'new row violates row-level security policy for table "solicitudes"' }), /violates|policy/);
  assert.doesNotMatch(traducirErrorDeBase({ code: 'XX000', message: 'internal error' }), /internal/);
});

// ---------------------------------------------------------------- casos de uso con dobles

class AutenticacionFalsa implements AutenticacionPort {
  registros: SolicitudDeRegistro[] = [];
  sesion: EstadoDeSesion = { estado: 'anonimo' };
  clavesCambiadas: string[] = [];
  recuperaciones = 0;
  async estadoDeSesion() {
    return this.sesion;
  }
  async registrar(s: SolicitudDeRegistro): Promise<Resultado<ResultadoDeRegistro>> {
    this.registros.push(s);
    return exito('requiere_confirmacion');
  }
  async iniciarSesion(correo: string) {
    return correo === 'ana@correo.bo' ? exito({ id: 'u1' as Id, correo }) : fallo('Correo o contraseña incorrectos.');
  }
  async cerrarSesion() {}
  async enviarRecuperacion() {
    this.recuperaciones++;
    return exito(undefined);
  }
  async cambiarClave(clave: string) {
    this.clavesCambiadas.push(clave);
    return exito(undefined);
  }
  async canjearCodigo() {
    return exito(undefined);
  }
  async verificarEnlace() {
    return exito(undefined);
  }
}

test('el registro inválido nunca llega al proveedor; el válido viaja sin el rol', async () => {
  const auth = new AutenticacionFalsa();
  const malo = await registrarEstudiante(auth, { ...REGISTRO, clave: 'corta' }, 'http://localhost/auth/confirmar');
  assert.equal(malo.exito, false);
  assert.equal(auth.registros.length, 0);

  const bueno = await registrarEstudiante(auth, REGISTRO, 'http://localhost/auth/confirmar');
  assert.deepEqual(bueno, { exito: true, valor: 'requiere_confirmacion' });
  assert.equal(auth.registros.length, 1);
  assert.equal(auth.registros[0]?.correo, 'ana@correo.bo');
  assert.ok(!('rol' in (auth.registros[0]?.estudiante ?? {})));
});

test('iniciar sesión valida antes y traduce el rechazo', async () => {
  const auth = new AutenticacionFalsa();
  assert.equal((await iniciarSesion(auth, 'no-es-correo', 'x')).exito, false);
  assert.equal((await iniciarSesion(auth, 'ana@correo.bo', '')).exito, false);
  assert.ok((await iniciarSesion(auth, ' ANA@correo.bo ', 'cualquiera')).exito);
  assert.equal((await iniciarSesion(auth, 'otra@correo.bo', 'cualquiera')).exito, false);
});

test('la recuperación responde igual exista o no la cuenta', async () => {
  const auth = new AutenticacionFalsa();
  assert.equal((await solicitarRecuperacion(auth, 'nadie', 'u')).exito, false, 'formato inválido sí se dice');
  assert.ok((await solicitarRecuperacion(auth, 'desconocido@correo.bo', 'u')).exito);
  assert.equal(auth.recuperaciones, 1);
});

test('cambiar la clave exige la sesión del enlace y una clave válida', async () => {
  const auth = new AutenticacionFalsa();
  assert.equal((await cambiarClave(auth, 'pan de batalla 99', 'pan de batalla 99')).exito, false, 'sin sesión');
  auth.sesion = { estado: 'autenticado', usuario: { id: 'u1' as Id, correo: 'ana@correo.bo' } };
  assert.equal((await cambiarClave(auth, 'corta', 'corta')).exito, false);
  assert.equal((await cambiarClave(auth, 'pan de batalla 99', 'otra cosa 99')).exito, false);
  assert.ok((await cambiarClave(auth, 'pan de batalla 99', 'pan de batalla 99')).exito);
  assert.deepEqual(auth.clavesCambiadas, ['pan de batalla 99']);
});


class PortalEnMemoria implements PortalRepositoryPort {
  solicitudes: Solicitud[] = [];
  oferta: GrupoDelPortal[] = [...OFERTA];
  mios: MisGrupos = SIN_GRUPOS;
  creadas: SolicitudValidada[] = [];
  canceladas: Id[] = [];
  perfil: PerfilDelPortal | null = { id: 'u1' as Id, rol: 'estudiante', nombres: 'Ana', apellidos: 'Quispe', correo: 'ana@correo.bo' };
  async miPerfil() {
    return exito(this.perfil);
  }
  async misSolicitudes() {
    return exito(this.solicitudes);
  }
  async ofertaAbierta() {
    return exito(this.oferta);
  }
  async misGrupos() {
    return exito(this.mios);
  }
  async crearSolicitud(datos: SolicitudValidada) {
    this.creadas.push(datos);
    return exito(`s${this.creadas.length}` as Id);
  }
  async cancelarSolicitud(id: Id) {
    this.canceladas.push(id);
    return exito(undefined);
  }
}

test('crear una solicitud valida contra la oferta abierta antes de escribir', async () => {
  const catalogo = new CatalogoEstaticoRepository();
  const portal = new PortalEnMemoria();
  portal.oferta = [CARRERA_2, TORTAS];
  const cerrada = await crearSolicitud(catalogo, portal, CARRERA);
  assert.deepEqual(cerrada, { exito: false, error: ['Las inscripciones de ese grupo no están abiertas.'] });
  assert.equal(portal.creadas.length, 0);

  portal.oferta = [...OFERTA];
  const buena = await crearSolicitud(catalogo, portal, CARRERA);
  assert.ok(buena.exito);
  assert.equal(portal.creadas[0]?.grupoId, 'c1');
  assert.equal(portal.creadas[0]?.sedeId, LA_PAZ, 'la sede sale del grupo');
});

test('cada página del portal ofrece sus grupos: cursos y 1.er año, o 2.º y 3.er año', async () => {
  const portal = new PortalEnMemoria();
  const inscripcion = await obtenerConvocatoria(portal, 'inscripcion');
  assert.ok(inscripcion.exito);
  assert.deepEqual(inscripcion.valor.grupos.map((g) => g.id), ['c1', 't1', 't2']);
  const renovacion = await obtenerConvocatoria(portal, 'renovacion');
  assert.ok(renovacion.exito);
  assert.deepEqual(renovacion.valor.grupos.map((g) => g.id), ['c2']);
});

test('cancelar solo lo propio y pendiente', async () => {
  const portal = new PortalEnMemoria();
  const base: Solicitud = {
    id: 'a' as Id,
    tipo: 'inscripcion',
    programaCodigo: 'tortas',
    programaNombre: 'Tortas',
    sedeNombre: 'La Paz',
    estado: 'pendiente',
    creadaEn: '2026-10-01T12:00:00Z',
  };
  portal.solicitudes = [base, { ...base, id: 'b' as Id, estado: 'en_revision' }];
  assert.ok((await cancelarSolicitud(portal, 'a' as Id)).exito);
  assert.equal((await cancelarSolicitud(portal, 'b' as Id)).exito, false);
  assert.equal((await cancelarSolicitud(portal, 'ajena' as Id)).exito, false);
  assert.deepEqual(portal.canceladas, ['a']);
});

test('el panel exige perfil y trae los cursos de la persona', async () => {
  const portal = new PortalEnMemoria();
  portal.mios = { inscripciones: [{ inscripcionId: 'i1' as Id, estado: 'inscrito', grupo: CARRERA_1 }], solicitudes: [] };
  const panel = await obtenerPanel(portal);
  assert.ok(panel.exito);
  assert.equal(panel.valor.misGrupos.inscripciones.length, 1);
  portal.perfil = null;
  assert.equal((await obtenerPanel(portal)).exito, false);
});
