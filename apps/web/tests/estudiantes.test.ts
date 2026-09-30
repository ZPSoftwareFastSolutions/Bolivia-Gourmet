/**
 * Pruebas del dominio de estudiantes e inscripciones.
 *
 * QUÉ SE PRUEBA. La validación de la persona (E-), que no se repite cohorte
 * vigente (E1), que el paquete solo existe en la carrera (E5) y los
 * ayudantes de sede (celular boliviano, enlace de WhatsApp).
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  esInscripcionVigente,
  nombreCompleto,
  validarEstudiante,
  validarInscripcion,
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

test('una inscripción retirada o concluida no bloquea volver a inscribirse', () => {
  const previas = [
    { cohorteId: id('coh-tortas'), estado: 'retirado' as const },
    { cohorteId: id('coh-tortas'), estado: 'concluido' as const },
  ];
  assert.equal(validarInscripcion(INSCRIPCION, 'curso', previas).exito, true);
  assert.equal(esInscripcionVigente({ estado: 'retirado' }), false);
  assert.equal(esInscripcionVigente({ estado: 'en_curso' }), true);
});

test('regla E2: inscripciones simultáneas en cohortes distintas', () => {
  const previas = [{ cohorteId: id('coh-gastronomia'), estado: 'en_curso' as const }];
  assert.equal(validarInscripcion(INSCRIPCION, 'curso', previas).exito, true);
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
