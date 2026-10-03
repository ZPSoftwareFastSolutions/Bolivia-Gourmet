/**
 * Panel interno · Tablero (rebanada R7; especificación §7.6 y §7.7,
 * enmiendas B.12 crítica 29).
 *
 * - `variacion`: porcentaje entero contra el mes anterior, sin base, iguales,
 *   subidas y bajadas con redondeo.
 * - `barrasDeSemanas`: alturas proporcionales al mayor valor, mínimo 2 para
 *   un valor positivo, negativos en 0.
 * - Pendientes de recepción y alertas de administración: orden de urgencia,
 *   ceros fuera, 4 a la vista y el resto aparte, frases sin voseo y con
 *   montos de dos decimales.
 * - `tableroDesdeBase`: el jsonb de `tablero_de_administracion` completo,
 *   vacío o roto, sin lanzar nunca.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  AVISOS_VISIBLES,
  alertasDeAdministracion,
  cifrasDelMes,
  pendientesDeRecepcion,
  type AvisoDeTablero,
  type DatosDeAdministracion,
  type DatosDeRecepcion,
} from '../src/core/application/panel/tablero/tablero.usecase.ts';
import type { TableroDeAdministracionEnBase } from '../src/core/application/ports/tablero.port.ts';
import { barrasDeSemanas, variacion } from '../src/core/domain/contabilidad/tablero.ts';
import type { Centavos, FechaISO } from '../src/core/domain/shared/tipos-base.ts';
import { deudoresDesdeBase, tableroDesdeBase } from '../src/infrastructure/supabase/tablero-desde-base.ts';

const c = (valor: number): Centavos => valor as Centavos;
const f = (valor: string): FechaISO => valor as FechaISO;

const clases = (avisos: readonly AvisoDeTablero[]): string[] => avisos.map((a) => a.clase);

// ---------------------------------------------------------------- variacion

test('variacion: sin base (mes anterior en 0) no da porcentaje', () => {
  assert.deepEqual(variacion(c(0), c(0)), { sentido: 'igual', porcentaje: null });
  assert.deepEqual(variacion(c(65000), c(0)), { sentido: 'sin_base', porcentaje: null });
  // Un neto negativo este mes, contra nada, tampoco tiene base.
  assert.deepEqual(variacion(c(-500), c(0)), { sentido: 'sin_base', porcentaje: null });
});

test('variacion: una base negativa (más anulado que registrado) se trata como sin base', () => {
  assert.deepEqual(variacion(c(100000), c(-500)), { sentido: 'sin_base', porcentaje: null });
  assert.deepEqual(variacion(c(-500), c(-500)), { sentido: 'igual', porcentaje: null });
});

test('variacion: iguales, y una diferencia que redondea a 0 % también es «igual»', () => {
  assert.deepEqual(variacion(c(100000), c(100000)), { sentido: 'igual', porcentaje: 0 });
  assert.deepEqual(variacion(c(10001), c(10000)), { sentido: 'igual', porcentaje: 0 });
  assert.deepEqual(variacion(c(10049), c(10000)), { sentido: 'igual', porcentaje: 0 });
  assert.deepEqual(variacion(c(9951), c(10000)), { sentido: 'igual', porcentaje: 0 });
});

test('variacion: subidas con redondeo al entero más cercano', () => {
  assert.deepEqual(variacion(c(10050), c(10000)), { sentido: 'sube', porcentaje: 1 }); // 0,5 %
  assert.deepEqual(variacion(c(112000), c(100000)), { sentido: 'sube', porcentaje: 12 });
  assert.deepEqual(variacion(c(112500), c(100000)), { sentido: 'sube', porcentaje: 13 }); // 12,5 %
  assert.deepEqual(variacion(c(13334), c(10000)), { sentido: 'sube', porcentaje: 33 }); // 33,34 %
  assert.deepEqual(variacion(c(200000), c(100000)), { sentido: 'sube', porcentaje: 100 });
  assert.deepEqual(variacion(c(350000), c(100000)), { sentido: 'sube', porcentaje: 250 });
});

test('variacion: bajadas con redondeo y porcentaje sin signo', () => {
  assert.deepEqual(variacion(c(87500), c(100000)), { sentido: 'baja', porcentaje: 13 }); // 12,5 %
  assert.deepEqual(variacion(c(66666), c(100000)), { sentido: 'baja', porcentaje: 33 });
  assert.deepEqual(variacion(c(0), c(100000)), { sentido: 'baja', porcentaje: 100 });
  // Un neto negativo este mes contra una base positiva: baja más del 100 %.
  assert.deepEqual(variacion(c(-50000), c(100000)), { sentido: 'baja', porcentaje: 150 });
});

// ---------------------------------------------------------------- barrasDeSemanas

test('barrasDeSemanas: alturas enteras proporcionales al mayor valor de todas las semanas', () => {
  const barras = barrasDeSemanas(
    [
      { desde: f('2026-08-10'), entro: c(50000), salio: c(25000) },
      { desde: f('2026-08-17'), entro: c(100000), salio: c(80000) },
      { desde: f('2026-08-24'), entro: c(33333), salio: c(0) },
    ],
    120,
  );
  assert.deepEqual(
    barras.map((b) => [b.desde, b.altoEntro, b.altoSalio]),
    [
      ['2026-08-10', 60, 30],
      ['2026-08-17', 120, 96],
      ['2026-08-24', 40, 0],
    ],
  );
  for (const b of barras) {
    assert.ok(Number.isInteger(b.altoEntro) && Number.isInteger(b.altoSalio));
    assert.ok(b.altoEntro >= 0 && b.altoEntro <= 120 && b.altoSalio >= 0 && b.altoSalio <= 120);
  }
});

test('barrasDeSemanas: el máximo puede salir de lo que salió, no solo de lo que entró', () => {
  const [barra] = barrasDeSemanas([{ desde: f('2026-09-28'), entro: c(20000), salio: c(80000) }], 100);
  assert.equal(barra?.altoSalio, 100);
  assert.equal(barra?.altoEntro, 25);
});

test('barrasDeSemanas: un valor positivo nunca mide menos de 2', () => {
  const barras = barrasDeSemanas(
    [
      { desde: f('2026-09-21'), entro: c(1000000), salio: c(100) },
      { desde: f('2026-09-28'), entro: c(1), salio: c(0) },
    ],
    120,
  );
  assert.deepEqual(
    barras.map((b) => [b.altoEntro, b.altoSalio]),
    [
      [120, 2],
      [2, 0],
    ],
  );
  // Con un alto menor que 2 el mínimo no pasa del alto.
  const [chica] = barrasDeSemanas([{ desde: f('2026-09-28'), entro: c(1000), salio: c(1) }], 1);
  assert.deepEqual([chica?.altoEntro, chica?.altoSalio], [1, 1]);
});

test('barrasDeSemanas: los negativos cuentan como 0 pero conservan su cifra para la tabla', () => {
  const barras = barrasDeSemanas(
    [
      { desde: f('2026-09-21'), entro: c(-5000), salio: c(40000) },
      { desde: f('2026-09-28'), entro: c(20000), salio: c(-100) },
    ],
    80,
  );
  assert.deepEqual(
    barras.map((b) => [b.entro, b.salio, b.altoEntro, b.altoSalio]),
    [
      [-5000, 40000, 0, 80],
      [20000, -100, 40, 0],
    ],
  );
});

test('barrasDeSemanas: todo en cero (o negativo), sin semanas y altos raros no rompen nada', () => {
  const ceros = barrasDeSemanas(
    [
      { desde: f('2026-09-21'), entro: c(0), salio: c(0) },
      { desde: f('2026-09-28'), entro: c(-300), salio: c(0) },
    ],
    120,
  );
  assert.deepEqual(
    ceros.map((b) => [b.altoEntro, b.altoSalio]),
    [
      [0, 0],
      [0, 0],
    ],
  );
  assert.deepEqual(barrasDeSemanas([], 120), []);
  const [conDecimales] = barrasDeSemanas([{ desde: f('2026-09-28'), entro: c(100), salio: c(50) }], 120.9);
  assert.deepEqual([conDecimales?.altoEntro, conDecimales?.altoSalio], [120, 60]);
  const [sinAlto] = barrasDeSemanas([{ desde: f('2026-09-28'), entro: c(100), salio: c(50) }], -10);
  assert.deepEqual([sinAlto?.altoEntro, sinAlto?.altoSalio], [0, 0]);
});

// ---------------------------------------------------------------- Pendientes de recepción

const RECEPCION_EN_CERO: DatosDeRecepcion = {
  prestamosAtrasados: 0,
  prestamosHoy: 0,
  solicitudes: 0,
  deudoresVencidos: 0,
  montoVencido: c(0),
  sinUniforme: 0,
  lotesVencidos: 0,
  lotesPorVencer: 0,
  bajoMinimo: 0,
};

const RECEPCION_COMPLETA: DatosDeRecepcion = {
  prestamosAtrasados: 3,
  prestamosHoy: 1,
  solicitudes: 2,
  deudoresVencidos: 3,
  montoVencido: c(195000),
  sinUniforme: 4,
  lotesVencidos: 1,
  lotesPorVencer: 2,
  bajoMinimo: 5,
};

test('pendientesDeRecepcion: todo en cero no muestra nada («¡Todo al día!»)', () => {
  assert.deepEqual(pendientesDeRecepcion(RECEPCION_EN_CERO), { visibles: [], resto: [] });
});

test('pendientesDeRecepcion: orden de urgencia, 4 a la vista y el resto aparte', () => {
  const { visibles, resto } = pendientesDeRecepcion(RECEPCION_COMPLETA);
  assert.equal(AVISOS_VISIBLES, 4);
  assert.deepEqual(clases(visibles), ['prestamos_atrasados', 'solicitudes', 'cuotas_vencidas', 'sin_uniforme']);
  assert.deepEqual(clases(resto), ['lotes_vencidos', 'lotes_por_vencer', 'bajo_minimo']);
  assert.deepEqual(
    [...visibles, ...resto].map((a) => a.cifra),
    [3, 2, 3, 4, 1, 2, 5],
  );
});

test('pendientesDeRecepcion: los ceros salen y los que quedan suben a la vista', () => {
  const { visibles, resto } = pendientesDeRecepcion({ ...RECEPCION_EN_CERO, solicitudes: 2, lotesPorVencer: 1, bajoMinimo: 3 });
  assert.deepEqual(clases(visibles), ['solicitudes', 'lotes_por_vencer', 'bajo_minimo']);
  assert.deepEqual(resto, []);
});

test('pendientesDeRecepcion: préstamos que vencen hoy sin ninguno atrasado no hacen aviso', () => {
  const { visibles } = pendientesDeRecepcion({ ...RECEPCION_EN_CERO, prestamosHoy: 2 });
  assert.deepEqual(visibles, []);
});

test('pendientesDeRecepcion: frases completas, con la cantidad, singular y plural', () => {
  const { visibles, resto } = pendientesDeRecepcion(RECEPCION_COMPLETA);
  assert.deepEqual(
    [...visibles, ...resto].map((a) => a.frase),
    [
      '3 préstamos de utensilios atrasados y 1 vence hoy.',
      '2 solicitudes del portal por atender.',
      '3 alumnos tienen cuotas vencidas por Bs 1.950,00 en total.',
      '4 alumnos de la carrera sin uniforme.',
      '1 lote de insumos vencido.',
      '2 lotes de insumos vencen en los próximos 7 días.',
      '5 artículos agotados o bajo el mínimo.',
    ],
  );

  const uno = pendientesDeRecepcion({
    prestamosAtrasados: 1,
    prestamosHoy: 2,
    solicitudes: 1,
    deudoresVencidos: 1,
    montoVencido: c(65000),
    sinUniforme: 1,
    lotesVencidos: 2,
    lotesPorVencer: 1,
    bajoMinimo: 1,
  });
  assert.deepEqual(
    [...uno.visibles, ...uno.resto].map((a) => a.frase),
    [
      '1 préstamo de utensilios atrasado y 2 vencen hoy.',
      '1 solicitud del portal por atender.',
      '1 alumno tiene cuotas vencidas por Bs 650,00.',
      '1 alumno de la carrera sin uniforme.',
      '2 lotes de insumos vencidos.',
      '1 lote de insumos vence en los próximos 7 días.',
      '1 artículo agotado o bajo el mínimo.',
    ],
  );

  const sinHoy = pendientesDeRecepcion({ ...RECEPCION_EN_CERO, prestamosAtrasados: 1250 });
  assert.equal(sinHoy.visibles[0]?.frase, '1.250 préstamos de utensilios atrasados.');
  assert.equal(sinHoy.visibles[0]?.cifra, 1250);
});

// ---------------------------------------------------------------- Alertas de administración

const TABLERO_COMPLETO: TableroDeAdministracionEnBase = {
  hoy: f('2026-10-02'),
  efectivoSinArqueo: { registros: 5, desde: f('2026-09-28'), sede: null, sedes: 1 },
  arqueosConDiferencia: { cantidad: 2, monto: c(1500), sede: null, sedes: 1 },
  bajasUltimos7Dias: { cantidad: 3, monto: c(12000) },
  sinPrecio: { grupos: 1, entregas: 2, perdidas: 1 },
  comparacion: {
    entroMes: c(112500),
    salioMes: c(50000),
    entroAnterior: c(100000),
    salioAnterior: c(0),
    corteAnterior: f('2026-09-02'),
  },
  semanas: [],
};

const ADMINISTRACION_COMPLETA: DatosDeAdministracion = {
  tablero: TABLERO_COMPLETO,
  solicitudes: 2,
  prestamosAtrasados: 1,
  lotesVencidos: 3,
  bajoMinimo: 4,
};

test('alertasDeAdministracion: orden de gravedad, 4 a la vista y el resto aparte', () => {
  const { visibles, resto } = alertasDeAdministracion(ADMINISTRACION_COMPLETA);
  assert.deepEqual(clases(visibles), ['efectivo_sin_arqueo', 'arqueos_con_diferencia', 'bajas', 'sin_precio']);
  assert.deepEqual(clases(resto), ['lotes_vencidos', 'bajo_minimo', 'solicitudes', 'prestamos_atrasados']);
  // «Sin precio» suma grupos, entregas y pérdidas.
  assert.deepEqual(
    [...visibles, ...resto].map((a) => a.cifra),
    [5, 2, 3, 4, 3, 4, 2, 1],
  );
});

test('alertasDeAdministracion: frases completas con la cantidad y montos de dos decimales', () => {
  const { visibles, resto } = alertasDeAdministracion(ADMINISTRACION_COMPLETA);
  assert.deepEqual(
    [...visibles, ...resto].map((a) => a.frase),
    [
      '5 registros en efectivo sin arquear desde el 28/09.',
      '2 arqueos de este mes no cuadraron: Bs 15,00 de diferencia en total.',
      '3 bajas y faltantes en los últimos 7 días: valían Bs 120,00.',
      'Falta el precio de 1 grupo con inscritos, 2 entregas de uniforme y 1 pérdida en préstamos.',
      '3 lotes de insumos vencidos.',
      '4 artículos agotados o bajo el mínimo.',
      '2 solicitudes del portal por atender.',
      '1 préstamo de utensilios atrasado.',
    ],
  );
});

test('alertasDeAdministracion: singulares, sin fecha de efectivo y «sin precio» solo con lo que falta', () => {
  const tablero: TableroDeAdministracionEnBase = {
    ...TABLERO_COMPLETO,
    efectivoSinArqueo: { registros: 1, desde: null, sede: null, sedes: 1 },
    arqueosConDiferencia: { cantidad: 1, monto: c(250), sede: null, sedes: 1 },
    bajasUltimos7Dias: { cantidad: 1, monto: c(4550) },
    sinPrecio: { grupos: 2, entregas: 0, perdidas: 3 },
  };
  const { visibles } = alertasDeAdministracion({ tablero, solicitudes: 0, prestamosAtrasados: 0, lotesVencidos: 0, bajoMinimo: 0 });
  assert.deepEqual(
    visibles.map((a) => [a.clase, a.cifra, a.frase]),
    [
      ['efectivo_sin_arqueo', 1, '1 registro en efectivo sin arquear de días anteriores.'],
      ['arqueos_con_diferencia', 1, '1 arqueo de este mes no cuadró: Bs 2,50 de diferencia.'],
      ['bajas', 1, '1 baja o faltante en los últimos 7 días: valía Bs 45,50.'],
      ['sin_precio', 5, 'Falta el precio de 2 grupos con inscritos y 3 pérdidas en préstamos.'],
    ],
  );

  const soloEntregas = alertasDeAdministracion({
    tablero: { ...TABLERO_COMPLETO, sinPrecio: { grupos: 0, entregas: 1, perdidas: 0 } },
    solicitudes: 0,
    prestamosAtrasados: 0,
    lotesVencidos: 0,
    bajoMinimo: 0,
  });
  const sinPrecio = [...soloEntregas.visibles, ...soloEntregas.resto].find((a) => a.clase === 'sin_precio');
  assert.equal(sinPrecio?.frase, 'Falta el precio de 1 entrega de uniforme.');
  assert.equal(sinPrecio?.cifra, 1);
});

test('alertasDeAdministracion: un tablero vacío y todo en cero no muestra alertas', () => {
  assert.deepEqual(
    alertasDeAdministracion({ tablero: tableroDesdeBase({}), solicitudes: 0, prestamosAtrasados: 0, lotesVencidos: 0, bajoMinimo: 0 }),
    { visibles: [], resto: [] },
  );
  // Solo lo que también ve recepción: sube a la vista en su orden.
  const { visibles, resto } = alertasDeAdministracion({
    tablero: tableroDesdeBase(null),
    solicitudes: 1,
    prestamosAtrasados: 2,
    lotesVencidos: 0,
    bajoMinimo: 1,
  });
  assert.deepEqual(clases(visibles), ['bajo_minimo', 'solicitudes', 'prestamos_atrasados']);
  assert.deepEqual(resto, []);
});

// ---------------------------------------------------------------- Frases sin voseo

test('ninguna frase usa voseo ni monto sin decimales', () => {
  const VOSEO =
    /(pagás|tenés|querés|podés|hacés|necesitás|preferís|contanos|\bsos\b|\bvos\b|revisá|cobrá|entregá|atendé|definí|registrá|mirá|elegí\b|cerrá)/i;
  const recepcion = pendientesDeRecepcion(RECEPCION_COMPLETA);
  const unoDeRecepcion = pendientesDeRecepcion({ ...RECEPCION_COMPLETA, prestamosAtrasados: 1, deudoresVencidos: 1, lotesPorVencer: 1 });
  const administracion = alertasDeAdministracion(ADMINISTRACION_COMPLETA);
  const frases = [recepcion, unoDeRecepcion, administracion].flatMap((a) => [...a.visibles, ...a.resto].map((x) => x.frase));
  assert.ok(frases.length > 0);
  for (const frase of frases) {
    assert.doesNotMatch(frase, VOSEO, frase);
    // Todo monto en una frase va como en el recibo: «Bs 1.950,00».
    for (const monto of frase.match(/Bs \d[\d.]*(?:,\d+)?/g) ?? []) assert.match(monto, /^Bs \d{1,3}(\.\d{3})*,\d{2}$/, frase);
    assert.match(frase, /^\S.*\.$/, frase);
  }
});

// ---------------------------------------------------------------- cifrasDelMes

test('cifrasDelMes: entró y salió de este mes con su variación contra el mes anterior a la misma fecha', () => {
  assert.deepEqual(cifrasDelMes(TABLERO_COMPLETO), {
    entro: 112500,
    salio: 50000,
    variacionEntro: { sentido: 'sube', porcentaje: 13 },
    variacionSalio: { sentido: 'sin_base', porcentaje: null },
    corteAnterior: '2026-09-02',
  });
  const bajo = cifrasDelMes({
    ...TABLERO_COMPLETO,
    comparacion: { entroMes: c(80000), salioMes: c(40000), entroAnterior: c(100000), salioAnterior: c(40000), corteAnterior: f('2026-08-31') },
  });
  assert.deepEqual(bajo.variacionEntro, { sentido: 'baja', porcentaje: 20 });
  assert.deepEqual(bajo.variacionSalio, { sentido: 'igual', porcentaje: 0 });
  assert.equal(bajo.corteAnterior, '2026-08-31');
});

// ---------------------------------------------------------------- tableroDesdeBase

const LA_PAZ = '0b6c1d2e-3f40-4a5b-8c6d-7e8f9a0b1c2d';
const EL_ALTO = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';

const JSON_COMPLETO = {
  hoy: '2026-10-02',
  efectivo_sin_arqueo: { registros: 5, desde: '2026-09-28', sede: LA_PAZ, sedes: 2 },
  arqueos_con_diferencia: { cantidad: 2, monto: 1500, sede: EL_ALTO, sedes: 1 },
  bajas_7_dias: { cantidad: 3, monto: 12000 },
  sin_precio: { grupos: 1, entregas: 2, perdidas: 1 },
  comparacion: {
    entro_mes: 112500,
    salio_mes: 50000,
    entro_anterior: 100000,
    salio_anterior: 0,
    corte_anterior: '2026-09-02',
  },
  semanas: [
    { desde: '2026-08-10', entro: 0, salio: 0 },
    { desde: '2026-08-17', entro: 65000, salio: 12000 },
    { desde: '2026-08-24', entro: 130000, salio: 45000 },
    { desde: '2026-08-31', entro: 0, salio: 3000 },
    { desde: '2026-09-07', entro: 65000, salio: 0 },
    { desde: '2026-09-14', entro: -5000, salio: 20000 },
    { desde: '2026-09-21', entro: 97500, salio: 15000 },
    { desde: '2026-09-28', entro: 112500, salio: 50000 },
  ],
};

test('tableroDesdeBase: un JSON completo cae en su lugar', () => {
  assert.deepEqual(tableroDesdeBase(JSON_COMPLETO), {
    hoy: '2026-10-02',
    efectivoSinArqueo: { registros: 5, desde: '2026-09-28', sede: LA_PAZ, sedes: 2 },
    arqueosConDiferencia: { cantidad: 2, monto: 1500, sede: EL_ALTO, sedes: 1 },
    bajasUltimos7Dias: { cantidad: 3, monto: 12000 },
    sinPrecio: { grupos: 1, entregas: 2, perdidas: 1 },
    comparacion: {
      entroMes: 112500,
      salioMes: 50000,
      entroAnterior: 100000,
      salioAnterior: 0,
      corteAnterior: '2026-09-02',
    },
    semanas: JSON_COMPLETO.semanas,
  });
  // De ahí al tablero: 8 semanas en el orden de la base.
  const tablero = tableroDesdeBase(JSON_COMPLETO);
  assert.equal(tablero.semanas.length, 8);
  assert.equal(barrasDeSemanas(tablero.semanas, 120)[2]?.altoEntro, 120);
});

test('tableroDesdeBase: vacío, nulo o de otra forma, todo vale 0, [] o null y nada lanza', () => {
  const VACIO = {
    hoy: '',
    efectivoSinArqueo: { registros: 0, desde: null, sede: null, sedes: 0 },
    arqueosConDiferencia: { cantidad: 0, monto: 0, sede: null, sedes: 0 },
    bajasUltimos7Dias: { cantidad: 0, monto: 0 },
    sinPrecio: { grupos: 0, entregas: 0, perdidas: 0 },
    comparacion: { entroMes: 0, salioMes: 0, entroAnterior: 0, salioAnterior: 0, corteAnterior: '' },
    semanas: [],
  };
  for (const json of [{}, null, undefined, [], 'texto', 42, { semanas: 'no' }]) {
    assert.deepEqual(tableroDesdeBase(json), VACIO, JSON.stringify(json));
  }
});

test('tableroDesdeBase: valores rotos se corrigen sin perder el signo de los netos', () => {
  const t = tableroDesdeBase({
    hoy: '2 de octubre',
    efectivo_sin_arqueo: { registros: '5', desde: 'ayer', sede: 'La Paz', sedes: '2' },
    arqueos_con_diferencia: { cantidad: -1, monto: 1500.4 },
    bajas_7_dias: { cantidad: 2.6, monto: Number.NaN },
    sin_precio: { grupos: null, entregas: 3 },
    comparacion: { entro_mes: -2500, salio_mes: '100', corte_anterior: 20260902 },
    semanas: [{ desde: '2026-09-28', entro: -700 }, null, { entro: 100, salio: 200 }],
  });
  assert.equal(t.hoy, '');
  assert.deepEqual(t.efectivoSinArqueo, { registros: 0, desde: null, sede: null, sedes: 0 });
  assert.deepEqual(t.arqueosConDiferencia, { cantidad: 0, monto: 1500, sede: null, sedes: 0 });
  assert.deepEqual(t.bajasUltimos7Dias, { cantidad: 3, monto: 0 });
  assert.deepEqual(t.sinPrecio, { grupos: 0, entregas: 3, perdidas: 0 });
  assert.deepEqual(t.comparacion, { entroMes: -2500, salioMes: 0, entroAnterior: 0, salioAnterior: 0, corteAnterior: '' });
  // Cada semana se conserva aunque le falten cifras: el gráfico necesita sus columnas.
  assert.deepEqual(t.semanas, [
    { desde: '2026-09-28', entro: -700, salio: 0 },
    { desde: '', entro: 0, salio: 0 },
    { desde: '', entro: 100, salio: 200 },
  ]);
  // Ningún «-0» que se muestre como «-Bs 0,00».
  assert.ok(!Object.is(tableroDesdeBase({ comparacion: { entro_mes: -0.2 } }).comparacion.entroMes, -0));
});

// ---------------------------------------------------------------- Dónde está el problema

test('alertasDeAdministracion: si el efectivo o los arqueos están en más de una sede, la frase lo dice', () => {
  const tablero: TableroDeAdministracionEnBase = {
    ...TABLERO_COMPLETO,
    efectivoSinArqueo: { registros: 5, desde: f('2026-09-28'), sede: null, sedes: 2 },
    arqueosConDiferencia: { cantidad: 2, monto: c(1500), sede: null, sedes: 2 },
  };
  const { visibles } = alertasDeAdministracion({ ...ADMINISTRACION_COMPLETA, tablero });
  assert.equal(visibles[0]?.frase, '5 registros en efectivo sin arquear desde el 28/09, en 2 sedes.');
  assert.equal(visibles[1]?.frase, '2 arqueos de este mes no cuadraron, en 2 sedes: Bs 15,00 de diferencia en total.');
});

test('tableroDesdeBase: la sede del problema solo se acepta si es un identificador', () => {
  const t = tableroDesdeBase(JSON_COMPLETO);
  assert.equal(t.efectivoSinArqueo.sede, LA_PAZ);
  assert.equal(t.efectivoSinArqueo.sedes, 2);
  assert.equal(t.arqueosConDiferencia.sede, EL_ALTO);
  assert.equal(tableroDesdeBase({ efectivo_sin_arqueo: { sede: 'La Paz' } }).efectivoSinArqueo.sede, null);
  assert.equal(tableroDesdeBase({ arqueos_con_diferencia: { sede: 42 } }).arqueosConDiferencia.sede, null);
});

// ---------------------------------------------------------------- deudoresDesdeBase

test('deudoresDesdeBase: cifras exactas de la base y valores rotos en cero', () => {
  assert.deepEqual(deudoresDesdeBase({ alumnos: 14, pendiente: 455000, alumnos_con_vencido: 3, vencido: 195000 }), {
    alumnos: 14,
    pendiente: 455000,
    alumnosConVencido: 3,
    vencido: 195000,
  });
  for (const json of [{}, null, undefined, [], 'texto']) {
    assert.deepEqual(deudoresDesdeBase(json), { alumnos: 0, pendiente: 0, alumnosConVencido: 0, vencido: 0 }, JSON.stringify(json));
  }
  assert.deepEqual(deudoresDesdeBase({ alumnos: '3', pendiente: 100.4, alumnos_con_vencido: -1, vencido: Number.NaN }), {
    alumnos: 0,
    pendiente: 100,
    alumnosConVencido: 0,
    vencido: 0,
  });
});
