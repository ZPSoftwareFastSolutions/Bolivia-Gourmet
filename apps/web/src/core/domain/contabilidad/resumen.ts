/**
 * CAPA: Domain / Contabilidad
 *
 * Resumen del mes (especificación §5.7): un estado de resultados simple y el
 * dinero del mes, calculados A PARTIR DE TOTALES (los suma la base en
 * `v_resumen_mensual` y `v_flujo_mensual`; aquí se combinan igual).
 *
 *   RESULTADO = ingresos − costo de lo usado − gastos − diferencias de caja
 *
 *   ingresos              cargos del mes − cargos anulados en el mes
 *   costo de lo usado     usos + entregas − devoluciones + bajas + faltantes
 *                         − sobrantes (± sus anulaciones)
 *   gastos                gastos del mes − gastos anulados en el mes
 *   diferencias de caja   faltantes − sobrantes de los arqueos del mes
 *
 * Una anulación cuenta en el mes en que se hace (`anulado_el`), restando; el
 * mes original NO cambia. Las compras son dinero e inventario, nunca gasto.
 *
 * Es una vista de gestión, no un estado financiero oficial.
 *
 * Sin React, sin Next, sin I/O.
 */

import { mesDe } from '../shared/calendario';
import type { Centavos, FechaISO } from '../shared/tipos-base';
import type { MedioDePago } from '../caja/cobro';
import type { TipoDeMovimiento } from '../inventario/movimiento';

const c = (valor: number): Centavos => valor as Centavos;

// ---------------------------------------------------------------- Resultado del mes

export interface TotalesDelMes {
  /** Cargos con fecha en el mes. */
  readonly ingresos: Centavos;
  /** Cargos anulados en el mes (de cualquier mes de origen). */
  readonly ingresosAnulados: Centavos;
  /** Con signo: puede ser negativo si las anulaciones o los sobrantes superan lo usado. */
  readonly costoDeLoUsado: Centavos;
  readonly gastos: Centavos;
  readonly gastosAnulados: Centavos;
  /** `diferencia` (contado − esperado) de cada arqueo del mes. */
  readonly diferenciasDeArqueos: readonly Centavos[];
}

export type ClaseDeResultado = 'ganancia' | 'perdida' | 'sin_resultado';

export interface ResultadoDelMes {
  readonly ingresos: Centavos;
  readonly costoDeLoUsado: Centavos;
  readonly gastos: Centavos;
  /** Faltantes − sobrantes de caja (positivo = faltó dinero). */
  readonly diferenciasDeCaja: Centavos;
  readonly resultado: Centavos;
  readonly clase: ClaseDeResultado;
}

/** Faltantes − sobrantes: un arqueo con diferencia −500 (faltan Bs 5) suma 500. */
export function diferenciasDeCaja(diferencias: readonly Centavos[]): Centavos {
  return c(-diferencias.reduce((t, d) => t + d, 0) || 0);
}

export function resultadoDelMes(totales: TotalesDelMes): ResultadoDelMes {
  const ingresos = totales.ingresos - totales.ingresosAnulados;
  const gastos = totales.gastos - totales.gastosAnulados;
  const diferencias = diferenciasDeCaja(totales.diferenciasDeArqueos);
  const resultado = ingresos - totales.costoDeLoUsado - gastos - diferencias;
  return {
    ingresos: c(ingresos),
    costoDeLoUsado: totales.costoDeLoUsado,
    gastos: c(gastos),
    diferenciasDeCaja: diferencias,
    resultado: c(resultado),
    clase: resultado > 0 ? 'ganancia' : resultado < 0 ? 'perdida' : 'sin_resultado',
  };
}

/** Lo que el libro de inventario aporta al costo: el valor que salió, con signo. */
export interface MovimientoValorizado {
  readonly tipo: TipoDeMovimiento;
  /** Si es una anulación, el tipo del movimiento que anula. */
  readonly tipoAnulado?: TipoDeMovimiento;
  /** `movimientos_costo.delta_valor`: + entra valor al inventario, − sale. */
  readonly deltaValor: Centavos;
}

/** Lo que entra al inventario desde fuera (y su anulación) no es costo de lo usado. */
const NO_ES_COSTO: readonly TipoDeMovimiento[] = ['compra', 'saldo_inicial'];

/**
 * Costo de lo usado = el valor que salió del inventario por uso, entrega,
 * baja o faltante, menos lo que volvió (devoluciones, sobrantes y anulaciones
 * de usos o bajas). Préstamos y devoluciones de préstamo no mueven valor.
 */
export function costoDeLoUsado(movimientos: readonly MovimientoValorizado[]): Centavos {
  let costo = 0;
  for (const m of movimientos) {
    const tipo = m.tipo === 'anulacion' ? m.tipoAnulado : m.tipo;
    if (tipo === undefined || NO_ES_COSTO.includes(tipo)) continue;
    costo -= m.deltaValor;
  }
  return c(costo || 0);
}

export interface DatosDeCuadre {
  readonly valorInicial: Centavos;
  readonly compras: Centavos;
  readonly comprasAnuladas: Centavos;
  readonly saldosIniciales: Centavos;
  readonly saldosInicialesAnulados: Centavos;
  readonly costoDeLoUsado: Centavos;
  readonly valorFinal: Centavos;
}

