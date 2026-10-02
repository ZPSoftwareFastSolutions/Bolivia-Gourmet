/**
 * Errores del panel interno: el catálogo de frases y las migraciones no se
 * separan. Si una función nueva lanza `message = 'algo_nuevo'` y nadie escribe
 * su frase, el personal vería el genérico en lugar de saber qué corregir; si
 * sobra una frase, es un código que la base ya no usa.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import { codigoDelPanel, MENSAJES_DE_PANEL, traducirErrorDePanel } from '../src/infrastructure/supabase/errores-del-panel.ts';

const CARPETA = new URL('../../../supabase/migrations/', import.meta.url);

function codigosDeLasMigraciones(): ReadonlySet<string> {
  const codigos = new Set<string>();
  for (const nombre of readdirSync(CARPETA).filter((n) => n.endsWith('.sql'))) {
    const sql = readFileSync(new URL(nombre, CARPETA), 'utf8');
    for (const m of sql.matchAll(/message = '([a-z_]+)'/g)) codigos.add(m[1] ?? '');
  }
  return codigos;
}

test('todo código que lanzan las migraciones tiene su frase', () => {
  const codigos = codigosDeLasMigraciones();
  assert.ok(codigos.size > 0);
  for (const codigo of codigos) assert.ok(codigo in MENSAJES_DE_PANEL, `falta la frase de «${codigo}»`);
});

test('no sobran frases sin un código que las use', () => {
  const codigos = codigosDeLasMigraciones();
  for (const codigo of Object.keys(MENSAJES_DE_PANEL)) assert.ok(codigos.has(codigo), `«${codigo}» no lo lanza ninguna migración`);
});

test('las frases no dejan pasar vocabulario técnico', () => {
  for (const [codigo, frase] of Object.entries(MENSAJES_DE_PANEL)) {
    const texto = frase({});
    assert.ok(texto.length > 10, codigo);
    assert.doesNotMatch(texto, /\b(null|undefined|uuid|rpc|sql|postgres|error)\b/i, codigo);
  }
});

test('un código conocido se traduce; uno desconocido o un texto de PostgreSQL no llegan a la pantalla', () => {
  assert.equal(codigoDelPanel({ message: 'sin_permiso' }), 'sin_permiso');
  assert.equal(traducirErrorDePanel({ code: '42501', message: 'sin_permiso', details: '{"permiso":"caja.anular"}' }), MENSAJES_DE_PANEL.sin_permiso?.({}));
  assert.equal(codigoDelPanel({ message: 'codigo_inexistente' }), null);
  const crudo = traducirErrorDePanel({ code: 'XX000', message: 'relation "public.cargos" does not exist' });
  assert.doesNotMatch(crudo, /relation|public\.|does not exist/);
  assert.match(traducirErrorDePanel(null), /No pudimos guardar/);
});

test('un detalle mal formado no rompe la traducción', () => {
  assert.equal(traducirErrorDePanel({ message: 'sede_no_operable', details: '{no es json' }), MENSAJES_DE_PANEL.sede_no_operable?.({}));
  assert.equal(traducirErrorDePanel({ message: 'sede_no_operable', details: '[1,2]' }), MENSAJES_DE_PANEL.sede_no_operable?.({}));
});
