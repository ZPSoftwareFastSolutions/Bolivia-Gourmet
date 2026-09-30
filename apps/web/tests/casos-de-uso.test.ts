/**
 * Pruebas de los casos de uso con puertos falsos en memoria.
 *
 * QUÉ SE PRUEBA. Que `registrarMovimiento` orqueste sin decidir: consulta el
 * puerto, deja validar al dominio, comprueba la existencia y SOLO entonces
 * guarda. Si una regla falla, el repositorio no recibe nada. También que el
 * composition root exponga el catálogo y falle cerrado con lo que no existe.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { registrarMovimiento } from '../src/core/application/inventario/registrar-movimiento.usecase.ts';
import type {
  InventarioRepositoryPort,
  VarianteConArticulo,
} from '../src/core/application/ports/inventario-repository.port.ts';
import type { Articulo, Variante } from '../src/core/domain/inventario/articulo.ts';
import { calcularStock, type DatosDeMovimiento, type Movimiento } from '../src/core/domain/inventario/movimiento.ts';
import { exito, fallo, type FechaISO, type Id, type Resultado } from '../src/core/domain/shared/tipos-base.ts';
import { catalogoAcademico, inventarioRepository } from '../src/infrastructure/config/composition-root.ts';

const id = (valor: string) => valor as Id;
const fecha = (valor: string) => valor as FechaISO;

const CHAQUETA: Articulo = {
  id: id('art-chaqueta'),
  nombre: 'Chaqueta blanca de chef',
  tipo: 'uniforme',
  unidad: 'unidad',
  stockMinimo: 5,
  activo: true,
};

const TALLA_M: Variante = { id: id('var-m'), articuloId: CHAQUETA.id, etiqueta: 'M' };

/**
 * Doble en memoria: guarda los movimientos y deriva el stock con el propio dominio.
 * Sin «parameter properties» en el constructor: Node ejecuta TypeScript en modo
 * «solo quitar tipos» y esa sintaxis genera código, así que no la admite.
 */
class InventarioEnMemoria implements InventarioRepositoryPort {
  readonly guardados: Movimiento[] = [];
  fallarAlGuardar = false;
  private readonly variantes: readonly VarianteConArticulo[];

  constructor(variantes: readonly VarianteConArticulo[]) {
    this.variantes = variantes;
  }

  async varianteConArticulo(varianteId: Id): Promise<VarianteConArticulo | null> {
    return this.variantes.find((v) => v.variante.id === varianteId) ?? null;
  }

  async stockDe(varianteId: Id, sedeId: Id): Promise<number> {
    const propios = this.guardados.filter((m) => m.varianteId === varianteId && m.sedeId === sedeId);
    const stock = calcularStock(propios);
    return stock.exito ? stock.valor : 0;
  }

  async guardarMovimiento(datos: DatosDeMovimiento): Promise<Resultado<Movimiento>> {
    if (this.fallarAlGuardar) return fallo('La base rechazó el movimiento (simulado).');
    const movimiento: Movimiento = { ...datos, id: id(`mov-${this.guardados.length + 1}`) };
    this.guardados.push(movimiento);
    return exito(movimiento);
  }
}

function entrada(cantidad: number, extra: Partial<DatosDeMovimiento> = {}): DatosDeMovimiento {
  return {
    varianteId: TALLA_M.id,
    sedeId: id('sede-la-paz'),
    tipo: 'entrada',
    cantidad,
    fecha: fecha('2026-10-01'),
    responsableId: id('usuario-1'),
    ...extra,
  };
}

test('registra una entrada y devuelve el stock resultante', async () => {
  const repo = new InventarioEnMemoria([{ variante: TALLA_M, articulo: CHAQUETA }]);

  const primero = await registrarMovimiento(repo, entrada(10));
  assert.ok(primero.exito);
  assert.equal(primero.valor.stockResultante, 10);
  assert.equal(primero.valor.movimiento.id, 'mov-1');

  const segundo = await registrarMovimiento(repo, entrada(2, { tipo: 'salida', fecha: fecha('2026-10-02') }));
  assert.ok(segundo.exito);
  assert.equal(segundo.valor.stockResultante, 8);
  assert.equal(repo.guardados.length, 2);
});

test('si la existencia no alcanza, no se guarda nada', async () => {
  const repo = new InventarioEnMemoria([{ variante: TALLA_M, articulo: CHAQUETA }]);
  await registrarMovimiento(repo, entrada(3));

  const resultado = await registrarMovimiento(repo, entrada(4, { tipo: 'salida' }));
  assert.equal(resultado.exito, false);
  assert.ok(!resultado.exito && resultado.error.some((e) => /existencia suficiente/.test(e)));
  assert.equal(repo.guardados.length, 1);
});

test('si el dominio rechaza el movimiento, el repositorio no se toca', async () => {
  const repo = new InventarioEnMemoria([{ variante: TALLA_M, articulo: CHAQUETA }]);

  const sinMotivo = await registrarMovimiento(repo, entrada(5, { tipo: 'ajuste' }));
  assert.equal(sinMotivo.exito, false);

  const fraccion = await registrarMovimiento(repo, entrada(1.5));
  assert.equal(fraccion.exito, false);

  assert.equal(repo.guardados.length, 0);
});

test('una variante desconocida se reporta como tal', async () => {
  const repo = new InventarioEnMemoria([]);
  const resultado = await registrarMovimiento(repo, entrada(1));
  assert.deepEqual(resultado, { exito: false, error: ['La variante indicada no existe.'] });
});

test('un fallo de la base se traduce a Resultado, nunca a excepción', async () => {
  const repo = new InventarioEnMemoria([{ variante: TALLA_M, articulo: CHAQUETA }]);
  repo.fallarAlGuardar = true;
  const resultado = await registrarMovimiento(repo, entrada(1));
  assert.equal(resultado.exito, false);
  assert.ok(!resultado.exito && /simulado/.test(resultado.error[0] ?? ''));
});

test('el stock se calcula por variante Y sede', async () => {
  const repo = new InventarioEnMemoria([{ variante: TALLA_M, articulo: CHAQUETA }]);
  await registrarMovimiento(repo, entrada(5, { sedeId: id('sede-la-paz') }));
  await registrarMovimiento(repo, entrada(2, { sedeId: id('sede-el-alto') }));

  assert.equal(await repo.stockDe(TALLA_M.id, id('sede-la-paz')), 5);
  assert.equal(await repo.stockDe(TALLA_M.id, id('sede-el-alto')), 2);
});

// ---------------------------------------------------------------- composition root

test('el composition root entrega el catálogo académico validado', async () => {
  const catalogo = catalogoAcademico();
  const programas = await catalogo.listarProgramas();
  assert.equal(programas.length, 6);
  assert.equal((await catalogo.programaPorCodigo('TORTAS'))?.nombre, 'Tortas');
  assert.equal(await catalogo.programaPorCodigo('no-existe'), null);
  assert.equal(catalogoAcademico(), catalogo, 'es singleton de proceso');
});

test('el composition root falla cerrado con lo que aún no existe', () => {
  assert.throws(() => inventarioRepository(), /no está configurado/);
});
