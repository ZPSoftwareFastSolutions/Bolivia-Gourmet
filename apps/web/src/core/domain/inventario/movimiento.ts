/**
 * CAPA: Domain / Inventario
 *
 * El libro de movimientos o kárdex (ADR 0003, especificación §2.5). Es
 * INMUTABLE: nunca se edita ni se borra un movimiento; un error se corrige con
 * una anulación (el asiento inverso exacto) o con un conteo.
 *
 * Cada movimiento mueve dos saldos de una variante en una sede: DISPONIBLE
 * (en el estante) y PRESTADO (utensilios fuera). Su efecto se expresa en
 * deltas con signo; ninguno de los dos saldos queda nunca negativo (I2).
 *
 * Ya no existe el «ajuste que fija la existencia» (D15): con lotes no se sabe
 * de qué lote sale o entra la diferencia. El conteo físico compara lo que
 * mostraba la pantalla con lo contado y produce un FALTANTE (salida), un
 * SOBRANTE (entrada) o una CONSTANCIA (sin movimiento).
 *
 * Quién lo registró sale de la sesión en la base (`auth.uid()`), nunca del
 * formulario; por eso no está en los datos.
 *
 * Sin React, sin Next, sin I/O.
 */

import { comoMilesimas, esEntera, type Milesimas } from '../shared/cantidad';
import { exito, fallo, fechaISO, type FechaISO, type Id, type Resultado } from '../shared/tipos-base';
import { admiteCantidadFraccionaria, COMPORTAMIENTO_POR_TIPO, type Articulo, type TipoDeArticulo } from './articulo';

export type TipoDeMovimiento =
  | 'saldo_inicial'
  | 'compra'
  | 'consumo'
  | 'entrega'
  | 'devolucion_entrega'
  | 'prestamo'
  | 'devolucion_prestamo'
  | 'baja'
  | 'ajuste_faltante'
  | 'ajuste_sobrante'
  | 'anulacion';

export const TIPOS_DE_MOVIMIENTO: readonly TipoDeMovimiento[] = [
  'saldo_inicial',
  'compra',
  'consumo',
  'entrega',
  'devolucion_entrega',
  'prestamo',
  'devolucion_prestamo',
  'baja',
  'ajuste_faltante',
  'ajuste_sobrante',
  'anulacion',
];

/** Rótulo de la fila del kárdex. */
export const ETIQUETA_DE_MOVIMIENTO: Record<TipoDeMovimiento, string> = {
  saldo_inicial: 'Saldo inicial',
  compra: 'Compra',
  consumo: 'Usado en clase',
  entrega: 'Entrega de uniforme',
  devolucion_entrega: 'Devolución de uniforme',
  prestamo: 'Préstamo',
  devolucion_prestamo: 'Devolución de préstamo',
  baja: 'Baja',
  ajuste_faltante: 'Faltante por conteo',
  ajuste_sobrante: 'Sobrante por conteo',
  anulacion: 'Anulación',
};

type Signo = -1 | 0 | 1;

/**
 * Signo de cada tipo sobre disponible y prestado (tabla de §2.5). La
 * anulación no tiene signo propio: es el inverso de su original. La baja de
 * algo que estaba prestado (se perdió en un préstamo) resta de prestado y no
 * de disponible: lo resuelve `deltasDe` con `desdePrestado`.
 */
export const SIGNOS_POR_TIPO: Record<Exclude<TipoDeMovimiento, 'anulacion'>, { readonly disponible: Signo; readonly prestado: Signo }> = {
  saldo_inicial: { disponible: 1, prestado: 0 },
  compra: { disponible: 1, prestado: 0 },
  consumo: { disponible: -1, prestado: 0 },
  entrega: { disponible: -1, prestado: 0 },
  devolucion_entrega: { disponible: 1, prestado: 0 },
  prestamo: { disponible: -1, prestado: 1 },
  devolucion_prestamo: { disponible: 1, prestado: -1 },
  baja: { disponible: -1, prestado: 0 },
  ajuste_faltante: { disponible: -1, prestado: 0 },
  ajuste_sobrante: { disponible: 1, prestado: 0 },
};

