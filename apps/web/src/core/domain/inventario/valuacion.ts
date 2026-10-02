/**
 * CAPA: Domain / Inventario
 *
 * Valuación del inventario (especificación §5; enmiendas B.5, B.6, B.12).
 *
 * Dos métodos, un solo motor:
 * - INSUMOS → PEPS: cada lote (lo que llegó en una compra) guarda su cantidad
 *   y su valor; lo primero que entra es lo primero que sale, a lo que costó.
 * - UNIFORMES, UTENSILIOS Y OTROS → costo promedio ponderado: una sola capa
 *   (cantidad total y valor total); cada pieza vale lo mismo.
 *
 * Los dos comparten la FÓRMULA PROPORCIONAL CON REMANENTE EXACTO: una salida
 * parcial vale `round(valor_que_queda × lo_que_sale / cantidad_que_queda)`
 * (mitad hacia arriba, en enteros) y la salida que agota la capa o el lote se
 * lleva el valor que quede, al centavo. Así la suma de las salidas es siempre
 * lo que se pagó. Es la misma cuenta que hará la base (`app.sacar`): estos
 * ejemplos son pruebas compartidas con la batería SQL (§5.8).
 *
 * Ninguna cuenta de costo usa coma flotante: cantidades en milésimas
 * (`bigint`) y valores en centavos enteros.
 *
 * Sin React, sin Next, sin I/O.
 */

import {
  CERO,
  centavosABigInt,
  bigIntACentavos,
  comoMilesimas,
  formatearCantidad,
  redondearProporcion,
  sumar,
  type Milesimas,
} from '../shared/cantidad';
import { exito, fallo, type Centavos, type FechaISO, type Id, type Resultado } from '../shared/tipos-base';

export type MetodoDeValuacion = 'peps' | 'promedio';

// ---------------------------------------------------------------- Errores

/** Errores con código (el mismo que lanzará la base) y los datos de la frase. */
export type ErrorDeValuacion =
  | { readonly codigo: 'cantidad_invalida'; readonly mensaje: string }
  | { readonly codigo: 'monto_invalido'; readonly mensaje: string }
  | {
      readonly codigo: 'stock_insuficiente';
      readonly mensaje: string;
      /** Lo que se puede usar con las reglas de esta salida. */
      readonly disponible: Milesimas;
      readonly pedido: Milesimas;
      /** Lo que hay en lotes vencidos (informativo: «2 kg vencidos no se usan»). */
      readonly vencido: Milesimas;
    }
  | { readonly codigo: 'lote_no_corresponde'; readonly mensaje: string }
  | { readonly codigo: 'devolucion_excede'; readonly mensaje: string; readonly pendiente: Milesimas }
  | { readonly codigo: 'costo_requerido'; readonly mensaje: string };

const CANTIDAD_INVALIDA: ErrorDeValuacion = {
  codigo: 'cantidad_invalida',
  mensaje: 'La cantidad debe ser mayor que cero.',
};

function stockInsuficiente(disponible: Milesimas, pedido: Milesimas, vencido: Milesimas, avisarVencido: boolean): ErrorDeValuacion {
  const nota = avisarVencido && vencido > 0n ? `; ${formatearCantidad(vencido)} están vencidos y no se usan` : '';
  return {
    codigo: 'stock_insuficiente',
    mensaje: `No alcanza: hay ${formatearCantidad(disponible)} y se pidieron ${formatearCantidad(pedido)}${nota}.`,
    disponible,
    pedido,
    vencido,
  };
}

function esMontoValido(valor: number): boolean {
  return Number.isSafeInteger(valor) && valor >= 0;
}

// ================================================================ PEPS

export interface Lote {
  readonly id: Id;
  readonly fechaIngreso: FechaISO;
  /** Orden de escritura (identity en la base): desempata dos lotes del mismo día. */
  readonly secuencia: number;
  readonly venceEl?: FechaISO;
  readonly cantidadInicial: Milesimas;
  readonly valorInicial: Centavos;
  readonly cantidadRestante: Milesimas;
  readonly valorRestante: Centavos;
}

/** Lo que salió de un lote en una salida («¿de qué compra salió esta harina?»). */
export interface TomaDeLote {
  readonly loteId: Id;
  readonly cantidad: Milesimas;
  readonly valor: Centavos;
  readonly vencido: boolean;
}

