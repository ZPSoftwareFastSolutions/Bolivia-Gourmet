/**
 * Panel interno · Devolver el uniforme (revisión DB-02, enmiendas B.12
 * crítica 14): la respuesta jsonb de `devolver_uniforme` se lee hacia la
 * forma del puerto. `cargo {id, monto, anulado}` + `aviso` → anulado, cobrado
 * o parcial; lo que la base no dice (o dice a medias) no se inventa.
 * Las mismas respuestas las prueba la batería (N96–N98) contra la base.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { devolucionDesdeBase } from '../src/infrastructure/supabase/devolucion-desde-base.ts';

const CARGO = '0b6d3a8e-1f5e-4c3a-9a51-2a8f0c1d9e7b';
const base = { entrega: 'e', devuelta: 1, nueva_entrega: null, lineas: [] };

test('devolución completa sin cobros: la base anuló el cargo', () => {
  assert.deepEqual(devolucionDesdeBase({ ...base, cargo: { id: CARGO, monto: 65000, anulado: true }, aviso: null }), {
    cargo: { cargoId: CARGO, monto: 65000, estado: 'anulado' },
  });
});

test('devolución completa de un uniforme cobrado: el cargo sigue y hay que anular el cobro', () => {
  assert.deepEqual(devolucionDesdeBase({ ...base, cargo: { id: CARGO, monto: 65000, anulado: false }, aviso: 'anula_el_cobro' }), {
    cargo: { cargoId: CARGO, monto: 65000, estado: 'cobrado' },
  });
});

test('devolución parcial: el cargo sigue igual', () => {
  assert.deepEqual(devolucionDesdeBase({ ...base, cargo: { id: CARGO, monto: 130000, anulado: false }, aviso: 'devolucion_parcial' }), {
    cargo: { cargoId: CARGO, monto: 130000, estado: 'parcial' },
  });
});

test('el reenvío del formulario trae la respuesta guardada con «repetida» y se lee igual', () => {
  assert.deepEqual(devolucionDesdeBase({ ...base, cargo: { id: CARGO, monto: 65000, anulado: true }, aviso: null, repetida: true }).cargo?.estado, 'anulado');
});

test('cambio de talla o entrega sin cargo: no hay nada que decir del cargo', () => {
  assert.deepEqual(devolucionDesdeBase({ ...base, nueva_entrega: 'n', cargo: null, aviso: null }), { cargo: null });
  // Una respuesta anterior a la revisión (sin las claves) tampoco inventa nada.
  assert.deepEqual(devolucionDesdeBase(base), { cargo: null });
});

test('lo que la base no dice entero no se inventa', () => {
  const casos: unknown[] = [
    null,
    'texto',
    [],
    { cargo: { id: CARGO, monto: 65000, anulado: false }, aviso: null },
    { cargo: { id: CARGO, monto: 65000, anulado: false }, aviso: 'otro_aviso' },
    { cargo: { id: '', monto: 65000, anulado: true } },
    { cargo: { monto: 65000, anulado: true } },
    { cargo: { id: CARGO, monto: '65000', anulado: true } },
    { cargo: { id: CARGO, monto: 0, anulado: true } },
    { cargo: { id: CARGO, monto: 650.5, anulado: true } },
    { cargo: [CARGO, 65000, true] },
  ];
  for (const caso of casos) assert.deepEqual(devolucionDesdeBase(caso), { cargo: null }, JSON.stringify(caso));
});
