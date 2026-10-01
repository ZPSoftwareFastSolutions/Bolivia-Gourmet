/**
 * Convenios con logotipos (panal y carrusel) y la unión de cursos y emprende.
 *
 * QUÉ SE PRUEBA:
 *   - Cada socio y cada universidad tiene su hexágono generado, con sus
 *     archivos en public/img (un logotipo sin archivo sería una imagen rota).
 *   - Las filas del panal (folleto y móvil) suman exactamente los 17 socios:
 *     si llega uno más, la prueba avisa en vez de dejarlo fuera.
 *   - El carrusel conserva la alternancia arriba/abajo al reiniciar el bucle.
 *   - /emprende ya no está en el menú y redirige a /cursos.
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import { ALIADOS, UNIVERSIDADES } from '../contenido/convenios.ts';
import { LOGOS_DE_SOCIOS } from '../contenido/imagenes.generadas.ts';
import { NAVEGACION } from '../src/lib/rutas.ts';
import { celdasDelCarrusel, FILAS_DEL_FOLLETO, FILAS_MOVILES, repartirEnFilas } from '../src/presentation/sections/panal.ts';

const RAIZ = new URL('../', import.meta.url);

test('cada socio y cada universidad tiene su hexágono y sus archivos', () => {
  const logos = [...ALIADOS.map((a) => a.logo), ...UNIVERSIDADES.map((u) => u.logo)];
  assert.equal(new Set(logos).size, 21, 'un logotipo repetido');
  for (const logo of logos) {
    const generado = LOGOS_DE_SOCIOS[logo];
    assert.ok(generado, `falta el hexágono de ${logo}`);
    for (const ancho of generado.anchos) {
      assert.ok(existsSync(new URL(`public/img/socio-${logo}-${ancho}.webp`, RAIZ)), `falta socio-${logo}-${ancho}.webp`);
    }
  }
  // Y ningún hexágono generado queda huérfano (un archivo publicado sin uso).
  assert.deepEqual(Object.keys(LOGOS_DE_SOCIOS).sort(), [...logos].sort());
});

test('el orden de los socios es el de la retícula del folleto', () => {
  assert.deepEqual(
    ALIADOS.slice(0, 4).map((a) => a.nombre),
    ['Michelline', 'Alí Pacha', 'Mamita Masita', 'Oberland'],
  );
  assert.equal(ALIADOS.at(-1)?.nombre, 'Boragó');
});

test('las filas del panal suman todos los socios', () => {
  const folleto = FILAS_DEL_FOLLETO.map((f) => f.celdas);
  assert.deepEqual(folleto, [4, 4, 5, 4]);
  assert.equal(folleto.reduce((a, b) => a + b, 0), ALIADOS.length);
  assert.equal(FILAS_MOVILES.reduce((a, b) => a + b, 0), ALIADOS.length);
  assert.deepEqual(
    repartirEnFilas(ALIADOS, folleto).map((f) => f.length),
    folleto,
  );
});

test('repartirEnFilas no pierde elementos si sobran', () => {
  assert.deepEqual(repartirEnFilas([1, 2, 3, 4, 5, 6], [2, 2]), [[1, 2], [3, 4], [5, 6]]);
  assert.deepEqual(repartirEnFilas([1, 2], [3, 3]), [[1, 2]]);
});

test('el carrusel se repite sin cambiar la fila de cada logotipo al reiniciar', () => {
  for (const total of [17, 18]) {
    const elementos = Array.from({ length: total }, (_, i) => i);
    const celdas = celdasDelCarrusel(elementos);
    const periodo = celdas.length / 2;
    // La cinta se desplaza la mitad de su largo: ese periodo debe ser par para
    // que la celda N y la N + periodo caigan en la misma fila (arriba/abajo).
    assert.equal(periodo % 2, 0, `periodo impar con ${total} logotipos`);
    for (let i = 0; i < periodo; i++) assert.equal(celdas[i]?.elemento, celdas[i + periodo]?.elemento);
    // La primera copia es la única que leen los lectores de pantalla.
    assert.equal(celdas.filter((c) => c.copia === 0).length, total);
  }
});

test('/emprende ya no está en el menú y redirige a /cursos', () => {
  assert.ok(!NAVEGACION.some((e) => e.href === '/emprende'));
  assert.ok(NAVEGACION.some((e) => e.href === '/cursos'));
  const config = readFileSync(new URL('next.config.ts', RAIZ), 'utf8');
  assert.match(config, /source: '\/emprende', destination: '\/cursos', permanent: true/);
  assert.ok(!existsSync(new URL('src/app/(publico)/emprende/page.tsx', RAIZ)));
});
