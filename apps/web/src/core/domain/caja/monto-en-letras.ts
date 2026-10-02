/**
 * CAPA: Domain / Caja
 *
 * El monto en letras del recibo (§6.12): «seiscientos cincuenta 00/100
 * bolivianos». Español de Bolivia, en minúsculas, con los centavos como
 * fracción «NN/100», como en los recibos y facturas del país.
 *
 * Reglas que cuidan: «cien» pero «ciento uno»; «veintiuno» al final pero
 * «veintiún mil» y «un millón» delante de mil y de millón (apócope); «mil» y
 * no «un mil»; tildes de dieciséis, veintidós, veintitrés y veintiséis.
 *
 * Sin React, sin Next, sin I/O.
 */

import type { Centavos } from '../shared/tipos-base';

const UNIDADES_Y_DIECES = [
  'cero',
  'uno',
  'dos',
  'tres',
  'cuatro',
  'cinco',
  'seis',
  'siete',
  'ocho',
  'nueve',
  'diez',
  'once',
  'doce',
  'trece',
  'catorce',
  'quince',
  'dieciséis',
  'diecisiete',
  'dieciocho',
  'diecinueve',
  'veinte',
  'veintiuno',
  'veintidós',
  'veintitrés',
  'veinticuatro',
  'veinticinco',
  'veintiséis',
  'veintisiete',
  'veintiocho',
  'veintinueve',
];

const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];

const CENTENAS = [
  '',
  'ciento',
  'doscientos',
  'trescientos',
  'cuatrocientos',
  'quinientos',
  'seiscientos',
  'setecientos',
  'ochocientos',
  'novecientos',
];

/** 0 a 999. `apocope`: «uno» final se dice «un» (delante de mil o de millón). */
function hastaMil(n: number, apocope: boolean): string {
  if (n === 100) return 'cien';
  const centena = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (centena > 0) partes.push(CENTENAS[centena] ?? '');
  if (resto > 0) {
    let decenas: string;
    if (resto < 30) {
      decenas = UNIDADES_Y_DIECES[resto] ?? '';
    } else {
      const unidad = resto % 10;
      const decena = DECENAS[Math.floor(resto / 10)] ?? '';
      decenas = unidad === 0 ? decena : `${decena} y ${UNIDADES_Y_DIECES[unidad] ?? ''}`;
    }
    if (apocope) decenas = decenas.replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un');
    partes.push(decenas);
  }
  return partes.join(' ');
}

/** 0 a 999 999. */
function hastaMillon(n: number, apocope: boolean): string {
  const miles = Math.floor(n / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (miles === 1) partes.push('mil');
  else if (miles > 1) partes.push(`${hastaMil(miles, true)} mil`);
  if (resto > 0) partes.push(hastaMil(resto, apocope));
  return partes.join(' ');
}

/** Un entero no negativo en letras (hasta 999 999 999 999). */
export function enteroEnLetras(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0 || n > 999_999_999_999) {
    throw new RangeError(`No se puede escribir en letras: ${n}.`);
  }
  if (n === 0) return 'cero';
  const millones = Math.floor(n / 1_000_000);
  const resto = n % 1_000_000;
  const partes: string[] = [];
  if (millones === 1) partes.push('un millón');
  else if (millones > 1) partes.push(`${hastaMillon(millones, true)} millones`);
  if (resto > 0) partes.push(hastaMillon(resto, false));
  return partes.join(' ');
}

/** «seiscientos cincuenta 00/100 bolivianos»; «mil doscientos cincuenta 50/100 bolivianos». */
export function montoEnLetras(monto: Centavos): string {
  if (!Number.isSafeInteger(monto) || monto < 0) throw new RangeError(`Importe no válido: ${monto}.`);
  const bolivianos = Math.floor(monto / 100);
  const centavos = monto % 100;
  return `${enteroEnLetras(bolivianos)} ${String(centavos).padStart(2, '0')}/100 bolivianos`;
}
