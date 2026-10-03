/**
 * Panel interno · Inventario (rebanada R4): los casos de uso revisan la forma
 * con el dominio antes de llamar a la base y juntan todas las frases; las
 * cantidades viajan a la base como texto con punto y vuelven en milésimas.
 * Un puerto falso registra si se llegó a llamar y con qué.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  agregarTalla,
  anularDocumento,
  bajaPideExplicacion,
  crearArticulo,
  darDeBaja,
  hayDiferencia,
  registrarCompra,
  registrarConteo,
  registrarSaldoInicial,
  usarInsumos,
  devolverUniforme,
  entregarUniforme,
  prestarUtensilios,
  recibirDevolucion,
} from '../src/core/application/panel/inventario/inventario.usecase.ts';
import type { InventarioPort } from '../src/core/application/ports/inventario.port.ts';
import { cantidadParaLaBase, milesimasDe } from '../src/infrastructure/supabase/cantidades.ts';
import type { Milesimas } from '../src/core/domain/shared/cantidad.ts';
import { exito, type Centavos, type Id } from '../src/core/domain/shared/tipos-base.ts';

const m = (n: number) => BigInt(Math.round(n * 1000)) as Milesimas;
const SEDE = 'sede' as Id;
const HARINA = 'harina' as Id;

function puertoFalso() {
  const llamadas: string[] = [];
  const datos: unknown[] = [];
  const ok = <T>(nombre: string, valor: T, recibido?: unknown) => {
    llamadas.push(nombre);
    datos.push(recibido);
    return Promise.resolve(exito(valor));
  };
  const puerto: InventarioPort = {
    existencias: () => ok('existencias', []),
    fichaDeArticulo: () => ok('fichaDeArticulo', null),
    lotesConAlerta: () => ok('lotesConAlerta', []),
    kardex: () => ok('kardex', []),
    gruposParaUso: () => ok('gruposParaUso', []),
    variantesConMovimientos: () => ok('variantesConMovimientos', new Set<Id>()),
    guardarArticulo: (_c, d, v) => ok('guardarArticulo', { codigo: 'INS-0001' }, { d, v }),
    editarArticulo: (_i, c) => ok('editarArticulo', undefined, c),
    agregarVariante: (_a, e, o) => ok('agregarVariante', undefined, { e, o }),
    registrarSaldoInicial: (_c, _s, l) => ok('registrarSaldoInicial', undefined, l),
    registrarCompra: (_c, d) => ok('registrarCompra', undefined, d),
    usarInsumos: (_c, d) => ok('usarInsumos', undefined, d),
    darDeBaja: (_c, d) => ok('darDeBaja', undefined, d),
    registrarConteo: (_c, _s, l) => ok('registrarConteo', { diferencias: 1 }, l),
    anular: (_c, t, i, mo) => ok('anular', undefined, { t, i, mo }),
    entregas: () => ok('entregas', []),
    prestamosAbiertos: () => ok('prestamosAbiertos', []),
    sinUniforme: () => ok('sinUniforme', []),
    entregarUniforme: (_c, d) => ok('entregarUniforme', { codigo: 'BG-2026-0001', cargado: 65000 as Centavos, pagoId: null, recibo: null }, d),
    devolverUniforme: (_c, d) => ok('devolverUniforme', undefined, d),
    prestarUtensilios: (_c, d) => ok('prestarUtensilios', undefined, d),
    recibirDevolucion: (_c, l) => ok('recibirDevolucion', { perdidos: 0 }, l),
  };
  return { puerto, llamadas, datos };
}

test('las cantidades viajan a la base con punto y vuelven en milésimas exactas', () => {
  assert.equal(cantidadParaLaBase(m(2.5)), '2.5');
  assert.equal(cantidadParaLaBase(m(12)), '12');
  assert.equal(cantidadParaLaBase(m(0.333)), '0.333');
  assert.equal(cantidadParaLaBase(m(19.667)), '19.667');
  assert.equal(milesimasDe(0.333), 333n);
  assert.equal(milesimasDe(9.5), 9500n);
  assert.equal(milesimasDe('19.667'), 19667n);
  assert.equal(milesimasDe('-0.25'), -250n);
  assert.equal(milesimasDe(null), 0n);
});

test('alta de artículo: un insumo queda con la variante «Única»; las tallas solo en uniformes', async () => {
  const { puerto, llamadas, datos } = puertoFalso();
  const base = { nombre: '  Harina de trigo ', unidad: 'kg' as const, icono: 'trigo' as const, controlaVencimiento: true, stockMinimo: m(5) };
  const r = await crearArticulo(puerto, 'c', { ...base, tipo: 'insumo' }, ['S', 'M']);
  assert.ok(r.exito);
  assert.deepEqual((datos[0] as { v: string[] }).v, ['Única']);
  assert.equal((datos[0] as { d: { nombre: string } }).d.nombre, 'Harina de trigo');

  const uniforme = await crearArticulo(puerto, 'c', { ...base, tipo: 'uniforme', unidad: 'unidad', icono: 'chaqueta', controlaVencimiento: false, precioVenta: 65000 as Centavos }, ['S', 's']);
  assert.ok(!uniforme.exito);
  assert.match(uniforme.error.join(' '), /repetidas/);

  const enKilos = await crearArticulo(puerto, 'c', { ...base, tipo: 'utensilio', icono: 'cubiertos', controlaVencimiento: false }, []);
  assert.ok(!enKilos.exito);
  assert.equal(llamadas.length, 1);
});

test('agregar una talla que ya existe se rechaza sin llamar a la base', async () => {
  const { puerto, llamadas } = puertoFalso();
  const repetida = await agregarTalla(puerto, 'a' as Id, ['S', 'M'], ' m ');
  assert.ok(!repetida.exito);
  assert.match(repetida.error.join(' '), /ya existe/);
  const nueva = await agregarTalla(puerto, 'a' as Id, ['S', 'M'], 'XL');
  assert.ok(nueva.exito);
  assert.deepEqual(llamadas, ['agregarVariante']);
});

test('compra: QR sin número de operación no llega a la base; en efectivo la referencia no se guarda', async () => {
  const { puerto, llamadas, datos } = puertoFalso();
  const linea = { varianteId: HARINA, cantidad: m(25), costoTotal: 17000 as Centavos };
  const sinRef = await registrarCompra(puerto, 'c', { sedeId: SEDE, comprobante: 'factura', medio: 'qr', lineas: [linea] });
  assert.ok(!sinRef.exito);
  assert.equal(llamadas.length, 0);

  const efectivo = await registrarCompra(puerto, 'c', {
    sedeId: SEDE,
    comprobante: 'sin_comprobante',
    numeroComprobante: '123',
    medio: 'efectivo',
    referencia: 'OP-1',
    proveedor: '  Molino   El Trigal ',
    lineas: [linea],
  });
  assert.ok(efectivo.exito);
  const enviado = datos[0] as { referencia?: string; numeroComprobante?: string; proveedor?: string };
  assert.equal(enviado.referencia, undefined);
  assert.equal(enviado.numeroComprobante, undefined);
  assert.equal(enviado.proveedor, 'Molino El Trigal');
});

test('compra: sin líneas, con cantidades o montos en cero, junta todas las frases', async () => {
  const { puerto } = puertoFalso();
  const vacia = await registrarCompra(puerto, 'c', { sedeId: SEDE, comprobante: 'recibo', medio: 'efectivo', lineas: [] });
  assert.ok(!vacia.exito);
  const ceros = await registrarCompra(puerto, 'c', {
    sedeId: SEDE,
    comprobante: 'recibo',
    medio: 'efectivo',
    lineas: [{ varianteId: HARINA, cantidad: m(0), costoTotal: 0 as Centavos }],
  });
  assert.ok(!ceros.exito);
  assert.equal(ceros.error.length, 2);
});

test('usar en clase: la clase pide el grupo; «otro» pide para qué', async () => {
  const { puerto, llamadas } = puertoFalso();
  const lineas = [{ varianteId: HARINA, cantidad: m(2) }];
  const sinGrupo = await usarInsumos(puerto, 'c', { sedeId: SEDE, destino: 'clase', lineas });
  assert.ok(!sinGrupo.exito);
  const otro = await usarInsumos(puerto, 'c', { sedeId: SEDE, destino: 'otro', detalle: ' x ', lineas });
  assert.ok(!otro.exito);
  const practica = await usarInsumos(puerto, 'c', { sedeId: SEDE, destino: 'practica', lineas });
  assert.ok(practica.exito);
  assert.deepEqual(llamadas, ['usarInsumos']);
});

test('dar de baja: lo vencido pide el lote; lo demás, una frase', async () => {
  const { puerto, datos } = puertoFalso();
  assert.equal(bajaPideExplicacion('vencimiento'), false);
  assert.equal(bajaPideExplicacion('rotura'), true);
  const sinLote = await darDeBaja(puerto, 'c', { sedeId: SEDE, varianteId: HARINA, cantidad: m(2), motivo: 'vencimiento' });
  assert.ok(!sinLote.exito);
  const sinFrase = await darDeBaja(puerto, 'c', { sedeId: SEDE, varianteId: HARINA, cantidad: m(1), motivo: 'dano', loteId: 'l' as Id });
  assert.ok(!sinFrase.exito);
  const bien = await darDeBaja(puerto, 'c', { sedeId: SEDE, varianteId: HARINA, cantidad: m(1), motivo: 'dano', detalle: 'Se mojó el saco', loteId: 'l' as Id });
  assert.ok(bien.exito);
  assert.equal((datos[0] as { loteId?: Id }).loteId, undefined, 'el lote solo viaja en la baja por vencimiento');
});

test('conteo: cada diferencia pide su motivo y nombra el artículo', async () => {
  const { puerto, llamadas } = puertoFalso();
  assert.equal(hayDiferencia({ existenciaVista: m(10), contado: m(9.5) }), true);
  const sinMotivo = await registrarConteo(puerto, 'c', SEDE, [
    { varianteId: HARINA, nombre: 'Harina', existenciaVista: m(10), contado: m(9.5) },
    { varianteId: 'azucar' as Id, nombre: 'Azúcar', existenciaVista: m(3), contado: m(3) },
  ]);
  assert.ok(!sinMotivo.exito);
  assert.deepEqual(sinMotivo.error, ['Harina: escribe por qué no coincide.']);
  const bien = await registrarConteo(puerto, 'c', SEDE, [{ varianteId: HARINA, nombre: 'Harina', existenciaVista: m(10), contado: m(9.5), motivo: 'Merma del saco' }]);
  assert.ok(bien.exito);
  assert.deepEqual(llamadas, ['registrarConteo']);
});

test('saldo inicial y anulación revisan lo mínimo antes de llamar', async () => {
  const { puerto, llamadas } = puertoFalso();
  const repetido = await registrarSaldoInicial(puerto, 'c', SEDE, [
    { varianteId: HARINA, cantidad: m(2), valor: 2000 as Centavos },
    { varianteId: HARINA, cantidad: m(1), valor: 1100 as Centavos },
  ]);
  assert.ok(!repetido.exito);
  const motivoCorto = await anularDocumento(puerto, 'c', 'uso', 'op' as Id, ' x ');
  assert.ok(!motivoCorto.exito);
  const anulado = await anularDocumento(puerto, 'c', 'uso', 'op' as Id, 'Grupo equivocado');
  assert.ok(anulado.exito);
  assert.deepEqual(llamadas, ['anular']);
});

test('entregar uniforme: cobrar exige cargar; QR pide número de operación; piezas enteras', async () => {
  const { puerto, llamadas, datos } = puertoFalso();
  const base = { inscripcionId: 'i' as Id, sedeId: SEDE, contexto: 'inscripcion' as const, lineas: [{ varianteId: 'm' as Id, cantidad: 1 }] };
  const sinCargo = await entregarUniforme(puerto, 'c', { ...base, cargar: false, cobro: { medio: 'efectivo' } });
  assert.ok(!sinCargo.exito);
  const qr = await entregarUniforme(puerto, 'c', { ...base, cargar: true, cobro: { medio: 'qr' } });
  assert.ok(!qr.exito);
  const media = await entregarUniforme(puerto, 'c', { ...base, lineas: [{ varianteId: 'm' as Id, cantidad: 1.5 }], cargar: false });
  assert.ok(!media.exito);
  const efectivo = await entregarUniforme(puerto, 'c', { ...base, cargar: true, cobro: { medio: 'efectivo', referencia: 'X-1' } });
  assert.ok(efectivo.exito);
  assert.equal((datos[0] as { cobro?: { referencia?: string } }).cobro?.referencia, undefined, 'en efectivo no hay número de operación');
  assert.deepEqual(llamadas, ['entregarUniforme']);
});

test('devolver o cambiar la talla pide el motivo', async () => {
  const { puerto, llamadas } = puertoFalso();
  const sinMotivo = await devolverUniforme(puerto, 'c', { entregaId: 'e' as Id, cantidad: 1, motivo: ' ', cambiarPor: 's' as Id });
  assert.ok(!sinMotivo.exito);
  assert.match(sinMotivo.error.join(' '), /cambia de talla/);
  const bien = await devolverUniforme(puerto, 'c', { entregaId: 'e' as Id, cantidad: 1, motivo: 'Le queda grande', cambiarPor: 's' as Id });
  assert.ok(bien.exito);
  assert.deepEqual(llamadas, ['devolverUniforme']);
});

test('prestar: exactamente un destinatario; recibir: lo que falta pide qué pasó', async () => {
  const { puerto, llamadas } = puertoFalso();
  const lineas = [{ varianteId: 'cuchillo' as Id, cantidad: 2 }];
  const dos = await prestarUtensilios(puerto, 'c', { sedeId: SEDE, estudianteId: 'a' as Id, persona: 'Chef', lineas });
  assert.ok(!dos.exito);
  const ninguno = await prestarUtensilios(puerto, 'c', { sedeId: SEDE, persona: '   ', lineas });
  assert.ok(!ninguno.exito);
  const bien = await prestarUtensilios(puerto, 'c', { sedeId: SEDE, persona: ' Chef  Invitado ', lineas });
  assert.ok(bien.exito);

  const vacio = await recibirDevolucion(puerto, 'c', [{ prestamoId: 'p' as Id, nombre: 'Cuchillos', devueltos: 0, perdidos: 0 }]);
  assert.ok(!vacio.exito);
  const sinMotivo = await recibirDevolucion(puerto, 'c', [{ prestamoId: 'p' as Id, nombre: 'Cuchillos', devueltos: 1, perdidos: 1 }]);
  assert.ok(!sinMotivo.exito);
  assert.deepEqual(sinMotivo.error, ['Cuchillos: escribe qué pasó con lo que falta.']);
  const recibido = await recibirDevolucion(puerto, 'c', [
    { prestamoId: 'p' as Id, nombre: 'Cuchillos', devueltos: 1, perdidos: 1, motivo: 'No apareció' },
    { prestamoId: 'q' as Id, nombre: 'Bols', devueltos: 0, perdidos: 0 },
  ]);
  assert.ok(recibido.exito);
  assert.deepEqual(llamadas, ['prestarUtensilios', 'recibirDevolucion']);
});