/**
 * Cuadre del inventario (§5.7): valor al inicio + compras + saldos iniciales
 * − sus anulaciones − costo de lo usado = valor al final. Devuelve la
 * diferencia (0 = cuadra).
 */
export function cuadreDelInventario(d: DatosDeCuadre): Centavos {
  const esperado = d.valorInicial + d.compras - d.comprasAnuladas + d.saldosIniciales - d.saldosInicialesAnulados - d.costoDeLoUsado;
  return c(d.valorFinal - esperado);
}

// ---------------------------------------------------------------- Dinero del mes

export interface TotalesDeMedio {
  readonly cobros: Centavos;
  readonly cobrosAnulados: Centavos;
  readonly gastos: Centavos;
  readonly gastosAnulados: Centavos;
  readonly compras: Centavos;
  readonly comprasAnuladas: Centavos;
}

export const TOTALES_DE_MEDIO_VACIOS: TotalesDeMedio = {
  cobros: c(0),
  cobrosAnulados: c(0),
  gastos: c(0),
  gastosAnulados: c(0),
  compras: c(0),
  comprasAnuladas: c(0),
};

export interface FlujoDeMedio {
  /** Cobros − cobros anulados. */
  readonly entro: Centavos;
  /** Gastos + compras − sus anulaciones. */
  readonly salio: Centavos;
  readonly neto: Centavos;
}

export interface FlujoDelMes {
  readonly porMedio: Record<MedioDePago, FlujoDeMedio>;
  readonly entro: Centavos;
  readonly salio: Centavos;
  /** Faltantes − sobrantes de caja: el efectivo que faltó también salió (B.13, crítica 34). */
  readonly diferenciasDeCaja: Centavos;
  readonly neto: Centavos;
}

const MEDIOS: readonly MedioDePago[] = ['efectivo', 'qr', 'transferencia'];

export function flujoDelMes(
  porMedio: Partial<Record<MedioDePago, TotalesDeMedio>>,
  diferenciasDeArqueos: readonly Centavos[] = [],
): FlujoDelMes {
  let entro = 0;
  let salio = 0;
  const resultado = {} as Record<MedioDePago, FlujoDeMedio>;
  for (const medio of MEDIOS) {
    const t = porMedio[medio] ?? TOTALES_DE_MEDIO_VACIOS;
    const entra = t.cobros - t.cobrosAnulados;
    const sale = t.gastos + t.compras - t.gastosAnulados - t.comprasAnuladas;
    resultado[medio] = { entro: c(entra), salio: c(sale), neto: c(entra - sale) };
    entro += entra;
    salio += sale;
  }
  const diferencias = diferenciasDeCaja(diferenciasDeArqueos);
  return { porMedio: resultado, entro: c(entro), salio: c(salio), diferenciasDeCaja: diferencias, neto: c(entro - salio - diferencias) };
}

/** Un cobro, gasto o compra con sus fechas: lo que la base suma en `v_flujo_mensual`. */
export interface DocumentoDeDinero {
  readonly clase: 'cobro' | 'gasto' | 'compra';
  readonly medio: MedioDePago;
  readonly monto: Centavos;
  readonly fecha: FechaISO;
  readonly anuladoEl?: FechaISO;
}

/**
 * Totales por medio de un mes (`AAAA-MM`): el alta cuenta en el mes de su
 * fecha y la anulación en el mes de `anuladoEl`. Por eso anular en octubre un
 * cobro de septiembre baja octubre y deja septiembre como estaba.
 */
export function totalesDeDineroDelMes(mes: string, documentos: readonly DocumentoDeDinero[]): Partial<Record<MedioDePago, TotalesDeMedio>> {
  const totales: Partial<Record<MedioDePago, { -readonly [K in keyof TotalesDeMedio]: number }>> = {};
  for (const d of documentos) {
    const t = (totales[d.medio] ??= { ...TOTALES_DE_MEDIO_VACIOS });
    if (mesDe(d.fecha) === mes) {
      if (d.clase === 'cobro') t.cobros += d.monto;
      else if (d.clase === 'gasto') t.gastos += d.monto;
      else t.compras += d.monto;
    }
    if (d.anuladoEl !== undefined && mesDe(d.anuladoEl) === mes) {
      if (d.clase === 'cobro') t.cobrosAnulados += d.monto;
      else if (d.clase === 'gasto') t.gastosAnulados += d.monto;
      else t.comprasAnuladas += d.monto;
    }
  }
  return totales as Partial<Record<MedioDePago, TotalesDeMedio>>;
}

/** Ingresos de un mes: cargos con fecha en el mes y cargos anulados en el mes. */
export function ingresosDelMes(
  mes: string,
  cargos: readonly { readonly monto: Centavos; readonly fecha: FechaISO; readonly anuladoEl?: FechaISO }[],
): { readonly ingresos: Centavos; readonly ingresosAnulados: Centavos } {
  let ingresos = 0;
  let anulados = 0;
  for (const cargo of cargos) {
    if (mesDe(cargo.fecha) === mes) ingresos += cargo.monto;
    if (cargo.anuladoEl !== undefined && mesDe(cargo.anuladoEl) === mes) anulados += cargo.monto;
  }
  return { ingresos: c(ingresos), ingresosAnulados: c(anulados) };
}
