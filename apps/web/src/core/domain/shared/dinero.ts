/**
 * CAPA: Domain / Shared
 *
 * Mostrar importes. Vive en `shared` porque lo usan la oferta académica, la
 * caja y la contabilidad; `academico/programa.ts` lo reexporta para que las
 * páginas que ya lo importan de allí no cambien.
 *
 * Sin React, sin Next, sin I/O.
 */

import { esPendiente, type Centavos, type Definido } from './tipos-base';

/** «Bs 650», «Bs 1.250,50» o «Consultar». Formato boliviano: punto de miles, coma decimal. */
export function formatearMonto(monto: Definido<Centavos>): string {
  if (esPendiente(monto)) return 'Consultar';
  const signo = monto < 0 ? '-' : '';
  const absoluto = Math.abs(monto);
  const bolivianos = Math.floor(absoluto / 100);
  const centavos = absoluto % 100;
  const miles = String(bolivianos).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return centavos === 0 ? `${signo}Bs ${miles}` : `${signo}Bs ${miles},${String(centavos).padStart(2, '0')}`;
}

/** Siempre con dos decimales, como en el recibo y el arqueo: «Bs 650,00». */
export function formatearMontoExacto(monto: Centavos): string {
  const signo = monto < 0 ? '-' : '';
  const absoluto = Math.abs(monto);
  const miles = String(Math.floor(absoluto / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${signo}Bs ${miles},${String(absoluto % 100).padStart(2, '0')}`;
}
