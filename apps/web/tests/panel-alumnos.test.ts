/**
 * Panel interno · Alumnos y grupos (rebanada R2).
 *
 * 1. El nombre del grupo que arma el dominio es el mismo que arma la base
 *    (`app.nombre_de_grupo`): los MISMOS casos están en la batería
 *    `docs/runbooks/pruebas-rls-panel-v1.sql` (N29). Enmiendas B.13, 36.
 * 2. Los casos de uso validan la forma con el dominio ANTES de llamar a la
 *    base y devuelven todos los errores juntos (un puerto falso registra si
 *    llegó a llamarse).
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  abrirGrupo,
  aprobarSolicitud,
  archivarAlumno,
  cambiarEstadoDeInscripcion,
  definirPrecio,
  inscribirAlumno,
  limpiarRequisitos,
  responderSolicitud,
  validarFicha,
} from '../src/core/application/panel/alumnos/alumnos.usecase.ts';
import type { AlumnosPort, DatosDeGrupo } from '../src/core/application/ports/alumnos.port.ts';
import { nombreDeGrupo, type Programa } from '../src/core/domain/academico/programa.ts';
import { exito, type Centavos, type FechaISO, type Id } from '../src/core/domain/shared/tipos-base.ts';
import { PROGRAMAS } from '../src/infrastructure/catalogo/oferta-academica.ts';

function programa(codigo: string): Programa {
  const p = PROGRAMAS.find((x) => x.codigo === codigo);
  assert.ok(p, codigo);
  return p;
}

// ---------------------------------------------------------------- nombre del grupo = app.nombre_de_grupo

test('el nombre del grupo del dominio coincide con app.nombre_de_grupo (casos N29 de la batería)', () => {
  const g = (o: Partial<Parameters<typeof nombreDeGrupo>[0]>) => ({ gestion: 2026, fechaInicio: '2026-02-02' as FechaISO, ...o });
  assert.equal(
    nombreDeGrupo(g({ anioDeCarrera: 1, turno: 'noche', diasDeClase: 'lun-vie' }), { nombre: 'Gastronomía', tipo: 'carrera' }, { nombre: 'La Paz' }),
    'Gastronomía · 1.er año · Noche · 2026 · La Paz',
  );
  assert.equal(
    nombreDeGrupo(g({ anioDeCarrera: 2, turno: 'especial', gestion: 2027 }), { nombre: 'Gastronomía', tipo: 'carrera' }, { nombre: 'El Alto' }),
    'Gastronomía · 2.º año · Horario especial · 2027 · El Alto',
  );
  assert.equal(
    nombreDeGrupo(g({ diasDeClase: 'sab', fechaInicio: '2026-10-03' as FechaISO }), { nombre: 'Tortas', tipo: 'curso' }, { nombre: 'La Paz' }),
    'Tortas · Sábados · oct 2026 · La Paz',
  );
  assert.equal(
    nombreDeGrupo(
      g({ turno: 'manana', diasDeClase: 'jue-vie', gestion: 2027, fechaInicio: '2027-03-04' as FechaISO }),
      { nombre: 'Repostería y Panadería', tipo: 'curso' },
      { nombre: 'La Paz' },
    ),
    'Repostería y Panadería · Jue–Vie · Mañana · mar 2027 · La Paz',
  );
  assert.equal(
    nombreDeGrupo(
      g({ modalidad: 'magistral', fechaInicio: '2026-12-05' as FechaISO }),
      { nombre: 'Cursos de Temporada', tipo: 'curso_de_temporada' },
      { nombre: 'El Alto' },
    ),
    'Cursos de Temporada · Clase magistral · dic 2026 · El Alto',
  );
});

// ---------------------------------------------------------------- puerto falso

function puertoFalso() {
  const llamadas: string[] = [];
  const ok = <T>(nombre: string, valor: T) => {
    llamadas.push(nombre);
    return Promise.resolve(exito(valor));
  };
  const hecha = {
    inscripcionId: 'i' as Id,
    numero: 1,
    estudianteId: 'e' as Id,
    codigo: 'BG-2026-0001',
    alumno: 'Ana',
    grupoNombre: 'G',
    cuotas: 0,
    sinPlan: false,
    fichaNueva: true,
    repetida: false,
  };
  const puerto: AlumnosPort = {
    buscarAlumnos: () => ok('buscarAlumnos', []),
    fichaDeAlumno: () => ok('fichaDeAlumno', null),
    sugerirFichas: () => ok('sugerirFichas', []),
    crearAlumno: () => ok('crearAlumno', { estudianteId: 'e' as Id, codigo: 'BG-2026-0001' }),
    editarAlumno: () => ok('editarAlumno', undefined),
    archivarAlumno: () => ok('archivarAlumno', undefined),
    listarGrupos: () => ok('listarGrupos', []),
    fichaDeGrupo: () => ok('fichaDeGrupo', null),
    crearGrupo: () => ok('crearGrupo', { id: 'g' as Id }),
    editarGrupo: () => ok('editarGrupo', undefined),
    cerrarGrupo: () => ok('cerrarGrupo', { concluidos: 0, conDeuda: 0 }),
    guardarPlan: () => ok('guardarPlan', undefined),
    borrarPlan: () => ok('borrarPlan', undefined),
    inscribir: (_c, datos) => {
      llamadas.push(`inscribir:${datos.documentos.join('|')}`);
      return Promise.resolve(exito(hecha));
    },
    cambiarEstadoDeInscripcion: (_c, _i, estado) => ok('cambiarEstadoDeInscripcion', { estado }),
    guardarRequisitos: () => ok('guardarRequisitos', undefined),
    listarSolicitudes: () => ok('listarSolicitudes', []),
    solicitud: () => ok('solicitud', null),
    contarSolicitudesAbiertas: () => ok('contarSolicitudesAbiertas', 0),
    aprobarSolicitud: () => ok('aprobarSolicitud', hecha),
    responderSolicitud: () => ok('responderSolicitud', undefined),
  };
  return { puerto, llamadas };
}

// ---------------------------------------------------------------- fichas

test('la ficha se normaliza y junta todos sus errores', () => {
  const mala = validarFicha({ nombres: ' ', apellidos: '', telefono: '1234', correo: 'no-es-correo' });
  assert.equal(mala.exito, false);
  if (!mala.exito) assert.equal(mala.error.length, 4);
  const buena = validarFicha({ nombres: ' Ana ', apellidos: 'Pérez', documento: 'ab-1234', telefono: '7123 4567', correo: 'Ana@Correo.BO' });
  assert.ok(buena.exito);
  if (buena.exito) {
    assert.equal(buena.valor.nombres, 'Ana');
    assert.equal(buena.valor.documento, 'AB-1234');
    assert.equal(buena.valor.telefono, '71234567');
    assert.equal(buena.valor.correo, 'ana@correo.bo');
  }
});

test('archivar exige motivo y no llama a la base sin él', async () => {
  const { puerto, llamadas } = puertoFalso();
  const r = await archivarAlumno(puerto, 'e' as Id, '  ');
  assert.equal(r.exito, false);
  assert.deepEqual(llamadas, []);
});

// ---------------------------------------------------------------- grupos y precios

const GRUPO_CARRERA: DatosDeGrupo = {
  programaCodigo: 'gastronomia',
  sedeId: 'sede-la-paz' as Id,
  gestion: 2027,
  anioDeCarrera: 1,
  turno: 'tarde',
  dias: 'lun-vie',
  duracion: 3,
  fechaInicio: '2027-02-01',
  capacidad: 25,
  estado: 'abierto',
};

test('abrir un grupo valida contra las opciones del programa antes de escribir', async () => {
  const { puerto, llamadas } = puertoFalso();
  const malo = await abrirGrupo(puerto, programa('gastronomia'), { ...GRUPO_CARRERA, turno: undefined, anioDeCarrera: undefined });
  assert.equal(malo.exito, false);
  if (!malo.exito) assert.ok(malo.error.length >= 2);
  assert.deepEqual(llamadas, []);

  const bueno = await abrirGrupo(puerto, programa('gastronomia'), GRUPO_CARRERA);
  assert.ok(bueno.exito);
  assert.deepEqual(llamadas, ['crearGrupo']);
});

test('el precio de un grupo de la carrera es por paquete; el de un curso, sin paquete', async () => {
  const { puerto, llamadas } = puertoFalso();
  const plan = { montoCuota: 65000 as Centavos, cuotas: 1, primerVencimiento: '2027-02-10', cadaMeses: 1 };
  assert.equal((await definirPrecio(puerto, programa('gastronomia'), 'g' as Id, plan)).exito, false);
  assert.equal((await definirPrecio(puerto, programa('cocina'), 'g' as Id, { ...plan, paquete: 'economico' })).exito, false);
  assert.ok((await definirPrecio(puerto, programa('gastronomia'), 'g' as Id, { ...plan, paquete: 'economico' })).exito);
  assert.deepEqual(llamadas, ['guardarPlan']);
});

// ---------------------------------------------------------------- inscribir y retirar

test('inscribir: persona nueva válida, paquete en la carrera y requisitos sin repetir', async () => {
  const { puerto, llamadas } = puertoFalso();
  const sinPaquete = await inscribirAlumno(puerto, true, 'k', { ficha: { nombres: 'Ana', apellidos: 'Pérez' }, grupoId: 'g' as Id, documentos: [] });
  assert.equal(sinPaquete.exito, false);
  const sinPersona = await inscribirAlumno(puerto, false, 'k', { grupoId: 'g' as Id, documentos: [] });
  assert.equal(sinPersona.exito, false);
  assert.deepEqual(llamadas, []);

  const ok = await inscribirAlumno(puerto, true, 'k', {
    ficha: { nombres: 'Ana', apellidos: 'Pérez' },
    grupoId: 'g' as Id,
    paquete: 'economico',
    documentos: ['Fotocopia de carnet', ' ', 'Fotocopia de carnet', 'Fotos'],
  });
  assert.ok(ok.exito);
  assert.deepEqual(llamadas, ['inscribir:Fotocopia de carnet|Fotos']);
});

test('retirar pide motivo; concluir no', async () => {
  const { puerto } = puertoFalso();
  assert.equal((await cambiarEstadoDeInscripcion(puerto, 'k', 'i' as Id, 'retirado', '')).exito, false);
  assert.ok((await cambiarEstadoDeInscripcion(puerto, 'k', 'i' as Id, 'retirado', 'Viaje')).exito);
  assert.ok((await cambiarEstadoDeInscripcion(puerto, 'k', 'i' as Id, 'concluido')).exito);
});

test('limpiarRequisitos quita vacíos y repetidos y respeta el máximo de 20', () => {
  assert.deepEqual(limpiarRequisitos([' a ', 'a', '', 'b']), ['a', 'b']);
  assert.equal(limpiarRequisitos(Array.from({ length: 30 }, (_, i) => `r${i}`)).length, 20);
});

// ---------------------------------------------------------------- solicitudes del portal

test('rechazar o pedir datos exige una respuesta que verá el alumno (B.9)', async () => {
  const { puerto, llamadas } = puertoFalso();
  assert.equal((await responderSolicitud(puerto, 's' as Id, 'rechazada', ' ')).exito, false);
  assert.equal((await responderSolicitud(puerto, 's' as Id, 'en_revision', '')).exito, false);
  assert.ok((await responderSolicitud(puerto, 's' as Id, 'rechazada', 'No hay cupo en la tarde')).exito);
  assert.deepEqual(llamadas, ['responderSolicitud']);
});

test('aprobar e inscribir pide el paquete en la carrera', async () => {
  const { puerto } = puertoFalso();
  const datos = { solicitudId: 's' as Id, grupoId: 'g' as Id, documentos: [], respuesta: 'Bienvenida' };
  assert.equal((await aprobarSolicitud(puerto, true, 'k', datos)).exito, false);
  assert.ok((await aprobarSolicitud(puerto, true, 'k', { ...datos, paquete: 'economico' })).exito);
  assert.ok((await aprobarSolicitud(puerto, false, 'k', datos)).exito);
});