export interface SalidaPeps {
  readonly cantidad: Milesimas;
  /** Costo de la salida: la suma de `detalle[].valor`. */
  readonly valor: Centavos;
  readonly detalle: readonly TomaDeLote[];
  /** Los lotes recibidos, en el mismo orden, con lo que les queda. */
  readonly lotes: readonly Lote[];
}

export interface OpcionesDeSalidaPeps {
  /**
   * `false` (uso en clase): los lotes vencidos no se usan (D14).
   * `true` (faltante de conteo, bajas que no son por vencimiento): se consume
   * PRIMERO lo vencido y después el orden PEPS (B.5).
   */
  readonly incluirVencidos?: boolean;
  /** Sacar solo de este lote (baja por vencimiento; lote elegido en el uso, B.12). */
  readonly loteElegido?: Id;
}

/** Vencido = `vence_el < hoy`. Un lote que vence hoy todavía se usa. */
export function estaVencido(lote: Pick<Lote, 'venceEl'>, hoy: FechaISO): boolean {
  return lote.venceEl !== undefined && lote.venceEl < hoy;
}

/** Orden PEPS: fecha de ingreso y, a igual fecha, orden de escritura. */
export function ordenPeps(a: Pick<Lote, 'fechaIngreso' | 'secuencia'>, b: Pick<Lote, 'fechaIngreso' | 'secuencia'>): number {
  if (a.fechaIngreso !== b.fechaIngreso) return a.fechaIngreso < b.fechaIngreso ? -1 : 1;
  return a.secuencia - b.secuencia;
}

/**
 * Salida PEPS (§5.3). Recorre los lotes con existencia en orden PEPS (con lo
 * vencido delante si `incluirVencidos`), toma de cada uno lo que haga falta y
 * lo valoriza en proporción a lo que le queda; si lo agota, se lleva su valor
 * restante exacto. Si no alcanza, no toca nada y devuelve `stock_insuficiente`
 * con lo usable, lo pedido y lo vencido.
 */
export function salidaPeps(
  lotes: readonly Lote[],
  cantidad: Milesimas,
  hoy: FechaISO,
  opciones: OpcionesDeSalidaPeps = {},
): Resultado<SalidaPeps, readonly ErrorDeValuacion[]> {
  if (cantidad <= 0n) return fallo([CANTIDAD_INVALIDA]);

  const incluirVencidos = opciones.incluirVencidos ?? false;
  let alcance = lotes.filter((l) => l.cantidadRestante > 0n);
  if (opciones.loteElegido !== undefined) {
    if (!lotes.some((l) => l.id === opciones.loteElegido)) {
      return fallo([{ codigo: 'lote_no_corresponde', mensaje: 'El lote elegido no es de este artículo y sede.' }]);
    }
    alcance = alcance.filter((l) => l.id === opciones.loteElegido);
  }

  const vencidos = alcance.filter((l) => estaVencido(l, hoy)).sort(ordenPeps);
  const vigentes = alcance.filter((l) => !estaVencido(l, hoy)).sort(ordenPeps);
  const orden = incluirVencidos ? [...vencidos, ...vigentes] : vigentes;

  const usable = sumar(...orden.map((l) => l.cantidadRestante));
  const vencido = sumar(...vencidos.map((l) => l.cantidadRestante));
  if (usable < cantidad) return fallo([stockInsuficiente(usable, cantidad, vencido, !incluirVencidos)]);

  let pendiente: bigint = cantidad;
  let total = 0n;
  const detalle: TomaDeLote[] = [];
  const actualizados = new Map<Id, Lote>();

  for (const lote of orden) {
    if (pendiente === 0n) break;
    const toma = pendiente < lote.cantidadRestante ? pendiente : lote.cantidadRestante;
    const valorRestante = centavosABigInt(lote.valorRestante);
    const valor = toma === lote.cantidadRestante ? valorRestante : redondearProporcion(valorRestante, toma, lote.cantidadRestante);

    detalle.push({ loteId: lote.id, cantidad: comoMilesimas(toma), valor: bigIntACentavos(valor), vencido: estaVencido(lote, hoy) });
    actualizados.set(lote.id, {
      ...lote,
      cantidadRestante: comoMilesimas(lote.cantidadRestante - toma),
      valorRestante: bigIntACentavos(valorRestante - valor),
    });
    pendiente -= toma;
    total += valor;
  }

  return exito({
    cantidad,
    valor: bigIntACentavos(total),
    detalle,
    lotes: lotes.map((l) => actualizados.get(l.id) ?? l),
  });
}

