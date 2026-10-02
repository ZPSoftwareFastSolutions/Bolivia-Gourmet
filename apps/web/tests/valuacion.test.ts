/**
 * Pruebas de la valuación del inventario (especificación §5; enmiendas B.5,
 * B.6, B.12) y de las cantidades en milésimas.
 *
 * QUÉ SE PRUEBA. TODOS los ejemplos de §5.8 al centavo —son los mismos que
 * correrá la batería SQL contra `app.sacar`— y además: el faltante con lotes
 * vencidos (B.5), la aritmética exacta `3 × 0,350 / 2,100` (B.6), el lote
 * que vence hoy, varias capas, la devolución exacta, el préstamo que no
 * cambia el valor, la pérdida a promedio y el sobrante en PEPS y en promedio.
 *
 * Invariante que se comprueba en cada recorrido: la suma de las salidas es
 * EXACTAMENTE lo que se pagó.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ESCALA,
  formatearCantidad,
  parsearCantidad,
  redondearProporcion,
  unidades,
  type Milesimas,
} from '../src/core/domain/shared/cantidad.ts';
import {
  costoPromedio,
  entradaPeps,
  entradaPromedio,
  estaVencido,
  prestar,
  recibirPrestado,
  resumenDeLotes,
  salidaPeps,
  salidaPromedio,
  valorDeDevolucion,
  valorDeSobrantePeps,
  valorDeSobrantePromedio,
  type Lote,
  type SaldoPromedio,
} from '../src/core/domain/inventario/valuacion.ts';
import type { Centavos, FechaISO, Id } from '../src/core/domain/shared/tipos-base.ts';

const id = (valor: string) => valor as Id;
const fecha = (valor: string) => valor as FechaISO;
const c = (valor: number) => valor as Centavos;

/** «2,5» → 2500n. Falla la prueba si el texto no es una cantidad. */
function q(texto: string): Milesimas {
  const resultado = parsearCantidad(texto);
  assert.ok(resultado.exito, texto);
  return resultado.valor;
}

function lote(datos: { id: string; ingreso: string; secuencia: number; cantidad: string; valor: number; vence?: string }): Lote {
  return {
    id: id(datos.id),
    fechaIngreso: fecha(datos.ingreso),
    secuencia: datos.secuencia,
    venceEl: datos.vence ? fecha(datos.vence) : undefined,
    cantidadInicial: q(datos.cantidad),
    valorInicial: c(datos.valor),
    cantidadRestante: q(datos.cantidad),
    valorRestante: c(datos.valor),
  };
}

const HOY = fecha('2026-10-02');

/** Saca y devuelve [valor, lotes que quedan]; falla la prueba si no alcanza. */
function sacar(lotes: readonly Lote[], cantidad: string, opciones = {}): [number, readonly Lote[]] {
  const salida = salidaPeps(lotes, q(cantidad), HOY, opciones);
  assert.ok(salida.exito, `no alcanzó para ${cantidad}`);
  return [salida.valor.valor, salida.valor.lotes];
}

function restante(lotes: readonly Lote[], loteId: string): [bigint, number] {
  const l = lotes.find((x) => x.id === loteId);
  assert.ok(l, loteId);
  return [l.cantidadRestante, l.valorRestante];
}

// ================================================================ cantidades (B.6)

test('parsearCantidad lee coma o punto decimal y hasta 3 decimales', () => {
  assert.equal(q('2,5'), 2500n);
  assert.equal(q('2.5'), 2500n);
  assert.equal(q('12'), 12_000n);
  assert.equal(q('0,333'), 333n);
  assert.equal(q(' 19,667 '), 19_667n);
  assert.equal(q('0'), 0n);
});

test('parsearCantidad rechaza lo que no es una cantidad sin redondear en silencio', () => {
  for (const malo of ['', '  ', '-1', '1,2345', '1.250,5', 'dos', ',', '1 000']) {
    assert.equal(parsearCantidad(malo).exito, false, malo);
  }
});

test('formatearCantidad usa coma decimal, punto de miles y la unidad', () => {
  assert.equal(formatearCantidad(q('12,5'), 'kg'), '12,5 kg');
  assert.equal(formatearCantidad(q('20'), 'kg'), '20 kg');
  assert.equal(formatearCantidad(q('0,333'), 'kg'), '0,333 kg');
  assert.equal(formatearCantidad(q('1250'), 'unidad'), '1.250 unidades');
  assert.equal(formatearCantidad(q('1'), 'unidad'), '1 unidad');
  assert.equal(formatearCantidad(q('1'), 'paquete'), '1 paquete');
  assert.equal(formatearCantidad(-2500n, 'l'), '-2,5 l');
  assert.equal(formatearCantidad(q('9,5')), '9,5');
});