/** Para qué se usó un insumo (`destino_de_uso`). */
export type DestinoDeUso = 'clase' | 'practica' | 'evento' | 'degustacion' | 'uso_interno' | 'otro';

export const ETIQUETA_DE_DESTINO: Record<DestinoDeUso, string> = {
  clase: 'Clase',
  practica: 'Práctica',
  evento: 'Evento',
  degustacion: 'Degustación',
  uso_interno: 'Uso interno',
  otro: 'Otro',
};

export type MotivoDeBaja = 'vencimiento' | 'dano' | 'rotura' | 'perdida' | 'merma' | 'otro';

export const ETIQUETA_DE_MOTIVO_DE_BAJA: Record<MotivoDeBaja, string> = {
  vencimiento: 'Se venció',
  dano: 'Se dañó',
  rotura: 'Se rompió',
  perdida: 'Se perdió',
  merma: 'Merma',
  otro: 'Otro',
};

/** Lo que se puede anular (§3.9; B.12: también el saldo inicial). Entregas y préstamos se DEVUELVEN. */
export const TIPOS_ANULABLES: readonly TipoDeMovimiento[] = ['saldo_inicial', 'compra', 'consumo', 'baja'];

export interface Movimiento {
  readonly id: Id;
  /** Agrupa las líneas de un mismo documento (un uso en clase son los movimientos de su operación). */
  readonly operacionId: Id;
  readonly varianteId: Id;
  readonly sedeId: Id;
  readonly tipo: TipoDeMovimiento;
  readonly fecha: FechaISO;
  /** Siempre positiva; el signo lo dan los deltas. */
  readonly cantidad: Milesimas;
  readonly destino?: DestinoDeUso;
  /** Grupo de la clase (solo `consumo`). */
  readonly cohorteId?: Id;
  /** Tema de la clase, motivo de la baja o del ajuste, nota. Hasta 300 caracteres. */
  readonly detalle?: string;
  readonly motivoBaja?: MotivoDeBaja;
  /** Baja de lo que estaba prestado (perdido o roto en un préstamo). */
  readonly desdePrestado?: boolean;
  readonly compraId?: Id;
  readonly entregaId?: Id;
  readonly prestamoId?: Id;
  readonly conteoId?: Id;
  /** Lote creado (entrada PEPS) o elegido (baja de un lote vencido). */
  readonly loteId?: Id;
  /** El movimiento que esta anulación deshace. */
  readonly anulaA?: Id;
}

export type DatosDeMovimiento = Omit<Movimiento, 'id' | 'operacionId'>;

// ---------------------------------------------------------------- Reglas por tipo

/** Regla I1: el tipo del artículo decide qué movimientos admite. */
export function admiteMovimiento(tipoDeArticulo: TipoDeArticulo, tipo: TipoDeMovimiento): boolean {
  const c = COMPORTAMIENTO_POR_TIPO[tipoDeArticulo];
  switch (tipo) {
    case 'consumo':
      return c.admiteUso;
    case 'entrega':
    case 'devolucion_entrega':
      return c.admiteEntrega;
    case 'prestamo':
    case 'devolucion_prestamo':
      return c.admitePrestamo;
    default:
      return true;
  }
}

