/**
 * Pruebas del dominio académico (ADR 0004) y del catálogo estático.
 *
 * QUÉ SE PRUEBA. Que el catálogo transcrito de INFORMACION-INSTITUTO.md sea
 * válido y fiel (ningún `[Consultar]` convertido en número), y la regla A1:
 * una cohorte solo elige entre las opciones de su programa.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  describirDuracion,
  validarCohorte,
  validarPrograma,
  type DatosDeCohorte,
  type Programa,
} from '../src/core/domain/academico/programa.ts';
import { esPendiente, PENDIENTE, type FechaISO, type Id } from '../src/core/domain/shared/tipos-base.ts';
import { validarCatalogo } from '../src/infrastructure/catalogo/catalogo.validator.ts';
import { PROGRAMAS, SEDE_LA_PAZ_ID, SEDES } from '../src/infrastructure/catalogo/oferta-academica.ts';

const porCodigo = (codigo: string): Programa => {
  const programa = PROGRAMAS.find((p) => p.codigo === codigo);
  assert.ok(programa, `falta el programa ${codigo}`);
  return programa;
};

// ---------------------------------------------------------------- catálogo

test('el catálogo transcrito es válido', () => {
  assert.deepEqual(validarCatalogo(PROGRAMAS, SEDES), []);
});

test('el catálogo contiene la carrera y los cinco cursos del documento', () => {
  assert.deepEqual(
    PROGRAMAS.map((p) => p.codigo),
    ['gastronomia', 'cocina', 'cocteleria', 'reposteria-y-panaderia', 'tortas', 'cursos-de-temporada'],
  );
  assert.equal(PROGRAMAS.filter((p) => p.tipo === 'carrera').length, 1);
});

test('la carrera dura 3 años, con 22 materias en tres años y título de Técnico Superior', () => {
  const carrera = porCodigo('gastronomia');
  assert.equal(describirDuracion(carrera.duracion), '3 años');
  assert.equal(carrera.tituloOtorgado, 'Técnico Superior en Gastronomía');
  assert.equal(carrera.planDeEstudios?.length, 3);
  assert.equal(carrera.planDeEstudios?.reduce((n, a) => n + a.materias.length, 0), 22);
  assert.deepEqual(carrera.turnos, ['manana', 'tarde', 'noche', 'especial']);
  assert.equal(carrera.horaPorTurno?.manana, '08:30');
  assert.equal(carrera.inicioPublicado, 'Febrero 2027');
  assert.equal(carrera.requisitos.length, 5);
});

test('ningún costo ni uniforme del documento se ha inventado: todos siguen pendientes', () => {
  for (const programa of PROGRAMAS) {
    assert.ok(esPendiente(programa.costo), `${programa.codigo}: costo`);
    assert.ok(esPendiente(programa.uniforme), `${programa.codigo}: uniforme`);
  }
  // Solo la carrera tiene inicio publicado.
  assert.equal(PROGRAMAS.filter((p) => !esPendiente(p.inicioPublicado)).length, 1);
});

test('las duraciones de los cursos son las del documento', () => {
  assert.equal(describirDuracion(porCodigo('cocina').duracion), '1, 2 o 3 meses');
  assert.equal(describirDuracion(porCodigo('cocteleria').duracion), '1 o 2 meses');
  assert.equal(describirDuracion(porCodigo('reposteria-y-panaderia').duracion), '2, 4 o 6 meses');
  assert.equal(describirDuracion(porCodigo('tortas').duracion), '2, 4 o 6 meses');
  assert.equal(describirDuracion(porCodigo('cursos-de-temporada').duracion), 'Consultar');
});

test('describirDuracion distingue singular y plural', () => {
  assert.equal(describirDuracion({ unidad: 'meses', opciones: [1] }), '1 mes');
  assert.equal(describirDuracion({ unidad: 'anios', opciones: [1] }), '1 año');
  assert.equal(describirDuracion({ unidad: 'meses', opciones: [] }), 'Consultar');
  assert.equal(describirDuracion(PENDIENTE), 'Consultar');
});

test('los cursos llevan matrícula gratis y solo repostería distingue turnos', () => {
  for (const codigo of ['cocina', 'cocteleria', 'reposteria-y-panaderia', 'tortas']) {
    assert.ok(porCodigo(codigo).beneficios.includes('Matrícula gratis'), codigo);
  }
  assert.deepEqual(porCodigo('reposteria-y-panaderia').turnos, ['manana', 'noche', 'unico']);
  assert.deepEqual(porCodigo('cocina').turnos, []);
  assert.deepEqual(porCodigo('cursos-de-temporada').modalidades, ['practico', 'magistral', 'virtual']);
});

test('las dos sedes tienen teléfono celular válido', () => {
  assert.equal(SEDES.length, 2);
  assert.deepEqual(
    SEDES.map((s) => [s.codigo, s.telefono]),
    [
      ['la-paz', '77706890'],
      ['el-alto', '77708027'],
    ],
  );
});

test('el validador del catálogo atrapa códigos repetidos y programas incoherentes', () => {
  const carrera = porCodigo('gastronomia');
  const duplicado = [carrera, { ...carrera }];
  assert.ok(validarCatalogo(duplicado, SEDES).some((e) => /repetido/.test(e)));

  const sinTitulo = { ...carrera, tituloOtorgado: undefined };
  assert.ok(validarPrograma(sinTitulo).some((e) => /título/.test(e)));

  const cursoConPlan = { ...porCodigo('cocina'), planDeEstudios: carrera.planDeEstudios };
  assert.ok(validarPrograma(cursoConPlan).some((e) => /plan de estudios/.test(e)));

  const horaFantasma = { ...porCodigo('cocina'), horaPorTurno: { noche: '19:00' } };
  assert.ok(validarPrograma(horaFantasma).some((e) => /turno "noche"/.test(e)));
});

test('el validador rechaza una sede con teléfono no boliviano', () => {
  const sedes = [{ ...SEDES[0]!, telefono: '12345' }];
  assert.ok(validarCatalogo(PROGRAMAS, sedes).some((e) => /celular boliviano/.test(e)));
});

// ---------------------------------------------------------------- cohortes

const COHORTE_CARRERA: DatosDeCohorte = {
  programaCodigo: 'gastronomia',
  sedeId: SEDE_LA_PAZ_ID,
  nombre: 'Gastronomía · Febrero 2027 · Noche',
  fechaInicio: '2027-02-01' as FechaISO,
  duracionElegida: 3,
  turno: 'noche',
  diasDeClase: 'lun-vie',
  costoVigente: PENDIENTE,
  anioDeCarrera: 1,
  estado: 'planificada',
};

const COHORTE_TORTAS: DatosDeCohorte = {
  programaCodigo: 'tortas',
  sedeId: SEDE_LA_PAZ_ID,
  nombre: 'Tortas · Sábados · 2 meses',
  fechaInicio: '2026-11-07' as FechaISO,
  duracionElegida: 2,
  diasDeClase: 'sab',
  costoVigente: PENDIENTE,
  estado: 'abierta',
};

test('regla A1: una cohorte válida elige entre las opciones del programa', () => {
  assert.equal(validarCohorte(porCodigo('gastronomia'), COHORTE_CARRERA).exito, true);
  assert.equal(validarCohorte(porCodigo('tortas'), COHORTE_TORTAS).exito, true);
});

test('una duración fuera de las opciones del programa se rechaza', () => {
  const resultado = validarCohorte(porCodigo('tortas'), { ...COHORTE_TORTAS, duracionElegida: 3 });
  assert.equal(resultado.exito, false);
  assert.ok(!resultado.exito && resultado.error.some((e) => /2, 4 o 6/.test(e)));
});

test('el turno es obligatorio si el programa lo ofrece y prohibido si no', () => {
  assert.equal(validarCohorte(porCodigo('gastronomia'), { ...COHORTE_CARRERA, turno: undefined }).exito, false);
  assert.equal(validarCohorte(porCodigo('gastronomia'), { ...COHORTE_CARRERA, turno: 'unico' }).exito, false);
  assert.equal(validarCohorte(porCodigo('tortas'), { ...COHORTE_TORTAS, turno: 'manana' }).exito, false);
});

test('los días de clase deben ser una opción del programa', () => {
  assert.equal(validarCohorte(porCodigo('tortas'), { ...COHORTE_TORTAS, diasDeClase: 'jue-vie' }).exito, false);
});

test('la modalidad es obligatoria solo en cursos de temporada', () => {
  const temporada = porCodigo('cursos-de-temporada');
  const base: DatosDeCohorte = { ...COHORTE_TORTAS, programaCodigo: temporada.codigo, diasDeClase: 'sab' };
  // Sin duración ni días definidos, el programa de temporada no puede abrir cohortes todavía.
  const resultado = validarCohorte(temporada, { ...base, modalidad: 'virtual' });
  assert.equal(resultado.exito, false);
  assert.ok(!resultado.exito && resultado.error.some((e) => /duración definida/.test(e)));
  assert.ok(!resultado.exito && resultado.error.some((e) => /días de clase/.test(e)));
  assert.ok(!resultado.exito && !resultado.error.some((e) => /modalidad/.test(e)));

  assert.equal(validarCohorte(porCodigo('tortas'), { ...COHORTE_TORTAS, modalidad: 'virtual' }).exito, false);
});

test('solo las cohortes de carrera llevan año, y dentro de la duración', () => {
  assert.equal(validarCohorte(porCodigo('gastronomia'), { ...COHORTE_CARRERA, anioDeCarrera: undefined }).exito, false);
  assert.equal(validarCohorte(porCodigo('gastronomia'), { ...COHORTE_CARRERA, anioDeCarrera: 4 }).exito, false);
  assert.equal(validarCohorte(porCodigo('tortas'), { ...COHORTE_TORTAS, anioDeCarrera: 1 }).exito, false);
});

test('un programa inactivo no admite cohortes nuevas', () => {
  const inactivo = { ...porCodigo('tortas'), activo: false };
  assert.equal(validarCohorte(inactivo, COHORTE_TORTAS).exito, false);
});

test('fechas: formato, existencia y fin no anterior al inicio', () => {
  assert.equal(validarCohorte(porCodigo('tortas'), { ...COHORTE_TORTAS, fechaInicio: '07/11/2026' as FechaISO }).exito, false);
  assert.equal(validarCohorte(porCodigo('tortas'), { ...COHORTE_TORTAS, fechaInicio: '2026-02-30' as FechaISO }).exito, false);
  assert.equal(
    validarCohorte(porCodigo('tortas'), { ...COHORTE_TORTAS, fechaFin: '2026-11-01' as FechaISO }).exito,
    false,
  );
  assert.equal(
    validarCohorte(porCodigo('tortas'), { ...COHORTE_TORTAS, fechaFin: '2027-01-07' as FechaISO }).exito,
    true,
  );
});

test('la cohorte se valida contra SU programa', () => {
  const resultado = validarCohorte(porCodigo('cocina'), COHORTE_TORTAS);
  assert.equal(resultado.exito, false);
});

test('el costo vigente puede quedar pendiente, pero si se define es un entero en centavos', () => {
  assert.equal(validarCohorte(porCodigo('tortas'), { ...COHORTE_TORTAS, costoVigente: 65000 as never }).exito, true);
  assert.equal(validarCohorte(porCodigo('tortas'), { ...COHORTE_TORTAS, costoVigente: 650.5 as never }).exito, false);
  assert.equal(validarCohorte(porCodigo('tortas'), { ...COHORTE_TORTAS, sedeId: SEDE_LA_PAZ_ID as Id }).exito, true);
});
