/**
 * CAPA: Application / Ports
 *
 * Puerto de salida del inventario. Lo implementará un repositorio Supabase
 * creado POR PETICIÓN con el cliente que lleva la cookie de quien opera
 * (nunca `service_role`, ADR 0002). En pruebas lo satisface un doble en
 * memoria.
 *
 * Las escrituras devuelven `Resultado`: el repositorio traduce el error de la
 * base (RLS, CHECK de stock, clave foránea) a un mensaje legible, y nunca
 * deja llegar una excepción de Supabase a la interfaz.
 */

import type { Articulo, Variante } from '../../domain/inventario/articulo';
import type { DatosDeMovimiento, Movimiento } from '../../domain/inventario/movimiento';
import type { Id, Resultado } from '../../domain/shared/tipos-base';

export interface VarianteConArticulo {
  readonly variante: Variante;
  readonly articulo: Articulo;
}

export interface InventarioRepositoryPort {
  /** `null` si la variante no existe o no es visible para la sesión. */
  varianteConArticulo(varianteId: Id): Promise<VarianteConArticulo | null>;
  /** Existencia actual de la variante en la sede (0 si nunca tuvo movimientos). */
  stockDe(varianteId: Id, sedeId: Id): Promise<number>;
  /** Inserta el movimiento; la base repite las reglas de stock y permisos. */
  guardarMovimiento(datos: DatosDeMovimiento): Promise<Resultado<Movimiento>>;
}
