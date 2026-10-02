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

/** Cada función de las migraciones: nombre calificado y cabecera completa (hasta `as $$`). */
function funciones(): readonly { migracion: string; nombre: string; cabecera: string }[] {
  const lista: { migracion: string; nombre: string; cabecera: string }[] = [];
  for (const { nombre: migracion, sql } of migraciones()) {
    for (const bloque of sql.split(/create or replace function /).slice(1)) {
      const fin = bloque.indexOf('as $$');
      assert.ok(fin > 0, `${migracion}: función sin cuerpo $$`);
      const nombre = /^([a-z_]+\.[a-z_]+)\(/.exec(bloque)?.[1] ?? '';
      assert.ok(nombre, `${migracion}: función sin esquema explícito`);
      lista.push({ migracion, nombre, cabecera: bloque.slice(0, fin) });
    }
  }
  return lista;
}

function revocaciones(): string {
  return migraciones()
    .map((m) => m.sql)
    .join('\n');
}

function escapar(nombre: string): string {
  return nombre.replace('.', '\\.');
}

// Enmiendas B.11: se lee la cabecera ENTERA (una lista larga de parámetros
// dejaba `security definer` fuera de los primeros 400 caracteres).
test('las funciones SECURITY DEFINER viven en el esquema app y fijan search_path', () => {
  const definer = funciones().filter((f) => /security definer/.test(f.cabecera));
  assert.ok(definer.length > 0);
  for (const f of definer) {
    assert.match(f.nombre, /^app\./, `${f.migracion}: ${f.nombre} es DEFINER fuera de app`);
    assert.match(f.cabecera, /set search_path = ''/, `${f.migracion}: ${f.nombre} sin search_path fijo`);
  }
});

test('las fachadas de public son SECURITY INVOKER y anon no las puede ejecutar', () => {
  const sql = revocaciones();
  const fachadas = funciones().filter((x) => x.nombre.startsWith('public.'));
  assert.ok(fachadas.length > 0);
  for (const f of fachadas) {
    assert.doesNotMatch(f.cabecera, /security definer/, `${f.nombre} no debe ser DEFINER`);
    assert.match(sql, new RegExp(`revoke all on function ${escapar(f.nombre)}\\([^)]*\\) from public, anon`), `${f.nombre}: falta revoke a anon`);
  }
});

test('toda función de app retira el permiso de ejecución por defecto', () => {
  const sql = revocaciones();
  for (const f of funciones().filter((x) => x.nombre.startsWith('app.'))) {
    assert.match(sql, new RegExp(`revoke all on function ${escapar(f.nombre)}\\([^)]*\\) from public`), `${f.nombre}: falta revoke`);
  }
});

test('las vistas v_* consultan con los permisos de quien pregunta (security_invoker)', () => {
  for (const { nombre, sql } of migraciones()) {
    for (const m of sql.matchAll(/create (?:or replace )?view (public\.v_[a-z_]+)([^;]*?) as\b/g)) {
      assert.match(m[2] ?? '', /security_invoker\s*=\s*(true|on)/, `${nombre}: ${m[1]} sin security_invoker`);
    }
  }
});