/** La referencia que exige cada tipo (`check` de la base). */
const REFERENCIA_POR_TIPO: Partial<Record<TipoDeMovimiento, { readonly campo: keyof DatosDeMovimiento; readonly nombre: string }>> = {
  saldo_inicial: { campo: 'conteoId', nombre: 'el documento de saldo inicial' },
  compra: { campo: 'compraId', nombre: 'la compra' },
  entrega: { campo: 'entregaId', nombre: 'la entrega' },
  devolucion_entrega: { campo: 'entregaId', nombre: 'la entrega que se devuelve' },
  prestamo: { campo: 'prestamoId', nombre: 'el préstamo' },
  devolucion_prestamo: { campo: 'prestamoId', nombre: 'el préstamo que se devuelve' },
  ajuste_faltante: { campo: 'conteoId', nombre: 'el conteo' },
  ajuste_sobrante: { campo: 'conteoId', nombre: 'el conteo' },
  anulacion: { campo: 'anulaA', nombre: 'el movimiento que se anula' },
};

/**
 * Valida un movimiento contra el artículo de su variante. Devuelve TODOS los
 * errores. No mira la existencia: eso lo hace `aplicarMovimiento` con el
 * saldo actual (y la base, con la fila bloqueada).
 */
export function validarMovimiento(
  datos: DatosDeMovimiento,
  articulo: Pick<Articulo, 'tipo' | 'unidad' | 'activo' | 'nombre'>,
): Resultado<DatosDeMovimiento, readonly string[]> {
  const errores: string[] = [];
  const comportamiento = COMPORTAMIENTO_POR_TIPO[articulo.tipo];
  const conocido = TIPOS_DE_MOVIMIENTO.includes(datos.tipo);

  if (!conocido) errores.push(`Tipo de movimiento desconocido: "${datos.tipo}".`);

  // Un artículo inactivo no admite operaciones nuevas, pero lo ya hecho se
  // puede seguir corrigiendo.
  if (!articulo.activo && datos.tipo !== 'anulacion') errores.push(`El artículo "${articulo.nombre}" está inactivo.`);

  if (datos.cantidad <= 0n) {
    errores.push('La cantidad debe ser mayor que cero.');
  } else if (!esEntera(datos.cantidad) && !admiteCantidadFraccionaria(articulo)) {
    errores.push(`"${articulo.nombre}" se cuenta por unidades enteras.`);
  }

  const fecha = fechaISO(datos.fecha);
  if (!fecha.exito) errores.push(fecha.error);

  if (conocido && !admiteMovimiento(articulo.tipo, datos.tipo)) {
    errores.push(`Un artículo de tipo "${comportamiento.etiqueta}" no admite «${ETIQUETA_DE_MOVIMIENTO[datos.tipo]}».`);
  }

  const referencia = REFERENCIA_POR_TIPO[datos.tipo];
  if (referencia && !datos[referencia.campo]) errores.push(`El movimiento debe indicar ${referencia.nombre}.`);

  const detalle = datos.detalle?.trim() ?? '';
  if (detalle.length > 300) errores.push('El detalle admite hasta 300 caracteres.');

  if (datos.tipo === 'consumo') {
    if (!datos.destino) errores.push('Indica para qué se usó (clase, práctica, evento…).');
    else if (!(datos.destino in ETIQUETA_DE_DESTINO)) errores.push(`Destino desconocido: "${datos.destino}".`);
    else if (datos.destino === 'otro' && detalle.length === 0) errores.push('Explica en qué se usó.');
  } else {
    if (datos.destino) errores.push('Solo el uso en clase lleva destino.');
    if (datos.cohorteId) errores.push('Solo el uso en clase se asocia a un grupo.');
  }

  if (datos.tipo === 'baja') {
    if (!datos.motivoBaja) errores.push('Una baja exige el motivo (se venció, se dañó, se rompió…).');
    else if (!(datos.motivoBaja in ETIQUETA_DE_MOTIVO_DE_BAJA)) errores.push(`Motivo de baja desconocido: "${datos.motivoBaja}".`);
    if (detalle.length === 0) errores.push('Una baja exige una frase que explique qué pasó.');
    // Lo vencido se tira por lote: es lo que físicamente sale del estante (§5.3).
    if (datos.motivoBaja === 'vencimiento' && comportamiento.valuacion === 'peps' && !datos.loteId) {
      errores.push('Una baja por vencimiento debe indicar el lote vencido.');
    }
    if (datos.desdePrestado) {
      if (!comportamiento.admitePrestamo) errores.push('Solo un utensilio puede darse de baja estando prestado.');
      if (!datos.prestamoId) errores.push('La baja de algo prestado debe indicar el préstamo.');
    }
  } else {
    if (datos.motivoBaja) errores.push('Solo una baja lleva motivo de baja.');
    if (datos.desdePrestado) errores.push('Solo una baja puede salir de lo prestado.');
  }

  return errores.length > 0 ? fallo(errores) : exito(datos);
}

