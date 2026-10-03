/**
 * Panel interno · topes de las listas y filtro del historial.
 *
 * Las pantallas que avisan «la lista se cortó» comparan con el mismo tope que
 * aplica el adaptador. Ese número vive en el puerto, junto al método que lo
 * aplica, y lo importan los dos: una copia privada en la página podía
 * desalinearse en silencio (el aviso salía de más o no salía nunca, y en
 * contabilidad los totales se sumaban de una lista cortada).
 *
 * El historial muestra el filtro por tipos con un chip por tipo: el chip no
 * parte su texto, y uno solo con todos los tipos empujaba la página de lado a
 * 375 px.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { TOPE_DE_ALUMNOS, TOPE_DE_SOLICITUDES } from '../src/core/application/ports/alumnos.port.ts';
import { TOPE_DE_DEUDORES } from '../src/core/application/ports/caja.port.ts';
import { TOPE_DE_LISTA_DEL_MES } from '../src/core/application/ports/contabilidad.port.ts';

const SRC = new URL('../src/', import.meta.url);
const fuente = (ruta: string): string => readFileSync(new URL(ruta, SRC), 'utf8');

interface Tope {
  readonly nombre: string;
  readonly puerto: string;
  readonly adaptador: string;
  readonly metodos: readonly string[];
  readonly paginas: readonly string[];
}

const TOPES: readonly Tope[] = [
  {
    nombre: 'TOPE_DE_DEUDORES',
    puerto: 'caja.port',
    adaptador: 'infrastructure/supabase/panel-caja.supabase.ts',
    metodos: ['deudores'],
    paginas: ['app/panel/caja/deben/page.tsx'],
  },
  {
    nombre: 'TOPE_DE_SOLICITUDES',
    puerto: 'alumnos.port',
    adaptador: 'infrastructure/supabase/panel-alumnos.supabase.ts',
    metodos: ['listarSolicitudes'],
    paginas: ['app/panel/alumnos/solicitudes/page.tsx'],
  },
  {
    nombre: 'TOPE_DE_ALUMNOS',
    puerto: 'alumnos.port',
    adaptador: 'infrastructure/supabase/panel-alumnos.supabase.ts',
    metodos: ['buscarAlumnos'],
    paginas: ['app/panel/alumnos/page.tsx'],
  },
  {
    nombre: 'TOPE_DE_LISTA_DEL_MES',
    puerto: 'contabilidad.port',
    adaptador: 'infrastructure/supabase/panel-contabilidad.supabase.ts',
    metodos: ['gastos', 'compras'],
    paginas: ['app/panel/contabilidad/gastos/page.tsx', 'app/panel/contabilidad/compras/page.tsx'],
  },
];

/** ¿El archivo importa `nombre` (como valor) del puerto? */
function importaDelPuerto(codigo: string, nombre: string, puerto: string): boolean {
  const importacion = new RegExp(`import \\{[^}]*(?<!type )\\b${nombre}\\b[^}]*\\} from '@core/application/ports/${puerto.replace('.', '\\.')}'`);
  return importacion.test(codigo);
}

/** Cuerpo de un método de la clase del adaptador: desde su firma hasta el siguiente método. */
function cuerpoDelMetodo(codigo: string, metodo: string): string {
  const inicio = codigo.indexOf(`\n  async ${metodo}(`);
  assert.notEqual(inicio, -1, `el adaptador no tiene el método ${metodo}`);
  const resto = codigo.slice(inicio + 1);
  const siguiente = resto.search(/\n {2}(?:private )?async /);
  return siguiente === -1 ? resto : resto.slice(0, siguiente);
}

test('los topes del puerto valen lo mismo que antes de moverlos', () => {
  assert.equal(TOPE_DE_DEUDORES, 100);
  assert.equal(TOPE_DE_SOLICITUDES, 100);
  assert.equal(TOPE_DE_ALUMNOS, 100);
  assert.equal(TOPE_DE_LISTA_DEL_MES, 300);
});

test('el adaptador corta cada lista con el tope del puerto', () => {
  for (const t of TOPES) {
    const codigo = fuente(t.adaptador);
    assert.ok(importaDelPuerto(codigo, t.nombre, t.puerto), `${t.adaptador}: no importa ${t.nombre} del puerto`);
    for (const m of t.metodos) {
      assert.match(cuerpoDelMetodo(codigo, m), new RegExp(`\\.limit\\(${t.nombre}\\)`), `${t.adaptador} · ${m}: no corta con ${t.nombre}`);
    }
  }
});

test('la pantalla avisa del corte con el mismo tope: lo importa del puerto y no guarda una copia', () => {
  for (const t of TOPES) {
    for (const pagina of t.paginas) {
      const codigo = fuente(pagina);
      assert.ok(importaDelPuerto(codigo, t.nombre, t.puerto), `${pagina}: no importa ${t.nombre} del puerto`);
      // Una cifra propia (`const TOPE_DE_LA_LISTA = 100`) es justo lo que se desalinea.
      assert.doesNotMatch(codigo, /^const (?:TOPE|LIMITE)\w* = \d/m, `${pagina}: guarda su propia copia del tope`);
      // Además de importarlo, lo usa para decidir si la lista se cortó.
      assert.match(codigo, new RegExp(`length >= ${t.nombre}\\b`), `${pagina}: no compara la lista con ${t.nombre}`);
    }
  }
});

test('historial: el filtro por tipos va en un chip por tipo, no en uno con todos', () => {
  const codigo = fuente('app/panel/inventario/historial/page.tsx');
  assert.doesNotMatch(codigo, /<Chip\b[^>]*>[^<]*etiquetaDeTipos/, 'un solo chip con todos los tipos no parte línea y desborda a 375 px');
  assert.match(codigo, /tipos\.map\(\(t\) => \(\s*<Chip\b/, 'cada tipo del filtro debe ir en su propio chip');
  // La frase del estado vacío sí parte líneas: ahí se queda la lista unida.
  assert.match(codigo, /<EstadoVacio\b[^>]*etiquetaDeTipos/);
});