test('unidades: piezas enteras a milésimas', () => {
  assert.deepEqual(unidades(3), { exito: true, valor: 3000n });
  assert.equal(unidades(1.5).exito, false);
  assert.equal(unidades(-1).exito, false);
  assert.equal(ESCALA, 1000n);
});

test('B.6: 3 × 0,350 / 2,100 redondea a 1 con aritmética exacta (con coma flotante daba 0)', () => {
  assert.equal(Math.round((3 * 0.35) / 2.1), 0, 'el error que se evita');
  assert.equal(redondearProporcion(3n, q('0,350'), q('2,100')), 1n);
  // En un lote real: 2,100 kg que valen 3 c; salen 0,350 kg.
  const [valor] = sacar([lote({ id: 'L', ingreso: '2026-09-01', secuencia: 1, cantidad: '2,100', valor: 3 })], '0,350');
  assert.equal(valor, 1);
});

test('redondearProporcion: la mitad hacia arriba y nada más', () => {
  assert.equal(redondearProporcion(18_000n, 5000n, 25_000n), 3600n);
  assert.equal(redondearProporcion(667n, 1n, 2n), 334n, '333,5 → 334');
  assert.equal(redondearProporcion(1000n, 1n, 3n), 333n, '333,33 → 333');
  assert.equal(redondearProporcion(5n, 1n, 8n), 1n, '0,625 → 1');
  assert.equal(redondearProporcion(0n, 1n, 8n), 0n);
  assert.throws(() => redondearProporcion(1n, 1n, 0n), RangeError);
});

// ================================================================ §5.8 ejemplo 1: PEPS

const HARINA_A = lote({ id: 'A', ingreso: '2026-09-12', secuencia: 1, cantidad: '25', valor: 17_000 });
const HARINA_B = lote({ id: 'B', ingreso: '2026-09-27', secuencia: 2, cantidad: '25', valor: 18_000 });

test('§5.8-1 PEPS: la harina de §5.3 (20 600 c, 240 c y 14 160 c; suma 35 000 c)', () => {
  const primera = salidaPeps([HARINA_A, HARINA_B], q('30'), HOY);
  assert.ok(primera.exito);
  assert.equal(primera.valor.valor, 20_600);
  assert.deepEqual(
    primera.valor.detalle.map((d) => [d.loteId, d.cantidad, d.valor]),
    [
      ['A', 25_000n, 17_000],
      ['B', 5000n, 3600],
    ],
  );
  assert.deepEqual(restante(primera.valor.lotes, 'A'), [0n, 0]);
  assert.deepEqual(restante(primera.valor.lotes, 'B'), [20_000n, 14_400]);

  const [segunda, tras2] = sacar(primera.valor.lotes, '0,333');
  assert.equal(segunda, 240);
  assert.deepEqual(restante(tras2, 'B'), [19_667n, 14_160]);

  const [tercera, tras3] = sacar(tras2, '19,667');
  assert.equal(tercera, 14_160);
  assert.deepEqual(restante(tras3, 'B'), [0n, 0]);

  assert.equal(primera.valor.valor + segunda + tercera, 35_000, 'igual a lo pagado');
});

// ================================================================ §5.8 ejemplo 2: fracciones

test('§5.8-2 fracciones: 3 kg por Bs 10,00 usados de a 1 kg → 333 + 334 + 333 = 1 000 c', () => {
  let lotes: readonly Lote[] = [lote({ id: 'L', ingreso: '2026-09-01', secuencia: 1, cantidad: '3', valor: 1000 })];
  const valores: number[] = [];
  for (let i = 0; i < 3; i += 1) {
    const [valor, quedan] = sacar(lotes, '1');
    valores.push(valor);
    lotes = quedan;
  }
  assert.deepEqual(valores, [333, 334, 333]);
  assert.equal(valores.reduce((a, b) => a + b, 0), 1000);
  assert.deepEqual(restante(lotes, 'L'), [0n, 0]);
});

// ================================================================ §5.8 ejemplo 3: vencido saltado