/**
 * Si un movimiento ya registrado se puede anular. Entregas y préstamos no se
 * anulan, se devuelven; una baja nacida en una devolución de préstamo
 * tampoco (B.12, crítica 12: descuadraría el préstamo); ni una anulación.
 */
export function validarAnulacion(original: Pick<Movimiento, 'tipo' | 'prestamoId'> & { readonly anulado?: boolean }): Resultado<true, readonly string[]> {
  const errores: string[] = [];
  if (!TIPOS_ANULABLES.includes(original.tipo)) {
    errores.push(`«${ETIQUETA_DE_MOVIMIENTO[original.tipo]}» no se anula${original.tipo === 'entrega' || original.tipo === 'prestamo' ? ': se devuelve' : ''}.`);
  }
  if (original.tipo === 'baja' && original.prestamoId) {
    errores.push('Esta baja salió de una devolución de préstamo y no se anula.');
  }
  if (original.anulado) errores.push('Este movimiento ya fue anulado.');
  return errores.length > 0 ? fallo(errores) : exito(true);
}

// ---------------------------------------------------------------- Deltas y saldos

export interface Deltas {
  readonly disponible: bigint;
  readonly prestado: bigint;
}

export interface Saldo {
  readonly disponible: Milesimas;
  readonly prestado: Milesimas;
}

export const SALDO_VACIO: Saldo = { disponible: comoMilesimas(0n), prestado: comoMilesimas(0n) };

/**
 * Deltas de un movimiento. La anulación necesita los deltas de su original y
 * devuelve exactamente el inverso.
 */
export function deltasDe(
  movimiento: Pick<DatosDeMovimiento, 'tipo' | 'cantidad' | 'desdePrestado'>,
  original?: Deltas,
): Resultado<Deltas> {
  if (movimiento.tipo === 'anulacion') {
    if (!original) return fallo('Una anulación necesita el movimiento que anula.');
    return exito({ disponible: -original.disponible, prestado: -original.prestado });
  }
  const signos = SIGNOS_POR_TIPO[movimiento.tipo] as (typeof SIGNOS_POR_TIPO)[keyof typeof SIGNOS_POR_TIPO] | undefined;
  if (!signos) return fallo(`Tipo de movimiento desconocido: "${movimiento.tipo}".`);
  if (movimiento.tipo === 'baja' && movimiento.desdePrestado) {
    return exito({ disponible: 0n, prestado: -movimiento.cantidad });
  }
  return exito({
    disponible: BigInt(signos.disponible) * movimiento.cantidad,
    prestado: BigInt(signos.prestado) * movimiento.cantidad,
  });
}

/** Regla I2: aplica unos deltas al saldo y rechaza cualquier resultado negativo. */
export function aplicarMovimiento(saldo: Saldo, deltas: Deltas): Resultado<Saldo> {
  if (saldo.disponible < 0n || saldo.prestado < 0n) return fallo('El saldo actual no es válido.');
  const disponible = saldo.disponible + deltas.disponible;
  const prestado = saldo.prestado + deltas.prestado;
  if (disponible < 0n) return fallo('No hay existencia suficiente en el estante para este movimiento.');
  if (prestado < 0n) return fallo('No hay tantas piezas prestadas.');
  return exito({ disponible: comoMilesimas(disponible), prestado: comoMilesimas(prestado) });
}

