/**
 * CAPA: Domain / Contabilidad
 *
 * Cuentas del tablero de administración (especificación §7.7; enmiendas B.12
 * crítica 29: 4 cifras del mes y un solo gráfico).
 *
 * - `variacion`: cuánto cambió lo de este mes frente al mes anterior a la
 *   misma fecha («12 % más que en septiembre a esta fecha»).
 * - `barrasDeSemanas`: la altura de cada barra del gráfico «Entró y salió»,
 *   que se dibuja en SVG en el servidor. Las alturas salen de aquí y no de la
 *   página para poder probarlas con números.
 *
 * Todo es aritmética entera sobre centavos: ninguna cifra pasa por coma
 * flotante salvo la división final del porcentaje y de la altura, que se
 * redondea en el acto.
 *
 * Sin React, sin Next, sin I/O.
 */

import type { Centavos, FechaISO } from '../shared/tipos-base';

// ---------------------------------------------------------------- Variación

export type SentidoDeVariacion = 'sube' | 'baja' | 'igual' | 'sin_base';

export interface Variacion {
  readonly sentido: SentidoDeVariacion;
  /** Entero, sin signo (el signo lo dice `sentido`). `null` cuando no hay base con la que comparar. */
  readonly porcentaje: number | null;
}

/**
 * Variación de `actual` frente a `anterior`, en porcentaje entero redondeado.
 *
 * - Sin base (`anterior` en 0): no hay porcentaje posible. Si los dos son 0,
 *   `igual`; si este mes hubo algo, `sin_base` («el mes anterior no hubo
 *   movimiento a esta fecha»).
 * - Base negativa: los totales son netos de anulaciones y, en un mes raro,
 *   pueden quedar bajo cero. Un porcentaje sobre una base negativa no dice
 *   nada útil («300 % más» de −Bs 5), así que se trata como sin base.
 * - Diferencia que redondea a 0 %: se informa `igual` y no «▲ 0 % más», que
 *   en pantalla se leería como una contradicción.
 */
export function variacion(actual: Centavos, anterior: Centavos): Variacion {
  if (!Number.isFinite(actual) || !Number.isFinite(anterior)) return { sentido: 'igual', porcentaje: null };
  if (anterior <= 0) {
    return actual === anterior ? { sentido: 'igual', porcentaje: null } : { sentido: 'sin_base', porcentaje: null };
  }
  const diferencia = actual - anterior;
  const porcentaje = Math.round((Math.abs(diferencia) * 100) / anterior);
  if (porcentaje === 0) return { sentido: 'igual', porcentaje: 0 };
  return { sentido: diferencia > 0 ? 'sube' : 'baja', porcentaje };
}

// ---------------------------------------------------------------- Barras del gráfico

export interface BarraDeSemana {
  /** Lunes de la semana. */
  readonly desde: FechaISO;
  /** Netos tal como los da la base (pueden ser negativos): la tabla «Ver como tabla» muestra la verdad. */
  readonly entro: Centavos;
  readonly salio: Centavos;
  /** Alturas enteras entre 0 y `alto`. */
  readonly altoEntro: number;
  readonly altoSalio: number;
}

/** Altura mínima de una barra con valor: con 1 px no se distingue de una vacía. */
const ALTO_MINIMO = 2;

/**
 * Alturas proporcionales al mayor valor de TODAS las semanas (entró o salió),
 * para que las 16 barras compartan escala y se puedan comparar a simple
 * vista. Un valor positivo nunca mide menos de 2 (si no, una semana con Bs 5
 * frente a otra con Bs 50.000 parecería vacía). Un neto negativo (más
 * anulado que registrado esa semana) se dibuja como 0: una barra hacia abajo
 * confundiría más de lo que explica, y la tabla da la cifra exacta.
 */
export function barrasDeSemanas(
  semanas: readonly { readonly desde: FechaISO; readonly entro: Centavos; readonly salio: Centavos }[],
  alto: number,
): BarraDeSemana[] {
  const tope = Number.isFinite(alto) ? Math.max(0, Math.floor(alto)) : 0;
  const positivo = (valor: number): number => (Number.isFinite(valor) && valor > 0 ? valor : 0);
  const maximo = semanas.reduce((m, s) => Math.max(m, positivo(s.entro), positivo(s.salio)), 0);

  const altura = (valor: number): number => {
    const v = positivo(valor);
    if (v === 0 || maximo === 0) return 0;
    return Math.min(tope, Math.max(Math.min(ALTO_MINIMO, tope), Math.round((v * tope) / maximo)));
  };

  return semanas.map((s) => ({
    desde: s.desde,
    entro: s.entro,
    salio: s.salio,
    altoEntro: altura(s.entro),
    altoSalio: altura(s.salio),
  }));
}
