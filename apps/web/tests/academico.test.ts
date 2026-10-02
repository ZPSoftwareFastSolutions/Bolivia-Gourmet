/**
 * Pruebas del dominio académico (ADR 0004) y del catálogo estático.
 *
 * QUÉ SE PRUEBA. Que el catálogo transcrito de INFORMACION-INSTITUTO.md sea
 * válido y fiel (ningún `[Consultar]` convertido en número); la regla A1 (un
 * grupo solo elige entre las opciones de su programa) con los grupos de
 * temporada de B.4; los estados de grupo de B.2; el nombre visible del grupo
 * (§2.3) y el plan de pagos con sus cuotas (B.7).
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ALIADOS, UNIVERSIDADES } from '../contenido/convenios.ts';
import {
  admiteInscripciones,
  describirDuracion,
  describirPlan,
  ESTADOS_DE_COHORTE,
  etiquetaCortaDeDias,
  formatearMonto,
  generarCuotas,
  nombreDeGrupo,
  ordinal,
  validarCohorte,
  validarPlanDePago,
  validarPrograma,
  type DatosDeCohorte,
  type PlanDePago,
  type Programa,
} from '../src/core/domain/academico/programa.ts';
import { esPendiente, PENDIENTE, type Centavos, type FechaISO } from '../src/core/domain/shared/tipos-base.ts';
import { validarCatalogo } from '../src/infrastructure/catalogo/catalogo.validator.ts';
import { direccionesDeMapa } from '../src/lib/mapas.ts';
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

test('la carrera publica solo los importes aclarados: Paquete Económico y uniforme a Bs 650', () => {
  const carrera = porCodigo('gastronomia');
  assert.ok(!esPendiente(carrera.costo));
  assert.deepEqual(
    carrera.costo.map((p) => [p.etiqueta, formatearMonto(p.monto)]),
    [
      ['Paquete Económico', 'Bs 650'],
      ['Paquete Ahorrador', 'Consultar'],
    ],
  );
  assert.ok(!esPendiente(carrera.uniforme));
  assert.equal(formatearMonto(carrera.uniforme.monto), 'Bs 650');
  // Sin periodicidad: no se aclaró si es mensual, por gestión o pago único.
  assert.ok(carrera.costo.every((p) => p.periodicidad === undefined));
});

test('ningún costo ni uniforme de los cursos se ha inventado: siguen pendientes', () => {
  for (const programa of PROGRAMAS.filter((p) => p.tipo !== 'carrera')) {
    assert.ok(esPendiente(programa.costo), `${programa.codigo}: costo`);
    assert.ok(esPendiente(programa.uniforme), `${programa.codigo}: uniforme`);
  }
  // Solo la carrera tiene inicio publicado.
  assert.equal(PROGRAMAS.filter((p) => !esPendiente(p.inicioPublicado)).length, 1);
});

test('formatearMonto usa el formato boliviano y nunca inventa un importe', () => {
  assert.equal(formatearMonto(65_000 as Centavos), 'Bs 650');
  assert.equal(formatearMonto(125_050 as Centavos), 'Bs 1.250,50');
  assert.equal(formatearMonto(1_000_000_00 as Centavos), 'Bs 1.000.000');
  assert.equal(formatearMonto(PENDIENTE), 'Consultar');
});

test('el validador rechaza precios sin etiqueta o con importes no enteros', () => {
  const carrera = porCodigo('gastronomia');
  const malo = { ...carrera, costo: [{ etiqueta: ' ', monto: 650.5 as Centavos }] };
  const errores = validarPrograma(malo);
  assert.ok(errores.some((e) => /sin etiqueta/.test(e)));
  assert.ok(errores.some((e) => /entero positivo/.test(e)));
  const uniformeMalo = { ...carrera, uniforme: { etiqueta: 'Uniforme', monto: 0 as Centavos } };
  assert.ok(validarPrograma(uniformeMalo).some((e) => /entero positivo/.test(e)));
});

// ---------------------------------------------------------------- convenios

test('convenios: 17 aliados y 4 universidades, sin nombres repetidos', () => {
  assert.equal(ALIADOS.length, 17);
  assert.equal(new Set(ALIADOS.map((a) => a.nombre)).size, 17);
  assert.deepEqual(
    UNIVERSIDADES.map((u) => u.sigla),
    ['UNANDES', 'UDI', 'UB', 'UNICEN'],
  );
});

test('las erratas del documento original no llegan a la web', () => {
  const nombres = [...ALIADOS.map((a) => a.nombre), ...UNIVERSIDADES.map((u) => `${u.sigla} ${u.nombre}`)].join(' | ');
  for (const errata of ['Alt Paocha', 'La Carindera', 'Auroras', 'UNIGEN']) {
    assert.ok(!nombres.includes(errata), errata);
  }
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

test('las sedes apuntan al lugar de Google Maps que envió el usuario', () => {
  assert.deepEqual(
    SEDES.map((s) => [s.codigo, s.ubicacion?.enlace]),
    [
      ['la-paz', 'https://maps.app.goo.gl/QK31bpHFF39UvxQs8'],
      ['el-alto', 'https://maps.app.goo.gl/EYi1qTQY7x5b1BSS7'],
    ],
  );
  // Las dos sedes están en el área metropolitana de La Paz y El Alto, y no en el mismo punto.
  for (const sede of SEDES) {
    assert.ok(sede.ubicacion);
    assert.ok(Math.abs(sede.ubicacion.latitud - -16.5) < 0.1 && Math.abs(sede.ubicacion.longitud - -68.15) < 0.1, sede.codigo);
  }
  assert.notEqual(SEDES[0]!.ubicacion?.longitud, SEDES[1]!.ubicacion?.longitud);
});

test('el mapa se centra en el lugar de la sede y el enlace es el que envió el usuario', () => {
  const miraflores = SEDES.find((s) => s.codigo === 'la-paz')!;
  const { incrustado, externo } = direccionesDeMapa(miraflores.direccion, miraflores.ubicacion);
  assert.equal(incrustado, 'https://www.google.com/maps?q=-16.5023223,-68.1191543&z=18&output=embed');
  assert.equal(externo, 'https://maps.app.goo.gl/QK31bpHFF39UvxQs8');
  // Sin ubicación confirmada se busca por la dirección escrita (www.google.com: lo que permite la CSP).
  const sinUbicacion = direccionesDeMapa('Calle 4, El Alto');
  assert.equal(sinUbicacion.incrustado, 'https://www.google.com/maps?q=Calle%204%2C%20El%20Alto%2C%20Bolivia&output=embed');
  assert.match(sinUbicacion.externo, /query=Calle%204/);
});

test('el validador rechaza una ubicación fuera de Bolivia o un enlace que no es de Google Maps', () => {
  const base = SEDES[0]!;
  const fuera = [{ ...base, ubicacion: { ...base.ubicacion!, latitud: 40.4, longitud: -3.7 } }];
  assert.ok(validarCatalogo(PROGRAMAS, fuera).some((e) => /ubicación/.test(e)));
  const ajeno = [{ ...base, ubicacion: { ...base.ubicacion!, enlace: 'https://ejemplo.com/mapa' } }];
  assert.ok(validarCatalogo(PROGRAMAS, ajeno).some((e) => /ubicación/.test(e)));
});

// ---------------------------------------------------------------- grupos (cohortes)

const COHORTE_CARRERA: DatosDeCohorte = {
  programaCodigo: 'gastronomia',
  sedeId: SEDE_LA_PAZ_ID,
  gestion: 2027,
  anioDeCarrera: 1,
  fechaInicio: '2027-02-01' as FechaISO,
  duracionElegida: 3,
  turno: 'noche',
  diasDeClase: 'lun-vie',
  estado: 'planificado',
};

const COHORTE_TORTAS: DatosDeCohorte = {
  programaCodigo: 'tortas',
  sedeId: SEDE_LA_PAZ_ID,
  gestion: 2026,
  fechaInicio: '2026-10-12' as FechaISO,
  duracionElegida: 2,
  diasDeClase: 'sab',
  capacidad: 12,
  estado: 'abierto',
};

const COHORTE_TEMPORADA: DatosDeCohorte = {
  programaCodigo: 'cursos-de-temporada',
  sedeId: SEDE_LA_PAZ_ID,
  gestion: 2026,
  fechaInicio: '2026-12-05' as FechaISO,
  fechaFin: '2026-12-05' as FechaISO,
  modalidad: 'practico',
  estado: 'abierto',
};

test('regla A1: un grupo válido elige entre las opciones del programa', () => {
  assert.equal(validarCohorte(porCodigo('gastronomia'), COHORTE_CARRERA).exito, true);
  assert.equal(validarCohorte(porCodigo('tortas'), COHORTE_TORTAS).exito, true);
});

test('una duración fuera de las opciones del programa se rechaza, y es obligatoria si el programa la define', () => {
  const resultado = validarCohorte(porCodigo('tortas'), { ...COHORTE_TORTAS, duracionElegida: 3 });
  assert.equal(resultado.exito, false);
  assert.ok(!resultado.exito && resultado.error.some((e) => /2, 4 o 6/.test(e)));
  assert.equal(validarCohorte(porCodigo('tortas'), { ...COHORTE_TORTAS, duracionElegida: undefined }).exito, false);
});

test('el turno es obligatorio si el programa lo ofrece y prohibido si no', () => {
  assert.equal(validarCohorte(porCodigo('gastronomia'), { ...COHORTE_CARRERA, turno: undefined }).exito, false);
  assert.equal(validarCohorte(porCodigo('gastronomia'), { ...COHORTE_CARRERA, turno: 'unico' }).exito, false);
  assert.equal(validarCohorte(porCodigo('tortas'), { ...COHORTE_TORTAS, turno: 'manana' }).exito, false);
});

test('los días de clase deben ser una opción del programa', () => {
  assert.equal(validarCohorte(porCodigo('tortas'), { ...COHORTE_TORTAS, diasDeClase: 'jue-vie' }).exito, false);
  assert.equal(validarCohorte(porCodigo('tortas'), { ...COHORTE_TORTAS, diasDeClase: undefined }).exito, false);
});

test('B.4: un curso de temporada abre grupos con modalidad y fechas, sin días ni duración', () => {
  const temporada = porCodigo('cursos-de-temporada');
  assert.deepEqual(validarCohorte(temporada, COHORTE_TEMPORADA), { exito: true, valor: COHORTE_TEMPORADA });

  const sinModalidad = validarCohorte(temporada, { ...COHORTE_TEMPORADA, modalidad: undefined });
  assert.ok(!sinModalidad.exito && sinModalidad.error.some((e) => /modalidad/.test(e)));
  const sinFin = validarCohorte(temporada, { ...COHORTE_TEMPORADA, fechaFin: undefined });
  assert.ok(!sinFin.exito && sinFin.error.some((e) => /fecha de fin/.test(e)));
  assert.equal(validarCohorte(temporada, { ...COHORTE_TEMPORADA, diasDeClase: 'sab' }).exito, false, 'el programa no define días');
  assert.equal(validarCohorte(temporada, { ...COHORTE_TEMPORADA, duracionElegida: 1 }).exito, false, 'ni duración');

  // La modalidad, en cambio, no existe en los cursos que no la ofrecen.
  assert.equal(validarCohorte(porCodigo('tortas'), { ...COHORTE_TORTAS, modalidad: 'virtual' }).exito, false);
});

test('solo los grupos de carrera llevan año, y dentro de la duración', () => {
  assert.equal(validarCohorte(porCodigo('gastronomia'), { ...COHORTE_CARRERA, anioDeCarrera: undefined }).exito, false);
  assert.equal(validarCohorte(porCodigo('gastronomia'), { ...COHORTE_CARRERA, anioDeCarrera: 4 }).exito, false);
  assert.equal(validarCohorte(porCodigo('tortas'), { ...COHORTE_TORTAS, anioDeCarrera: 1 }).exito, false);
});

test('la gestión es un año razonable y el estado uno de los cuatro', () => {
  assert.equal(validarCohorte(porCodigo('tortas'), { ...COHORTE_TORTAS, gestion: 1999 }).exito, false);
  assert.equal(validarCohorte(porCodigo('tortas'), { ...COHORTE_TORTAS, gestion: 2026.5 }).exito, false);
  assert.equal(validarCohorte(porCodigo('tortas'), { ...COHORTE_TORTAS, estado: 'abierta' as never }).exito, false, 'masculino (crítica 30)');
});

test('un programa inactivo no admite grupos nuevos', () => {
  const inactivo = { ...porCodigo('tortas'), activo: false };
  assert.equal(validarCohorte(inactivo, COHORTE_TORTAS).exito, false);
});

test('fechas: formato, existencia y fin no anterior al inicio', () => {
  assert.equal(validarCohorte(porCodigo('tortas'), { ...COHORTE_TORTAS, fechaInicio: '12/10/2026' as FechaISO }).exito, false);
  assert.equal(validarCohorte(porCodigo('tortas'), { ...COHORTE_TORTAS, fechaInicio: '2026-02-30' as FechaISO }).exito, false);
  assert.equal(validarCohorte(porCodigo('tortas'), { ...COHORTE_TORTAS, fechaFin: '2026-10-01' as FechaISO }).exito, false);
  assert.equal(validarCohorte(porCodigo('tortas'), { ...COHORTE_TORTAS, fechaFin: '2026-12-12' as FechaISO }).exito, true);
});

test('el grupo se valida contra SU programa', () => {
  assert.equal(validarCohorte(porCodigo('cocina'), COHORTE_TORTAS).exito, false);
});

test('la capacidad, si se indica, es un entero positivo', () => {
  assert.equal(validarCohorte(porCodigo('tortas'), { ...COHORTE_TORTAS, capacidad: 0 }).exito, false);
  assert.equal(validarCohorte(porCodigo('tortas'), { ...COHORTE_TORTAS, capacidad: undefined }).exito, true);
});

test('B.2: solo «abierto» y «en curso» admiten inscripciones', () => {
  assert.deepEqual(
    ESTADOS_DE_COHORTE.map((e) => [e, admiteInscripciones(e)]),
    [
      ['planificado', false],
      ['abierto', true],
      ['en_curso', true],
      ['cerrado', false],
    ],
  );
});

// ---------------------------------------------------------------- nombre del grupo

const LA_PAZ = { nombre: 'La Paz' };
const EL_ALTO = { nombre: 'El Alto' };

test('nombreDeGrupo de la carrera: programa · año · turno · gestión · sede', () => {
  const carrera = porCodigo('gastronomia');
  assert.equal(nombreDeGrupo({ ...COHORTE_CARRERA, gestion: 2026 }, carrera, LA_PAZ), 'Gastronomía · 1.er año · Noche · 2026 · La Paz');
  assert.equal(nombreDeGrupo({ ...COHORTE_CARRERA, anioDeCarrera: 2 }, carrera, LA_PAZ), 'Gastronomía · 2.º año · Noche · 2027 · La Paz');
  assert.equal(
    nombreDeGrupo({ ...COHORTE_CARRERA, anioDeCarrera: 3, turno: 'manana', gestion: 2026 }, carrera, EL_ALTO),
    'Gastronomía · 3.er año · Mañana · 2026 · El Alto',
  );
});

test('nombreDeGrupo de los cursos: programa · días · turno · modalidad · mes de inicio · sede', () => {
  assert.equal(nombreDeGrupo(COHORTE_TORTAS, porCodigo('tortas'), LA_PAZ), 'Tortas · Sábados · oct 2026 · La Paz');
  assert.equal(
    nombreDeGrupo({ ...COHORTE_TORTAS, diasDeClase: 'jue-vie', fechaInicio: '2026-11-05' as FechaISO }, porCodigo('cocteleria'), LA_PAZ),
    'Coctelería · Jue–Vie · nov 2026 · La Paz',
  );
  assert.equal(
    nombreDeGrupo({ ...COHORTE_TORTAS, diasDeClase: 'lun-mie', turno: 'noche', fechaInicio: '2026-09-07' as FechaISO }, porCodigo('reposteria-y-panaderia'), EL_ALTO),
    'Repostería y Panadería · Lun–Mié · Noche · sep 2026 · El Alto',
  );
  assert.equal(nombreDeGrupo(COHORTE_TEMPORADA, porCodigo('cursos-de-temporada'), LA_PAZ), 'Cursos de Temporada · Curso práctico · dic 2026 · La Paz');
});

test('los días se rotulan desde su código (la base solo ve el código)', () => {
  assert.equal(etiquetaCortaDeDias('sab'), 'Sábados');
  assert.equal(etiquetaCortaDeDias('lun-vie'), 'Lun–Vie');
  assert.equal(etiquetaCortaDeDias('lun-mie'), 'Lun–Mié');
  assert.equal(etiquetaCortaDeDias('xyz'), 'xyz');
  assert.equal(etiquetaCortaDeDias('lun-mar-mie'), 'lun-mar-mie');
  assert.deepEqual([1, 2, 3, 4].map(ordinal), ['1.er', '2.º', '3.er', '4.º']);
});

// ---------------------------------------------------------------- plan de pagos y cuotas

const PLAN_CARRERA: PlanDePago = {
  paquete: 'economico',
  montoCuota: 65_000 as Centavos,
  cuotas: 1,
  primerVencimiento: '2026-03-01' as FechaISO,
  cadaMeses: 1,
  nota: ' Periodicidad por confirmar ',
};

test('el plan de la carrera es por paquete; el de un curso, no', () => {
  const valido = validarPlanDePago(PLAN_CARRERA, 'carrera');
  assert.ok(valido.exito);
  assert.equal(valido.valor.nota, 'Periodicidad por confirmar');
  assert.equal(validarPlanDePago({ ...PLAN_CARRERA, paquete: undefined }, 'carrera').exito, false);
  assert.equal(validarPlanDePago(PLAN_CARRERA, 'curso').exito, false);
  assert.equal(validarPlanDePago({ ...PLAN_CARRERA, paquete: undefined }, 'curso').exito, true);
});

test('el plan valida monto, cuotas (1 a 24), cada cuántos meses (1 a 12) y fecha, todo a la vez', () => {
  const malo = validarPlanDePago({ ...PLAN_CARRERA, montoCuota: 0 as Centavos, cuotas: 25, cadaMeses: 0, primerVencimiento: '2026-02-30' as FechaISO }, 'carrera');
  assert.ok(!malo.exito && malo.error.length === 4);
  assert.equal(describirPlan(PLAN_CARRERA), '1 cuota de Bs 650');
  assert.equal(describirPlan({ montoCuota: 10_000 as Centavos, cuotas: 3, cadaMeses: 1 }), '3 cuotas de Bs 100 cada mes');
  assert.equal(describirPlan({ montoCuota: 10_000 as Centavos, cuotas: 2, cadaMeses: 2 }), '2 cuotas de Bs 100 cada 2 meses');
});

test('generarCuotas: una por cuota, desde el primer vencimiento, y cuentan en el mes en que vencen', () => {
  assert.deepEqual(generarCuotas(PLAN_CARRERA, '2026-02-10' as FechaISO), [
    { numero: 1, de: 1, monto: 65_000, venceEl: '2026-03-01', fecha: '2026-03-01' },
  ]);
});

test('generarCuotas suma meses como PostgreSQL: recorta al fin de mes y no encadena', () => {
  const plan: PlanDePago = { montoCuota: 10_000 as Centavos, cuotas: 4, primerVencimiento: '2026-01-31' as FechaISO, cadaMeses: 1 };
  assert.deepEqual(
    generarCuotas(plan, '2026-01-15' as FechaISO).map((c) => c.venceEl),
    ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'],
  );
  const bisiesto: PlanDePago = { ...plan, cuotas: 2, primerVencimiento: '2028-01-31' as FechaISO };
  assert.deepEqual(generarCuotas(bisiesto, '2028-01-15' as FechaISO).map((c) => c.venceEl), ['2028-01-31', '2028-02-29']);
  const bimestral: PlanDePago = { ...plan, cuotas: 3, primerVencimiento: '2026-11-15' as FechaISO, cadaMeses: 2 };
  assert.deepEqual(generarCuotas(bimestral, '2026-11-01' as FechaISO).map((c) => c.venceEl), ['2026-11-15', '2027-01-15', '2027-03-15']);
});

test('B.7: con «desde» no se generan las cuotas que vencen antes, y se conserva su número', () => {
  const plan: PlanDePago = { montoCuota: 10_000 as Centavos, cuotas: 3, primerVencimiento: '2026-08-05' as FechaISO, cadaMeses: 1 };
  const cuotas = generarCuotas(plan, '2026-08-01' as FechaISO, '2026-09-01' as FechaISO);
  assert.deepEqual(
    cuotas.map((c) => [c.numero, c.de, c.venceEl]),
    [
      [2, 3, '2026-09-05'],
      [3, 3, '2026-10-05'],
    ],
  );
  // «Antes de» es estricto: la que vence el mismo día de la puesta en marcha sí se genera.
  assert.equal(generarCuotas(plan, '2026-08-01' as FechaISO, '2026-09-05' as FechaISO).length, 2);
  assert.equal(generarCuotas(plan, '2026-08-01' as FechaISO, '2027-01-01' as FechaISO).length, 0);
});
