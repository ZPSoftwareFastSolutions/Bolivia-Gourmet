/**
 * Pruebas del dominio de inventario (ADR 0003, especificación §2.5).
 *
 * QUÉ SE PRUEBA. Lo que la base repetirá pero el dominio define: el tipo del
 * artículo decide cómo se valoriza y qué operaciones admite (I1); cada
 * movimiento mueve disponible y prestado con su signo y nada queda negativo
 * (I2); ya no hay «ajuste que fija», sino conteo con faltante, sobrante o
 * constancia (D15); qué se puede anular (B.12); la entrega de uniforme con su
 * devolución y cambio de talla; el préstamo de utensilios con devolución y
 * pérdida. Los costos (PEPS y promedio) están en `valuacion.test.ts`.
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
  validarVariantes,
  type DatosDeArticulo,
} from '../src/core/domain/inventario/articulo.ts';
import { devolverEntrega, movimientoDeEntrega, validarEntrega, type Entrega } from '../src/core/domain/inventario/entrega.ts';
import {
  admiteMovimiento,
  aplicarMovimiento,
  calcularSaldo,
  conteo,
  deltasDe,
  existenciaCambio,
  SALDO_VACIO,
  TIPOS_DE_MOVIMIENTO,
  validarAnulacion,
  validarLineaDeConteo,
  validarMovimiento,
  type DatosDeMovimiento,
  type Deltas,
  type Saldo,
} from '../src/core/domain/inventario/movimiento.ts';
import {
  diasDeAtraso,
  estaAtrasado,
  movimientoDePrestamo,
  pendienteDePrestamo,
  recibirPrestamo,
  validarPrestamo,
  type DatosDePrestamo,
  type Prestamo,
} from '../src/core/domain/inventario/prestamo.ts';
import type { Milesimas } from '../src/core/domain/shared/cantidad.ts';
import type { Centavos, FechaISO, Id } from '../src/core/domain/shared/tipos-base.ts';

const id = (valor: string) => valor as Id;
const fecha = (valor: string) => valor as FechaISO;
const mil = (valor: bigint) => valor as Milesimas;

const JUEGO: DatosDeArticulo = {
  nombre: 'Juego de uniforme de la carrera',
  tipo: 'uniforme',
  icono: 'chaqueta',
  unidad: 'unidad',
  controlaVencimiento: false,
  stockMinimo: mil(5000n),
  precioVenta: 65_000 as Centavos,
  activo: true,
};

const HARINA: DatosDeArticulo = {
  nombre: 'Harina de trigo',
  tipo: 'insumo',
  icono: 'trigo',
  unidad: 'kg',
  controlaVencimiento: true,
  stockMinimo: mil(25_000n),
  activo: true,
};

const CUCHILLOS: DatosDeArticulo = {
  nombre: 'Juego de cuchillos',
  tipo: 'utensilio',
  icono: 'cubiertos',
  unidad: 'unidad',
  controlaVencimiento: false,
  stockMinimo: mil(2000n),
  activo: true,
};

const DETERGENTE: DatosDeArticulo = {
  nombre: 'Detergente',
  tipo: 'otro',
  icono: 'almacen',
  unidad: 'l',
  controlaVencimiento: false,
  stockMinimo: mil(0n),
  activo: true,
};

function movimiento(parcial: Partial<DatosDeMovimiento> & Pick<DatosDeMovimiento, 'tipo'>): DatosDeMovimiento {
  return {
    varianteId: id('var-1'),
    sedeId: id('sede-la-paz'),
    fecha: fecha('2026-10-02'),
    cantidad: mil(1000n),
    ...parcial,
  };
}

// ================================================================ tipos de artículo

test('cada tipo de artículo declara su comportamiento completo', () => {
  for (const tipo of TIPOS_DE_ARTICULO) {
    const c = COMPORTAMIENTO_POR_TIPO[tipo];
    assert.ok(c.valuacion === 'peps' || c.valuacion === 'promedio', tipo);
    for (const clave of ['admiteUso', 'admiteEntrega', 'admitePrestamo', 'controlaVencimiento', 'admitePrecioVenta', 'usaTallas', 'admiteFraccion'] as const) {
      assert.equal(typeof c[clave], 'boolean', `${tipo}.${clave}`);
    }
    assert.ok(c.etiqueta.length > 0, tipo);
  }
});

test('D18: los insumos van por PEPS y todo lo demás a costo promedio', () => {
  assert.equal(COMPORTAMIENTO_POR_TIPO.insumo.valuacion, 'peps');
  assert.equal(COMPORTAMIENTO_POR_TIPO.uniforme.valuacion, 'promedio');
  assert.equal(COMPORTAMIENTO_POR_TIPO.utensilio.valuacion, 'promedio');
  assert.equal(COMPORTAMIENTO_POR_TIPO.otro.valuacion, 'promedio');
});

test('el utensilio se presta (ya no se entrega); el uniforme se entrega; insumos y otros se usan', () => {
  assert.equal(COMPORTAMIENTO_POR_TIPO.utensilio.admitePrestamo, true);
  assert.equal(COMPORTAMIENTO_POR_TIPO.utensilio.admiteEntrega, false);
  assert.equal(COMPORTAMIENTO_POR_TIPO.uniforme.admiteEntrega, true);
  assert.equal(COMPORTAMIENTO_POR_TIPO.uniforme.admitePrestamo, false);
  assert.equal(COMPORTAMIENTO_POR_TIPO.insumo.admiteUso, true);
  assert.equal(COMPORTAMIENTO_POR_TIPO.otro.admiteUso, true);
  assert.equal(COMPORTAMIENTO_POR_TIPO.uniforme.admiteUso, false);
});

test('solo el insumo controla vencimiento y solo el uniforme tiene precio de venta', () => {
  for (const tipo of TIPOS_DE_ARTICULO) {
    assert.equal(COMPORTAMIENTO_POR_TIPO[tipo].controlaVencimiento, tipo === 'insumo', tipo);
    assert.equal(COMPORTAMIENTO_POR_TIPO[tipo].admitePrecioVenta, tipo === 'uniforme', tipo);
  }
});

test('la fracción depende del tipo Y de la unidad (kg, g, l y ml solo en insumo y otro)', () => {
  assert.equal(admiteCantidadFraccionaria(HARINA), true);
  assert.equal(admiteCantidadFraccionaria(DETERGENTE), true);
  assert.equal(admiteCantidadFraccionaria({ tipo: 'insumo', unidad: 'unidad' }), false);
  assert.equal(admiteCantidadFraccionaria(JUEGO), false);
});

test('validarArticulo: un artículo válido se normaliza', () => {
  const resultado = validarArticulo({ ...JUEGO, nombre: '  Juego M  ', categoria: '  ' });
  assert.ok(resultado.exito);
  assert.equal(resultado.valor.nombre, 'Juego M');
  assert.equal(resultado.valor.categoria, undefined);
  for (const articulo of [HARINA, CUCHILLOS, DETERGENTE]) assert.equal(validarArticulo(articulo).exito, true, articulo.nombre);
});

test('validarArticulo: errores de carga, todos a la vez', () => {
  assert.equal(validarArticulo({ ...JUEGO, unidad: 'kg' }).exito, false, 'uniforme en kilos');
  assert.equal(validarArticulo({ ...HARINA, precioVenta: 1000 as Centavos }).exito, false, 'precio solo en uniforme');
  assert.equal(validarArticulo({ ...JUEGO, controlaVencimiento: true }).exito, false, 'vencimiento solo en insumo');
  assert.equal(validarArticulo({ ...JUEGO, precioVenta: 0 as Centavos }).exito, false, 'precio mayor que cero');
  assert.equal(validarArticulo({ ...JUEGO, stockMinimo: mil(1500n) }).exito, false, 'mínimo entero en piezas');
  assert.equal(validarArticulo({ ...HARINA, stockMinimo: mil(-1n) }).exito, false, 'mínimo no negativo');
  assert.equal(validarArticulo({ ...HARINA, icono: 'cohete' as never }).exito, false, 'icono de la lista cerrada');

  const varios = validarArticulo({ ...JUEGO, nombre: ' ', unidad: 'kg', controlaVencimiento: true });
  assert.ok(!varios.exito && varios.error.length === 3, 'nombre, unidad y vencimiento');
});

test('variantes: «Única» por defecto, un insumo tiene una sola y las tallas no se repiten', () => {
  assert.deepEqual(validarVariantes('insumo', []), { exito: true, valor: ['Única'] });
  assert.equal(validarVariantes('insumo', ['Saco', 'Bolsa']).exito, false);
  assert.deepEqual(validarVariantes('uniforme', [' S ', 'M', 'L']), { exito: true, valor: ['S', 'M', 'L'] });
  assert.equal(validarVariantes('uniforme', ['M', 'm']).exito, false);
});

// ================================================================ deltas y saldos

const DELTAS_ESPERADOS: Record<Exclude<(typeof TIPOS_DE_MOVIMIENTO)[number], 'anulacion'>, Deltas> = {
  saldo_inicial: { disponible: 2000n, prestado: 0n },
  compra: { disponible: 2000n, prestado: 0n },
  consumo: { disponible: -2000n, prestado: 0n },
  entrega: { disponible: -2000n, prestado: 0n },
  devolucion_entrega: { disponible: 2000n, prestado: 0n },
  prestamo: { disponible: -2000n, prestado: 2000n },
  devolucion_prestamo: { disponible: 2000n, prestado: -2000n },
  baja: { disponible: -2000n, prestado: 0n },
  ajuste_faltante: { disponible: -2000n, prestado: 0n },
  ajuste_sobrante: { disponible: 2000n, prestado: 0n },
};

test('cada tipo de §2.5 mueve disponible y prestado con su signo', () => {
  for (const [tipo, esperado] of Object.entries(DELTAS_ESPERADOS)) {
    assert.deepEqual(deltasDe({ tipo: tipo as keyof typeof DELTAS_ESPERADOS, cantidad: mil(2000n) }), { exito: true, valor: esperado }, tipo);
  }
});

test('la baja de algo prestado (se perdió en un préstamo) resta de prestado, no del estante', () => {
  assert.deepEqual(deltasDe({ tipo: 'baja', cantidad: mil(1000n), desdePrestado: true }), {
    exito: true,
    valor: { disponible: 0n, prestado: -1000n },
  });
});

test('la anulación es el inverso exacto de su original y lo necesita', () => {
  assert.deepEqual(deltasDe({ tipo: 'anulacion', cantidad: mil(2000n) }, { disponible: -2000n, prestado: 0n }), {
    exito: true,
    valor: { disponible: 2000n, prestado: 0n },
  });
  assert.equal(deltasDe({ tipo: 'anulacion', cantidad: mil(2000n) }).exito, false);
});

test('regla I2: ni el estante ni lo prestado quedan negativos', () => {
  const saldo: Saldo = { disponible: mil(3000n), prestado: mil(1000n) };
  assert.equal(aplicarMovimiento(saldo, { disponible: -4000n, prestado: 0n }).exito, false);
  assert.equal(aplicarMovimiento(saldo, { disponible: 2000n, prestado: -2000n }).exito, false);
  assert.deepEqual(aplicarMovimiento(saldo, { disponible: -1000n, prestado: 1000n }), {
    exito: true,
    valor: { disponible: 2000n, prestado: 2000n },
  });
});

test('calcularSaldo aplica en orden de escritura y se detiene en el asiento que dejaría negativo', () => {
  const libro: Deltas[] = [
    { disponible: 10_000n, prestado: 0n }, // compra 10
    { disponible: -2000n, prestado: 2000n }, // préstamo 2
    { disponible: 1000n, prestado: -1000n }, // vuelve 1
    { disponible: 0n, prestado: -1000n }, // se pierde 1
  ];
  assert.deepEqual(calcularSaldo(libro), { exito: true, valor: { disponible: 9000n, prestado: 0n } });
  assert.equal(calcularSaldo([{ disponible: -1000n, prestado: 0n }, ...libro]).exito, false);
  assert.deepEqual(calcularSaldo([]), { exito: true, valor: SALDO_VACIO });
});

// ================================================================ validar movimiento

test('regla I1: cada tipo de artículo admite sus movimientos', () => {
  assert.equal(admiteMovimiento('uniforme', 'consumo'), false);
  assert.equal(admiteMovimiento('utensilio', 'entrega'), false);
  assert.equal(admiteMovimiento('uniforme', 'prestamo'), false);
  assert.equal(admiteMovimiento('insumo', 'consumo'), true);
  assert.equal(admiteMovimiento('otro', 'consumo'), true);
  for (const tipo of TIPOS_DE_ARTICULO) {
    for (const mov of ['saldo_inicial', 'compra', 'baja', 'ajuste_faltante', 'ajuste_sobrante'] as const) {
      assert.equal(admiteMovimiento(tipo, mov), true, `${tipo} ${mov}`);
    }
  }
});

test('un uso en clase válido: insumo, destino y cantidad con decimales', () => {
  const uso = movimiento({ tipo: 'consumo', cantidad: mil(2500n), destino: 'clase', cohorteId: id('coh-cocina') });
  assert.equal(validarMovimiento(uso, HARINA).exito, true);
  assert.equal(validarMovimiento({ ...uso, destino: undefined }, HARINA).exito, false, 'sin destino');
  assert.equal(validarMovimiento({ ...uso, destino: 'otro' }, HARINA).exito, false, 'destino otro sin detalle');
  assert.equal(validarMovimiento({ ...uso, destino: 'otro', detalle: 'Muestra para la feria' }, HARINA).exito, true);
  assert.equal(validarMovimiento(uso, JUEGO).exito, false, 'un uniforme no se usa en clase');
});

test('las piezas se cuentan enteras; los kilos admiten decimales', () => {
  const compra = movimiento({ tipo: 'compra', cantidad: mil(1500n), compraId: id('compra-1') });
  assert.equal(validarMovimiento(compra, JUEGO).exito, false);
  assert.equal(validarMovimiento(compra, HARINA).exito, true);
  assert.equal(validarMovimiento({ ...compra, cantidad: mil(0n) }, HARINA).exito, false);
});

test('cada tipo exige la referencia a su documento', () => {
  assert.equal(validarMovimiento(movimiento({ tipo: 'compra' }), HARINA).exito, false);
  assert.equal(validarMovimiento(movimiento({ tipo: 'entrega' }), JUEGO).exito, false);
  assert.equal(validarMovimiento(movimiento({ tipo: 'entrega', entregaId: id('ent-1') }), JUEGO).exito, true);
  assert.equal(validarMovimiento(movimiento({ tipo: 'prestamo' }), CUCHILLOS).exito, false);
  assert.equal(validarMovimiento(movimiento({ tipo: 'ajuste_faltante' }), HARINA).exito, false);
  assert.equal(validarMovimiento(movimiento({ tipo: 'anulacion' }), HARINA).exito, false);
});

test('una baja exige motivo y explicación; la de un insumo vencido, el lote', () => {
  const baja = movimiento({ tipo: 'baja', motivoBaja: 'rotura', detalle: 'Se cayó en la práctica' });
  assert.equal(validarMovimiento(baja, CUCHILLOS).exito, true);
  assert.equal(validarMovimiento({ ...baja, motivoBaja: undefined }, CUCHILLOS).exito, false);
  assert.equal(validarMovimiento({ ...baja, detalle: ' ' }, CUCHILLOS).exito, false);

  const vencida = movimiento({ tipo: 'baja', motivoBaja: 'vencimiento', detalle: 'Leche vencida ayer' });
  assert.equal(validarMovimiento(vencida, HARINA).exito, false);
  assert.equal(validarMovimiento({ ...vencida, loteId: id('lote-1') }, HARINA).exito, true);
});

test('la baja desde lo prestado solo es de utensilios e indica el préstamo', () => {
  const perdida = movimiento({ tipo: 'baja', motivoBaja: 'perdida', detalle: 'No volvió', desdePrestado: true, prestamoId: id('pre-1') });
  assert.equal(validarMovimiento(perdida, CUCHILLOS).exito, true);
  assert.equal(validarMovimiento({ ...perdida, prestamoId: undefined }, CUCHILLOS).exito, false);
  assert.equal(validarMovimiento(perdida, JUEGO).exito, false);
  assert.equal(validarMovimiento(movimiento({ tipo: 'compra', compraId: id('c'), desdePrestado: true }), CUCHILLOS).exito, false);
});

test('un artículo inactivo no admite operaciones nuevas, pero sí anular lo hecho', () => {
  const inactivo = { ...HARINA, activo: false };
  assert.equal(validarMovimiento(movimiento({ tipo: 'compra', compraId: id('c') }), inactivo).exito, false);
  assert.equal(validarMovimiento(movimiento({ tipo: 'anulacion', anulaA: id('mov-1') }), inactivo).exito, true);
});

test('se devuelven todos los errores, no solo el primero', () => {
  const resultado = validarMovimiento(movimiento({ tipo: 'baja', cantidad: mil(0n), fecha: fecha('x') }), HARINA);
  assert.ok(!resultado.exito && resultado.error.length >= 4, 'cantidad, fecha, motivo y detalle');
});

test('B.12: qué se anula y qué no', () => {
  for (const tipo of ['compra', 'consumo', 'baja', 'saldo_inicial'] as const) {
    assert.equal(validarAnulacion({ tipo }).exito, true, tipo);
  }
  const entrega = validarAnulacion({ tipo: 'entrega' });
  assert.ok(!entrega.exito && /se devuelve/.test(entrega.error[0] ?? ''));
  assert.equal(validarAnulacion({ tipo: 'prestamo' }).exito, false);
  assert.equal(validarAnulacion({ tipo: 'anulacion' }).exito, false);
  assert.equal(validarAnulacion({ tipo: 'baja', prestamoId: id('pre-1') }).exito, false, 'crítica 12');
  assert.equal(validarAnulacion({ tipo: 'compra', anulado: true }).exito, false);
});

// ================================================================ conteo

test('D15: el conteo produce faltante, sobrante o constancia por la diferencia', () => {
  assert.deepEqual(conteo(mil(9500n), mil(9000n)), { exito: true, valor: { tipo: 'ajuste_faltante', cantidad: 500n } });
  assert.deepEqual(conteo(mil(9500n), mil(10_000n)), { exito: true, valor: { tipo: 'ajuste_sobrante', cantidad: 500n } });
  assert.deepEqual(conteo(mil(9500n), mil(9500n)), { exito: true, valor: { tipo: 'constancia' } });
  assert.deepEqual(conteo(mil(0n), mil(0n)), { exito: true, valor: { tipo: 'constancia' } });
  assert.equal(conteo(mil(1000n), mil(-1n)).exito, false);
});

test('la línea de conteo exige motivo si difiere, piezas enteras y que nada se haya movido', () => {
  const linea = { existenciaVista: mil(9500n), contado: mil(9000n), motivo: 'Derrame' };
  assert.deepEqual(validarLineaDeConteo(linea, HARINA, mil(9500n)), { exito: true, valor: { tipo: 'ajuste_faltante', cantidad: 500n } });
  assert.equal(validarLineaDeConteo({ ...linea, motivo: '' }, HARINA, mil(9500n)).exito, false);
  assert.equal(validarLineaDeConteo({ existenciaVista: mil(3000n), contado: mil(3000n) }, JUEGO, mil(3000n)).exito, true, 'la constancia no pide motivo');
  assert.equal(validarLineaDeConteo({ existenciaVista: mil(3000n), contado: mil(2500n), motivo: 'x' }, JUEGO, mil(3000n)).exito, false);

  const cambio = validarLineaDeConteo(linea, HARINA, mil(7500n));
  assert.ok(!cambio.exito && cambio.error.some((e) => /se movió/.test(e)), 'existencia_cambio');
  assert.equal(existenciaCambio(mil(9500n), mil(7500n)), true);
  assert.equal(existenciaCambio(mil(9500n), mil(9500n)), false);
});

// ================================================================ entrega de uniforme

const ENTREGA: Entrega = {
  id: id('ent-1'),
  inscripcionId: id('ins-diego'),
  sedeId: id('sede-la-paz'),
  varianteId: id('var-m'),
  cantidad: 1,
  devuelta: 0,
  contexto: 'inscripcion',
  fecha: fecha('2026-10-02'),
};

test('la entrega es de uniformes, por piezas enteras y con contexto explícito', () => {
  assert.equal(validarEntrega(ENTREGA, JUEGO).exito, true);
  assert.equal(validarEntrega(ENTREGA, CUCHILLOS).exito, false, 'el utensilio se presta');
  assert.equal(validarEntrega({ ...ENTREGA, cantidad: 1.5 }, JUEGO).exito, false);
  assert.equal(validarEntrega({ ...ENTREGA, contexto: 'otro' }, JUEGO).exito, false);
  assert.equal(validarEntrega({ ...ENTREGA, contexto: 'otro', detalle: 'Evento de la feria' }, JUEGO).exito, true);
  assert.equal(validarEntrega({ ...ENTREGA, contexto: 'sesion' as never }, JUEGO).exito, false, 'P10: ya no hay sesiones');
});

test('regla I5: la entrega genera un movimiento de entrega que la referencia', () => {
  const m = movimientoDeEntrega(ENTREGA);
  assert.ok(m.exito);
  assert.equal(m.valor.tipo, 'entrega');
  assert.equal(m.valor.cantidad, 1000n);
  assert.equal(m.valor.entregaId, 'ent-1');
  assert.equal(validarMovimiento(m.valor, JUEGO).exito, true);
});

test('la devolución apunta a la misma entrega y no excede lo entregado', () => {
  const devolucion = devolverEntrega({ ...ENTREGA, articuloId: id('art-juego') }, { cantidad: 1, motivo: 'Le quedó grande', fecha: fecha('2026-10-03') });
  assert.ok(devolucion.exito);
  assert.equal(devolucion.valor.movimiento.tipo, 'devolucion_entrega');
  assert.equal(devolucion.valor.movimiento.entregaId, 'ent-1');
  assert.equal(devolucion.valor.nuevaEntrega, undefined);

  assert.equal(devolverEntrega({ ...ENTREGA, devuelta: 1, articuloId: id('art-juego') }, { cantidad: 1, motivo: 'x', fecha: fecha('2026-10-03') }).exito, false);
  assert.equal(devolverEntrega({ ...ENTREGA, articuloId: id('art-juego') }, { cantidad: 1, motivo: ' ', fecha: fecha('2026-10-03') }).exito, false);
});

test('el cambio de talla devuelve una y entrega otra del mismo uniforme, sin cargo', () => {
  const entrega = { ...ENTREGA, articuloId: id('art-juego') };
  const cambio = devolverEntrega(entrega, {
    cantidad: 1,
    motivo: 'Cambio S → M',
    fecha: fecha('2026-10-03'),
    cambiarPor: { varianteId: id('var-l'), articuloId: id('art-juego') },
  });
  assert.ok(cambio.exito);
  assert.deepEqual(cambio.valor.nuevaEntrega, {
    inscripcionId: id('ins-diego'),
    sedeId: id('sede-la-paz'),
    varianteId: id('var-l'),
    cantidad: 1,
    contexto: 'cambio_de_talla',
    fecha: fecha('2026-10-03'),
  });

  const misma = devolverEntrega(entrega, { cantidad: 1, motivo: 'x', fecha: fecha('2026-10-03'), cambiarPor: { varianteId: id('var-m'), articuloId: id('art-juego') } });
  assert.equal(misma.exito, false, 'talla igual');
  const otra = devolverEntrega(entrega, { cantidad: 1, motivo: 'x', fecha: fecha('2026-10-03'), cambiarPor: { varianteId: id('var-x'), articuloId: id('art-otro') } });
  assert.equal(otra.exito, false, 'pieza distinta');
});

// ================================================================ préstamo de utensilios

const PRESTAMO_DATOS: DatosDePrestamo = {
  sedeId: id('sede-la-paz'),
  varianteId: id('var-cuchillos'),
  cantidad: 2,
  estudianteId: id('est-luis'),
  fecha: fecha('2026-10-01'),
  devolverEl: fecha('2026-10-01'),
};

const PRESTAMO: Prestamo = { ...PRESTAMO_DATOS, id: id('pre-1'), devuelta: 0, perdida: 0 };

test('un préstamo va a exactamente uno: un alumno, un grupo u otra persona', () => {
  assert.equal(validarPrestamo(PRESTAMO_DATOS, CUCHILLOS).exito, true);
  assert.equal(validarPrestamo({ ...PRESTAMO_DATOS, estudianteId: undefined, cohorteId: id('coh-cocina') }, CUCHILLOS).exito, true);
  const docente = validarPrestamo({ ...PRESTAMO_DATOS, estudianteId: undefined, persona: '  Chef Oscar  ' }, CUCHILLOS);
  assert.ok(docente.exito);
  assert.equal(docente.valor.persona, 'Chef Oscar');

  assert.equal(validarPrestamo({ ...PRESTAMO_DATOS, estudianteId: undefined }, CUCHILLOS).exito, false, 'nadie');
  assert.equal(validarPrestamo({ ...PRESTAMO_DATOS, persona: '   ' , estudianteId: undefined }, CUCHILLOS).exito, false, 'nombre vacío');
  assert.equal(validarPrestamo({ ...PRESTAMO_DATOS, cohorteId: id('coh-cocina') }, CUCHILLOS).exito, false, 'dos a la vez');
});

test('solo se prestan utensilios, por piezas, y se devuelven después de prestarse', () => {
  assert.equal(validarPrestamo(PRESTAMO_DATOS, JUEGO).exito, false);
  assert.equal(validarPrestamo({ ...PRESTAMO_DATOS, cantidad: 0 }, CUCHILLOS).exito, false);
  assert.equal(validarPrestamo({ ...PRESTAMO_DATOS, devolverEl: fecha('2026-09-30') }, CUCHILLOS).exito, false);
  const m = movimientoDePrestamo(PRESTAMO);
  assert.ok(m.exito);
  assert.deepEqual([m.valor.tipo, m.valor.cantidad, m.valor.prestamoId], ['prestamo', 2000n, 'pre-1']);
});

test('recibir: lo que vuelve regresa al estante y lo que no, es baja desde lo prestado', () => {
  const recibido = recibirPrestamo(PRESTAMO, {
    devueltos: 1,
    perdidos: 1,
    motivo: 'perdida',
    detalle: 'No lo encontró',
    fecha: fecha('2026-10-02'),
  });
  assert.ok(recibido.exito);
  assert.deepEqual(
    recibido.valor.movimientos.map((m) => [m.tipo, m.cantidad, m.desdePrestado ?? false, m.motivoBaja]),
    [
      ['devolucion_prestamo', 1000n, false, undefined],
      ['baja', 1000n, true, 'perdida'],
    ],
  );
  assert.equal(recibido.valor.cerrado, true);
  assert.equal(pendienteDePrestamo(recibido.valor.prestamo), 0);
  for (const m of recibido.valor.movimientos) assert.equal(validarMovimiento(m, CUCHILLOS).exito, true, m.tipo);
});

test('recibir en partes deja el préstamo abierto; no se recibe más de lo que está fuera', () => {
  const parcial = recibirPrestamo(PRESTAMO, { devueltos: 1, perdidos: 0, fecha: fecha('2026-10-02') });
  assert.ok(parcial.exito);
  assert.equal(parcial.valor.cerrado, false);
  assert.equal(recibirPrestamo(PRESTAMO, { devueltos: 2, perdidos: 1, motivo: 'rotura', detalle: 'x', fecha: fecha('2026-10-02') }).exito, false);
  assert.equal(recibirPrestamo(PRESTAMO, { devueltos: 0, perdidos: 0, fecha: fecha('2026-10-02') }).exito, false);
  assert.equal(recibirPrestamo(PRESTAMO, { devueltos: 0, perdidos: 1, fecha: fecha('2026-10-02') }).exito, false, 'falta el motivo');
  assert.equal(recibirPrestamo({ ...PRESTAMO, devuelta: 2 }, { devueltos: 1, perdidos: 0, fecha: fecha('2026-10-02') }).exito, false, 'cerrado');
});

test('atraso: venció ayer y sigue fuera', () => {
  assert.equal(estaAtrasado(PRESTAMO, fecha('2026-10-01')), false, 'vence hoy');
  assert.equal(estaAtrasado(PRESTAMO, fecha('2026-10-02')), true);
  assert.equal(diasDeAtraso(PRESTAMO, fecha('2026-10-04')), 3);
  assert.equal(diasDeAtraso({ ...PRESTAMO, devuelta: 2 }, fecha('2026-10-04')), 0);
});