const VENCIDO_A = lote({ id: 'A', ingreso: '2026-09-01', secuencia: 1, cantidad: '2', valor: 1400, vence: '2026-10-01' });
const VIGENTE_B = lote({ id: 'B', ingreso: '2026-09-20', secuencia: 2, cantidad: '1', valor: 800, vence: '2026-10-20' });

test('§5.8-3 vencido saltado: pedir 2 kg → stock_insuficiente con vencido = 2; pedir 1 kg → sale de B', () => {
  const dos = salidaPeps([VENCIDO_A, VIGENTE_B], q('2'), HOY);
  assert.equal(dos.exito, false);
  assert.ok(!dos.exito);
  const error = dos.error[0];
  assert.ok(error && error.codigo === 'stock_insuficiente');
  assert.deepEqual([error.disponible, error.pedido, error.vencido], [1000n, 2000n, 2000n]);
  assert.match(error.mensaje, /2 están vencidos/);

  const uno = salidaPeps([VENCIDO_A, VIGENTE_B], q('1'), HOY);
  assert.ok(uno.exito);
  assert.deepEqual(uno.valor.detalle.map((d) => [d.loteId, d.valor]), [['B', 800]]);
  assert.deepEqual(restante(uno.valor.lotes, 'A'), [2000n, 1400], 'lo vencido no se toca');
});

test('un lote que vence HOY todavía se usa (vencido = vence_el < hoy)', () => {
  const hoyMismo = lote({ id: 'H', ingreso: '2026-09-01', secuencia: 1, cantidad: '1', valor: 500, vence: '2026-10-02' });
  assert.equal(estaVencido(hoyMismo, HOY), false);
  assert.equal(estaVencido(hoyMismo, fecha('2026-10-03')), true);
  const [valor] = sacar([hoyMismo], '1');
  assert.equal(valor, 500);
});

// ================================================================ B.5: faltante y bajas con lotes vencidos

const VIGENTE_ANTIGUO = lote({ id: 'viejo', ingreso: '2026-09-01', secuencia: 1, cantidad: '5', valor: 3500, vence: '2026-12-01' });
const VENCIDO_NUEVO = lote({ id: 'nuevo', ingreso: '2026-09-20', secuencia: 2, cantidad: '2', valor: 1600, vence: '2026-09-30' });

test('B.5: el faltante consume PRIMERO lo vencido y después sigue el orden PEPS', () => {
  const faltante = salidaPeps([VIGENTE_ANTIGUO, VENCIDO_NUEVO], q('3'), HOY, { incluirVencidos: true });
  assert.ok(faltante.exito);
  assert.deepEqual(
    faltante.valor.detalle.map((d) => [d.loteId, d.cantidad, d.valor, d.vencido]),
    [
      ['nuevo', 2000n, 1600, true],
      ['viejo', 1000n, 700, false],
    ],
  );
  assert.equal(faltante.valor.valor, 2300);
});

test('B.5: el uso en clase con los mismos lotes no alcanza y dice cuánto hay vencido', () => {
  const uso = salidaPeps([VIGENTE_ANTIGUO, VENCIDO_NUEVO], q('6'), HOY);
  assert.ok(!uso.exito);
  const error = uso.error[0];
  assert.ok(error && error.codigo === 'stock_insuficiente');
  assert.deepEqual([error.disponible, error.pedido, error.vencido], [5000n, 6000n, 2000n]);
});

test('B.5: la leche con su único lote vencido: el faltante sale; el uso, no', () => {
  const leche = [lote({ id: 'leche', ingreso: '2026-09-18', secuencia: 1, cantidad: '3', valor: 3000, vence: '2026-10-01' })];
  const [valor] = sacar(leche, '1', { incluirVencidos: true });
  assert.equal(valor, 1000);
  const uso = salidaPeps(leche, q('1'), HOY);
  assert.ok(!uso.exito && uso.error[0]?.codigo === 'stock_insuficiente');
  assert.ok(!uso.exito && uso.error[0]?.codigo === 'stock_insuficiente' && uso.error[0].disponible === 0n && uso.error[0].vencido === 3000n);
});

