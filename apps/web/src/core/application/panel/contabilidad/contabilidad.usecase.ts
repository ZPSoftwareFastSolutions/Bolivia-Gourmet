/**
 * CAPA: Application / Panel · Contabilidad
 *
 * Arma el resumen del mes para la pantalla (especificación §5.7, solo
 * administración): combina los totales que suma la base con las reglas del
 * dominio (`resultadoDelMes`, `flujoDelMes`, `cuadreDelInventario`) y añade
 * las frases que explican, en palabras simples, por qué la ganancia del mes y
 * el dinero que entró no son la misma cifra. Es lo que más se pregunta en un
 * resumen así, y la respuesta casi siempre es «compraste inventario» o
 * «todavía te deben».
 *
 * No llama a la base: recibe los totales ya leídos por el puerto. Así se
 * prueba con números y la página solo pinta.
 */

import {
  cuadreDelInventario,
  flujoDelMes,
  resultadoDelMes,
  type FlujoDelMes,
  type ResultadoDelMes,
} from '../../../domain/contabilidad/resumen';
import { ETIQUETA_DE_MOVIMIENTO, type TipoDeMovimiento } from '../../../domain/inventario/movimiento';
import { formatearMontoExacto } from '../../../domain/shared/dinero';
import type { Centavos } from '../../../domain/shared/tipos-base';
import type { TotalesDelMesEnBase } from '../../ports/contabilidad.port';

const c = (valor: number): Centavos => valor as Centavos;

export interface ResumenParaPantalla {
  readonly resultado: ResultadoDelMes;
  readonly flujo: FlujoDelMes;
  /** Diferencia del cuadre del inventario del mes (0 = cuadra). */
  readonly cuadreDelMes: Centavos;
  /** Lo comprado en el mes que sigue en el inventario: se pagó, pero todavía no es costo (sin saldos iniciales ni sobrantes). */
  readonly comprasSinUsar: Centavos;
  /** Ingresos del mes que no entraron como dinero en el mes. */
  readonly porCobrarDelMes: Centavos;
  /** Frases que explican la distancia entre el resultado y el dinero. */
  readonly explicaciones: readonly string[];
}

export function resumenParaPantalla(t: TotalesDelMesEnBase): ResumenParaPantalla {
  const resultado = resultadoDelMes({
    ingresos: t.ingresos.total,
    ingresosAnulados: t.ingresos.anulados,
    costoDeLoUsado: t.costo.total,
    gastos: t.gastos.total,
    gastosAnulados: t.gastos.anulados,
    diferenciasDeArqueos: t.arqueos,
  });
  const flujo = flujoDelMes(t.dinero, t.arqueos);
  const cuadreDelMes = cuadreDelInventario({
    valorInicial: t.inventario.valorInicial,
    compras: t.costo.compras,
    comprasAnuladas: t.costo.comprasAnuladas,
    saldosIniciales: t.costo.saldosIniciales,
    saldosInicialesAnulados: t.costo.saldosInicialesAnulados,
    costoDeLoUsado: t.costo.total,
    valorFinal: t.inventario.valorFinal,
  });

  // Si el inventario creció por COMPRAS, ese dinero salió pero todavía no se
  // usó: no es gasto ni costo del mes. Lo que creció por un saldo inicial o
  // un sobrante de conteo no fue dinero: se descuenta, y el monto nunca pasa
  // de lo comprado (neto de anulaciones) en el mes.
  const comprasNetas = t.costo.compras - t.costo.comprasAnuladas;
  const saldosNetos = t.costo.saldosIniciales - t.costo.saldosInicialesAnulados;
  const comprasSinUsar = c(Math.max(0, Math.min(comprasNetas, t.inventario.valorFinal - t.inventario.valorInicial - saldosNetos)));
  // Lo generado que no entró como dinero. Es aproximado a propósito: un cobro
  // de una deuda de otro mes también suma a lo que entró.
  const porCobrarDelMes = c(Math.max(0, resultado.ingresos - flujo.entro));

  const explicaciones: string[] = [];
  if (comprasSinUsar > 0) {
    explicaciones.push(`Compraste inventario por ${formatearMontoExacto(comprasSinUsar)} que todavía no se usó: salió dinero, pero no es gasto.`);
  }
  if (porCobrarDelMes > 0) {
    explicaciones.push(`De lo que se generó este mes, falta cobrar ${formatearMontoExacto(porCobrarDelMes)}.`);
  }
  // `diferenciasDeCaja` positiva = faltó dinero en los arqueos.
  if (resultado.diferenciasDeCaja > 0) {
    explicaciones.push(`En los arqueos faltaron ${formatearMontoExacto(resultado.diferenciasDeCaja)}.`);
  } else if (resultado.diferenciasDeCaja < 0) {
    explicaciones.push(`En los arqueos sobraron ${formatearMontoExacto(c(-resultado.diferenciasDeCaja))}.`);
  }
  if (cuadreDelMes !== 0) {
    explicaciones.push(`El inventario del mes no cuadra por ${formatearMontoExacto(c(Math.abs(cuadreDelMes)))}: revisa la verificación.`);
  }

  return { resultado, flujo, cuadreDelMes, comprasSinUsar, porCobrarDelMes, explicaciones };
}

/**
 * Rótulo de cada línea del costo de lo usado. Dice qué pasó con lo que salió
 * del inventario («Uniformes entregados»), no el nombre técnico del asiento.
 */
const ETIQUETA_DE_COSTO: Partial<Record<TipoDeMovimiento, string>> = {
  consumo: 'Usado en clase',
  entrega: 'Uniformes entregados',
  devolucion_entrega: 'Uniformes devueltos',
  baja: 'Dado de baja',
  ajuste_faltante: 'Faltantes del conteo',
  ajuste_sobrante: 'Sobrantes del conteo',
};

export function etiquetaDeCosto(tipo: TipoDeMovimiento): string {
  return ETIQUETA_DE_COSTO[tipo] ?? ETIQUETA_DE_MOVIMIENTO[tipo];
}
