/**
 * Panel interno · Contabilidad (rebanada R6): la tarjeta kárdex PEPS con los
 * números de la harina de la especificación §5.3 / §5.8, el costo por unidad
 * que solo se muestra y el resumen del mes con el seguimiento de §5.7 (los
 * mismos números que la batería SQL N73–N75).
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { etiquetaDeCosto, resumenParaPantalla } from '../src/core/application/panel/contabilidad/contabilidad.usecase.ts';
import type { TotalesDelMesEnBase } from '../src/core/application/ports/contabilidad.port.ts';
import { costoUnitario, tarjetaPeps, type MovimientoDeTarjeta, type TomaDeTarjeta } from '../src/core/domain/contabilidad/tarjeta-peps.ts';
import type { TotalesDeMedio } from '../src/core/domain/contabilidad/resumen.ts';
import type { Milesimas } from '../src/core/domain/shared/cantidad.ts';
import type { Centavos, FechaISO } from '../src/core/domain/shared/tipos-base.ts';

const c = (valor: number): Centavos => valor as Centavos;
const m = (valor: bigint): Milesimas => valor as Milesimas;

// ---------------------------------------------------------------- Tarjeta PEPS

function movimiento(id: string, numero: number, entra: bigint, sale: bigint, deltaValor: number): MovimientoDeTarjeta {
  return { id, numero, entra: m(entra), sale: m(sale), deltaValor: c(deltaValor) };
}

function toma(movimientoId: string, loteId: string, cantidad: bigint, valor: number): TomaDeTarjeta {
  return { movimientoId, loteId, cantidad: m(cantidad), valor: c(valor) };
}

/** Harina de §5.3: dos compras de 25 kg, tres usos y la anulación del primero. */
const HARINA_MOVIMIENTOS: readonly MovimientoDeTarjeta[] = [
  movimiento('compra-a', 1, 25_000n, 0n, 17_000),
  movimiento('compra-b', 2, 25_000n, 0n, 18_000),
  movimiento('uso-30', 3, 0n, 30_000n, -20_600),
  movimiento('uso-0333', 4, 0n, 333n, -240),
  movimiento('uso-19667', 5, 0n, 19_667n, -14_160),
  movimiento('anula-uso-30', 6, 30_000n, 0n, 20_600),
];

const HARINA_TOMAS: readonly TomaDeTarjeta[] = [
  toma('compra-a', 'A', 25_000n, 17_000),
  toma('compra-b', 'B', 25_000n, 18_000),
  // La base las escribe en el orden que quiera: la tarjeta las ordena por lote.
  toma('uso-30', 'B', 5_000n, 3_600),
  toma('uso-30', 'A', 25_000n, 17_000),
  toma('uso-0333', 'B', 333n, 240),
  toma('uso-19667', 'B', 19_667n, 14_160),
  toma('anula-uso-30', 'A', 25_000n, 17_000),
  toma('anula-uso-30', 'B', 5_000n, 3_600),
];

const ORDEN_AB: ReadonlyMap<string, number> = new Map([
  ['A', 1],
  ['B', 2],
]);