test('baja por vencimiento: saca ESE lote; un lote ajeno se rechaza', () => {
  const lotes = [VIGENTE_ANTIGUO, VENCIDO_NUEVO];
  const baja = salidaPeps(lotes, q('2'), HOY, { loteElegido: id('nuevo'), incluirVencidos: true });
  assert.ok(baja.exito);
  assert.deepEqual(baja.valor.detalle.map((d) => [d.loteId, d.valor]), [['nuevo', 1600]]);
  assert.deepEqual(restante(baja.valor.lotes, 'viejo'), [5000n, 3500]);

  const ajeno = salidaPeps(lotes, q('1'), HOY, { loteElegido: id('otro') });
  assert.ok(!ajeno.exito && ajeno.error[0]?.codigo === 'lote_no_corresponde');

  // Elegir un lote vencido para usarlo en clase no lo vuelve usable.
  const usarVencido = salidaPeps(lotes, q('1'), HOY, { loteElegido: id('nuevo') });
  assert.ok(!usarVencido.exito && usarVencido.error[0]?.codigo === 'stock_insuficiente');
});

test('B.12 (crítica 16): el lote elegido en el uso sale aunque no sea el primero', () => {
  const [valor, quedan] = sacar([HARINA_A, HARINA_B], '5', { loteElegido: id('B') });
  assert.equal(valor, 3600);
  assert.deepEqual(restante(quedan, 'A'), [25_000n, 17_000]);
});

// ================================================================ varias capas y orden

test('varias capas: la salida cruza tres lotes en orden PEPS (fecha y, a igual fecha, secuencia)', () => {
  const lotes = [
    lote({ id: 'L3', ingreso: '2026-09-10', secuencia: 9, cantidad: '4', valor: 3000 }),
    lote({ id: 'L2', ingreso: '2026-09-05', secuencia: 7, cantidad: '2', valor: 1500 }),
    lote({ id: 'L1', ingreso: '2026-09-05', secuencia: 3, cantidad: '1', valor: 700 }),
  ];
  const salida = salidaPeps(lotes, q('5'), HOY);
  assert.ok(salida.exito);
  assert.deepEqual(
    salida.valor.detalle.map((d) => [d.loteId, d.cantidad, d.valor]),
    [
      ['L1', 1000n, 700],
      ['L2', 2000n, 1500],
      ['L3', 2000n, 1500],
    ],
  );
  assert.equal(salida.valor.valor, 3700);
  assert.deepEqual(salida.valor.lotes.map((l) => l.id), ['L3', 'L2', 'L1'], 'conserva el orden recibido');
  const resumen = resumenDeLotes(salida.valor.lotes, HOY);
  assert.deepEqual([resumen.cantidad, resumen.valor], [2000n, 1500]);
});

test('si no alcanza, no se toca nada', () => {
  const salida = salidaPeps([HARINA_A], q('25,001'), HOY);
  assert.ok(!salida.exito && salida.error[0]?.codigo === 'stock_insuficiente');
  assert.equal(salidaPeps([HARINA_A], q('0'), HOY).exito, false, 'cantidad cero');
});

test('entradaPeps crea el lote con cantidad y valor de la línea entera', () => {
  const resultado = entradaPeps([HARINA_A], {
    id: id('C'),
    fechaIngreso: HOY,
    secuencia: 3,
    venceEl: fecha('2027-01-01'),
    cantidad: q('10'),
    valor: c(6800),
  });
  assert.ok(resultado.exito);
  assert.equal(resultado.valor.length, 2);
  assert.deepEqual(restante(resultado.valor, 'C'), [10_000n, 6800]);
  assert.equal(entradaPeps([], { id: id('X'), fechaIngreso: HOY, secuencia: 1, cantidad: q('0'), valor: c(-1) }).exito, false);
  const errores = entradaPeps([], { id: id('X'), fechaIngreso: HOY, secuencia: 1, cantidad: q('0'), valor: c(-1) });
  assert.ok(!errores.exito && errores.error.length === 2, 'cantidad y valor');
});

test('resumen de lotes: existencia, valor y cuánto está vencido', () => {
  const resumen = resumenDeLotes([VIGENTE_ANTIGUO, VENCIDO_NUEVO], HOY);
  assert.deepEqual([resumen.cantidad, resumen.valor, resumen.vencido], [7000n, 5100, 2000n]);
});

// ================================================================ §5.8 ejemplo 4: promedio

const VACIO: SaldoPromedio = { disponible: 0n as Milesimas, prestado: 0n as Milesimas, valor: c(0) };

function entrar(saldo: SaldoPromedio, cantidad: string, valor: number): SaldoPromedio {
  const r = entradaPromedio(saldo, q(cantidad), c(valor));
  assert.ok(r.exito);
  return r.valor;
}