/**
 * Saldo resultante de aplicar unos deltas EN ORDEN DE ESCRITURA (el `numero`
 * del libro). Falla en el primero que dejaría un saldo negativo: un libro con
 * ese asiento está corrupto y hay que saberlo, no promediarlo.
 */
export function calcularSaldo(deltas: readonly Deltas[], inicial: Saldo = SALDO_VACIO): Resultado<Saldo> {
  let saldo = inicial;
  for (const d of deltas) {
    const resultado = aplicarMovimiento(saldo, d);
    if (!resultado.exito) return resultado;
    saldo = resultado.valor;
  }
  return exito(saldo);
}

// ---------------------------------------------------------------- Conteo físico

export type ResultadoDeConteo =
  | { readonly tipo: 'ajuste_faltante'; readonly cantidad: Milesimas }
  | { readonly tipo: 'ajuste_sobrante'; readonly cantidad: Milesimas }
  /** Coincidió: no hay movimiento, la línea queda como constancia. */
  | { readonly tipo: 'constancia' };

/**
 * Conteo físico (D15): lo que mostraba la pantalla (`existenciaVista`) contra
 * lo contado. Falta → faltante por la diferencia; sobra → sobrante; igual →
 * constancia.
 */
export function conteo(existenciaVista: Milesimas, contado: Milesimas): Resultado<ResultadoDeConteo, readonly string[]> {
  const errores: string[] = [];
  if (existenciaVista < 0n) errores.push('La existencia mostrada no puede ser negativa.');
  if (contado < 0n) errores.push('Lo contado no puede ser negativo.');
  if (errores.length > 0) return fallo(errores);

  if (contado < existenciaVista) return exito({ tipo: 'ajuste_faltante', cantidad: comoMilesimas(existenciaVista - contado) });
  if (contado > existenciaVista) return exito({ tipo: 'ajuste_sobrante', cantidad: comoMilesimas(contado - existenciaVista) });
  return exito({ tipo: 'constancia' });
}

export interface LineaDeConteo {
  readonly existenciaVista: Milesimas;
  readonly contado: Milesimas;
  readonly motivo?: string;
}

/**
 * Una línea del formulario de conteo: además de `conteo`, exige motivo si hay
 * diferencia, piezas enteras donde corresponde y que nadie haya movido el
 * artículo mientras se contaba (`existencia_cambio`: la base compara con el
 * `disponible`, que incluye lo vencido, B.5).
 */
export function validarLineaDeConteo(
  linea: LineaDeConteo,
  articulo: Pick<Articulo, 'tipo' | 'unidad' | 'nombre'>,
  disponibleActual: Milesimas,
): Resultado<ResultadoDeConteo, readonly string[]> {
  const errores: string[] = [];
  if (!admiteCantidadFraccionaria(articulo) && !esEntera(linea.contado)) {
    errores.push(`"${articulo.nombre}" se cuenta por unidades enteras.`);
  }
  if (existenciaCambio(linea.existenciaVista, disponibleActual)) {
    errores.push(`"${articulo.nombre}" se movió mientras contabas: vuelve a contarlo.`);
  }
  const resultado = conteo(linea.existenciaVista, linea.contado);
  if (!resultado.exito) errores.push(...resultado.error);
  else if (resultado.valor.tipo !== 'constancia' && !linea.motivo?.trim()) {
    errores.push(`Explica la diferencia de "${articulo.nombre}".`);
  }
  return errores.length > 0 || !resultado.exito ? fallo(errores) : exito(resultado.valor);
}

/** La existencia cambió entre que se mostró y se guardó el conteo. */
export function existenciaCambio(existenciaVista: Milesimas, disponibleActual: Milesimas): boolean {
  return existenciaVista !== disponibleActual;
}