test('tarjeta PEPS de la harina (§5.8): compras, salida de 30 kg por dos lotes, fracciones y lote agotado', () => {
  // Desordenados a propósito: la tarjeta sigue el `numero` del libro.
  const desordenados = [...HARINA_MOVIMIENTOS].reverse();
  const filas = tarjetaPeps(desordenados, HARINA_TOMAS, ORDEN_AB);
  assert.deepEqual(
    filas.map((f) => f.movimientoId),
    ['compra-a', 'compra-b', 'uso-30', 'uso-0333', 'uso-19667', 'anula-uso-30'],
  );
  assert.equal(desordenados[0]?.id, 'anula-uso-30', 'no reordena la lista de quien llama');

  const [compraA, compraB, uso30, uso0333, uso19667] = filas;
  assert.ok(compraA && compraB && uso30 && uso0333 && uso19667);

  assert.equal(compraA.signo, 1);
  assert.deepEqual(compraA.capas, [{ loteId: 'A', cantidad: 25_000n, valor: 17_000 }]);
  assert.equal(compraA.saldoCantidad, 25_000n);
  assert.equal(compraA.saldoValor, 17_000);

  assert.deepEqual(compraB.capas, [
    { loteId: 'A', cantidad: 25_000n, valor: 17_000 },
    { loteId: 'B', cantidad: 25_000n, valor: 18_000 },
  ]);
  assert.equal(compraB.saldoCantidad, 50_000n);
  assert.equal(compraB.saldoValor, 35_000);

  // Uso de 30 kg: todo el lote A (17 000) y 5 kg de B (3 600) = 20 600.
  assert.equal(uso30.signo, -1);
  assert.deepEqual(uso30.tomas, [toma('uso-30', 'A', 25_000n, 17_000), toma('uso-30', 'B', 5_000n, 3_600)]);
  assert.equal(uso30.tomas.reduce((t, x) => t + x.valor, 0), 20_600);
  assert.deepEqual(uso30.capas, [{ loteId: 'B', cantidad: 20_000n, valor: 14_400 }]);
  assert.equal(uso30.saldoCantidad, 20_000n);
  assert.equal(uso30.saldoValor, 14_400);

  // Uso de 0,333 kg: 240 c; quedan 19,667 kg por 14 160 c.
  assert.deepEqual(uso0333.capas, [{ loteId: 'B', cantidad: 19_667n, valor: 14_160 }]);

  // Uso de 19,667 kg: el remanente exacto; no queda nada.
  assert.deepEqual(uso19667.capas, []);
  assert.equal(uso19667.saldoCantidad, 0n);
  assert.equal(uso19667.saldoValor, 0);

  // Suma de las salidas = lo pagado por las dos compras.
  const salidas = filas.filter((f) => f.signo === -1).flatMap((f) => f.tomas);
  assert.equal(salidas.reduce((t, x) => t + x.valor, 0), 35_000);
});

test('la anulación de la primera salida devuelve exacto a sus dos lotes, aunque estaban agotados', () => {
  const filas = tarjetaPeps(HARINA_MOVIMIENTOS, HARINA_TOMAS, ORDEN_AB);
  const anulacion = filas.at(-1);
  assert.ok(anulacion);
  assert.equal(anulacion.movimientoId, 'anula-uso-30');
  assert.equal(anulacion.signo, 1);
  assert.deepEqual(anulacion.capas, [
    { loteId: 'A', cantidad: 25_000n, valor: 17_000 },
    { loteId: 'B', cantidad: 5_000n, valor: 3_600 },
  ]);
  assert.equal(anulacion.saldoCantidad, 30_000n);
  assert.equal(anulacion.saldoValor, 20_600);
});

test('anular una entrada saca su lote; un movimiento sin tomas deja las capas igual', () => {
  const filas = tarjetaPeps(
    [
      movimiento('compra-a', 1, 10_000n, 0n, 6_800),
      movimiento('compra-c', 2, 3_000n, 0n, 1_000),
      movimiento('sin-tomas', 3, 0n, 0n, 0),
      movimiento('anula-compra-c', 4, 0n, 3_000n, -1_000),
    ],
    [toma('compra-a', 'A', 10_000n, 6_800), toma('compra-c', 'C', 3_000n, 1_000), toma('anula-compra-c', 'C', 3_000n, 1_000)],
    new Map([
      ['A', 1],
      ['C', 2],
    ]),
  );
  const [, compraC, sinTomas, anulaC] = filas;
  assert.ok(compraC && sinTomas && anulaC);
  assert.equal(sinTomas.signo, 0);
  assert.deepEqual(sinTomas.tomas, []);
  assert.deepEqual(sinTomas.capas, compraC.capas);
  assert.equal(anulaC.signo, -1);
  assert.deepEqual(anulaC.capas, [{ loteId: 'A', cantidad: 10_000n, valor: 6_800 }]);
  assert.equal(anulaC.saldoValor, 6_800);
});

test('los lotes sin orden conocido van al final, en el orden en que aparecieron', () => {
  const filas = tarjetaPeps(
    [movimiento('x', 1, 1_000n, 0n, 100), movimiento('y', 2, 1_000n, 0n, 200), movimiento('z', 3, 1_000n, 0n, 300)],
    [toma('x', 'X', 1_000n, 100), toma('y', 'Y', 1_000n, 200), toma('z', 'Z', 1_000n, 300)],
    new Map([['Z', 1]]),
  );
  assert.deepEqual(
    filas.at(-1)?.capas.map((capa) => capa.loteId),
    ['Z', 'X', 'Y'],
  );
});

