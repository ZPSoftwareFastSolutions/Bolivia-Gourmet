/**
 * CAPA: Infrastructure / Supabase
 *
 * Piezas comunes de los adaptadores del panel.
 *
 * - `argsDe`: el generador de tipos marca TODOS los parámetros de una RPC como
 *   obligatorios aunque la función admita null (`p_estudiante`, `p_paquete`…).
 *   Se dice en un solo lugar en lugar de repartir conversiones por el código.
 * - `textoDeBusqueda`: lo que la persona escribe en un buscador, reducido a
 *   letras, números, espacios y guiones sin tildes, para usarlo en un filtro
 *   `ilike` sin que una coma o un paréntesis rompan la consulta.
 */

import 'server-only';
import type { Database } from './tipos-de-base.generados';

type Funciones = Database['public']['Functions'];

export type ArgsConNulos<F extends keyof Funciones> = {
  readonly [K in keyof Funciones[F]['Args']]: Funciones[F]['Args'][K] | null;
};

export function argsDe<F extends keyof Funciones>(args: ArgsConNulos<F>): Funciones[F]['Args'] {
  return args as unknown as Funciones[F]['Args'];
}

export function textoDeBusqueda(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

/** Lo que devuelve una RPC del panel: un objeto jsonb. */
export type ResultadoDeRpc = Readonly<Record<string, unknown>>;

export function comoObjeto(valor: unknown): ResultadoDeRpc {
  return valor && typeof valor === 'object' && !Array.isArray(valor) ? (valor as ResultadoDeRpc) : {};
}

export function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor : '';
}

export function numero(valor: unknown): number {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : 0;
}
