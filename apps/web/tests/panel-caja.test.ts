/**
 * Panel interno · Caja (rebanada R3): los casos de uso revisan la forma con
 * el dominio antes de llamar a la base y juntan todas las frases. Un puerto
 * falso registra si se llegó a llamar.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { anular, aplicacionesElegidas, cerrarCaja, cobrar, crearCargoManual, registrarGasto, revisarArqueo, totalDelCobro } from '../src/core/application/panel/caja/caja.usecase.ts';
import type { CajaPort } from '../src/core/application/ports/caja.port.ts';
import { exito, type Centavos, type Id } from '../src/core/domain/shared/tipos-base.ts';

function puertoFalso() {
  const llamadas: string[] = [];
  const ok = <T>(nombre: string, valor: T) => {
    llamadas.push(nombre);
    return Promise.resolve(exito(valor));
  };
  const puerto: CajaPort = {
    cuentaDeAlumno: () => ok('cuentaDeAlumno', null),
    deudores: () => ok('deudores', []),
    registrarCobro: (_c, d) => ok(`registrarCobro:${d.medio}:${d.referencia ?? ''}`, { pagoId: 'p' as Id, recibo: 'LP-2026-000001', monto: 1 as Centavos, saldoPendiente: 0 as Centavos, codigo: null, repetida: false }),
    recibo: () => ok('recibo', null),
    recibos: () => ok('recibos', []),
    cajaPorCerrar: () =>
      ok('cajaPorCerrar', {
        primerArqueo: false,
        saldoInicial: 0 as Centavos,
        entradasEfectivo: 0 as Centavos,
        salidasEfectivo: 0 as Centavos,
        esperado: 0 as Centavos,
        cobrosQr: 0 as Centavos,
        cobrosTransferencia: 0 as Centavos,
        registros: 0,
        ultimoCierreEn: null,
        salidas: [],
        digitales: [],
      }),
    cerrarCaja: () => ok('cerrarCaja', { numero: 1, esperado: 0 as Centavos, contado: 0 as Centavos, diferencia: 0 as Centavos, queda: 0 as Centavos }),
    arqueos: () => ok('arqueos', []),
    revisarArqueo: (_c, _id, nota) => ok(`revisarArqueo:${nota}`, { numero: 7 }),
    anular: () => ok('anular', undefined),
    crearCargo: () => ok('crearCargo', undefined),
    registrarGasto: () => ok('registrarGasto', { numero: 1 }),
    conceptos: () => ok('conceptos', []),
    generarCuotasDeGrupo: () => ok('generarCuotasDeGrupo', { inscripciones: 0, cuotas: 0 }),
  };
  return { puerto, llamadas };
}

const SEDE = 'sede' as Id;
const ALUMNO = 'alumno' as Id;

test('el total de un cobro suma los cargos elegidos y la venta', () => {
  assert.equal(totalDelCobro({ aplicaciones: [{ cargoId: 'a' as Id, monto: 30000 as Centavos }, { cargoId: 'b' as Id, monto: 5000 as Centavos }] }), 35000);
  assert.equal(totalDelCobro({ venta: { conceptoCodigo: 'otro-ingreso', descripcion: 'x', monto: 1200 as Centavos } }), 1200);
});

test('cobrar por QR o transferencia exige el número de operación; en efectivo no se guarda', async () => {
  const { puerto, llamadas } = puertoFalso();
  const aplicaciones = [{ cargoId: 'a' as Id, monto: 65000 as Centavos }];
  const sinNumero = await cobrar(puerto, 'k', { sedeId: SEDE, estudianteId: ALUMNO, medio: 'qr', aplicaciones });
  assert.equal(sinNumero.exito, false);
  assert.deepEqual(llamadas, []);
  assert.ok((await cobrar(puerto, 'k', { sedeId: SEDE, estudianteId: ALUMNO, medio: 'qr', referencia: ' 998877 ', aplicaciones })).exito);
  assert.ok((await cobrar(puerto, 'k', { sedeId: SEDE, estudianteId: ALUMNO, medio: 'efectivo', referencia: 'no-va', aplicaciones })).exito);
  assert.deepEqual(llamadas, ['registrarCobro:qr:998877', 'registrarCobro:efectivo:']);
});

test('un cobro sin nada elegido no llega a la base; una venta a alguien de fuera pide su nombre', async () => {
  const { puerto, llamadas } = puertoFalso();
  assert.equal((await cobrar(puerto, 'k', { sedeId: SEDE, estudianteId: ALUMNO, medio: 'efectivo', aplicaciones: [] })).exito, false);
  const venta = { conceptoCodigo: 'otro-ingreso', descripcion: 'Recetario', monto: 5000 as Centavos };
  assert.equal((await cobrar(puerto, 'k', { sedeId: SEDE, medio: 'efectivo', venta })).exito, false);
  assert.ok((await cobrar(puerto, 'k', { sedeId: SEDE, medio: 'efectivo', venta: { ...venta, cliente: 'Juan Pérez' } })).exito);
  assert.deepEqual(llamadas, ['registrarCobro:efectivo:']);
});

test('los cargos marcados no pueden pasar lo que se debe; los que quedan en 0 no se envían', () => {
  const r = aplicacionesElegidas([
    { cargoId: 'a' as Id, monto: 30000 as Centavos, pendiente: 30000 as Centavos },
    { cargoId: 'b' as Id, monto: 0 as Centavos, pendiente: 20000 as Centavos },
  ]);
  assert.ok(r.exito);
  if (r.exito) assert.deepEqual(r.valor, [{ cargoId: 'a', monto: 30000 }]);
  assert.equal(aplicacionesElegidas([{ cargoId: 'a' as Id, monto: 30001 as Centavos, pendiente: 30000 as Centavos }]).exito, false);
});

test('cerrar caja: si no cuadra con lo que se mostró, pide explicación; no se retira más de lo contado', async () => {
  const { puerto, llamadas } = puertoFalso();
  const base = { sedeId: SEDE, contado: 134500 as Centavos, retiro: 0 as Centavos };
  assert.equal((await cerrarCaja(puerto, 'k', base, 135000 as Centavos)).exito, false);
  assert.equal((await cerrarCaja(puerto, 'k', { ...base, contado: 135000 as Centavos, retiro: 200000 as Centavos }, 135000 as Centavos)).exito, false);
  assert.deepEqual(llamadas, []);
  assert.ok((await cerrarCaja(puerto, 'k', { ...base, observacion: 'Faltó cambio' }, 135000 as Centavos)).exito);
  assert.ok((await cerrarCaja(puerto, 'k', { ...base, contado: 135000 as Centavos, retiro: 100000 as Centavos }, 135000 as Centavos)).exito);
  assert.deepEqual(llamadas, ['cerrarCaja', 'cerrarCaja']);
});

test('revisar un arqueo exige una nota de 3 a 300 caracteres y la manda sin espacios sobrantes', async () => {
  const { puerto, llamadas } = puertoFalso();
  assert.equal((await revisarArqueo(puerto, 'k', 'c' as Id, '  ')).exito, false);
  assert.equal((await revisarArqueo(puerto, 'k', 'c' as Id, 'x'.repeat(301))).exito, false);
  assert.deepEqual(llamadas, []);
  const r = await revisarArqueo(puerto, 'k', 'c' as Id, '  Faltó cambio; se habló con Rosa  ');
  assert.ok(r.exito && r.valor.numero === 7);
  assert.deepEqual(llamadas, ['revisarArqueo:Faltó cambio; se habló con Rosa']);
});

test('anular exige motivo; cargo manual y gasto revisan su forma', async () => {
  const { puerto, llamadas } = puertoFalso();
  assert.equal((await anular(puerto, 'k', 'cobro', 'p' as Id, ' ')).exito, false);
  assert.equal((await crearCargoManual(puerto, 'k', { estudianteId: ALUMNO, conceptoId: 'c' as Id, descripcion: 'x', monto: 0 as Centavos })).exito, false);
  const gasto = { sedeId: SEDE, conceptoId: 'c' as Id, descripcion: 'Luz de septiembre', monto: 18000 as Centavos, comprobante: 'factura' as const };
  assert.equal((await registrarGasto(puerto, 'k', { ...gasto, medio: 'efectivo', fecha: '2026-09-30' }, '2026-10-02')).exito, false);
  assert.equal((await registrarGasto(puerto, 'k', { ...gasto, medio: 'transferencia' }, '2026-10-02')).exito, false);
  assert.deepEqual(llamadas, []);
  assert.ok((await anular(puerto, 'k', 'cobro', 'p' as Id, 'Se devolvió')).exito);
  assert.ok((await registrarGasto(puerto, 'k', { ...gasto, medio: 'efectivo' }, '2026-10-02')).exito);
  assert.deepEqual(llamadas, ['anular', 'registrarGasto']);
});
