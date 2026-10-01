/**
 * Coherencia entre el catálogo del código y las migraciones SQL.
 *
 * QUÉ SE PRUEBA. La tabla `programas` es la referencia de las claves foráneas
 * de las solicitudes; el contenido de cada programa vive en el catálogo
 * estático. Si alguien añade un programa en un lado y no en el otro, el
 * portal ofrecería un curso que la base rechaza (o al revés). Esta prueba lee
 * el SQL versionado y lo compara con el catálogo, sin conectarse a ninguna base.
 *
 * También vigila dos invariantes de seguridad que se escriben en SQL y que
 * nadie debería perder al editar una migración: toda tabla nace con RLS y el
 * rol del registro nunca sale de los metadatos del usuario.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import { PROGRAMAS } from '../src/infrastructure/catalogo/oferta-academica.ts';

const CARPETA = new URL('../../../supabase/migrations/', import.meta.url);

function migraciones(): readonly { nombre: string; sql: string }[] {
  return readdirSync(CARPETA)
    .filter((n) => n.endsWith('.sql'))
    .sort()
    .map((nombre) => ({ nombre, sql: readFileSync(new URL(nombre, CARPETA), 'utf8') }));
}

test('los programas sembrados en SQL son exactamente los del catálogo, con el mismo tipo', () => {
  const completo = migraciones().find((m) => m.nombre.includes('programas'))?.sql;
  assert.ok(completo, 'falta la migración de programas');
  // Solo el bloque de inserción: la declaración del enum también tiene la forma ('carrera', 'curso'…).
  const sql = completo.slice(completo.indexOf('insert into public.programas'));
  const sembrados = [...sql.matchAll(/\('([a-z0-9-]+)',\s*'(carrera|curso|curso_de_temporada)'/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(
    sembrados,
    PROGRAMAS.map((p) => [p.codigo, p.tipo]),
  );
});

test('toda tabla creada en una migración activa RLS', () => {
  for (const { nombre, sql } of migraciones()) {
    const tablas = [...sql.matchAll(/create table public\.([a-z_]+)/g)].map((m) => m[1]);
    for (const tabla of tablas) {
      assert.match(sql, new RegExp(`alter table public\\.${tabla} enable row level security`), `${nombre}: ${tabla}`);
    }
  }
});

test('toda tabla retira los permisos por defecto de Supabase antes de conceder los suyos', () => {
  for (const { nombre, sql } of migraciones()) {
    const tablas = [...sql.matchAll(/create table public\.([a-z_]+)/g)].map((m) => m[1]);
    for (const tabla of tablas) {
      assert.match(sql, new RegExp(`revoke all on table public\\.${tabla} from anon, authenticated`), `${nombre}: ${tabla}`);
    }
  }
});

test('el alta de perfiles nunca lee el rol de los metadatos del registro', () => {
  const sql = migraciones().find((m) => m.nombre.includes('identidad'))?.sql ?? '';
  const funcion = sql.slice(sql.indexOf('function app.crear_perfil_de_usuario'), sql.indexOf('create trigger perfiles_alta_automatica'));
  assert.ok(funcion.length > 0, 'falta la función de alta');
  assert.doesNotMatch(funcion, /raw_user_meta_data\s*->>\s*'rol'/);
  assert.doesNotMatch(funcion, /\brol\b\s*[,)]/, 'la función no debe insertar la columna rol');
});

test('las funciones SECURITY DEFINER viven en el esquema app y fijan search_path', () => {
  for (const { nombre, sql } of migraciones()) {
    const bloques = sql.split(/create or replace function /).slice(1);
    for (const bloque of bloques) {
      if (!/security definer/.test(bloque.slice(0, 400))) continue;
      assert.match(bloque, /^app\./, `${nombre}: función DEFINER fuera de app`);
      assert.match(bloque.slice(0, 400), /set search_path = ''/, `${nombre}: DEFINER sin search_path fijo`);
    }
  }
});