export interface EntradaDeLote {
  readonly id: Id;
  readonly fechaIngreso: FechaISO;
  readonly secuencia: number;
  readonly venceEl?: FechaISO;
  readonly cantidad: Milesimas;
  /** Lo pagado por la línea, entero (no un unitario redondeado). */
  readonly valor: Centavos;
}

/** Entrada PEPS (compra, saldo inicial, sobrante): un lote nuevo con su cantidad y su valor. */
export function entradaPeps(lotes: readonly Lote[], entrada: EntradaDeLote): Resultado<readonly Lote[], readonly ErrorDeValuacion[]> {
  const errores: ErrorDeValuacion[] = [];
  if (entrada.cantidad <= 0n) errores.push(CANTIDAD_INVALIDA);
  if (!esMontoValido(entrada.valor)) errores.push({ codigo: 'monto_invalido', mensaje: 'El valor debe ser un importe en centavos no negativo.' });
  if (errores.length > 0) return fallo(errores);

  const lote: Lote = {
    id: entrada.id,
    fechaIngreso: entrada.fechaIngreso,
    secuencia: entrada.secuencia,
    venceEl: entrada.venceEl,
    cantidadInicial: entrada.cantidad,
    valorInicial: entrada.valor,
    cantidadRestante: entrada.cantidad,
    valorRestante: entrada.valor,
  };
  return exito([...lotes, lote]);
}

/** Lo que hay en los lotes: total, su valor y cuánto está vencido (la existencia de un insumo). */
export function resumenDeLotes(lotes: readonly Lote[], hoy: FechaISO): { readonly cantidad: Milesimas; readonly valor: Centavos; readonly vencido: Milesimas } {
  return {
    cantidad: sumar(...lotes.map((l) => l.cantidadRestante)),
    valor: bigIntACentavos(lotes.reduce((t, l) => t + centavosABigInt(l.valorRestante), 0n)),
    vencido: sumar(...lotes.filter((l) => estaVencido(l, hoy)).map((l) => l.cantidadRestante)),
  };
}

// ================================================================ Promedio

/**
 * La capa de costo promedio de una variante en una sede. En utensilios,
 * `prestado` sigue siendo del instituto y sigue valiendo: el promedio se
 * calcula sobre `disponible + prestado`.
 */
export interface SaldoPromedio {
  readonly disponible: Milesimas;
  readonly prestado: Milesimas;
  readonly valor: Centavos;
}

export interface SalidaPromedio {
  readonly cantidad: Milesimas;
  readonly valor: Centavos;
  readonly saldo: SaldoPromedio;
}

export function totalDe(saldo: Pick<SaldoPromedio, 'disponible' | 'prestado'>): Milesimas {
  return comoMilesimas(saldo.disponible + saldo.prestado);
}

/** Costo por unidad, SOLO para mostrar («cada juego M nos cuesta Bs 320»). Nulo si no hay existencia. */
export function costoPromedio(saldo: SaldoPromedio): Centavos | null {
  const total = totalDe(saldo);
  if (total === 0n) return null;
  return bigIntACentavos(redondearProporcion(centavosABigInt(saldo.valor), 1000n, total));
}

/** Entrada a la capa (compra, saldo inicial, sobrante, devolución de uniforme). */
export function entradaPromedio(saldo: SaldoPromedio, cantidad: Milesimas, valor: Centavos): Resultado<SaldoPromedio, readonly ErrorDeValuacion[]> {
  const errores: ErrorDeValuacion[] = [];
  if (cantidad <= 0n) errores.push(CANTIDAD_INVALIDA);
  if (!esMontoValido(valor)) errores.push({ codigo: 'monto_invalido', mensaje: 'El valor debe ser un importe en centavos no negativo.' });
  if (errores.length > 0) return fallo(errores);
  return exito({
    disponible: comoMilesimas(saldo.disponible + cantidad),
    prestado: saldo.prestado,
    valor: bigIntACentavos(centavosABigInt(saldo.valor) + centavosABigInt(valor)),
  });
}

