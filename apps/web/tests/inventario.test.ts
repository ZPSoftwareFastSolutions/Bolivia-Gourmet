/**
 * Pruebas del dominio de inventario (ADR 0003).
 *
 * QUÉ SE PRUEBA. Las reglas que la base repetirá pero que el dominio define:
 * el tipo decide qué movimientos admite (I1), el stock nunca queda negativo
 * (I2), el ajuste fija con motivo (I3), la entrega genera su movimiento (I5)
 * y el contexto de la entrega es explícito (I6).
 *
 * Se ejecutan con `npm test` (node --test), sin framework ni navegador.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  admiteCantidadFraccionaria,
  COMPORTAMIENTO_POR_TIPO,
  TIPOS_DE_ARTICULO,
  validarArticulo,
  type Articulo,
} from '../src/core/domain/inventario/articulo.ts';
import {
  movimientoDeDevolucion,
  movimientoDeEntrega,
  validarEntrega,
  type Entrega,
} from '../src/core/domain/inventario/entrega.ts';
import {
  aplicarMovimiento,
  calcularStock,
  validarMovimiento,
  type DatosDeMovimiento,
} from '../src/core/domain/inventario/movimiento.ts';
import type { FechaISO, Id } from '../src/core/domain/shared/tipos-base.ts';

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

const HARINA: Articulo = {
  id: id('art-harina'),
  nombre: 'Harina',
  tipo: 'insumo',
  unidad: 'kg',
  stockMinimo: 10,
  activo: true,
};

const CUCHILLO: Articulo = {
  id: id('art-cuchillo'),
  nombre: 'Cuchillo cebollero',
  tipo: 'utensilio',
  unidad: 'unidad',
  stockMinimo: 2,
  activo: true,
};

function movimiento(parcial: Partial<DatosDeMovimiento> & Pick<DatosDeMovimiento, 'tipo' | 'cantidad'>): DatosDeMovimiento {
  return {
    varianteId: id('var-1'),
    sedeId: id('sede-la-paz'),
    fecha: fecha('2026-10-01'),
    responsableId: id('usuario-1'),
    ...parcial,
  };
}

// ---------------------------------------------------------------- tipos

test('cada tipo de artículo declara su comportamiento completo', () => {
  for (const tipo of TIPOS_DE_ARTICULO) {
    const c = COMPORTAMIENTO_POR_TIPO[tipo];
    assert.equal(typeof c.seEntregaAEstudiantes, 'boolean', tipo);
    assert.equal(typeof c.admiteDevolucion, 'boolean', tipo);
    assert.equal(typeof c.usaTallas, 'boolean', tipo);
    assert.equal(typeof c.admiteFraccion, 'boolean', tipo);
    assert.ok(c.etiqueta.length > 0, tipo);
  }
});

test('solo los uniformes usan tallas y solo los insumos admiten fracción', () => {
  assert.equal(COMPORTAMIENTO_POR_TIPO.uniforme.usaTallas, true);
  assert.equal(COMPORTAMIENTO_POR_TIPO.utensilio.usaTallas, false);
  assert.equal(COMPORTAMIENTO_POR_TIPO.insumo.admiteFraccion, true);
  assert.equal(COMPORTAMIENTO_POR_TIPO.uniforme.admiteFraccion, false);
});

test('la fracción depende del tipo Y de la unidad', () => {
  assert.equal(admiteCantidadFraccionaria(HARINA), true);
  assert.equal(admiteCantidadFraccionaria({ tipo: 'insumo', unidad: 'unidad' }), false);
  assert.equal(admiteCantidadFraccionaria(CHAQUETA), false);
});

test('un uniforme medido en kilos es un error de carga', () => {
  const resultado = validarArticulo({ ...CHAQUETA, unidad: 'kg' });
  assert.equal(resultado.exito, false);
});

test('un artículo válido se normaliza (nombre sin espacios sobrantes)', () => {
  const resultado = validarArticulo({ ...CHAQUETA, nombre: '  Chaqueta  ' });
  assert.ok(resultado.exito);
  assert.equal(resultado.valor.nombre, 'Chaqueta');
});

test('el stock mínimo no puede ser negativo', () => {
  const resultado = validarArticulo({ ...CHAQUETA, stockMinimo: -1 });
  assert.equal(resultado.exito, false);
});

// ---------------------------------------------------------------- aplicar

test('las entradas y devoluciones suman; salidas, entregas y bajas restan', () => {
  assert.deepEqual(aplicarMovimiento(10, { tipo: 'entrada', cantidad: 5 }), { exito: true, valor: 15 });
  assert.deepEqual(aplicarMovimiento(10, { tipo: 'devolucion', cantidad: 1 }), { exito: true, valor: 11 });
  assert.deepEqual(aplicarMovimiento(10, { tipo: 'salida', cantidad: 4 }), { exito: true, valor: 6 });
  assert.deepEqual(aplicarMovimiento(10, { tipo: 'entrega', cantidad: 10 }), { exito: true, valor: 0 });
  assert.deepEqual(aplicarMovimiento(10, { tipo: 'baja', cantidad: 3 }), { exito: true, valor: 7 });
});

test('regla I2: el stock nunca queda negativo', () => {
  const resultado = aplicarMovimiento(3, { tipo: 'entrega', cantidad: 4 });
  assert.equal(resultado.exito, false);
  assert.match(resultado.exito ? '' : resultado.error, /existencia suficiente/);
});

test('regla I3: el ajuste fija la existencia al valor indicado, incluido cero', () => {
  assert.deepEqual(aplicarMovimiento(50, { tipo: 'ajuste', cantidad: 12 }), { exito: true, valor: 12 });
  assert.deepEqual(aplicarMovimiento(50, { tipo: 'ajuste', cantidad: 0 }), { exito: true, valor: 0 });
});

test('las fracciones de insumo no arrastran ruido de coma flotante', () => {
  assert.deepEqual(aplicarMovimiento(0.1, { tipo: 'entrada', cantidad: 0.2 }), { exito: true, valor: 0.3 });
});

test('una existencia actual inválida se rechaza en vez de propagarse', () => {
  assert.equal(aplicarMovimiento(-1, { tipo: 'entrada', cantidad: 1 }).exito, false);
  assert.equal(aplicarMovimiento(Number.NaN, { tipo: 'entrada', cantidad: 1 }).exito, false);
});

// ---------------------------------------------------------------- calcular

test('calcularStock aplica en orden de fecha y, a igual fecha, en orden de llegada', () => {
  const resultado = calcularStock([
    { tipo: 'salida', cantidad: 2, fecha: fecha('2026-10-03') },
    { tipo: 'entrada', cantidad: 10, fecha: fecha('2026-10-01') },
    { tipo: 'entrega', cantidad: 3, fecha: fecha('2026-10-02') },
    { tipo: 'devolucion', cantidad: 1, fecha: fecha('2026-10-02') },
  ]);
  assert.deepEqual(resultado, { exito: true, valor: 6 });
});

test('un libro que en algún punto queda negativo se reporta, no se promedia', () => {
  const resultado = calcularStock([
    { tipo: 'entrega', cantidad: 3, fecha: fecha('2026-10-01') },
    { tipo: 'entrada', cantidad: 10, fecha: fecha('2026-10-02') },
  ]);
  assert.equal(resultado.exito, false);
});

test('sin movimientos, el stock es el inicial', () => {
  assert.deepEqual(calcularStock([]), { exito: true, valor: 0 });
  assert.deepEqual(calcularStock([], 4), { exito: true, valor: 4 });
});

// ---------------------------------------------------------------- validar movimiento

test('la cantidad debe ser positiva (salvo el ajuste, que admite cero)', () => {
  assert.equal(validarMovimiento(movimiento({ tipo: 'entrada', cantidad: 0 }), CHAQUETA).exito, false);
  assert.equal(validarMovimiento(movimiento({ tipo: 'entrada', cantidad: -2 }), CHAQUETA).exito, false);
  assert.equal(
    validarMovimiento(movimiento({ tipo: 'ajuste', cantidad: 0, motivo: 'Conteo físico' }), CHAQUETA).exito,
    true,
  );
});

test('las piezas se cuentan enteras; los kilos admiten decimales', () => {
  assert.equal(validarMovimiento(movimiento({ tipo: 'entrada', cantidad: 1.5 }), CHAQUETA).exito, false);
  assert.equal(validarMovimiento(movimiento({ tipo: 'entrada', cantidad: 1.5 }), HARINA).exito, true);
});

test('ajuste y baja exigen motivo', () => {
  assert.equal(validarMovimiento(movimiento({ tipo: 'ajuste', cantidad: 5 }), CHAQUETA).exito, false);
  assert.equal(validarMovimiento(movimiento({ tipo: 'baja', cantidad: 1 }), CUCHILLO).exito, false);
  assert.equal(validarMovimiento(movimiento({ tipo: 'baja', cantidad: 1, motivo: 'Se rompió' }), CUCHILLO).exito, true);
});

test('regla I1: un insumo no se entrega a estudiantes ni se devuelve', () => {
  const entrega = movimiento({ tipo: 'entrega', cantidad: 1, referencia: { tipo: 'entrega', id: id('ent-1') } });
  assert.equal(validarMovimiento(entrega, HARINA).exito, false);
  assert.equal(validarMovimiento(entrega, CHAQUETA).exito, true);

  const devolucion = movimiento({ tipo: 'devolucion', cantidad: 1, referencia: { tipo: 'entrega', id: id('ent-1') } });
  assert.equal(validarMovimiento(devolucion, HARINA).exito, false);
  assert.equal(validarMovimiento(devolucion, CUCHILLO).exito, true);
});

test('regla I5: entrega y devolución deben referenciar la entrega', () => {
  assert.equal(validarMovimiento(movimiento({ tipo: 'entrega', cantidad: 1 }), CHAQUETA).exito, false);
  assert.equal(
    validarMovimiento(movimiento({ tipo: 'entrega', cantidad: 1, referencia: { tipo: 'compra', id: id('c-1') } }), CHAQUETA).exito,
    false,
  );
});

test('un artículo inactivo no admite movimientos', () => {
  const resultado = validarMovimiento(movimiento({ tipo: 'entrada', cantidad: 1 }), { ...CHAQUETA, activo: false });
  assert.equal(resultado.exito, false);
});

test('la fecha debe existir en el calendario', () => {
  assert.equal(validarMovimiento(movimiento({ tipo: 'entrada', cantidad: 1, fecha: fecha('2026-02-30') }), CHAQUETA).exito, false);
  assert.equal(validarMovimiento(movimiento({ tipo: 'entrada', cantidad: 1, fecha: fecha('30/02/2026') }), CHAQUETA).exito, false);
});

test('se devuelven todos los errores, no solo el primero', () => {
  const resultado = validarMovimiento(movimiento({ tipo: 'ajuste', cantidad: -1, fecha: fecha('x') }), CHAQUETA);
  assert.equal(resultado.exito, false);
  assert.ok(!resultado.exito && resultado.error.length >= 3, 'cantidad, motivo y fecha');
});

// ---------------------------------------------------------------- entrega

const ENTREGA: Entrega = {
  id: id('ent-1'),
  inscripcionId: id('ins-1'),
  varianteId: id('var-m'),
  cantidad: 1,
  fecha: fecha('2026-10-05'),
  sedeId: id('sede-la-paz'),
  responsableId: id('usuario-1'),
  contexto: { tipo: 'inscripcion' },
  estado: 'entregado',
};

test('regla I6: la entrega lleva contexto explícito y la sesión es opcional', () => {
  assert.equal(validarEntrega(ENTREGA, CHAQUETA).exito, true);
  assert.equal(validarEntrega({ ...ENTREGA, contexto: { tipo: 'sesion', sesionId: id('ses-1') } }, CHAQUETA).exito, true);
  assert.equal(validarEntrega({ ...ENTREGA, contexto: { tipo: 'sesion', sesionId: '' as Id } }, CHAQUETA).exito, false);
  assert.equal(validarEntrega({ ...ENTREGA, contexto: { tipo: 'otro', detalle: '  ' } }, CHAQUETA).exito, false);
});

test('lo que se entrega a una persona se cuenta por piezas enteras', () => {
  assert.equal(validarEntrega({ ...ENTREGA, cantidad: 1.5 }, CHAQUETA).exito, false);
  assert.equal(validarEntrega({ ...ENTREGA, cantidad: 0 }, CHAQUETA).exito, false);
});

test('un insumo no se entrega a estudiantes', () => {
  assert.equal(validarEntrega(ENTREGA, HARINA).exito, false);
});

test('regla I5: la entrega genera un movimiento de entrega que la referencia', () => {
  const m = movimientoDeEntrega(ENTREGA);
  assert.equal(m.tipo, 'entrega');
  assert.equal(m.cantidad, 1);
  assert.deepEqual(m.referencia, { tipo: 'entrega', id: 'ent-1' });
  assert.equal(validarMovimiento(m, CHAQUETA).exito, true);
});

test('la devolución genera el movimiento inverso y no se repite', () => {
  const devolucion = movimientoDeDevolucion(ENTREGA, fecha('2026-10-06'), id('usuario-2'), 'Cambio de talla');
  assert.ok(devolucion.exito);
  assert.equal(devolucion.valor.tipo, 'devolucion');
  assert.deepEqual(devolucion.valor.referencia, { tipo: 'entrega', id: 'ent-1' });

  const repetida = movimientoDeDevolucion({ ...ENTREGA, estado: 'devuelto' }, fecha('2026-10-07'), id('usuario-2'));
  assert.equal(repetida.exito, false);
});