test('costo por unidad: solo se muestra, redondeado al centavo con la mitad hacia arriba', () => {
  assert.equal(costoUnitario(m(25_000n), c(18_000)), 720);
  assert.equal(costoUnitario(m(19_667n), c(14_160)), 720);
  assert.equal(costoUnitario(m(3_000n), c(1_000)), 333);
  assert.equal(costoUnitario(m(2_000n), c(5)), 3, '2,5 c por kg sube a 3');
  assert.equal(costoUnitario(m(0n), c(0)), null);
  assert.equal(costoUnitario(m(1_000n), c(-100)), null, 'un valor negativo no rompe la pantalla');
});

// ---------------------------------------------------------------- Resumen del mes

const SIN_MOVIMIENTO: TotalesDeMedio = {
  cobros: c(0),
  cobrosAnulados: c(0),
  gastos: c(0),
  gastosAnulados: c(0),
  compras: c(0),
  comprasAnuladas: c(0),
};

/**
 * Seguimiento de §5.7 con los números de la batería SQL (N73–N75): harina
 * comprada al contado (Bs 350), juego y tabla por transferencia (Bs 320 +
 * Bs 45); se usan 30 kg (Bs 210), se entrega el juego (Bs 320) y se da de
 * baja la tabla (Bs 45) → costo Bs 575. Cuota y uniforme: Bs 1.300 de
 * ingreso; se cobra el uniforme en efectivo (Bs 650). Luz Bs 180 y un arqueo
 * con faltante de Bs 5.
 */
const SEGUIMIENTO: TotalesDelMesEnBase = {
  desde: '2026-10-01' as FechaISO,
  hasta: '2026-11-01' as FechaISO,
  ingresos: { total: c(130_000), anulados: c(0), porGrupo: [] },
  costo: {
    total: c(57_500),
    porTipo: [],
    compras: c(71_500),
    comprasAnuladas: c(0),
    saldosIniciales: c(0),
    saldosInicialesAnulados: c(0),
  },
  gastos: { total: c(18_000), anulados: c(0), porConcepto: [] },
  dinero: {
    efectivo: { ...SIN_MOVIMIENTO, cobros: c(65_000), gastos: c(18_000), compras: c(35_000) },
    transferencia: { ...SIN_MOVIMIENTO, compras: c(36_500) },
  },
  arqueos: [c(-500)],
  inventario: { valorInicial: c(0), valorFinal: c(14_000) },
  hoy: { deben: c(65_000), valorInventario: c(14_000) },
};

test('resumen del mes (§5.7): resultado, dinero, cuadre y las frases que explican la diferencia', () => {
  const r = resumenParaPantalla(SEGUIMIENTO);
  assert.deepEqual(r.resultado, {
    ingresos: 130_000,
    costoDeLoUsado: 57_500,
    gastos: 18_000,
    diferenciasDeCaja: 500,
    resultado: 54_000,
    clase: 'ganancia',
  });
  assert.equal(r.flujo.entro, 65_000);
  assert.equal(r.flujo.salio, 89_500);
  assert.equal(r.flujo.neto, -25_000);
  assert.deepEqual(r.flujo.porMedio.efectivo, { entro: 65_000, salio: 53_000, neto: 12_000 });
  assert.deepEqual(r.flujo.porMedio.transferencia, { entro: 0, salio: 36_500, neto: -36_500 });
  assert.deepEqual(r.flujo.porMedio.qr, { entro: 0, salio: 0, neto: 0 });
  assert.equal(r.cuadreDelMes, 0);
  assert.equal(r.comprasSinUsar, 14_000);
  assert.equal(r.porCobrarDelMes, 65_000);
  assert.deepEqual(r.explicaciones, [
    'Compraste inventario por Bs 140,00 que todavía no se usó: salió dinero, pero no es gasto.',
    'De lo que se generó este mes, falta cobrar Bs 650,00.',
    'En los arqueos faltaron Bs 5,00.',
  ]);
});

test('resumen del mes: sobrantes de caja e inventario que no cuadra aparecen solo cuando corresponden', () => {
  const sobrante = resumenParaPantalla({ ...SEGUIMIENTO, arqueos: [c(500)] });
  assert.ok(sobrante.explicaciones.includes('En los arqueos sobraron Bs 5,00.'));
  assert.ok(!sobrante.explicaciones.some((e) => e.includes('faltaron')));

  const descuadre = resumenParaPantalla({ ...SEGUIMIENTO, inventario: { valorInicial: c(0), valorFinal: c(14_100) } });
  assert.equal(descuadre.cuadreDelMes, 100);
  assert.equal(descuadre.explicaciones.at(-1), 'El inventario del mes no cuadra por Bs 1,00: revisa la verificación.');

  const descuadreHaciaAbajo = resumenParaPantalla({ ...SEGUIMIENTO, inventario: { valorInicial: c(0), valorFinal: c(13_900) } });
  assert.equal(descuadreHaciaAbajo.cuadreDelMes, -100);
  assert.equal(descuadreHaciaAbajo.explicaciones.at(-1), 'El inventario del mes no cuadra por Bs 1,00: revisa la verificación.');
});

