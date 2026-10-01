/**
 * Pruebas del portal de estudiantes: dominio de solicitudes, credenciales y
 * casos de uso con puertos falsos en memoria.
 *
 * QUÉ SE PRUEBA. Que una solicitud solo acepte las opciones del programa
 * elegido (y pida las que ese programa exige), que la política de
 * contraseñas sea la acordada, que los casos de uso no llamen al proveedor
 * con datos inválidos, y que cancelar respete «solo pendientes».
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  cambiarClave,
  iniciarSesion,
  registrarEstudiante,
  solicitarRecuperacion,
} from '../src/core/application/portal/acceso.usecase.ts';
import { cancelarSolicitud, crearSolicitud, obtenerPanel } from '../src/core/application/portal/solicitudes.usecase.ts';
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
import {
  MAXIMO_DE_SOLICITUDES_ABIERTAS,
  puedeCancelar,
  validarSolicitud,
  type DatosDeSolicitud,
  type Solicitud,
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
const SEDES = ['la-paz', 'el-alto'];

// ---------------------------------------------------------------- solicitudes

const CARRERA: DatosDeSolicitud = {
  tipo: 'inscripcion',
  programaCodigo: 'gastronomia',
  sedeCodigo: 'la-paz',
  turno: 'noche',
  dias: 'lun-vie',
  paquete: 'economico',
};

test('la carrera exige turno, días y paquete; la duración única se fija sola', () => {
  const ok = validarSolicitud(CARRERA, programa('gastronomia'), SEDES);
  assert.ok(ok.exito);
  assert.equal(ok.valor.duracion, 3, 'la carrera solo dura 3 años: no se pregunta');

  const sinNada = validarSolicitud({ tipo: 'inscripcion', programaCodigo: 'gastronomia', sedeCodigo: 'la-paz' }, programa('gastronomia'), SEDES);
  assert.equal(sinNada.exito, false);
  assert.ok(!sinNada.exito && sinNada.error.length === 3, 'turno, días y paquete');
});

test('un curso rechaza turno y paquete que no ofrece, y exige duración entre sus opciones', () => {
  const tortas = programa('tortas');
  assert.ok(validarSolicitud({ tipo: 'inscripcion', programaCodigo: 'tortas', sedeCodigo: 'el-alto', dias: 'sab', duracion: 4 }, tortas, SEDES).exito);
  assert.equal(validarSolicitud({ tipo: 'inscripcion', programaCodigo: 'tortas', sedeCodigo: 'el-alto', dias: 'sab', duracion: 3 }, tortas, SEDES).exito, false);
  assert.equal(
    validarSolicitud({ tipo: 'inscripcion', programaCodigo: 'tortas', sedeCodigo: 'el-alto', dias: 'sab', duracion: 2, paquete: 'economico' }, tortas, SEDES).exito,
    false,
  );
  assert.equal(validarSolicitud({ tipo: 'inscripcion', programaCodigo: 'tortas', sedeCodigo: 'el-alto', duracion: 2 }, tortas, SEDES).exito, false);
});

test('los datos normalizados solo llevan lo que el programa usa', () => {
  // Un turno colado en un curso sin turnos hace fallar la validación…
  const conTurno = validarSolicitud(
    { tipo: 'inscripcion', programaCodigo: 'cocina', sedeCodigo: 'la-paz', dias: 'jue-vie', duracion: 2, turno: 'noche' },
    programa('cocina'),
    SEDES,
  );
  assert.ok(conTurno.exito, 'cocina no ofrece turnos: el turno se ignora en vez de rechazar');
  assert.equal(conTurno.valor.turno, undefined);
  // …y el mensaje vacío no viaja.
  const conMensajeVacio = validarSolicitud({ ...CARRERA, mensaje: '   ' }, programa('gastronomia'), SEDES);
  assert.ok(conMensajeVacio.exito && conMensajeVacio.valor.mensaje === undefined);
});

test('repostería exige uno de sus turnos (mañana, noche o único)', () => {
  const base = { tipo: 'inscripcion' as const, programaCodigo: 'reposteria-y-panaderia', sedeCodigo: 'la-paz', dias: 'lun-mie', duracion: 6 };
  assert.ok(validarSolicitud({ ...base, turno: 'unico' }, programa('reposteria-y-panaderia'), SEDES).exito);
  assert.equal(validarSolicitud({ ...base, turno: 'tarde' }, programa('reposteria-y-panaderia'), SEDES).exito, false);
});

test('los cursos de temporada piden modalidad y no inventan duración', () => {
  const temporada = programa('cursos-de-temporada');
  const ok = validarSolicitud({ tipo: 'inscripcion', programaCodigo: temporada.codigo, sedeCodigo: 'la-paz', modalidad: 'virtual' }, temporada, SEDES);
  assert.ok(ok.exito);
  assert.equal(ok.valor.duracion, undefined);
  assert.equal(validarSolicitud({ tipo: 'inscripcion', programaCodigo: temporada.codigo, sedeCodigo: 'la-paz' }, temporada, SEDES).exito, false);
});

test('la renovación exige la gestión anterior y la inscripción no la guarda', () => {
  const sinGestion = validarSolicitud({ ...CARRERA, tipo: 'renovacion' }, programa('gastronomia'), SEDES);
  assert.equal(sinGestion.exito, false);
  const conGestion = validarSolicitud({ ...CARRERA, tipo: 'renovacion', gestionAnterior: ' 1.er año ', paquete: undefined }, programa('gastronomia'), SEDES);
  assert.ok(conGestion.exito, 'la renovación de la carrera no obliga a elegir paquete');
  assert.equal(conGestion.valor.gestionAnterior, '1.er año');
  const inscripcion = validarSolicitud({ ...CARRERA, gestionAnterior: 'algo' }, programa('gastronomia'), SEDES);
  assert.ok(inscripcion.exito && inscripcion.valor.gestionAnterior === undefined);
});

test('programa inexistente, sede desconocida y mensaje largo se rechazan', () => {
  assert.equal(validarSolicitud(CARRERA, null, SEDES).exito, false);
  assert.equal(validarSolicitud({ ...CARRERA, sedeCodigo: 'cochabamba' }, programa('gastronomia'), SEDES).exito, false);
  assert.equal(validarSolicitud({ ...CARRERA, mensaje: 'x'.repeat(501) }, programa('gastronomia'), SEDES).exito, false);
  assert.equal(validarSolicitud(CARRERA, { ...programa('gastronomia'), activo: false }, SEDES).exito, false);
});

test('no se duplica una solicitud abierta y se respeta el límite de abiertas', () => {
  const abierta = { programaCodigo: 'gastronomia', tipo: 'inscripcion' as const, estado: 'pendiente' as const };
  assert.equal(validarSolicitud(CARRERA, programa('gastronomia'), SEDES, [abierta]).exito, false);
  // Una cancelada no cuenta.
  assert.ok(validarSolicitud(CARRERA, programa('gastronomia'), SEDES, [{ ...abierta, estado: 'cancelada' }]).exito);
  const muchas = Array.from({ length: MAXIMO_DE_SOLICITUDES_ABIERTAS }, (_, i) => ({ programaCodigo: `otro-${i}`, tipo: 'inscripcion' as const, estado: 'en_revision' as const }));
  assert.equal(validarSolicitud(CARRERA, programa('gastronomia'), SEDES, muchas).exito, false);
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
  creadas: DatosDeSolicitud[] = [];
  canceladas: Id[] = [];
  perfil: PerfilDelPortal | null = { id: 'u1' as Id, rol: 'estudiante', nombres: 'Ana', apellidos: 'Quispe', correo: 'ana@correo.bo' };
  async miPerfil() {
    return exito(this.perfil);
  }
  async misSolicitudes() {
    return exito(this.solicitudes);
  }
  async crearSolicitud(datos: DatosDeSolicitud) {
    this.creadas.push(datos);
    return exito(`s${this.creadas.length}` as Id);
  }
  async cancelarSolicitud(id: Id) {
    this.canceladas.push(id);
    return exito(undefined);
  }
}

test('crear una solicitud valida contra el catálogo antes de escribir', async () => {
  const catalogo = new CatalogoEstaticoRepository();
  const portal = new PortalEnMemoria();
  const mala = await crearSolicitud(catalogo, portal, { ...CARRERA, turno: 'unico' });
  assert.equal(mala.exito, false);
  assert.equal(portal.creadas.length, 0);

  const buena = await crearSolicitud(catalogo, portal, CARRERA);
  assert.ok(buena.exito);
  assert.equal(portal.creadas[0]?.duracion, 3);
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

test('el panel exige perfil', async () => {
  const portal = new PortalEnMemoria();
  assert.ok((await obtenerPanel(portal)).exito);
  portal.perfil = null;
  assert.equal((await obtenerPanel(portal)).exito, false);
});
