/**
 * CAPA: Domain / Inventario
 *
 * Artículo y variante (ADR 0003). El TIPO del artículo decide su
 * comportamiento; la CATEGORÍA es una clasificación libre del usuario y no
 * cambia nada. Añadir un tipo nuevo es añadir una fila a
 * `COMPORTAMIENTO_POR_TIPO`; el resto del dominio lo lee de ahí.
 *
 * Sin React, sin Next, sin I/O.
 */

import { exito, fallo, textoObligatorio, type Id, type Resultado } from '../shared/tipos-base';

export type TipoDeArticulo = 'utensilio' | 'insumo' | 'uniforme' | 'otro';

export const TIPOS_DE_ARTICULO: readonly TipoDeArticulo[] = ['uniforme', 'utensilio', 'insumo', 'otro'];

export interface ComportamientoDeTipo {
  readonly etiqueta: string;
  /** Puede salir del inventario hacia un estudiante inscrito (movimiento `entrega`). */
  readonly seEntregaAEstudiantes: boolean;
  /** Puede volver al inventario (movimiento `devolucion`). */
  readonly admiteDevolucion: boolean;
  /** Sus variantes son tallas. */
  readonly usaTallas: boolean;
  /** Admite cantidades con decimales si su unidad es fraccionable (kg, l…). */
  readonly admiteFraccion: boolean;
}

/**
 * Qué puede hacer cada tipo. «Utensilio se entrega y se devuelve» modela el
 * préstamo; si el cliente confirma que los utensilios no se prestan (P4),
 * se cambian dos booleanos aquí y nada más.
 */
export const COMPORTAMIENTO_POR_TIPO: Record<TipoDeArticulo, ComportamientoDeTipo> = {
  uniforme: {
    etiqueta: 'Uniforme',
    seEntregaAEstudiantes: true,
    admiteDevolucion: true,
    usaTallas: true,
    admiteFraccion: false,
  },
  utensilio: {
    etiqueta: 'Utensilio',
    seEntregaAEstudiantes: true,
    admiteDevolucion: true,
    usaTallas: false,
    admiteFraccion: false,
  },
  insumo: {
    etiqueta: 'Insumo',
    seEntregaAEstudiantes: false,
    admiteDevolucion: false,
    usaTallas: false,
    admiteFraccion: true,
  },
  otro: {
    etiqueta: 'Otro',
    seEntregaAEstudiantes: false,
    admiteDevolucion: false,
    usaTallas: false,
    admiteFraccion: false,
  },
};

export type Unidad = 'unidad' | 'kg' | 'g' | 'l' | 'ml' | 'paquete';

export const UNIDADES: readonly Unidad[] = ['unidad', 'kg', 'g', 'l', 'ml', 'paquete'];

/** Unidades en las que tiene sentido «medio»: 0,5 kg sí; 0,5 chaquetas no. */
const UNIDADES_FRACCIONABLES: readonly Unidad[] = ['kg', 'g', 'l', 'ml'];

export function esUnidadFraccionable(unidad: Unidad): boolean {
  return UNIDADES_FRACCIONABLES.includes(unidad);
}

export interface Articulo {
  readonly id: Id;
  readonly nombre: string;
  readonly descripcion?: string;
  readonly tipo: TipoDeArticulo;
  readonly categoriaId?: Id;
  readonly unidad: Unidad;
  /** Por debajo de este valor el artículo aparece en el tablero (regla I9). */
  readonly stockMinimo: number;
  readonly activo: boolean;
}

export type DatosDeArticulo = Omit<Articulo, 'id'>;

/** Toda variante pertenece a un artículo; todo artículo tiene al menos una («Única»). */
export interface Variante {
  readonly id: Id;
  readonly articuloId: Id;
  /** «Única», «S», «M», «L», «Bolsa 1 kg». */
  readonly etiqueta: string;
  readonly sku?: string;
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

  if (!(datos.tipo in COMPORTAMIENTO_POR_TIPO)) errores.push(`Tipo de artículo desconocido: "${datos.tipo}".`);
  if (!UNIDADES.includes(datos.unidad)) errores.push(`Unidad desconocida: "${datos.unidad}".`);

  // Un uniforme en kilos o un utensilio en litros es un error de carga, no una
  // rareza que haya que soportar.
  if (datos.tipo in COMPORTAMIENTO_POR_TIPO && !COMPORTAMIENTO_POR_TIPO[datos.tipo].admiteFraccion && esUnidadFraccionable(datos.unidad)) {
    errores.push(`Un artículo de tipo "${COMPORTAMIENTO_POR_TIPO[datos.tipo].etiqueta}" no se mide en ${datos.unidad}.`);
  }

  if (!Number.isFinite(datos.stockMinimo) || datos.stockMinimo < 0) {
    errores.push('El stock mínimo debe ser un número no negativo.');
  }

  if (errores.length > 0) return fallo(errores);
  return exito({ ...datos, nombre: nombre.exito ? nombre.valor : datos.nombre });
}
