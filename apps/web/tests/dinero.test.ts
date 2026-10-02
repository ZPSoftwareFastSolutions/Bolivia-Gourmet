/**
 * Lectura de montos escritos por una persona (precio de un grupo, cobros,
 * gastos). Centavos enteros, formato boliviano y errores en frase clara.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatearMonto, montoParaCampo, parsearMonto } from '../src/core/domain/shared/dinero.ts';
import type { Centavos } from '../src/core/domain/shared/tipos-base.ts';

function centavos(texto: string): number | string {
  const r = parsearMonto(texto);
  return r.exito ? r.valor : r.error;
}

test('lee los montos como los escribe la gente en Bolivia', () => {
  assert.equal(centavos('650'), 65000);
  assert.equal(centavos('Bs 650'), 65000);
  assert.equal(centavos('bs. 650,5'), 65050);
  assert.equal(centavos('650,50'), 65050);
  assert.equal(centavos('1.250,50'), 125050);
  assert.equal(centavos('1.250'), 125000);
  assert.equal(centavos('12.345.678'), 1234567800);
  assert.equal(centavos('1250.5'), 125050);
  assert.equal(centavos(' 0,01 '), 1);
});

test('rechaza lo que no es un monto válido', () => {
  for (const malo of ['', 'Bs', '0', '0,00', '-5', '6,505', '12a', '1,2,3', '1.25.0']) {
    assert.equal(parsearMonto(malo).exito, false, malo);
  }
});

test('ida y vuelta: lo que se muestra en el campo se vuelve a leer igual', () => {
  for (const c of [1, 99, 100, 65000, 65050, 125050] as Centavos[]) {
    const r = parsearMonto(montoParaCampo(c));
    assert.ok(r.exito);
    if (r.exito) assert.equal(r.valor, c);
  }
  assert.equal(formatearMonto(65000 as Centavos), 'Bs 650');
});
