/**
 * CAPA: Domain / Caja
 *
 * Arqueo o cierre de caja (especificación §2.4, §6.14; D7): contar el
 * efectivo y compararlo con lo que debería haber.
 *
 *   esperado   = saldo inicial + entradas de efectivo − salidas de efectivo
 *   diferencia = contado − esperado     (negativa = falta; positiva = sobra)
 *   queda      = contado − retiro       (saldo inicial del arqueo siguiente)
 *
 * El arqueo cuenta TODO lo no arqueado de la sede, también las anulaciones
 * tardías: un cobro en efectivo ya arqueado que se anula después sale en el
 * arqueo siguiente (el dinero se devolvió). Nunca bloquea un cobro.
 *
 * Los importes con signo (esperado, diferencia) también van en centavos
 * enteros.
 *
 * Sin React, sin Next, sin I/O.
 */

import { formatearMontoExacto } from '../shared/dinero';
import { exito, fallo, type Centavos, type Resultado } from '../shared/tipos-base';
import type { MedioDePago } from './cobro';

// ---------------------------------------------------------------- Lo que hay por arquear

/** Un cobro, gasto o compra visto desde la caja (sin datos sensibles). */
export interface RegistroDeCaja {
  readonly clase: 'cobro' | 'gasto' | 'compra';
  readonly medio: MedioDePago;
  readonly monto: Centavos;
  /** Ningún arqueo lo contó todavía (`cierre_id` nulo). */
  readonly sinArquear: boolean;
  /** Está anulado y ningún arqueo contó su anulación (`anulacion_cierre_id` nulo). */
  readonly anulacionSinArquear: boolean;
}

export interface TotalesDeCaja {
  /** Cobros en efectivo + anulaciones de gastos y compras en efectivo. */
  readonly entradasEfectivo: Centavos;
  /** Gastos y compras en efectivo + anulaciones de cobros en efectivo. */
  readonly salidasEfectivo: Centavos;
  /** Informativos, para cotejar con el banco. */
  readonly cobrosQr: Centavos;
  readonly cobrosTransferencia: Centavos;
  /** Cuántas marcas pondrá el cierre (altas y anulaciones). */
  readonly registros: number;
}

/** La misma cuenta que `caja_por_cerrar` y `cerrar_caja` (§3.8). */
export function totalesDeCaja(registros: readonly RegistroDeCaja[]): TotalesDeCaja {
  let entradas = 0;
  let salidas = 0;
  let qr = 0;
  let transferencia = 0;
  let marcas = 0;

  for (const r of registros) {
    if (r.sinArquear) marcas += 1;
    if (r.anulacionSinArquear) marcas += 1;

    if (r.medio === 'efectivo') {
      const entra = r.clase === 'cobro';
      if (r.sinArquear) {
        if (entra) entradas += r.monto;
        else salidas += r.monto;
      }
      // La anulación mueve el dinero al revés que el alta.
      if (r.anulacionSinArquear) {
        if (entra) salidas += r.monto;
        else entradas += r.monto;
      }
    } else if (r.clase === 'cobro' && r.sinArquear) {
      if (r.medio === 'qr') qr += r.monto;
      else transferencia += r.monto;
    }
  }

  return {
    entradasEfectivo: entradas as Centavos,
    salidasEfectivo: salidas as Centavos,
    cobrosQr: qr as Centavos,
    cobrosTransferencia: transferencia as Centavos,
    registros: marcas,
  };
}

// ---------------------------------------------------------------- El arqueo

export interface DatosDeArqueo {
  /** El `queda` del arqueo anterior (o lo que escribe quien cierra el primero). */
  readonly saldoInicial: Centavos;
  readonly entradasEfectivo: Centavos;
  readonly salidasEfectivo: Centavos;
  /** Lo que contó la persona. */
  readonly contado: Centavos;
  /** Lo que se retira o deposita; el resto queda para el cambio. */
  readonly retiro: Centavos;
  /** Obligatoria si no cuadra. */
  readonly observacion?: string;
  /** Si se indica y es 0: `nada_que_arquear`. */
  readonly registros?: number;
}

export interface Arqueo {
  readonly esperado: Centavos;
  readonly diferencia: Centavos;
  readonly queda: Centavos;
  readonly cuadra: boolean;
  readonly observacion?: string;
}

export interface ErrorDeArqueo {
  readonly codigo: 'monto_invalido' | 'retiro_excede' | 'observacion_requerida' | 'nada_que_arquear';
  readonly mensaje: string;
}

function esNoNegativo(valor: number): boolean {
  return Number.isSafeInteger(valor) && valor >= 0;
}

export function calcularArqueo(datos: DatosDeArqueo): Resultado<Arqueo, readonly ErrorDeArqueo[]> {
  const errores: ErrorDeArqueo[] = [];
  const montos = [datos.saldoInicial, datos.entradasEfectivo, datos.salidasEfectivo, datos.contado, datos.retiro];
  if (!montos.every(esNoNegativo)) {
    return fallo([{ codigo: 'monto_invalido', mensaje: 'Los importes del arqueo son centavos enteros no negativos.' }]);
  }
  if (datos.registros === 0) errores.push({ codigo: 'nada_que_arquear', mensaje: 'No hay nada nuevo que arquear desde el último cierre.' });

  const esperado = datos.saldoInicial + datos.entradasEfectivo - datos.salidasEfectivo;
  const diferencia = datos.contado - esperado;
  const observacion = datos.observacion?.trim() ?? '';

  if (datos.retiro > datos.contado) {
    errores.push({ codigo: 'retiro_excede', mensaje: `No puedes retirar más de lo contado (${formatearMontoExacto(datos.contado)}).` });
  }
  if (diferencia !== 0 && observacion.length === 0) {
    errores.push({ codigo: 'observacion_requerida', mensaje: 'La caja no cuadra: explica la diferencia.' });
  }
  if (errores.length > 0) return fallo(errores);

  return exito({
    esperado: esperado as Centavos,
    diferencia: diferencia as Centavos,
    queda: (datos.contado - datos.retiro) as Centavos,
    cuadra: diferencia === 0,
    observacion: observacion.length > 0 ? observacion : undefined,
  });
}

/** «¡La caja cuadra!», «Faltan Bs 5,00» o «Sobran Bs 2,50». */
export function describirDiferencia(diferencia: Centavos): string {
  if (diferencia === 0) return '¡La caja cuadra!';
  return diferencia < 0
    ? `Faltan ${formatearMontoExacto(-diferencia as Centavos)}`
    : `Sobran ${formatearMontoExacto(diferencia)}`;
}
