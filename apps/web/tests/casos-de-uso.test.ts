/**
 * Pruebas del composition root.
 *
 * QUÉ SE PRUEBA. Que exponga el catálogo académico validado como singleton de
 * proceso. El caso de uso y el puerto del inventario viejo se retiraron
 * (enmiendas B.1): la base escribirá por RPC y los puertos nuevos llegan con
 * cada módulo del panel (R1–R5), con sus propias pruebas.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { catalogoAcademico } from '../src/infrastructure/config/composition-root.ts';

test('el composition root entrega el catálogo académico validado', async () => {
  const catalogo = catalogoAcademico();
  const programas = await catalogo.listarProgramas();
  assert.equal(programas.length, 6);
  assert.equal((await catalogo.programaPorCodigo('TORTAS'))?.nombre, 'Tortas');
  assert.equal(await catalogo.programaPorCodigo('no-existe'), null);
  assert.equal(catalogoAcademico(), catalogo, 'es singleton de proceso');
});
