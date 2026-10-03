/**
 * Panel interno · Historial del inventario: los filtros que llegan en la URL
 * (`?tipo=` y `?desde=`). Los avisos del inicio llevan a «bajas y faltantes»
 * o a «entregas y bajas»; un tipo desconocido se ignora y un salto inválido
 * vuelve a la primera página, sin romper la consulta a la base.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { desdeDeParametro, MOVIMIENTOS_POR_PAGINA, tiposDeParametro } from '../src/app/panel/inventario/historial/_filtro.ts';
import { TIPOS_DE_MOVIMIENTO } from '../src/core/domain/inventario/movimiento.ts';

test('tipo: los enlaces de los avisos del inicio se leen tal cual', () => {
  assert.deepEqual(tiposDeParametro('baja,ajuste_faltante'), ['baja', 'ajuste_faltante']);
  assert.deepEqual(tiposDeParametro('entrega,baja'), ['entrega', 'baja']);
  assert.deepEqual(tiposDeParametro('compra'), ['compra']);
});

test('tipo: vacío o solo espacios es «sin filtro»', () => {
  assert.deepEqual(tiposDeParametro(''), []);
  assert.deepEqual(tiposDeParametro('   '), []);
  assert.deepEqual(tiposDeParametro(',,'), []);
});

test('tipo: lo desconocido se ignora y lo repetido cuenta una vez, en el orden pedido', () => {
  assert.deepEqual(tiposDeParametro('baja,robo,BAJA,ajuste_faltante'), ['baja', 'ajuste_faltante']);
  assert.deepEqual(tiposDeParametro('ajuste_faltante, baja ,ajuste_faltante'), ['ajuste_faltante', 'baja']);
  assert.deepEqual(tiposDeParametro("baja'),or(id.neq.0"), []);
  assert.deepEqual(tiposDeParametro('__proto__,constructor,toString'), []);
});

test('tipo: cada tipo del dominio se acepta', () => {
  assert.deepEqual(tiposDeParametro(TIPOS_DE_MOVIMIENTO.join(',')), [...TIPOS_DE_MOVIMIENTO]);
});

test('desde: un entero sin signo; cualquier otra cosa es la primera página', () => {
  assert.equal(desdeDeParametro(''), 0);
  assert.equal(desdeDeParametro('0'), 0);
  assert.equal(desdeDeParametro(String(MOVIMIENTOS_POR_PAGINA)), 100);
  assert.equal(desdeDeParametro(' 200 '), 200);
  assert.equal(desdeDeParametro('-100'), 0);
  assert.equal(desdeDeParametro('1.5'), 0);
  assert.equal(desdeDeParametro('1e3'), 0);
  assert.equal(desdeDeParametro('abc'), 0);
  assert.equal(desdeDeParametro('12345678'), 0);
  assert.equal(desdeDeParametro('9999999'), 9999999);
});
