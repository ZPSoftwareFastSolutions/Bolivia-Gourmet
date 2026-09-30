/**
 * CAPA: Application / Ports
 *
 * Puerto de salida hacia el catálogo académico (programas y sedes).
 *
 * Se DECLARA aquí (donde se consume) y se IMPLEMENTA en `infrastructure`.
 * Hoy lo satisface un archivo estático versionado; cuando la oferta viva en
 * la base, lo satisfará un repositorio Supabase y ningún consumidor cambia.
 * Por eso ya es asíncrono.
 */

import type { Programa } from '../../domain/academico/programa';
import type { Sede } from '../../domain/shared/sede';

export interface CatalogoAcademicoPort {
  /** Programas activos e inactivos; quien publica filtra por `activo`. */
  listarProgramas(): Promise<readonly Programa[]>;
  /** `null` si el código no existe. Nunca lanza. */
  programaPorCodigo(codigo: string): Promise<Programa | null>;
  listarSedes(): Promise<readonly Sede[]>;
}
