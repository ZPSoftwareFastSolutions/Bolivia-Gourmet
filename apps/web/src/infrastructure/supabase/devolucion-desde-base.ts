/**
 * CAPA: Infrastructure / Supabase
 *
 * Lectura de lo que devuelve `devolver_uniforme` (jsonb) hacia la forma del
 * puerto de inventario: qué pasó con el cargo del uniforme (enmiendas B.12,
 * crítica 14). Función pura y sin `server-only` para poder probarla con
 * `node --test` (como `contabilidad-desde-base.ts`).
 *
 * La base responde `cargo: {id, monto, anulado} | null` y `aviso:
 * 'anula_el_cobro' | 'devolucion_parcial' | null`; el reenvío de un
 * formulario trae la misma respuesta guardada. Es defensiva a propósito: si
 * falta el id, el monto no es un entero positivo de centavos o el aviso no es
 * uno de los que conoce, no inventa un estado y deja `cargo: null` (la
 * pantalla confirma la devolución sin hablar del cargo).
 */

import type { Centavos, Id } from '@core/domain/shared/tipos-base';
import type { CargoDeLaDevolucion, DevolucionHecha } from '@core/application/ports/inventario.port';

type Objeto = Readonly<Record<string, unknown>>;

function objeto(valor: unknown): Objeto | null {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Objeto) : null;
}

function cargoDesdeBase(respuesta: Objeto | null): CargoDeLaDevolucion | null {
  const cargo = objeto(respuesta?.cargo);
  if (!cargo) return null;
  const { id, monto } = cargo;
  if (typeof id !== 'string' || id === '' || typeof monto !== 'number' || !Number.isSafeInteger(monto) || monto <= 0) return null;
  const base = { cargoId: id as Id, monto: monto as Centavos };
  if (cargo.anulado === true) return { ...base, estado: 'anulado' };
  if (respuesta?.aviso === 'anula_el_cobro') return { ...base, estado: 'cobrado' };
  if (respuesta?.aviso === 'devolucion_parcial') return { ...base, estado: 'parcial' };
  return null;
}

export function devolucionDesdeBase(datos: unknown): DevolucionHecha {
  return { cargo: cargoDesdeBase(objeto(datos)) };
}