/**
 * Salida a costo promedio (§5.4): `round(valor × q / total)`; si agota la
 * capa, se lleva el valor que quede. `desde: 'prestado'` es la pérdida o la
 * rotura de un utensilio que estaba prestado (§5.5).
 */
export function salidaPromedio(
  saldo: SaldoPromedio,
  cantidad: Milesimas,
  opciones: { readonly desde?: 'disponible' | 'prestado' } = {},
): Resultado<SalidaPromedio, readonly ErrorDeValuacion[]> {
  if (cantidad <= 0n) return fallo([CANTIDAD_INVALIDA]);

  const desde = opciones.desde ?? 'disponible';
  const alcance = desde === 'disponible' ? saldo.disponible : saldo.prestado;
  if (alcance < cantidad) return fallo([stockInsuficiente(alcance, cantidad, CERO, false)]);

  const total = totalDe(saldo);
  const valorCapa = centavosABigInt(saldo.valor);
  const valor = cantidad === total ? valorCapa : redondearProporcion(valorCapa, cantidad, total);

  return exito({
    cantidad,
    valor: bigIntACentavos(valor),
    saldo: {
      disponible: desde === 'disponible' ? comoMilesimas(saldo.disponible - cantidad) : saldo.disponible,
      prestado: desde === 'prestado' ? comoMilesimas(saldo.prestado - cantidad) : saldo.prestado,
      valor: bigIntACentavos(valorCapa - valor),
    },
  });
}

/** Prestar es custodia (§5.5): pasa de disponible a prestado y el valor NO cambia. */
export function prestar(saldo: SaldoPromedio, cantidad: Milesimas): Resultado<SaldoPromedio, readonly ErrorDeValuacion[]> {
  if (cantidad <= 0n) return fallo([CANTIDAD_INVALIDA]);
  if (saldo.disponible < cantidad) return fallo([stockInsuficiente(saldo.disponible, cantidad, CERO, false)]);
  return exito({
    disponible: comoMilesimas(saldo.disponible - cantidad),
    prestado: comoMilesimas(saldo.prestado + cantidad),
    valor: saldo.valor,
  });
}

/** Lo prestado vuelve al estante; el valor tampoco cambia. */
export function recibirPrestado(saldo: SaldoPromedio, cantidad: Milesimas): Resultado<SaldoPromedio, readonly ErrorDeValuacion[]> {
  if (cantidad <= 0n) return fallo([CANTIDAD_INVALIDA]);
  if (saldo.prestado < cantidad) {
    return fallo([{ codigo: 'devolucion_excede', mensaje: `Solo hay ${formatearCantidad(saldo.prestado)} prestados.`, pendiente: saldo.prestado }]);
  }
  return exito({
    disponible: comoMilesimas(saldo.disponible + cantidad),
    prestado: comoMilesimas(saldo.prestado - cantidad),
    valor: saldo.valor,
  });
}

// ================================================================ Devolución de uniforme

export interface EntregaValorizada {
  /** Piezas entregadas, en milésimas (3 juegos = 3000n). */
  readonly cantidad: Milesimas;
  /** Lo que valía la entrega cuando salió (su costo promedio de ese día). */
  readonly valor: Centavos;
  /** Lo ya devuelto antes de esta devolución. */
  readonly devuelta: Milesimas;
  readonly valorDevuelto: Centavos;
}

/**
 * Lo que vuelve vale LO QUE VALÍA AL SALIR, no el promedio de hoy (§5.4):
 * `round(valor_entrega × q / cantidad_entrega)`, y la última pieza devuelta
 * de la entrega se lleva el resto exacto. Así entrega y devolución se anulan
 * al centavo.
 *
 * Tope: una devolución parcial nunca vale más de lo que le queda a la
 * entrega. Con piezas de valor ínfimo (p. ej. 8 piezas por 5 c devueltas de a
 * una) el redondeo de cada pieza podría pasarse y dejar la última en negativo;
 * el tope lo impide (y la última se queda con 0).
 */