test('§5.8-4 promedio: juego M (10 por Bs 3.000 y 10 por Bs 3.400 → Bs 320; entrega a Bs 320)', () => {
  const juegoM = entrar(entrar(VACIO, '10', 300_000), '10', 340_000);
  assert.deepEqual(juegoM, { disponible: 20_000n, prestado: 0n, valor: 640_000 });
  assert.equal(costoPromedio(juegoM), 32_000);

  const entrega = salidaPromedio(juegoM, q('1'));
  assert.ok(entrega.exito);
  assert.equal(entrega.valor.valor, 32_000);
  assert.deepEqual(entrega.valor.saldo, { disponible: 19_000n, prestado: 0n, valor: 608_000 });
  assert.equal(65_000 - entrega.valor.valor, 33_000, 'margen de Bs 330 frente a los Bs 650');
});

test('§5.8-4 promedio: 3 juegos por Bs 100,00 entregados de a uno → 3 333 + 3 334 + 3 333 = 10 000 c', () => {
  let saldo = entrar(VACIO, '3', 10_000);
  const valores: number[] = [];
  for (let i = 0; i < 3; i += 1) {
    const salida = salidaPromedio(saldo, q('1'));
    assert.ok(salida.exito);
    valores.push(salida.valor.valor);
    saldo = salida.valor.saldo;
  }
  assert.deepEqual(valores, [3333, 3334, 3333]);
  assert.deepEqual(saldo, { disponible: 0n, prestado: 0n, valor: 0 }, 'total = 0 ⇒ valor = 0');
  assert.equal(costoPromedio(saldo), null);
});

test('promedio: no se saca más de lo que hay en el estante', () => {
  const r = salidaPromedio(entrar(VACIO, '2', 1000), q('3'));
  assert.ok(!r.exito && r.error[0]?.codigo === 'stock_insuficiente');
});

// ================================================================ §5.8 ejemplo 5: devolución

test('§5.8-5 devolución: entrega y devolución se anulan al centavo', () => {
  const juegoM = entrar(entrar(VACIO, '10', 300_000), '10', 340_000);
  const entrega = salidaPromedio(juegoM, q('1'));
  assert.ok(entrega.exito);

  const valor = valorDeDevolucion({ cantidad: q('1'), valor: entrega.valor.valor, devuelta: q('0'), valorDevuelto: c(0) }, q('1'));
  assert.deepEqual(valor, { exito: true, valor: 32_000 });
  assert.ok(valor.exito);
  assert.deepEqual(entrar(entrega.valor.saldo, '1', valor.valor), juegoM, 'vuelve exactamente al saldo anterior');
});

test('devolución en partes: al costo con que salió y la última pieza se lleva el resto exacto', () => {
  const entrega = { cantidad: q('3'), valor: c(10_000) };
  const valores: number[] = [];
  let devuelta = 0n;
  let valorDevuelto = 0;
  for (let i = 0; i < 3; i += 1) {
    const r = valorDeDevolucion({ ...entrega, devuelta: devuelta as Milesimas, valorDevuelto: c(valorDevuelto) }, q('1'));
    assert.ok(r.exito);
    valores.push(r.valor);
    devuelta += 1000n;
    valorDevuelto += r.valor;
  }
  assert.deepEqual(valores, [3333, 3333, 3334]);
  assert.equal(valorDevuelto, 10_000);

  const excede = valorDeDevolucion({ ...entrega, devuelta: q('2'), valorDevuelto: c(6666) }, q('2'));
  assert.ok(!excede.exito && excede.error[0]?.codigo === 'devolucion_excede');
});

test('devolución con piezas de valor ínfimo: nunca negativa y suma lo que salió', () => {
  const entrega = { cantidad: q('8'), valor: c(5) };
  const valores: number[] = [];
  let devuelta = 0n;
  let valorDevuelto = 0;
  for (let i = 0; i < 8; i += 1) {
    const r = valorDeDevolucion({ ...entrega, devuelta: devuelta as Milesimas, valorDevuelto: c(valorDevuelto) }, q('1'));
    assert.ok(r.exito);
    valores.push(r.valor);
    devuelta += 1000n;
    valorDevuelto += r.valor;
  }
  assert.ok(valores.every((v) => v >= 0), valores.join(','));
  assert.equal(valorDevuelto, 5);
});

// ================================================================ §5.8 ejemplo 6: préstamo

