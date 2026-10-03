/**
 * CAPA: Domain / Contabilidad
 *
 * Tarjeta kárdex PEPS de un insumo (especificación §5.3 y §5.8): cada
 * movimiento del libro con lo que tomó o devolvió de cada lote y las «capas»
 * que quedan después (cuánto queda de cada compra y cuánto vale).
 *
 * Se arma con lo que ya guardó la base (`movimiento_lotes`), no se vuelve a
 * calcular el PEPS: la tarjeta tiene que mostrar EXACTAMENTE los centavos que
 * se descontaron, y el que decide qué lote se toma es `app.sacar`. Aquí solo
 * se acumula.
 *
 * Por qué el signo sale del movimiento y no de la toma: la base escribe las
 * tomas siempre en positivo (lo que entró a un lote al comprar, lo que salió
 * al usar) y el sentido lo da el asiento. Una anulación de una salida entra
 * (devuelve a sus lotes, aunque estuvieran agotados); la de una entrada sale.
 *
 * Sin React, sin Next, sin I/O.
 */

import { bigIntACentavos, comoMilesimas, ESCALA, redondearProporcion, type Milesimas } from '../shared/cantidad';
import type { Centavos } from '../shared/tipos-base';

export interface MovimientoDeTarjeta {
  readonly id: string;
  /** Orden de escritura en el libro: la tarjeta se recorre en este orden. */
  readonly numero: number;
  readonly entra: Milesimas;
  readonly sale: Milesimas;
  readonly deltaValor: Centavos;
}

/** Lo que un movimiento tomó de (o devolvió a) un lote; siempre en positivo. */
export interface TomaDeTarjeta {
  readonly movimientoId: string;
  readonly loteId: string;
  readonly cantidad: Milesimas;
  readonly valor: Centavos;
}

/** Lo que queda de un lote después de un movimiento. */
export interface CapaDeTarjeta {
  readonly loteId: string;
  readonly cantidad: Milesimas;
  readonly valor: Centavos;
}

export interface FilaDeTarjeta {
  readonly movimientoId: string;
  /** 1 entra a los lotes, −1 sale de ellos, 0 no los toca. */
  readonly signo: 1 | -1 | 0;
  /** Las tomas de este movimiento, en orden PEPS de sus lotes. */
  readonly tomas: readonly TomaDeTarjeta[];
  /** Lotes con existencia después del movimiento, del más antiguo al más nuevo. */
  readonly capas: readonly CapaDeTarjeta[];
  readonly saldoCantidad: Milesimas;
  readonly saldoValor: Centavos;
}

/**
 * Compara dos lotes por su orden PEPS. Los que no tienen orden conocido van al
 * final y, entre ellos, conservan el orden en que aparecieron (el `sort` de
 * JavaScript es estable). No se usa `?? Infinity` porque `Infinity − Infinity`
 * es `NaN` y desordena la lista sin avisar.
 */
function compararLotes(ordenDeLotes: ReadonlyMap<string, number>, a: string, b: string): number {
  const oa = ordenDeLotes.get(a);
  const ob = ordenDeLotes.get(b);
  if (oa === undefined && ob === undefined) return 0;
  if (oa === undefined) return 1;
  if (ob === undefined) return -1;
  return oa - ob;
}

/**
 * Recorre los movimientos en orden de `numero` y, después de cada uno,
 * devuelve sus tomas y las capas que quedan. Un movimiento sin tomas (o sin
 * entrada ni salida) deja las capas como estaban.
 */
export function tarjetaPeps(
  movimientos: readonly MovimientoDeTarjeta[],
  tomas: readonly TomaDeTarjeta[],
  ordenDeLotes: ReadonlyMap<string, number>,
): FilaDeTarjeta[] {
  const tomasPorMovimiento = new Map<string, TomaDeTarjeta[]>();
  for (const toma of tomas) {
    const lista = tomasPorMovimiento.get(toma.movimientoId);
    if (lista) lista.push(toma);
    else tomasPorMovimiento.set(toma.movimientoId, [toma]);
  }

  // Valor en centavos como `number`: son enteros seguros y solo se suman.
  const lotes = new Map<string, { readonly cantidad: bigint; readonly valor: number }>();
  const ordenados = [...movimientos].sort((a, b) => a.numero - b.numero);

  return ordenados.map((movimiento): FilaDeTarjeta => {
    const signo: 1 | -1 | 0 = movimiento.entra > 0n ? 1 : movimiento.sale > 0n ? -1 : 0;
    const propias = [...(tomasPorMovimiento.get(movimiento.id) ?? [])].sort((a, b) => compararLotes(ordenDeLotes, a.loteId, b.loteId));

    if (signo !== 0) {
      for (const toma of propias) {
        const antes = lotes.get(toma.loteId) ?? { cantidad: 0n, valor: 0 };
        lotes.set(toma.loteId, {
          cantidad: antes.cantidad + BigInt(signo) * toma.cantidad,
          valor: antes.valor + signo * toma.valor,
        });
      }
    }

    const capas: CapaDeTarjeta[] = [...lotes.entries()]
      .filter(([, lote]) => lote.cantidad > 0n)
      .sort(([a], [b]) => compararLotes(ordenDeLotes, a, b))
      .map(([loteId, lote]) => ({ loteId, cantidad: comoMilesimas(lote.cantidad), valor: lote.valor as Centavos }));

    const saldoCantidad = capas.reduce((total, capa) => total + capa.cantidad, 0n);
    const saldoValor = capas.reduce((total, capa) => total + capa.valor, 0);

    return {
      movimientoId: movimiento.id,
      signo,
      tomas: propias,
      capas,
      saldoCantidad: comoMilesimas(saldoCantidad),
      saldoValor: saldoValor as Centavos,
    };
  });
}

/**
 * Costo por unidad entera (1000 milésimas), redondeado al centavo con la
 * mitad hacia arriba, igual que `round` de PostgreSQL: 25 kg por Bs 180,00 →
 * Bs 7,20 el kg. Solo se MUESTRA; el costo de una salida se calcula siempre
 * sobre el valor total del lote (§5.3).
 *
 * Sin existencia no hay costo por unidad (`null`). Tampoco con un valor
 * negativo, que solo saldría de un libro dañado: aquí se muestra, no se
 * valida, y la verificación del cuadre es la que lo señala.
 */
export function costoUnitario(cantidad: Milesimas, valor: Centavos): Centavos | null {
  if (cantidad <= 0n || valor < 0) return null;
  return bigIntACentavos(redondearProporcion(BigInt(valor), ESCALA, cantidad));
}
