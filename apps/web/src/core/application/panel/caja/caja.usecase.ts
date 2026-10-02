/**
 * CAPA: Application / Panel · Caja
 *
 * Casos de uso de la caja (enmiendas B.1): validan la forma con el dominio
 * (`validarCobro`, `calcularArqueo`) y llaman al puerto; la base decide lo
 * que depende de datos (lo pendiente de cada cargo, el número de recibo, lo
 * que hay por arquear). Devuelven todas las frases juntas.
 */

import { calcularArqueo } from '../../../domain/caja/arqueo';
import { exigeReferencia, validarCobro, type MedioDePago } from '../../../domain/caja/cobro';
import { exito, fallo, type Centavos, type Id, type Resultado } from '../../../domain/shared/tipos-base';
import type {
  CajaPort,
  CierreHecho,
  CobroHecho,
  DatosDeCargoManual,
  DatosDeCierre,
  DatosDeCobroNuevo,
  DatosDeGasto,
  TipoAnulable,
} from '../../ports/caja.port';

type Res<T> = Promise<Resultado<T, readonly string[]>>;

function comoLista<T>(r: Resultado<T>): Resultado<T, readonly string[]> {
  return r.exito ? r : fallo([r.error]);
}

/** El total de un cobro: lo aplicado a cargos más la venta directa. */
export function totalDelCobro(datos: Pick<DatosDeCobroNuevo, 'aplicaciones' | 'monto' | 'venta'>): number {
  const aplicado = (datos.aplicaciones ?? []).reduce((t, a) => t + a.monto, 0);
  return aplicado + (datos.monto ?? 0) + (datos.venta?.monto ?? 0);
}

/**
 * Cobrar (§6.12): alumno con cargos elegidos, o venta directa (a un alumno o
 * a alguien de fuera, con su nombre). Medio y número de operación como dice
 * el dominio.
 */
export async function cobrar(port: CajaPort, clave: string, datos: DatosDeCobroNuevo): Res<CobroHecho> {
  const errores: string[] = [];
  const aplicaciones = (datos.aplicaciones ?? []).filter((a) => a.monto > 0);
  if (aplicaciones.some((a) => !Number.isSafeInteger(a.monto))) errores.push('Revisa los montos: solo números con hasta dos decimales.');
  const total = totalDelCobro({ ...datos, aplicaciones });

  const forma = validarCobro({ monto: total as Centavos, medio: datos.medio, referencia: datos.referencia, nota: datos.nota });
  if (!forma.exito) errores.push(...forma.error.map((e) => (e.codigo === 'monto_invalido' ? 'Elige al menos un cargo para cobrar o escribe el monto.' : e.mensaje)));

  if (aplicaciones.length > 0 && !datos.estudianteId) errores.push('Elige al alumno.');
  if (datos.venta) {
    if (datos.venta.descripcion.trim().length < 3) errores.push('Escribe qué se vende.');
    if (!Number.isSafeInteger(datos.venta.monto) || datos.venta.monto <= 0) errores.push('Escribe el monto de la venta.');
    if (!datos.estudianteId && (datos.venta.cliente?.trim().length ?? 0) < 2) errores.push('Escribe el nombre de quien compra.');
  }
  if (errores.length > 0) return fallo(errores);

  return comoLista(
    await port.registrarCobro(clave, {
      ...datos,
      aplicaciones: aplicaciones.length > 0 ? aplicaciones : undefined,
      referencia: forma.exito ? forma.valor.referencia : undefined,
      nota: forma.exito ? forma.valor.nota : undefined,
      venta: datos.venta
        ? { ...datos.venta, descripcion: datos.venta.descripcion.trim(), cliente: datos.estudianteId ? undefined : datos.venta.cliente?.trim() }
        : undefined,
    }),
  );
}

/**
 * Cerrar caja (§6.14). El esperado lo calcula la base con las filas que marca;
 * aquí se revisa la forma (montos, retiro, explicación si no cuadra según lo
 * que la pantalla mostró). Si mientras tanto entró otro cobro, la base vuelve
 * a pedir la explicación con la diferencia real.
 */
export async function cerrarCaja(port: CajaPort, clave: string, datos: DatosDeCierre, esperadoMostrado: Centavos): Res<CierreHecho> {
  // El esperado que vio la persona hace de saldo: la diferencia y la
  // explicación se comprueban igual que en el dominio.
  const arqueo = calcularArqueo({
    saldoInicial: esperadoMostrado,
    entradasEfectivo: 0 as Centavos,
    salidasEfectivo: 0 as Centavos,
    contado: datos.contado,
    retiro: datos.retiro,
    observacion: datos.observacion,
  });
  if (!arqueo.exito) return fallo(arqueo.error.map((e) => e.mensaje));
  const observacion = datos.observacion?.trim() ?? '';
  if (observacion.length > 500) return fallo(['La explicación admite hasta 500 caracteres.']);
  return comoLista(await port.cerrarCaja(clave, { ...datos, observacion: observacion || undefined }));
}

export async function anular(port: CajaPort, clave: string, tipo: TipoAnulable, id: Id, motivo: string): Res<void> {
  const limpio = motivo.trim();
  if (limpio.length < 3) return fallo(['Escribe el motivo de la anulación: queda registrado.']);
  if (limpio.length > 300) return fallo(['El motivo admite hasta 300 caracteres.']);
  return comoLista(await port.anular(clave, tipo, id, limpio));
}

export async function crearCargoManual(port: CajaPort, clave: string, datos: DatosDeCargoManual): Res<void> {
  const errores: string[] = [];
  if (datos.descripcion.trim().length < 3) errores.push('Escribe qué se cobra.');
  if (!Number.isSafeInteger(datos.monto) || datos.monto <= 0) errores.push('Escribe el monto.');
  if (errores.length > 0) return fallo(errores);
  return comoLista(await port.crearCargo(clave, { ...datos, descripcion: datos.descripcion.trim() }));
}

export async function registrarGasto(port: CajaPort, clave: string, datos: DatosDeGasto, hoy: string): Res<{ readonly numero: number }> {
  const errores: string[] = [];
  if (datos.descripcion.trim().length < 3) errores.push('Escribe qué fue el gasto.');
  if (!Number.isSafeInteger(datos.monto) || datos.monto <= 0) errores.push('Escribe el monto.');
  const medio: MedioDePago = datos.medio;
  if (exigeReferencia(medio) && (datos.referencia?.trim().length ?? 0) < 3) errores.push('Escribe el número de operación del pago.');
  if (medio === 'efectivo' && datos.fecha && datos.fecha !== hoy) errores.push('Un gasto en efectivo sale del cajón de hoy: deja la fecha de hoy.');
  if (errores.length > 0) return fallo(errores);
  return comoLista(await port.registrarGasto(clave, { ...datos, descripcion: datos.descripcion.trim() }));
}

/** Prepara los cargos marcados en la pantalla de cobro: solo los que tienen monto. */
export function aplicacionesElegidas(
  marcados: readonly { readonly cargoId: Id; readonly monto: Centavos; readonly pendiente: Centavos }[],
): Resultado<readonly { readonly cargoId: Id; readonly monto: Centavos }[], readonly string[]> {
  const errores: string[] = [];
  for (const m of marcados) {
    if (m.monto > m.pendiente) errores.push('Un monto supera lo que se debe en ese cargo.');
  }
  if (errores.length > 0) return fallo([...new Set(errores)]);
  return exito(marcados.filter((m) => m.monto > 0).map((m) => ({ cargoId: m.cargoId, monto: m.monto })));
}
