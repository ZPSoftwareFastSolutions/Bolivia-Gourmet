/**
 * Saludo del panel del estudiante según la hora de La Paz (pedido del
 * usuario, 2026-10-05): cinco franjas, frases que se turnan por día y que
 * no dependen del género de la persona.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { franjaDelDia, saludoDelMomento, SALUDOS, type FranjaDelDia } from '../src/core/domain/portal/saludo.ts';

test('franjaDelDia: madrugada, mañana, mediodía, tarde y noche en sus bordes', () => {
  const casos: readonly (readonly [number, FranjaDelDia])[] = [
    [0, 'madrugada'],
    [4, 'madrugada'],
    [5, 'manana'],
    [11, 'manana'],
    [12, 'mediodia'],
    [13, 'mediodia'],
    [14, 'tarde'],
    [18, 'tarde'],
    [19, 'noche'],
    [23, 'noche'],
  ];
  for (const [hora, franja] of casos) assert.equal(franjaDelDia(hora), franja, `${hora} h`);
  // Una hora rota no rompe la página: saludo neutro de la mañana.
  assert.equal(franjaDelDia(Number.NaN), 'manana');
  assert.equal(franjaDelDia(24), 'manana');
});

test('saludoDelMomento: igual todo el día, distinto al día siguiente', () => {
  const hoy = saludoDelMomento(9, '2026-10-05');
  assert.deepEqual(saludoDelMomento(9, '2026-10-05'), hoy);
  assert.deepEqual(saludoDelMomento(11, '2026-10-05'), hoy);
  const dias = ['2026-10-05', '2026-10-06', '2026-10-07'].map((d) => saludoDelMomento(9, d).frase);
  assert.equal(new Set(dias).size, 3, 'tres días seguidos, tres frases');
  assert.equal(saludoDelMomento(1, '2026-10-05').franja, 'madrugada');
  // Una fecha rota no rompe la página.
  assert.equal(saludoDelMomento(20, 'no es fecha').franja, 'noche');
});

test('cada frase es corta, cierra la exclamación del gancho y no depende del género', () => {
  const GENERO = /\b(list[oa]s?|bienvenid[oa]s?|desvelad[oa]|cansad[oa]|preparad[oa]|despiert[oa])\b/i;
  const VOSEO = /(tenés|querés|podés|hacés|\bsos\b|\bvos\b|revisá|mirá|elegí\b)/i;
  for (const [franja, variantes] of Object.entries(SALUDOS)) {
    assert.ok(variantes.length >= 2, `${franja}: al menos dos variantes`);
    for (const v of variantes) {
      const texto = `${v.gancho} Nombre${v.cierre} ${v.frase}`;
      assert.ok(v.frase.length <= 60, texto);
      assert.doesNotMatch(texto, GENERO, texto);
      assert.doesNotMatch(texto, VOSEO, texto);
      assert.match(v.gancho, /,$/, `el gancho termina en coma: ${texto}`);
      // «¡…» se cierra después del nombre; sin «¡» no hay «!» suelto.
      assert.equal(v.gancho.startsWith('¡'), v.cierre === '!', texto);
    }
  }
});