test('§5.8-6 préstamo: prestar no cambia el valor; perder 1 sí, a promedio', () => {
  const cuchillos = entrar(VACIO, '10', 45_000);

  const prestado = prestar(cuchillos, q('2'));
  assert.ok(prestado.exito);
  assert.deepEqual(prestado.valor, { disponible: 8000n, prestado: 2000n, valor: 45_000 }, 'custodia: mismo valor');

  const perdida = salidaPromedio(prestado.valor, q('1'), { desde: 'prestado' });
  assert.ok(perdida.exito);
  assert.equal(perdida.valor.valor, 4500, 'a promedio sobre disponible + prestado');
  assert.deepEqual(perdida.valor.saldo, { disponible: 8000n, prestado: 1000n, valor: 40_500 });

  const vuelve = recibirPrestado(perdida.valor.saldo, q('1'));
  assert.ok(vuelve.exito);
  assert.deepEqual(vuelve.valor, { disponible: 9000n, prestado: 0n, valor: 40_500 });

  assert.equal(prestar(cuchillos, q('11')).exito, false);
  assert.equal(recibirPrestado(vuelve.valor, q('1')).exito, false, 'no hay nada prestado');
  assert.equal(salidaPromedio(vuelve.valor, q('1'), { desde: 'prestado' }).exito, false);
});

// ================================================================ §5.8 ejemplo 7: conteo

test('§5.8-7 conteo: el faltante sale por PEPS (con lo vencido primero)', () => {
  const [faltante] = sacar([HARINA_A, HARINA_B], '0,5', { incluirVencidos: true });
  assert.equal(faltante, 340, 'del lote A: round(17 000 × 0,5 / 25)');
});

test('§5.8-7 conteo: el sobrante de un insumo entra al costo del último lote ingresado', () => {
  const agotados = [{ ...HARINA_B, cantidadRestante: 0n as Milesimas, valorRestante: c(0) }, HARINA_A];
  const sobrante = valorDeSobrantePeps(agotados, q('0,5'));
  assert.deepEqual(sobrante, { exito: true, valor: { valor: 360, origen: 'ultimo_lote' } }, 'round(18 000 × 0,5 / 25), aunque B esté agotado');

  const sinLotes = valorDeSobrantePeps([], q('0,5'));
  assert.ok(!sinLotes.exito && sinLotes.error[0]?.codigo === 'costo_requerido');
  assert.deepEqual(valorDeSobrantePeps([], q('0,5'), c(400)), { exito: true, valor: { valor: 400, origen: 'indicado' } });
  assert.deepEqual(valorDeSobrantePeps(agotados, q('0,5'), c(999)), { exito: true, valor: { valor: 360, origen: 'ultimo_lote' } }, 'el conteo no revaloriza');
});

test('crítica 24: el sobrante a costo promedio (vigente, última compra o el que escribe administración)', () => {
  const juegoM = entrar(VACIO, '19', 608_000);
  assert.deepEqual(valorDeSobrantePromedio(juegoM, q('1')), { exito: true, valor: { valor: 32_000, origen: 'promedio' } });

  const agotado = { ...VACIO };
  assert.deepEqual(valorDeSobrantePromedio(agotado, q('1'), { ultimaCompra: { cantidad: q('10'), valor: c(340_000) } }), {
    exito: true,
    valor: { valor: 34_000, origen: 'ultima_compra' },
  });

  const nunca = valorDeSobrantePromedio(agotado, q('1'));
  assert.ok(!nunca.exito && nunca.error[0]?.codigo === 'costo_requerido');
  assert.deepEqual(valorDeSobrantePromedio(agotado, q('1'), { valorIndicado: c(30_000) }), {
    exito: true,
    valor: { valor: 30_000, origen: 'indicado' },
  });
});

test('el sobrante entra al lote o a la capa y el faltante sale: el conteo cuadra', () => {
  // Promedio: 19 juegos por 608 000; sobra 1 → 20 por 640 000; falta 1 → 19 por 608 000.
  const juegoM = entrar(VACIO, '19', 608_000);
  const sobrante = valorDeSobrantePromedio(juegoM, q('1'));
  assert.ok(sobrante.exito);
  const conSobrante = entrar(juegoM, '1', sobrante.valor.valor);
  assert.deepEqual(conSobrante, { disponible: 20_000n, prestado: 0n, valor: 640_000 });
  const faltante = salidaPromedio(conSobrante, q('1'));
  assert.ok(faltante.exito);
  assert.deepEqual(faltante.valor.saldo, juegoM);
});
