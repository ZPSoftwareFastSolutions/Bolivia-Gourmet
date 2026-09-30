/**
 * CAPA: Application / Inventario
 *
 * Caso de uso: registrar un movimiento de inventario.
 *
 * Orquesta, no decide: trae el artículo por el puerto, deja que el dominio
 * valide (`validarMovimiento`) y compruebe la existencia
 * (`aplicarMovimiento`), y solo entonces guarda. Si una regla falla, no toca
 * el repositorio. No conoce React, Next ni Supabase.
 */

import { aplicarMovimiento, validarMovimiento, type DatosDeMovimiento, type Movimiento } from '../../domain/inventario/movimiento';
import { exito, fallo, type Resultado } from '../../domain/shared/tipos-base';
import type { InventarioRepositoryPort } from '../ports/inventario-repository.port';

export interface MovimientoRegistrado {
  readonly movimiento: Movimiento;
  /** Existencia de la variante en la sede tras el movimiento. */
  readonly stockResultante: number;
}

export async function registrarMovimiento(
  repositorio: InventarioRepositoryPort,
  datos: DatosDeMovimiento,
): Promise<Resultado<MovimientoRegistrado, readonly string[]>> {
  const encontrado = await repositorio.varianteConArticulo(datos.varianteId);
  if (!encontrado) return fallo(['La variante indicada no existe.']);

  const validacion = validarMovimiento(datos, encontrado.articulo);
  if (!validacion.exito) return validacion;

  const stockActual = await repositorio.stockDe(datos.varianteId, datos.sedeId);
  const aplicado = aplicarMovimiento(stockActual, datos);
  if (!aplicado.exito) return fallo([aplicado.error]);

  const guardado = await repositorio.guardarMovimiento(validacion.valor);
  if (!guardado.exito) return fallo([guardado.error]);

  return exito({ movimiento: guardado.valor, stockResultante: aplicado.valor });
}
