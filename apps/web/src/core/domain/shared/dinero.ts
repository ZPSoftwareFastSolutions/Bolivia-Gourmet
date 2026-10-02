/**
 * CAPA: Domain / Shared
 *
 * Mostrar importes. Vive en `shared` porque lo usan la oferta académica, la
 * caja y la contabilidad; `academico/programa.ts` lo reexporta para que las
 * páginas que ya lo importan de allí no cambien.
 *
 * Sin React, sin Next, sin I/O.
 */

import { esPendiente, exito, fallo, type Centavos, type Definido, type Resultado } from './tipos-base';

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

const MAXIMO_EN_CENTAVOS = 100_000_000_00; // Bs 100 millones: ningún cobro real llega

/**
 * Lee lo que escribe una persona en un campo de monto y lo devuelve en
 * centavos enteros, sin coma flotante: «650», «Bs 650», «650,50», «1.250,50»,
 * «1250.5». Formato boliviano: punto de miles y coma decimal; si no hay coma,
 * un punto seguido de 1 o 2 cifras se toma como decimal. Cero o negativo, más
 * de dos decimales o letras sueltas son error.
 */
export function parsearMonto(texto: string): Resultado<Centavos> {
  const limpio = texto.replace(/bs\.?/gi, '').replace(/\s+/g, '');
  if (limpio === '') return fallo('Escribe el monto en bolivianos.');
  let entero: string;
  let decimales = '';
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(limpio) || /^\d+(,\d{1,2})?$/.test(limpio)) {
    const [e = '', d = ''] = limpio.split(',');
    entero = e.replace(/\./g, '');
    decimales = d;
  } else if (/^\d+\.\d{1,2}$/.test(limpio)) {
    const [e = '', d = ''] = limpio.split('.');
    entero = e;
    decimales = d;
  } else {
    return fallo('El monto solo admite números, con hasta dos decimales (por ejemplo 650 o 650,50).');
  }
  const centavos = Number.parseInt(entero, 10) * 100 + Number.parseInt(decimales.padEnd(2, '0') || '0', 10);
  if (!Number.isSafeInteger(centavos) || centavos <= 0) return fallo('El monto debe ser mayor que cero.');
  if (centavos > MAXIMO_EN_CENTAVOS) return fallo('El monto es demasiado grande. Revísalo.');
  return exito(centavos as Centavos);
}

/** Centavos como se escriben en un campo de monto: «650» o «650,50». */
export function montoParaCampo(monto: Centavos): string {
  const bolivianos = Math.floor(monto / 100);
  const centavos = monto % 100;
  return centavos === 0 ? String(bolivianos) : `${bolivianos},${String(centavos).padStart(2, '0')}`;
}