export function valorDeDevolucion(entrega: EntregaValorizada, cantidad: Milesimas): Resultado<Centavos, readonly ErrorDeValuacion[]> {
  if (cantidad <= 0n) return fallo([CANTIDAD_INVALIDA]);
  const pendiente = comoMilesimas(entrega.cantidad - entrega.devuelta);
  if (cantidad > pendiente) {
    return fallo([
      {
        codigo: 'devolucion_excede',
        mensaje: `De esta entrega quedan ${formatearCantidad(pendiente)} por devolver.`,
        pendiente,
      },
    ]);
  }
  const resto = centavosABigInt(entrega.valor) - centavosABigInt(entrega.valorDevuelto);
  if (cantidad === pendiente) return exito(bigIntACentavos(resto));
  const proporcional = redondearProporcion(centavosABigInt(entrega.valor), cantidad, entrega.cantidad);
  return exito(bigIntACentavos(proporcional < resto ? proporcional : resto));
}

// ================================================================ Sobrante de conteo

export type OrigenDelCostoDeSobrante = 'ultimo_lote' | 'promedio' | 'ultima_compra' | 'indicado';

export interface ValorDeSobrante {
  readonly valor: Centavos;
  readonly origen: OrigenDelCostoDeSobrante;
}

/**
 * Sobrante de un insumo (§5.3, D16): lote nuevo al costo por unidad del
 * ÚLTIMO LOTE INGRESADO, `round(valor_inicial × q / cantidad_inicial)`. Por
 * eso hay que pasar también los lotes ya agotados. Sin ningún lote, al costo
 * que escribe administración; sin él, `costo_requerido`.
 *
 * El costo indicado solo se usa cuando no hay costo de referencia: un conteo
 * no es la vía para revalorizar el inventario.
 */
export function valorDeSobrantePeps(
  lotes: readonly Lote[],
  cantidad: Milesimas,
  valorIndicado?: Centavos,
): Resultado<ValorDeSobrante, readonly ErrorDeValuacion[]> {
  if (cantidad <= 0n) return fallo([CANTIDAD_INVALIDA]);
  const ultimo = [...lotes].sort(ordenPeps).at(-1);
  if (ultimo && ultimo.cantidadInicial > 0n) {
    const valor = redondearProporcion(centavosABigInt(ultimo.valorInicial), cantidad, ultimo.cantidadInicial);
    return exito({ valor: bigIntACentavos(valor), origen: 'ultimo_lote' });
  }
  return costoIndicado(valorIndicado);
}

/**
 * Sobrante a costo promedio (crítica 24): si hay existencia, al promedio
 * vigente; si no, al último costo unitario de compra; si nunca hubo compras,
 * al costo que escribe administración; sin él, `costo_requerido`.
 */
export function valorDeSobrantePromedio(
  saldo: SaldoPromedio,
  cantidad: Milesimas,
  referencias: {
    readonly ultimaCompra?: { readonly cantidad: Milesimas; readonly valor: Centavos };
    readonly valorIndicado?: Centavos;
  } = {},
): Resultado<ValorDeSobrante, readonly ErrorDeValuacion[]> {
  if (cantidad <= 0n) return fallo([CANTIDAD_INVALIDA]);
  const total = totalDe(saldo);
  if (total > 0n) {
    return exito({ valor: bigIntACentavos(redondearProporcion(centavosABigInt(saldo.valor), cantidad, total)), origen: 'promedio' });
  }
  const compra = referencias.ultimaCompra;
  if (compra && compra.cantidad > 0n) {
    return exito({
      valor: bigIntACentavos(redondearProporcion(centavosABigInt(compra.valor), cantidad, compra.cantidad)),
      origen: 'ultima_compra',
    });
  }
  return costoIndicado(referencias.valorIndicado);
}

function costoIndicado(valor: Centavos | undefined): Resultado<ValorDeSobrante, readonly ErrorDeValuacion[]> {
  if (valor === undefined) {
    return fallo([{ codigo: 'costo_requerido', mensaje: 'No hay compras de referencia: escribe cuánto vale lo que sobró.' }]);
  }
  if (!esMontoValido(valor)) return fallo([{ codigo: 'monto_invalido', mensaje: 'El costo debe ser un importe en centavos no negativo.' }]);
  return exito({ valor, origen: 'indicado' });
}
