/**
 * CAPA: Domain / Inventario
 *
 * El libro de movimientos (ADR 0003). Es INMUTABLE: nunca se edita ni se
 * borra un movimiento; un error se corrige con el inverso. El stock de una
 * variante en una sede es el resultado de aplicar sus movimientos en orden.
 *
 * Reglas que viven aquí: I1 (el tipo decide qué movimientos admite),
 * I2 (nunca negativo), I3 (ajuste fija con motivo), I4 (inmutable).
 * La base las repite; la pantalla las anticipa; el dominio las define.
 *
 * Sin React, sin Next, sin I/O.
 */

import { exito, fallo, fechaISO, type FechaISO, type Id, type Resultado } from '../shared/tipos-base';
import { admiteCantidadFraccionaria, COMPORTAMIENTO_POR_TIPO, type Articulo } from './articulo';

export type TipoDeMovimiento = 'entrada' | 'salida' | 'entrega' | 'devolucion' | 'ajuste' | 'baja';

export const ETIQUETA_DE_MOVIMIENTO: Record<TipoDeMovimiento, string> = {
  entrada: 'Entrada',
  salida: 'Salida',
  entrega: 'Entrega a estudiante',
  devolucion: 'Devolución de estudiante',
  ajuste: 'Ajuste de existencia',
  baja: 'Baja',
};

/** +1 suma, -1 resta, 0 fija la existencia al valor indicado (`ajuste`). */
export const SIGNO_POR_TIPO: Record<TipoDeMovimiento, 1 | -1 | 0> = {
  entrada: 1,
  devolucion: 1,
  salida: -1,
  entrega: -1,
  baja: -1,
  ajuste: 0,
};

/** Tipos que exigen explicar por qué. */
const TIPOS_CON_MOTIVO_OBLIGATORIO: readonly TipoDeMovimiento[] = ['ajuste', 'baja'];

export type TipoDeReferencia = 'entrega' | 'compra' | 'otro';

export interface Referencia {
  readonly tipo: TipoDeReferencia;
  readonly id: Id;
}

export interface Movimiento {
  readonly id: Id;
  readonly varianteId: Id;
  readonly sedeId: Id;
  readonly tipo: TipoDeMovimiento;
  /** Siempre positiva. En `ajuste` es la existencia resultante (puede ser 0). */
  readonly cantidad: number;
  readonly fecha: FechaISO;
  /** Sale de la sesión, nunca del formulario. */
  readonly responsableId: Id;
  readonly motivo?: string;
  readonly referencia?: Referencia;
  readonly nota?: string;
}

export type DatosDeMovimiento = Omit<Movimiento, 'id'>;

/**
 * Valida un movimiento contra el artículo de su variante. Devuelve todos los
 * errores. No mira el stock: eso lo hace `aplicarMovimiento`, que necesita
 * la existencia actual.
 */
export function validarMovimiento(
  datos: DatosDeMovimiento,
  articulo: Pick<Articulo, 'tipo' | 'unidad' | 'activo' | 'nombre'>,
): Resultado<DatosDeMovimiento, readonly string[]> {
  const errores: string[] = [];
  const comportamiento = COMPORTAMIENTO_POR_TIPO[articulo.tipo];

  if (!(datos.tipo in SIGNO_POR_TIPO)) errores.push(`Tipo de movimiento desconocido: "${datos.tipo}".`);

  if (!articulo.activo) errores.push(`El artículo "${articulo.nombre}" está inactivo.`);

  if (!Number.isFinite(datos.cantidad)) {
    errores.push('La cantidad debe ser un número.');
  } else if (datos.tipo === 'ajuste' ? datos.cantidad < 0 : datos.cantidad <= 0) {
    errores.push(datos.tipo === 'ajuste' ? 'Un ajuste fija la existencia a un valor no negativo.' : 'La cantidad debe ser mayor que cero.');
  } else if (!Number.isInteger(datos.cantidad) && !admiteCantidadFraccionaria(articulo)) {
    errores.push(`"${articulo.nombre}" se cuenta por unidades enteras (${articulo.unidad}).`);
  }

  const fecha = fechaISO(datos.fecha);
  if (!fecha.exito) errores.push(fecha.error);

  if (TIPOS_CON_MOTIVO_OBLIGATORIO.includes(datos.tipo) && !datos.motivo?.trim()) {
    errores.push(`Un movimiento de tipo "${ETIQUETA_DE_MOVIMIENTO[datos.tipo]}" exige un motivo.`);
  }

  if (datos.tipo === 'entrega') {
    if (!comportamiento.seEntregaAEstudiantes) {
      errores.push(`Un artículo de tipo "${comportamiento.etiqueta}" no se entrega a estudiantes.`);
    }
    if (datos.referencia?.tipo !== 'entrega') {
      errores.push('Un movimiento de entrega debe referenciar la entrega que lo origina (regla I5).');
    }
  }

  if (datos.tipo === 'devolucion') {
    if (!comportamiento.admiteDevolucion) {
      errores.push(`Un artículo de tipo "${comportamiento.etiqueta}" no admite devolución.`);
    }
    if (datos.referencia?.tipo !== 'entrega') {
      errores.push('Una devolución debe referenciar la entrega que se devuelve (regla I5).');
    }
  }

  if (!datos.responsableId) errores.push('El movimiento debe tener un responsable.');

  return errores.length > 0 ? fallo(errores) : exito(datos);
}

/**
 * Regla I2: aplica un movimiento a la existencia actual y devuelve la nueva.
 * Rechaza cualquier resultado negativo; la base lo repite con un CHECK.
 */
export function aplicarMovimiento(
  stockActual: number,
  movimiento: Pick<DatosDeMovimiento, 'tipo' | 'cantidad'>,
): Resultado<number> {
  if (!Number.isFinite(stockActual) || stockActual < 0) {
    return fallo(`La existencia actual no es válida (${stockActual}).`);
  }
  const signo = SIGNO_POR_TIPO[movimiento.tipo];
  if (signo === undefined) return fallo(`Tipo de movimiento desconocido: "${movimiento.tipo}".`);

  if (signo === 0) return exito(redondear(movimiento.cantidad));

  const nuevo = redondear(stockActual + signo * movimiento.cantidad);
  if (nuevo < 0) {
    return fallo(
      `No hay existencia suficiente: hay ${stockActual} y el movimiento retira ${movimiento.cantidad}.`,
    );
  }
  return exito(nuevo);
}

/**
 * Existencia resultante de una secuencia de movimientos, en orden de fecha y,
 * a igual fecha, en el orden recibido. Falla en el primer movimiento que
 * dejaría la existencia negativa: un libro con ese asiento está corrupto y
 * hay que saberlo, no promediarlo.
 */
export function calcularStock(
  movimientos: readonly Pick<DatosDeMovimiento, 'tipo' | 'cantidad' | 'fecha'>[],
  inicial = 0,
): Resultado<number> {
  const ordenados = movimientos
    .map((m, indice) => ({ m, indice }))
    .sort((a, b) => (a.m.fecha < b.m.fecha ? -1 : a.m.fecha > b.m.fecha ? 1 : a.indice - b.indice));

  let stock = inicial;
  for (const { m } of ordenados) {
    const resultado = aplicarMovimiento(stock, m);
    if (!resultado.exito) return resultado;
    stock = resultado.valor;
  }
  return exito(stock);
}

/** Tres decimales bastan para gramos y mililitros; evita 0.1 + 0.2 = 0.30000000000000004. */
function redondear(valor: number): number {
  return Math.round(valor * 1000) / 1000;
}
