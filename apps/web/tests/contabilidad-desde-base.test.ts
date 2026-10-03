/**
 * Panel interno · Contabilidad (rebanada R6): lo que devuelven
 * `resumen_del_mes` y `verificar_cuadre` se lee hacia la forma del puerto.
 * Con un JSON completo cada cifra cae en su lugar; con uno vacío, roto o con
 * claves desconocidas todo vale 0 o lista vacía y nada lanza.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cuadreDesdeBase, totalesDesdeBase } from '../src/infrastructure/supabase/contabilidad-desde-base.ts';

const RESUMEN_COMPLETO = {
  desde: '2026-10-01',
  hasta: '2026-11-01',
  sede: null,
  ingresos: {
    total: 150000,
    anulados: 5000,
    por_grupo: [
      { grupo: 'Colegiaturas', monto: 120000 },
      { grupo: 'Ventas', monto: 25000 },
    ],
  },
  costo: {
    total: 30000,
    por_tipo: [
      { tipo: 'consumo', monto: 28000 },
      { tipo: 'baja', monto: 2500 },
      { tipo: 'ajuste_sobrante', monto: -500 },
    ],
    compras: 60000,
    compras_anuladas: 4000,
    saldos_iniciales: 10000,
    saldos_iniciales_anulados: 0,
  },
  gastos: {
    total: 20000,
    anulados: 1000,
    por_concepto: [{ concepto: 'Luz', icono: 'rayo', monto: 19000 }],
  },
  dinero: {
    efectivo: { cobros: 100000, cobros_anulados: 5000, gastos: 15000, gastos_anulados: 1000, compras: 40000, compras_anuladas: 4000 },
    qr: { cobros: 50000, cobros_anulados: 0, gastos: 5000, gastos_anulados: 0, compras: 20000, compras_anuladas: 0 },
  },
  arqueos: [-500, 0, 200],
  inventario: { valor_inicial: 80000, valor_final: 116000 },
  hoy: { deben: 45000, valor_inventario: 116000 },
};

test('resumen del mes completo: cada cifra va a su lugar', () => {
  const t = totalesDesdeBase(RESUMEN_COMPLETO);
  assert.equal(t.desde, '2026-10-01');
  assert.equal(t.hasta, '2026-11-01');
  assert.equal(t.ingresos.total, 150000);
  assert.equal(t.ingresos.anulados, 5000);
  assert.deepEqual(t.ingresos.porGrupo, [
    { grupo: 'Colegiaturas', monto: 120000 },
    { grupo: 'Ventas', monto: 25000 },
  ]);
  assert.equal(t.costo.total, 30000);
  assert.deepEqual(t.costo.porTipo, [
    { tipo: 'consumo', monto: 28000 },
    { tipo: 'baja', monto: 2500 },
    { tipo: 'ajuste_sobrante', monto: -500 },
  ]);
  assert.equal(t.costo.compras, 60000);
  assert.equal(t.costo.comprasAnuladas, 4000);
  assert.equal(t.costo.saldosIniciales, 10000);
  assert.equal(t.costo.saldosInicialesAnulados, 0);
  assert.equal(t.gastos.total, 20000);
  assert.equal(t.gastos.anulados, 1000);
  assert.deepEqual(t.gastos.porConcepto, [{ concepto: 'Luz', icono: 'rayo', monto: 19000 }]);
  assert.deepEqual(t.dinero, {
    efectivo: { cobros: 100000, cobrosAnulados: 5000, gastos: 15000, gastosAnulados: 1000, compras: 40000, comprasAnuladas: 4000 },
    qr: { cobros: 50000, cobrosAnulados: 0, gastos: 5000, gastosAnulados: 0, compras: 20000, comprasAnuladas: 0 },
  });
  assert.equal(t.dinero.transferencia, undefined, 'un medio sin movimiento no viene');
  assert.deepEqual(t.arqueos, [-500, 0, 200]);
  assert.deepEqual(t.inventario, { valorInicial: 80000, valorFinal: 116000 });
  assert.deepEqual(t.hoy, { deben: 45000, valorInventario: 116000 });
});

test('resumen del mes vacío, nulo o que no es objeto: ceros y listas vacías', () => {
  for (const json of [{}, null, undefined, 'texto', 42, []]) {
    const t = totalesDesdeBase(json);
    assert.equal(t.desde, '');
    assert.equal(t.hasta, '');
    assert.deepEqual(t.ingresos, { total: 0, anulados: 0, porGrupo: [] });
    assert.deepEqual(t.costo, {
      total: 0,
      porTipo: [],
      compras: 0,
      comprasAnuladas: 0,
      saldosIniciales: 0,
      saldosInicialesAnulados: 0,
    });
    assert.deepEqual(t.gastos, { total: 0, anulados: 0, porConcepto: [] });
    assert.deepEqual(t.dinero, {});
    assert.deepEqual(t.arqueos, []);
    assert.deepEqual(t.inventario, { valorInicial: 0, valorFinal: 0 });
    assert.deepEqual(t.hoy, { deben: 0, valorInventario: 0 });
  }
});

test('resumen del mes defensivo: lo que no es número vale 0 y lo desconocido se ignora', () => {
  const t = totalesDesdeBase({
    ingresos: { total: '150000', anulados: null, por_grupo: [{ grupo: 'Ventas' }, 'basura'] },
    costo: { total: Number.NaN, por_tipo: [{ tipo: 'teletransporte', monto: 100 }, { tipo: 'consumo', monto: 12.6 }] },
    gastos: { por_concepto: 'no es lista' },
    dinero: { efectivo: { cobros: 700 }, cripto: { cobros: 999 }, qr: 'roto' },
    arqueos: [100, 'x', null, -0],
    inventario: { valor_inicial: Infinity },
  });
  assert.equal(t.ingresos.total, 0, 'un número en texto no se adivina');
  assert.equal(t.ingresos.anulados, 0);
  assert.deepEqual(t.ingresos.porGrupo, [
    { grupo: 'Ventas', monto: 0 },
    { grupo: '', monto: 0 },
  ]);
  assert.equal(t.costo.total, 0);
  assert.deepEqual(t.costo.porTipo, [{ tipo: 'consumo', monto: 13 }], 'tipo desconocido fuera; centavos enteros');
  assert.deepEqual(t.gastos.porConcepto, []);
  assert.deepEqual(Object.keys(t.dinero).sort(), ['efectivo', 'qr'], 'el medio desconocido se ignora');
  assert.deepEqual(t.dinero.efectivo, { cobros: 700, cobrosAnulados: 0, gastos: 0, gastosAnulados: 0, compras: 0, comprasAnuladas: 0 });
  assert.deepEqual(t.dinero.qr, { cobros: 0, cobrosAnulados: 0, gastos: 0, gastosAnulados: 0, compras: 0, comprasAnuladas: 0 });
  assert.deepEqual(t.arqueos, [100, 0, 0, 0]);
  assert.ok(Object.is(t.arqueos[3], 0), 'sin «-0»');
  assert.equal(t.inventario.valorInicial, 0);
});

test('cuadre completo: cuadra, valores y diferencias', () => {
  const sin = cuadreDesdeBase({ cuadra: true, valor_libro: 116000, valor_saldos: 116000, diferencias: [] });
  assert.deepEqual(sin, { cuadra: true, valorLibro: 116000, valorSaldos: 116000, diferencias: [] });

  const con = cuadreDesdeBase({
    cuadra: false,
    valor_libro: 116000,
    valor_saldos: 115500,
    diferencias: [
      { clase: 'valor', detalle: 'Harina (La Paz)' },
      { clase: 'lotes', detalle: 'Harina (La Paz)' },
      { clase: 'compra', detalle: 'Compra n.º 12' },
      { clase: 'cobro', detalle: 'Recibo LP-2026-000031' },
      { clase: 'cantidad', detalle: 'Aceite (El Alto)' },
    ],
  });
  assert.equal(con.cuadra, false);
  assert.equal(con.valorLibro, 116000);
  assert.equal(con.valorSaldos, 115500);
  assert.deepEqual(
    con.diferencias.map((d) => d.clase),
    ['valor', 'lotes', 'compra', 'cobro', 'cantidad'],
  );
  assert.equal(con.diferencias[2]?.detalle, 'Compra n.º 12');
});

test('cuadre vacío o raro: no cuadra, ceros, y la clase desconocida se omite sin cambiar «cuadra»', () => {
  for (const json of [{}, null, undefined, 'texto', []]) {
    assert.deepEqual(cuadreDesdeBase(json), { cuadra: false, valorLibro: 0, valorSaldos: 0, diferencias: [] });
  }
  const raro = cuadreDesdeBase({ cuadra: 'true', valor_libro: '5', diferencias: [{ clase: 'misterio', detalle: 'x' }, { clase: 'valor' }] });
  assert.equal(raro.cuadra, false, 'solo el booleano true cuenta');
  assert.equal(raro.valorLibro, 0);
  assert.deepEqual(raro.diferencias, [{ clase: 'valor', detalle: '' }]);
});