test('resumen del mes: si todo lo generado se cobró y el inventario bajó, no hay nada que explicar', () => {
  const r = resumenParaPantalla({
    ...SEGUIMIENTO,
    ingresos: { total: c(65_000), anulados: c(0), porGrupo: [] },
    costo: { ...SEGUIMIENTO.costo, total: c(10_000), compras: c(0) },
    dinero: { qr: { ...SIN_MOVIMIENTO, cobros: c(70_000) } },
    arqueos: [c(0)],
    inventario: { valorInicial: c(30_000), valorFinal: c(20_000) },
  });
  assert.equal(r.cuadreDelMes, 0);
  assert.equal(r.comprasSinUsar, 0);
  assert.equal(r.porCobrarDelMes, 0, 'cobrar más que lo generado no deja nada por cobrar');
  assert.deepEqual(r.explicaciones, []);
});

test('un saldo inicial o un sobrante no se explican como compras: no salió dinero', () => {
  // Mes de arranque: solo se cargó lo que ya había (Bs 300), sin compras ni usos.
  const arranque = resumenParaPantalla({
    ...SEGUIMIENTO,
    ingresos: { total: c(0), anulados: c(0), porGrupo: [] },
    costo: { ...SEGUIMIENTO.costo, total: c(0), compras: c(0), saldosIniciales: c(30_000) },
    gastos: { total: c(0), anulados: c(0), porConcepto: [] },
    dinero: {},
    arqueos: [],
    inventario: { valorInicial: c(0), valorFinal: c(30_000) },
  });
  assert.equal(arranque.cuadreDelMes, 0);
  assert.equal(arranque.comprasSinUsar, 0);
  assert.ok(!arranque.explicaciones.some((e) => e.startsWith('Compraste')));

  // Compra de Bs 100 sin usar y un sobrante de conteo de Bs 20: la frase dice como mucho lo comprado.
  const conSobrante = resumenParaPantalla({
    ...SEGUIMIENTO,
    costo: { ...SEGUIMIENTO.costo, total: c(-2_000), compras: c(10_000) },
    inventario: { valorInicial: c(0), valorFinal: c(12_000) },
  });
  assert.equal(conSobrante.cuadreDelMes, 0);
  assert.equal(conSobrante.comprasSinUsar, 10_000);
});

test('un mes vacío no tiene resultado ni frases', () => {
  const r = resumenParaPantalla({
    desde: '2026-10-01' as FechaISO,
    hasta: '2026-11-01' as FechaISO,
    ingresos: { total: c(0), anulados: c(0), porGrupo: [] },
    costo: { total: c(0), porTipo: [], compras: c(0), comprasAnuladas: c(0), saldosIniciales: c(0), saldosInicialesAnulados: c(0) },
    gastos: { total: c(0), anulados: c(0), porConcepto: [] },
    dinero: {},
    arqueos: [],
    inventario: { valorInicial: c(0), valorFinal: c(0) },
    hoy: { deben: c(0), valorInventario: c(0) },
  });
  assert.equal(r.resultado.clase, 'sin_resultado');
  assert.equal(r.flujo.neto, 0);
  assert.deepEqual(r.explicaciones, []);
});

test('cada línea del costo de lo usado dice qué pasó con lo que salió', () => {
  assert.equal(etiquetaDeCosto('consumo'), 'Usado en clase');
  assert.equal(etiquetaDeCosto('entrega'), 'Uniformes entregados');
  assert.equal(etiquetaDeCosto('devolucion_entrega'), 'Uniformes devueltos');
  assert.equal(etiquetaDeCosto('baja'), 'Dado de baja');
  assert.equal(etiquetaDeCosto('ajuste_faltante'), 'Faltantes del conteo');
  assert.equal(etiquetaDeCosto('ajuste_sobrante'), 'Sobrantes del conteo');
  assert.equal(etiquetaDeCosto('compra'), 'Compra');
  assert.equal(etiquetaDeCosto('prestamo'), 'Préstamo');
});
