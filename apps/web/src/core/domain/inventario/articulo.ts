/**
 * CAPA: Domain / Inventario
 *
 * Artículo y variante (ADR 0003, especificación §2.5). El TIPO del artículo
 * decide su comportamiento: cómo se valoriza, qué operaciones admite y si
 * admite decimales. La CATEGORÍA es texto libre del usuario y no cambia nada
 * (D23). Añadir un tipo nuevo es añadir una fila a `COMPORTAMIENTO_POR_TIPO`;
 * el resto del dominio lo lee de ahí.
 *
 * Sin React, sin Next, sin I/O.
 */

import { UNIDADES, type Milesimas, type Unidad } from '../shared/cantidad';
import { exito, fallo, textoObligatorio, type Centavos, type Id, type Resultado } from '../shared/tipos-base';
import type { MetodoDeValuacion } from './valuacion';

export { UNIDADES };
export type { Unidad };

export type TipoDeArticulo = 'utensilio' | 'insumo' | 'uniforme' | 'otro';

export const TIPOS_DE_ARTICULO: readonly TipoDeArticulo[] = ['uniforme', 'utensilio', 'insumo', 'otro'];

export interface ComportamientoDeTipo {
  readonly etiqueta: string;
  /** PEPS (lotes) en insumos; costo promedio ponderado en el resto (D18). */
  readonly valuacion: MetodoDeValuacion;
  /** Se usa en clase (movimiento `consumo`). */
  readonly admiteUso: boolean;
  /** Se entrega a un alumno inscrito y puede devolverse (`entrega`, `devolucion_entrega`). */
  readonly admiteEntrega: boolean;
  /** Se presta y vuelve (`prestamo`, `devolucion_prestamo`); prestar no cambia su valor. */
  readonly admitePrestamo: boolean;
  /** Puede llevar vencimiento por lote (solo los insumos tienen lotes). */
  readonly controlaVencimiento: boolean;
  /** Puede tener precio de venta (el juego de uniforme, D17). */
  readonly admitePrecioVenta: boolean;
  /** Sus variantes son tallas. */
  readonly usaTallas: boolean;
  /** Admite cantidades con decimales si su unidad es fraccionable (kg, l…). */
  readonly admiteFraccion: boolean;
}

/**
 * Qué puede hacer cada tipo. El utensilio YA NO se entrega: se PRESTA y
 * vuelve (§5.5). El uniforme se entrega (y se cobra). Insumos y «otros»
 * (limpieza, descartables) se usan en clase.
 */
export const COMPORTAMIENTO_POR_TIPO: Record<TipoDeArticulo, ComportamientoDeTipo> = {
  uniforme: {
    etiqueta: 'Uniforme',
    valuacion: 'promedio',
    admiteUso: false,
    admiteEntrega: true,
    admitePrestamo: false,
    controlaVencimiento: false,
    admitePrecioVenta: true,
    usaTallas: true,
    admiteFraccion: false,
  },
  utensilio: {
    etiqueta: 'Utensilio',
    valuacion: 'promedio',
    admiteUso: false,
    admiteEntrega: false,
    admitePrestamo: true,
    controlaVencimiento: false,
    admitePrecioVenta: false,
    usaTallas: false,
    admiteFraccion: false,
  },
  insumo: {
    etiqueta: 'Insumo',
    valuacion: 'peps',
    admiteUso: true,
    admiteEntrega: false,
    admitePrestamo: false,
    controlaVencimiento: true,
    admitePrecioVenta: false,
    usaTallas: false,
    admiteFraccion: true,
  },
  otro: {
    etiqueta: 'Otro',
    valuacion: 'promedio',
    admiteUso: true,
    admiteEntrega: false,
    admitePrestamo: false,
    controlaVencimiento: false,
    admitePrecioVenta: false,
    usaTallas: false,
    admiteFraccion: true,
  },
};

/** Unidades en las que tiene sentido «medio»: 0,5 kg sí; 0,5 chaquetas no. */
const UNIDADES_FRACCIONABLES: readonly Unidad[] = ['kg', 'g', 'l', 'ml'];

export function esUnidadFraccionable(unidad: Unidad): boolean {
  return UNIDADES_FRACCIONABLES.includes(unidad);
}

/** Lista cerrada de iconos del artículo (los dibuja `Icono.tsx`). */
export const ICONOS_DE_ARTICULO = [
  'trigo',
  'huevo',
  'lacteo',
  'torta',
  'copa',
  'plato',
  'chaqueta',
  'gorro',
  'cubiertos',
  'bol',
  'batidor',
  'almacen',
  'paquete',
] as const;

export type IconoDeArticulo = (typeof ICONOS_DE_ARTICULO)[number];

