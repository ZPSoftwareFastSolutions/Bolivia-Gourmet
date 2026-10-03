/**
 * CAPA: Infrastructure / Supabase
 *
 * Cantidades entre la base y el dominio. PostgreSQL devuelve `numeric(12,3)`
 * como número JSON (o texto); el dominio trabaja en milésimas enteras; las
 * RPC leen texto con punto decimal (`app.leer_cantidad`). Sin `server-only`
 * para poder probarlo con `node --test`.
 */

import type { Milesimas } from '@core/domain/shared/cantidad';

/** `numeric` de PostgreSQL (número o texto) → milésimas enteras. */
export function milesimasDe(valor: unknown): Milesimas {
  if (typeof valor === 'number' && Number.isFinite(valor)) return BigInt(Math.round(valor * 1000)) as Milesimas;
  if (typeof valor === 'string' && /^-?\d+(\.\d+)?$/.test(valor.trim())) {
    const [enteros = '0', decimales = ''] = valor.trim().replace('-', '').split('.');
    const absoluto = BigInt(enteros) * 1000n + BigInt(decimales.slice(0, 3).padEnd(3, '0'));
    return (valor.trim().startsWith('-') ? -absoluto : absoluto) as Milesimas;
  }
  return 0n as Milesimas;
}

/** Milésimas → texto para la base: «2.5», «12», «0.333». */
export function cantidadParaLaBase(cantidad: bigint): string {
  const negativo = cantidad < 0n;
  const absoluto = negativo ? -cantidad : cantidad;
  const decimales = (absoluto % 1000n).toString().padStart(3, '0').replace(/0+$/, '');
  return `${negativo ? '-' : ''}${absoluto / 1000n}${decimales.length > 0 ? `.${decimales}` : ''}`;
}
