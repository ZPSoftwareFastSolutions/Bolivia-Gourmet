/**
 * Pruebas del dominio de estudiantes e inscripciones.
 *
 * QUÉ SE PRUEBA. La validación de la persona (E-), que no se repite grupo
 * vigente (E1), que el paquete solo existe en la carrera (E5), los estados
 * de la inscripción (D6: inscrito, retirado, concluido), lo que admite cada
 * estado de grupo (B.2), la renovación (B.3) y los ayudantes de sede
 * (celular boliviano, enlace de WhatsApp).
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  esInscripcionVigente,
  ESTADOS_VIGENTES,
  nombreCompleto,
  validarCambioDeEstado,
  validarEstudiante,
  validarInscripcion,
  validarRenovacion,
  type DatosDeEstudiante,
  type DatosDeInscripcion,
} from '../src/core/domain/estudiantes/estudiante.ts';
import { enlaceDeWhatsApp, esCelularBoliviano } from '../src/core/domain/shared/sede.ts';
import { centavos, enumerar, fechaISO, type FechaISO, type Id } from '../src/core/domain/shared/tipos-base.ts';

const id = (valor: string) => valor as Id;

const ANA: DatosDeEstudiante = {
  nombres: 'Ana',
  apellidos: 'Quispe',
  telefono: '77712345',
  correo: 'Ana@Correo.bo',
};

// ---------------------------------------------------------------- estudiante

test('un estudiante válido se normaliza (correo en minúsculas, espacios fuera)', () => {
  const resultado = validarEstudiante({ ...ANA, nombres: '  Ana ', telefono: '777 12345' });
  assert.ok(resultado.exito);
  assert.equal(resultado.valor.nombres, 'Ana');
  assert.equal(resultado.valor.telefono, '77712345');
  assert.equal(resultado.valor.correo, 'ana@correo.bo');
});

test('nombre y apellido son obligatorios; el resto, opcional', () => {
  assert.equal(validarEstudiante({ nombres: '', apellidos: 'Quispe' }).exito, false);
  assert.equal(validarEstudiante({ nombres: 'Ana', apellidos: '  ' }).exito, false);
  assert.equal(validarEstudiante({ nombres: 'Ana', apellidos: 'Quispe' }).exito, true);
});

test('el teléfono, si viene, es un celular boliviano', () => {
  assert.equal(validarEstudiante({ ...ANA, telefono: '2233445' }).exito, false);
  assert.equal(validarEstudiante({ ...ANA, telefono: '87712345' }).exito, false);
  assert.equal(validarEstudiante({ ...ANA, telefono: '' }).exito, true);
});

test('el correo, si viene, tiene formato válido', () => {
  assert.equal(validarEstudiante({ ...ANA, correo: 'sin-arroba' }).exito, false);
});

test('el documento admite letras, números y guiones', () => {
  assert.equal(validarEstudiante({ ...ANA, documento: '1234567 LP' }).exito, false);
  assert.equal(validarEstudiante({ ...ANA, documento: '1234567-LP' }).exito, true);
});

test('la fecha de nacimiento debe existir', () => {
  assert.equal(validarEstudiante({ ...ANA, fechaDeNacimiento: '2001-13-01' as FechaISO }).exito, false);
});

test('se devuelven todos los errores', () => {
  const resultado = validarEstudiante({ nombres: '', apellidos: '', telefono: '1', correo: 'x' });
  assert.ok(!resultado.exito && resultado.error.length === 4);
});

test('nombreCompleto une nombres y apellidos', () => {
  assert.equal(nombreCompleto(ANA), 'Ana Quispe');
});

// ---------------------------------------------------------------- inscripción

const INSCRIPCION: DatosDeInscripcion = {
  estudianteId: id('est-1'),
  cohorteId: id('coh-tortas'),
  fecha: '2026-10-10' as FechaISO,
  estado: 'inscrito',
  documentosEntregados: [],
};

test('regla E1: no se repite una cohorte con inscripción vigente', () => {
  const previas = [{ cohorteId: id('coh-tortas'), estado: 'inscrito' as const }];
  assert.equal(validarInscripcion(INSCRIPCION, 'curso', previas).exito, false);
});

test('D6: solo «inscrito» es vigente; retirada o concluida no bloquea volver a inscribirse', () => {
  assert.deepEqual(ESTADOS_VIGENTES, ['inscrito']);
  const previas = [
    { cohorteId: id('coh-tortas'), estado: 'retirado' as const },
    { cohorteId: id('coh-tortas'), estado: 'concluido' as const },
  ];
  assert.equal(validarInscripcion(INSCRIPCION, 'curso', previas).exito, true);
  assert.equal(esInscripcionVigente({ estado: 'retirado' }), false);
  assert.equal(esInscripcionVigente({ estado: 'concluido' }), false);
  assert.equal(esInscripcionVigente({ estado: 'inscrito' }), true);
});

test('regla E2: inscripciones simultáneas en grupos distintos', () => {
  const previas = [{ cohorteId: id('coh-gastronomia'), estado: 'inscrito' as const }];
  assert.equal(validarInscripcion(INSCRIPCION, 'curso', previas).exito, true);
});

test('una inscripción nueva empieza «inscrito» y puede venir de una solicitud y renovar a otra', () => {
  const renovacion: DatosDeInscripcion = {
    ...INSCRIPCION,
    cohorteId: id('coh-gastro-2-2027'),
    paquete: 'economico',
    solicitudId: id('sol-diego'),
    renuevaA: id('ins-diego-2026'),
  };
  assert.equal(validarInscripcion(renovacion, 'carrera', []).exito, true);
  assert.equal(validarInscripcion({ ...INSCRIPCION, estado: 'concluido' }, 'curso', []).exito, false);
});

test('B.2: solo un grupo abierto o en curso, y con cupo, admite inscripciones', () => {
  const grupo = { estado: 'abierto' as const, capacidad: 12, inscritos: 3 };
  assert.equal(validarInscripcion(INSCRIPCION, 'curso', [], grupo).exito, true);
  assert.equal(validarInscripcion(INSCRIPCION, 'curso', [], { ...grupo, estado: 'en_curso' }).exito, true);
  assert.equal(validarInscripcion(INSCRIPCION, 'curso', [], { ...grupo, estado: 'planificado' }).exito, false);
  assert.equal(validarInscripcion(INSCRIPCION, 'curso', [], { ...grupo, estado: 'cerrado' }).exito, false);
  const lleno = validarInscripcion(INSCRIPCION, 'curso', [], { ...grupo, inscritos: 12 });
  assert.ok(!lleno.exito && lleno.error.some((e) => /lleno \(12 cupos\)/.test(e)));
  assert.equal(validarInscripcion(INSCRIPCION, 'curso', [], { estado: 'abierto', inscritos: 500 }).exito, true, 'sin capacidad = sin límite');
});

test('cambio de estado: desde «inscrito» a retirado (con motivo) o a concluido', () => {
  assert.deepEqual(validarCambioDeEstado('inscrito', 'retirado', '  Se mudó a Cochabamba '), {
    exito: true,
    valor: { estado: 'retirado', motivo: 'Se mudó a Cochabamba' },
  });
  assert.equal(validarCambioDeEstado('inscrito', 'retirado').exito, false, 'motivo obligatorio');
  assert.equal(validarCambioDeEstado('inscrito', 'concluido').exito, true);
  assert.equal(validarCambioDeEstado('concluido', 'inscrito').exito, false);
  assert.equal(validarCambioDeEstado('retirado', 'concluido').exito, false);
  assert.equal(validarCambioDeEstado('inscrito', 'inscrito').exito, false);
});

test('renovación: mismo programa, gestión posterior y, en la carrera, el año siguiente', () => {
  const primeroDe2026 = { estado: 'inscrito' as const, grupo: { programaCodigo: 'gastronomia', gestion: 2026, anioDeCarrera: 1 } };
  assert.equal(validarRenovacion(primeroDe2026, { programaCodigo: 'gastronomia', gestion: 2027, anioDeCarrera: 2 }, 'carrera').exito, true);
  assert.equal(validarRenovacion(primeroDe2026, { programaCodigo: 'gastronomia', gestion: 2026, anioDeCarrera: 2 }, 'carrera').exito, false, 'misma gestión');
  assert.equal(validarRenovacion(primeroDe2026, { programaCodigo: 'gastronomia', gestion: 2027, anioDeCarrera: 3 }, 'carrera').exito, false, 'salta un año');
  assert.equal(validarRenovacion(primeroDe2026, { programaCodigo: 'cocina', gestion: 2027 }, 'carrera').exito, false, 'otro programa');
  assert.equal(
    validarRenovacion({ ...primeroDe2026, estado: 'concluido' }, { programaCodigo: 'gastronomia', gestion: 2027, anioDeCarrera: 2 }, 'carrera').exito,
    false,
    'B.3: renovar enlaza una inscripción vigente',
  );
});

test('regla E5: el paquete es obligatorio en la carrera y prohibido en los cursos', () => {
  assert.equal(validarInscripcion(INSCRIPCION, 'carrera', []).exito, false);
  assert.equal(validarInscripcion({ ...INSCRIPCION, paquete: 'ahorrador' }, 'carrera', []).exito, true);
  assert.equal(validarInscripcion({ ...INSCRIPCION, paquete: 'economico' }, 'curso', []).exito, false);
});

test('la fecha de inscripción debe ser válida', () => {
  assert.equal(validarInscripcion({ ...INSCRIPCION, fecha: 'ayer' as FechaISO }, 'curso', []).exito, false);
});

// ---------------------------------------------------------------- shared

test('celular boliviano: 8 dígitos que empiezan por 6 o 7', () => {
  assert.equal(esCelularBoliviano('77706890'), true);
  assert.equal(esCelularBoliviano('6 000 0000'), true);
  assert.equal(esCelularBoliviano('2777068'), false);
  assert.equal(esCelularBoliviano('777068901'), false);
});

test('el enlace de WhatsApp lleva el prefijo de Bolivia y el mensaje codificado', () => {
  assert.equal(enlaceDeWhatsApp('77706890'), 'https://wa.me/59177706890');
  assert.equal(enlaceDeWhatsApp('777 06890', 'Hola, ¿info?'), 'https://wa.me/59177706890?text=Hola%2C%20%C2%BFinfo%3F');
});

test('los importes son enteros en centavos', () => {
  assert.deepEqual(centavos(65000), { exito: true, valor: 65000 });
  assert.equal(centavos(650.5).exito, false);
  assert.equal(centavos(-1).exito, false);
});

test('fechaISO exige formato y existencia', () => {
  assert.equal(fechaISO('2027-02-01').exito, true);
  assert.equal(fechaISO('2027-2-1').exito, false);
  assert.equal(fechaISO('2027-02-29').exito, false);
  assert.equal(fechaISO('2028-02-29').exito, true);
});

test('enumerar escribe listas en español', () => {
  assert.equal(enumerar([]), '');
  assert.equal(enumerar([3]), '3');
  assert.equal(enumerar([1, 2]), '1 o 2');
  assert.equal(enumerar([2, 4, 6]), '2, 4 o 6');
});