export interface Articulo {
  readonly id: Id;
  /** `INS-0001`, `UNI-0001`… lo pone la base. */
  readonly codigo?: string;
  readonly nombre: string;
  readonly tipo: TipoDeArticulo;
  /** Texto libre con sugerencias (D23). */
  readonly categoria?: string;
  readonly icono: IconoDeArticulo;
  readonly unidad: Unidad;
  /** Solo insumos: cada lote lleva fecha de vencimiento. */
  readonly controlaVencimiento: boolean;
  /** Por debajo de este valor el artículo aparece en el tablero (regla I9). Vale para cada sede. */
  readonly stockMinimo: Milesimas;
  /** Solo uniformes. Sin precio = «Precio por definir» (no se puede cobrar). */
  readonly precioVenta?: Centavos;
  readonly activo: boolean;
}

export type DatosDeArticulo = Omit<Articulo, 'id' | 'codigo'>;

/** Toda variante pertenece a un artículo; todo artículo tiene al menos una («Única»). */
export interface Variante {
  readonly id: Id;
  readonly articuloId: Id;
  /** «Única», «S», «M», «L», «XL». */
  readonly etiqueta: string;
  readonly orden?: number;
  readonly activa?: boolean;
}

export const ETIQUETA_DE_VARIANTE_UNICA = 'Única';

/** Un artículo admite decimales solo si su tipo lo permite Y su unidad es fraccionable. */
export function admiteCantidadFraccionaria(articulo: Pick<Articulo, 'tipo' | 'unidad'>): boolean {
  return COMPORTAMIENTO_POR_TIPO[articulo.tipo].admiteFraccion && esUnidadFraccionable(articulo.unidad);
}

export function validarArticulo(datos: DatosDeArticulo): Resultado<DatosDeArticulo, readonly string[]> {
  const errores: string[] = [];

  const nombre = textoObligatorio(datos.nombre, 'El nombre del artículo');
  if (!nombre.exito) errores.push(nombre.error);
  else if (nombre.valor.length > 80) errores.push('El nombre del artículo admite hasta 80 caracteres.');

  const comportamiento = COMPORTAMIENTO_POR_TIPO[datos.tipo] as ComportamientoDeTipo | undefined;
  if (!comportamiento) errores.push(`Tipo de artículo desconocido: "${datos.tipo}".`);
  if (!UNIDADES.includes(datos.unidad)) errores.push(`Unidad desconocida: "${datos.unidad}".`);
  if (!ICONOS_DE_ARTICULO.includes(datos.icono)) errores.push(`Icono desconocido: "${datos.icono}".`);

  const categoria = datos.categoria?.trim();
  if (categoria && categoria.length > 40) errores.push('La categoría admite hasta 40 caracteres.');

  if (comportamiento) {
    // Un uniforme en kilos o un utensilio en litros es un error de carga, no una
    // rareza que haya que soportar.
    if (!comportamiento.admiteFraccion && esUnidadFraccionable(datos.unidad)) {
      errores.push(`Un artículo de tipo "${comportamiento.etiqueta}" no se mide en ${datos.unidad}.`);
    }
    if (datos.controlaVencimiento && !comportamiento.controlaVencimiento) {
      errores.push('Solo los insumos controlan vencimiento.');
    }
    if (datos.precioVenta !== undefined && !comportamiento.admitePrecioVenta) {
      errores.push('Solo el uniforme tiene precio de venta.');
    }
  }

  if (datos.precioVenta !== undefined && (!Number.isSafeInteger(datos.precioVenta) || datos.precioVenta <= 0)) {
    errores.push('El precio de venta debe ser un importe en centavos mayor que cero.');
  }

  if (datos.stockMinimo < 0n) {
    errores.push('El stock mínimo no puede ser negativo.');
  } else if (datos.stockMinimo % 1000n !== 0n && !admiteCantidadFraccionaria(datos)) {
    errores.push('El stock mínimo de este artículo se cuenta en unidades enteras.');
  }

  if (errores.length > 0) return fallo(errores);
  return exito({
    ...datos,
    nombre: nombre.exito ? nombre.valor : datos.nombre,
    categoria: categoria || undefined,
  });
}

/**
 * Variantes al dar de alta (§3.6 `guardar_articulo`): un insumo tiene
 * exactamente una («Única»); sin etiquetas, el artículo queda con «Única»;
 * las tallas no se repiten (sin distinguir mayúsculas).
 */
export function validarVariantes(tipo: TipoDeArticulo, etiquetas: readonly string[]): Resultado<readonly string[], readonly string[]> {
  const limpias = etiquetas.map((e) => e.trim()).filter((e) => e.length > 0);
  if (limpias.length === 0) return exito([ETIQUETA_DE_VARIANTE_UNICA]);

  const errores: string[] = [];
  if (tipo === 'insumo' && limpias.length > 1) errores.push('Un insumo tiene una sola variante.');
  if (limpias.some((e) => e.length > 20)) errores.push('Cada talla o variante admite hasta 20 caracteres.');
  if (new Set(limpias.map((e) => e.toLowerCase())).size !== limpias.length) errores.push('Hay variantes repetidas.');

  return errores.length > 0 ? fallo(errores) : exito(limpias);
}
