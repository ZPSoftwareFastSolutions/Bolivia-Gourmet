/**
 * Pruebas de la caja y de la contabilidad básica (especificación §2.4, §5.7,
 * §5.8 ejemplos 8 y 9, §6.12–6.14; enmiendas B.12 y B.13).
 *
 * QUÉ SE PRUEBA. Cargos (estado, vencido, atraso, retiro); aplicación de un
 * cobro del más antiguo al más nuevo o según lo indicado, sin anticipos;
 * número de operación obligatorio y no repetido en QR y transferencia; el
 * arqueo (esperado, diferencia, lo que queda) con la anulación tardía de
 * §5.8-9; el monto en letras del recibo; el resultado y el dinero del mes
 * con el seguimiento de §5.7.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { calcularArqueo, describirDiferencia, totalesDeCaja, type RegistroDeCaja } from '../src/core/domain/caja/arqueo.ts';
import {
  cuotasQueSeAnulanAlRetirar,
  diasDeAtraso,
  estadoDeCargo,
  estaVencido,
  pendienteDeCargo,
  validarAnulacionDeCargo,
  validarCargo,
  type DatosDeCargo,
  type SaldoDeCargo,
} from '../src/core/domain/caja/cargo.ts';
import {
  aplicarCobro,
  claveDeReferencia,
  esReferenciaRepetida,
  formatearRecibo,
  validarCobro,
  type CargoPorCobrar,
} from '../src/core/domain/caja/cobro.ts';
import { enteroEnLetras, montoEnLetras } from '../src/core/domain/caja/monto-en-letras.ts';
import {
  costoDeLoUsado,
  cuadreDelInventario,
  diferenciasDeCaja,
  flujoDelMes,
  ingresosDelMes,
  resultadoDelMes,
  totalesDeDineroDelMes,
  type DocumentoDeDinero,
} from '../src/core/domain/contabilidad/resumen.ts';
import { formatearMonto } from '../src/core/domain/shared/dinero.ts';
import type { Centavos, FechaISO, Id } from '../src/core/domain/shared/tipos-base.ts';

const id = (valor: string) => valor as Id;
const fecha = (valor: string) => valor as FechaISO;
const c = (valor: number) => valor as Centavos;
const bs = (bolivianos: number) => Math.round(bolivianos * 100) as Centavos;

const HOY = fecha('2026-10-02');

// ================================================================ cargos

const CUOTA_DIEGO: DatosDeCargo = {
  estudianteId: id('est-diego'),
  inscripcionId: id('ins-diego'),
  conceptoId: id('colegiatura-carrera'),
  descripcion: 'Paquete Económico · Gastronomía 1.er año 2026',
  monto: bs(650),
  fecha: fecha('2026-09-20'),
  venceEl: fecha('2026-09-20'),
  sedeId: id('sede-la-paz'),
  origen: 'plan',
  planId: id('plan-1'),
  numeroDeCuota: 1,
};

test('validarCargo: de un alumno o de un cliente de fuera, y una cuota con su plan y número', () => {
  assert.equal(validarCargo(CUOTA_DIEGO).exito, true);
  assert.equal(validarCargo({ ...CUOTA_DIEGO, cliente: 'Visitante' }).exito, false, 'los dos');
  const venta = validarCargo({
    cliente: '  Señora de la feria ',
    conceptoId: id('otro-ingreso'),
    descripcion: 'Venta de queque',
    monto: bs(30),
    fecha: HOY,
    venceEl: HOY,
    sedeId: id('sede-la-paz'),
    origen: 'venta_directa',
  });
  assert.ok(venta.exito);
  assert.equal(venta.valor.cliente, 'Señora de la feria');
  assert.equal(validarCargo({ ...CUOTA_DIEGO, planId: undefined }).exito, false);
  assert.equal(validarCargo({ ...CUOTA_DIEGO, origen: 'manual' }).exito, false, 'plan y número solo en cuotas');
  assert.equal(validarCargo({ ...CUOTA_DIEGO, origen: 'entrega', planId: undefined, numeroDeCuota: undefined }).exito, false, 'falta la entrega');
  const malo = validarCargo({ ...CUOTA_DIEGO, monto: c(0), descripcion: ' ', fecha: fecha('x') });
  assert.ok(!malo.exito && malo.error.length === 3);
});

test('saldo de un cargo: pendiente, parcial, pagado o anulado', () => {
  const cargo: SaldoDeCargo = { monto: bs(650), aplicado: c(0), venceEl: fecha('2026-09-20'), anulado: false };
  assert.equal(estadoDeCargo(cargo), 'pendiente');
  const andrea = { ...cargo, aplicado: bs(300) };
  assert.equal(estadoDeCargo(andrea), 'parcial');
  assert.equal(pendienteDeCargo(andrea), bs(350));
  assert.equal(estadoDeCargo({ ...cargo, aplicado: bs(650) }), 'pagado');
  assert.equal(pendienteDeCargo({ ...cargo, anulado: true }), 0);
  assert.equal(estadoDeCargo({ ...cargo, anulado: true }), 'anulado');
});

test('la cuota de Diego venció hace 12 días; la pagada no está vencida', () => {
  const cargo: SaldoDeCargo = { monto: bs(650), aplicado: c(0), venceEl: fecha('2026-09-20'), anulado: false };
  assert.equal(estaVencido(cargo, HOY), true);
  assert.equal(diasDeAtraso(cargo, HOY), 12);
  assert.equal(estaVencido(cargo, fecha('2026-09-20')), false, 'vence hoy: aún no');
  assert.equal(estaVencido({ ...cargo, aplicado: bs(650) }, HOY), false);
  assert.equal(diasDeAtraso({ ...cargo, aplicado: bs(650) }, HOY), 0);
});

test('B.12 (crítica 15): al retirar se anulan las cuotas futuras sin cobros; las vencidas quedan', () => {
  const cargos = [
    { nombre: 'vencida', origen: 'plan' as const, monto: bs(100), aplicado: c(0), venceEl: fecha('2026-09-01'), anulado: false },
    { nombre: 'futura', origen: 'plan' as const, monto: bs(100), aplicado: c(0), venceEl: fecha('2026-11-01'), anulado: false },
    { nombre: 'futura con cobro', origen: 'plan' as const, monto: bs(100), aplicado: bs(20), venceEl: fecha('2026-12-01'), anulado: false },
    { nombre: 'uniforme', origen: 'entrega' as const, monto: bs(650), aplicado: c(0), venceEl: fecha('2026-11-01'), anulado: false },
  ];
  assert.deepEqual(cuotasQueSeAnulanAlRetirar(cargos, HOY).map((x) => x.nombre), ['futura']);
});

test('un cargo con cobros no se anula; sin cobros, con motivo', () => {
  const cargo: SaldoDeCargo = { monto: bs(650), aplicado: c(0), venceEl: HOY, anulado: false };
  assert.equal(validarAnulacionDeCargo(cargo, 'Se cargó dos veces').exito, true);
  assert.equal(validarAnulacionDeCargo(cargo, ' ').exito, false);
  assert.equal(validarAnulacionDeCargo({ ...cargo, aplicado: bs(100) }, 'x').exito, false, 'cargo_con_cobros');
});

// ================================================================ §5.8-8 cobros

const DEUDAS_DE_DIEGO: readonly CargoPorCobrar[] = [
  // Desordenados a propósito.
  { id: id('uniforme'), estudianteId: id('est-diego'), venceEl: fecha('2026-10-02'), registradoEn: '2026-10-02T10:00:00Z', monto: bs(650), aplicado: c(0), anulado: false },
  { id: id('reposicion'), estudianteId: id('est-diego'), venceEl: fecha('2026-09-20'), registradoEn: '2026-09-25T09:00:00Z', monto: bs(100), aplicado: c(0), anulado: false },
  { id: id('cuota'), estudianteId: id('est-diego'), venceEl: fecha('2026-09-20'), registradoEn: '2026-02-01T09:00:00Z', monto: bs(650), aplicado: c(0), anulado: false },
  { id: id('anulado'), estudianteId: id('est-diego'), venceEl: fecha('2026-01-01'), registradoEn: '2026-01-01T09:00:00Z', monto: bs(50), aplicado: c(0), anulado: true },
  { id: id('pagado'), estudianteId: id('est-diego'), venceEl: fecha('2026-02-01'), registradoEn: '2026-01-01T09:00:00Z', monto: bs(50), aplicado: bs(50), anulado: false },
];

test('§5.8-8 sin indicar cargos, el cobro se aplica del más antiguo al más nuevo (vencimiento y registro)', () => {
  const aplicado = aplicarCobro(bs(700), DEUDAS_DE_DIEGO, { estudianteId: id('est-diego') });
  assert.deepEqual(aplicado, {
    exito: true,
    valor: [
      { cargoId: 'cuota', monto: bs(650) },
      { cargoId: 'reposicion', monto: bs(50) },
    ],
  });
  const todo = aplicarCobro(bs(1400), DEUDAS_DE_DIEGO, { estudianteId: id('est-diego') });
  assert.ok(todo.exito);
  assert.deepEqual(todo.valor.map((a) => a.cargoId), ['cuota', 'reposicion', 'uniforme']);
});

test('§5.8-8 sin anticipos: cobrar más de lo que se debe es aplicacion_excede_saldo', () => {
  const resultado = aplicarCobro(bs(1500), DEUDAS_DE_DIEGO, { estudianteId: id('est-diego') });
  assert.ok(!resultado.exito);
  assert.equal(resultado.error[0]?.codigo, 'aplicacion_excede_saldo');
  assert.equal(resultado.error[0]?.pendiente, bs(1400));
  const nada = aplicarCobro(bs(10), [], {});
  assert.ok(!nada.exito && nada.error[0]?.codigo === 'cobro_sin_aplicar');
});

test('§5.8-8 con cargos indicados: se respeta lo indicado y nada supera lo pendiente', () => {
  const opciones = (aplicaciones: { cargoId: Id; monto: Centavos }[]) => ({ estudianteId: id('est-diego'), aplicaciones });
  assert.deepEqual(aplicarCobro(bs(650), DEUDAS_DE_DIEGO, opciones([{ cargoId: id('uniforme'), monto: bs(650) }])), {
    exito: true,
    valor: [{ cargoId: 'uniforme', monto: bs(650) }],
  });

  const excede = aplicarCobro(bs(700), DEUDAS_DE_DIEGO, opciones([{ cargoId: id('uniforme'), monto: bs(700) }]));
  assert.ok(!excede.exito && excede.error[0]?.codigo === 'aplicacion_excede_saldo' && excede.error[0].pendiente === bs(650));

  const noSuma = aplicarCobro(bs(700), DEUDAS_DE_DIEGO, opciones([{ cargoId: id('uniforme'), monto: bs(650) }]));
  assert.ok(!noSuma.exito && noSuma.error[0]?.codigo === 'cobro_sin_aplicar');

  const ajeno = aplicarCobro(bs(10), DEUDAS_DE_DIEGO, { estudianteId: id('est-marco'), aplicaciones: [{ cargoId: id('cuota'), monto: bs(10) }] });
  assert.ok(!ajeno.exito && ajeno.error[0]?.codigo === 'cargo_de_otro_alumno');

  const anulado = aplicarCobro(bs(10), DEUDAS_DE_DIEGO, opciones([{ cargoId: id('anulado'), monto: bs(10) }]));
  assert.ok(!anulado.exito && anulado.error[0]?.codigo === 'cargo_anulado');

  const repetido = aplicarCobro(bs(20), DEUDAS_DE_DIEGO, opciones([
    { cargoId: id('cuota'), monto: bs(10) },
    { cargoId: id('cuota'), monto: bs(10) },
  ]));
  assert.ok(!repetido.exito && repetido.error.some((e) => e.codigo === 'aplicacion_repetida'));
});

test('§5.8-8 el número de operación: obligatorio en QR y transferencia, no se repite por medio', () => {
  const sinReferencia = validarCobro({ monto: bs(650), medio: 'qr' });
  assert.ok(!sinReferencia.exito && sinReferencia.error[0]?.codigo === 'referencia_requerida');
  assert.equal(validarCobro({ monto: bs(650), medio: 'transferencia', referencia: '  ' }).exito, false);

  const qr = validarCobro({ monto: bs(650), medio: 'qr', referencia: '  OP-123456 ', nota: '' });
  assert.deepEqual(qr, { exito: true, valor: { monto: bs(650), medio: 'qr', referencia: 'OP-123456', nota: undefined } });

  const efectivo = validarCobro({ monto: bs(650), medio: 'efectivo', referencia: 'no aplica' });
  assert.ok(efectivo.exito);
  assert.equal(efectivo.valor.referencia, undefined, 'en efectivo no se guarda número de operación');

  assert.equal(claveDeReferencia('qr', ' op-123456 '), 'qr:OP-123456');
  const vigentes = [{ medio: 'qr' as const, referencia: 'OP-123456' }];
  assert.equal(esReferenciaRepetida('qr', 'op-123456', vigentes), true, 'referencia_repetida');
  assert.equal(esReferenciaRepetida('transferencia', 'op-123456', vigentes), false, 'otro medio');

  const todo = validarCobro({ monto: c(0), medio: 'cheque' as never });
  assert.ok(!todo.exito && todo.error.length === 2, 'monto y medio');
});

test('el recibo se numera por sede y año: «LP-2026-000123»', () => {
  assert.equal(formatearRecibo('la-paz', 2026, 123), 'LP-2026-000123');
  assert.equal(formatearRecibo('el-alto', 2027, 1), 'EA-2027-000001');
});

// ================================================================ arqueo

test('§6.14 arqueo: esperado, diferencia y lo que queda para el cambio', () => {
  const datos = { saldoInicial: bs(200), entradasEfectivo: bs(1300), salidasEfectivo: bs(150), contado: bs(1350), retiro: bs(1150) };
  const cuadra = calcularArqueo(datos);
  assert.deepEqual(cuadra, { exito: true, valor: { esperado: bs(1350), diferencia: 0, queda: bs(200), cuadra: true, observacion: undefined } });
  assert.equal(describirDiferencia(c(0)), '¡La caja cuadra!');

  const falta = calcularArqueo({ ...datos, contado: bs(1345), retiro: bs(1145) });
  assert.ok(!falta.exito && falta.error[0]?.codigo === 'observacion_requerida');
  const explicado = calcularArqueo({ ...datos, contado: bs(1345), retiro: bs(1145), observacion: '(demo) vuelto mal dado' });
  assert.ok(explicado.exito);
  assert.equal(explicado.valor.diferencia, -500);
  assert.equal(describirDiferencia(explicado.valor.diferencia), 'Faltan Bs 5,00');
  assert.equal(describirDiferencia(c(250)), 'Sobran Bs 2,50');
});

test('arqueo: no se retira más de lo contado y no se arquea la nada', () => {
  const datos = { saldoInicial: bs(200), entradasEfectivo: bs(0), salidasEfectivo: bs(0), contado: bs(200), retiro: bs(201) };
  const retiro = calcularArqueo(datos);
  assert.ok(!retiro.exito && retiro.error[0]?.codigo === 'retiro_excede');
  const nada = calcularArqueo({ ...datos, retiro: c(0), registros: 0 });
  assert.ok(!nada.exito && nada.error[0]?.codigo === 'nada_que_arquear');
  assert.equal(calcularArqueo({ ...datos, contado: c(-1) }).exito, false);
});

test('lo que hay por arquear: cobros en efectivo entran; gastos y compras salen; las anulaciones al revés', () => {
  const registros: RegistroDeCaja[] = [
    { clase: 'cobro', medio: 'efectivo', monto: bs(650), sinArquear: true, anulacionSinArquear: false },
    { clase: 'cobro', medio: 'efectivo', monto: bs(650), sinArquear: true, anulacionSinArquear: false },
    { clase: 'gasto', medio: 'efectivo', monto: bs(150), sinArquear: true, anulacionSinArquear: false },
    { clase: 'compra', medio: 'efectivo', monto: bs(350), sinArquear: false, anulacionSinArquear: true },
    { clase: 'cobro', medio: 'qr', monto: bs(650), sinArquear: true, anulacionSinArquear: false },
    { clase: 'gasto', medio: 'transferencia', monto: bs(900), sinArquear: true, anulacionSinArquear: false },
    { clase: 'cobro', medio: 'efectivo', monto: bs(10), sinArquear: false, anulacionSinArquear: false },
  ];
  assert.deepEqual(totalesDeCaja(registros), {
    entradasEfectivo: bs(1300 + 350),
    salidasEfectivo: bs(150),
    cobrosQr: bs(650),
    cobrosTransferencia: c(0),
    registros: 6,
  });
});

// ================================================================ §5.8-9 anulación tardía

test('§5.8-9 anulación tardía: el arqueo 42 la cuenta como salida; octubre baja Bs 650 y septiembre no cambia', () => {
  // Cobro en efectivo del 30/09, contado en el arqueo 41; anulado el 02/10.
  const cobro = { clase: 'cobro' as const, medio: 'efectivo' as const, monto: bs(650) };
  const caja42 = totalesDeCaja([{ ...cobro, sinArquear: false, anulacionSinArquear: true }]);
  assert.deepEqual([caja42.entradasEfectivo, caja42.salidasEfectivo, caja42.registros], [0, bs(650), 1]);
  const arqueo42 = calcularArqueo({
    saldoInicial: bs(850), // lo que quedó en el arqueo 41
    entradasEfectivo: caja42.entradasEfectivo,
    salidasEfectivo: caja42.salidasEfectivo,
    contado: bs(200),
    retiro: c(0),
    registros: caja42.registros,
  });
  assert.ok(arqueo42.exito && arqueo42.valor.cuadra);

  const documentos: DocumentoDeDinero[] = [{ ...cobro, fecha: fecha('2026-09-30'), anuladoEl: fecha('2026-10-02') }];
  const septiembre = flujoDelMes(totalesDeDineroDelMes('2026-09', documentos));
  const octubre = flujoDelMes(totalesDeDineroDelMes('2026-10', documentos));
  assert.equal(septiembre.entro, bs(650), 'septiembre intacto');
  assert.equal(octubre.entro, -bs(650), 'octubre −650');
  assert.equal(octubre.porMedio.efectivo.neto, -bs(650));

  // El ingreso no cambia (el cargo sigue vigente); si además se anula el cargo, baja octubre.
  const cargo = { monto: bs(650), fecha: fecha('2026-09-30') };
  assert.deepEqual(ingresosDelMes('2026-10', [cargo]), { ingresos: 0, ingresosAnulados: 0 });
  assert.deepEqual(ingresosDelMes('2026-10', [{ ...cargo, anuladoEl: fecha('2026-10-02') }]), { ingresos: 0, ingresosAnulados: bs(650) });
  assert.deepEqual(ingresosDelMes('2026-09', [{ ...cargo, anuladoEl: fecha('2026-10-02') }]), { ingresos: bs(650), ingresosAnulados: 0 });
});

// ================================================================ monto en letras

test('montoEnLetras: los casos del recibo', () => {
  assert.equal(montoEnLetras(bs(0)), 'cero 00/100 bolivianos');
  assert.equal(montoEnLetras(bs(1)), 'uno 00/100 bolivianos');
  assert.equal(montoEnLetras(bs(21)), 'veintiuno 00/100 bolivianos');
  assert.equal(montoEnLetras(bs(100)), 'cien 00/100 bolivianos');
  assert.equal(montoEnLetras(bs(650)), 'seiscientos cincuenta 00/100 bolivianos');
  assert.equal(montoEnLetras(bs(1250.5)), 'mil doscientos cincuenta 50/100 bolivianos');
  assert.equal(montoEnLetras(bs(1_000_000)), 'un millón 00/100 bolivianos');
  assert.equal(montoEnLetras(c(5)), 'cero 05/100 bolivianos');
});

test('enteroEnLetras: apócopes, «cien»/«ciento», tildes y millones', () => {
  const casos: [number, string][] = [
    [16, 'dieciséis'],
    [22, 'veintidós'],
    [31, 'treinta y uno'],
    [101, 'ciento uno'],
    [115, 'ciento quince'],
    [500, 'quinientos'],
    [1001, 'mil uno'],
    [2026, 'dos mil veintiséis'],
    [21_000, 'veintiún mil'],
    [31_000, 'treinta y un mil'],
    [100_000, 'cien mil'],
    [101_000, 'ciento un mil'],
    [999_999, 'novecientos noventa y nueve mil novecientos noventa y nueve'],
    [2_000_000, 'dos millones'],
    [21_000_001, 'veintiún millones uno'],
    [1_001_000_000, 'mil un millones'],
  ];
  for (const [n, letras] of casos) assert.equal(enteroEnLetras(n), letras, String(n));
  assert.throws(() => montoEnLetras(c(-1)), RangeError);
  assert.throws(() => montoEnLetras(c(1.5)), RangeError);
});

// ================================================================ resumen del mes (§5.7)

test('§5.7 seguimiento completo: resultado del mes y dinero del mes', () => {
  // Compra de harina al contado Bs 350 · uso de 30 kg (Bs 206) · cuota de Diego Bs 650 ·
  // entrega de su juego M con cargo (Bs 650, costo Bs 320) · cobro por QR del uniforme ·
  // luz en efectivo Bs 180 · baja de una tabla rota (Bs 45) · préstamo de 10 cuchillos ·
  // arqueo con faltante de Bs 5.
  const costo = costoDeLoUsado([
    { tipo: 'compra', deltaValor: bs(350) },
    { tipo: 'consumo', deltaValor: c(-20_600) },
    { tipo: 'entrega', deltaValor: c(-32_000) },
    { tipo: 'baja', deltaValor: c(-4500) },
    { tipo: 'prestamo', deltaValor: c(0) },
  ]);
  assert.equal(costo, bs(571));

  const resultado = resultadoDelMes({
    ingresos: bs(1300),
    ingresosAnulados: c(0),
    costoDeLoUsado: costo,
    gastos: bs(180),
    gastosAnulados: c(0),
    diferenciasDeArqueos: [c(-500)],
  });
  assert.deepEqual(resultado, {
    ingresos: bs(1300),
    costoDeLoUsado: bs(571),
    gastos: bs(180),
    diferenciasDeCaja: bs(5),
    resultado: bs(544),
    clase: 'ganancia',
  });

  const flujo = flujoDelMes(
    {
      efectivo: { cobros: c(0), cobrosAnulados: c(0), gastos: bs(180), gastosAnulados: c(0), compras: bs(350), comprasAnuladas: c(0) },
      qr: { cobros: bs(650), cobrosAnulados: c(0), gastos: c(0), gastosAnulados: c(0), compras: c(0), comprasAnuladas: c(0) },
    },
    [c(-500)],
  );
  assert.deepEqual([flujo.entro, flujo.salio, flujo.diferenciasDeCaja, flujo.neto], [bs(650), bs(530), bs(5), bs(115)]);
  assert.deepEqual(flujo.porMedio.transferencia, { entro: 0, salio: 0, neto: 0 });
});

test('costo de lo usado: devoluciones, sobrantes y anulaciones de usos restan; compras y sus anulaciones no cuentan', () => {
  assert.equal(
    costoDeLoUsado([
      { tipo: 'consumo', deltaValor: c(-1000) },
      { tipo: 'anulacion', tipoAnulado: 'consumo', deltaValor: c(1000) },
      { tipo: 'entrega', deltaValor: c(-32_000) },
      { tipo: 'devolucion_entrega', deltaValor: c(32_000) },
      { tipo: 'ajuste_faltante', deltaValor: c(-340) },
      { tipo: 'ajuste_sobrante', deltaValor: c(360) },
      { tipo: 'saldo_inicial', deltaValor: c(5000) },
      { tipo: 'anulacion', tipoAnulado: 'compra', deltaValor: c(-35_000) },
    ]),
    -20,
  );
  assert.equal(costoDeLoUsado([]), 0);
});

test('una pérdida y un mes sin movimiento', () => {
  const perdida = resultadoDelMes({
    ingresos: c(0),
    ingresosAnulados: c(0),
    costoDeLoUsado: bs(45),
    gastos: bs(180),
    gastosAnulados: c(0),
    diferenciasDeArqueos: [c(250)],
  });
  assert.equal(perdida.resultado, -bs(222.5));
  assert.equal(perdida.clase, 'perdida');
  assert.equal(formatearMonto(perdida.resultado), '-Bs 222,50');
  const vacio = resultadoDelMes({ ingresos: c(0), ingresosAnulados: c(0), costoDeLoUsado: c(0), gastos: c(0), gastosAnulados: c(0), diferenciasDeArqueos: [] });
  assert.equal(vacio.clase, 'sin_resultado');
  assert.equal(diferenciasDeCaja([]), 0);
});

test('cuadre del inventario: valor al inicio + compras − costo de lo usado = valor al final', () => {
  const datos = {
    valorInicial: bs(1000),
    compras: bs(350),
    comprasAnuladas: c(0),
    saldosIniciales: c(0),
    saldosInicialesAnulados: c(0),
    costoDeLoUsado: bs(206),
    valorFinal: bs(1144),
  };
  assert.equal(cuadreDelInventario(datos), 0);
  assert.equal(cuadreDelInventario({ ...datos, valorFinal: bs(1143) }), -100);
});
