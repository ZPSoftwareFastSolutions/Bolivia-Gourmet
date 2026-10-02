/**
 * CAPA: Domain / Shared
 *
 * Cantidades del inventario en MILÉSIMAS ENTERAS (enmiendas B.6).
 *
 * Por qué no `number` con decimales: `3 * 0.35 / 2.1` da `0.4999999999999999`
 * en JavaScript y `Math.round` lo lleva a 0, mientras PostgreSQL calcula 0,5
 * exacto y redondea a 1. Un costo que no coincide con la base al centavo es un
 * descuadre. Por eso la cantidad viaja como `bigint` de milésimas (2,5 kg =
 * 2500n), que es lo mismo que guarda la base (`numeric(12,3)`), y toda
 * proporción de costo se calcula con enteros.
 *
 * Sin React, sin Next, sin I/O.
 */

import { exito, fallo, type Branded, type Centavos, type Resultado } from './tipos-base';

/** Cantidad en milésimas de su unidad: 2,5 kg = 2500n; 3 chaquetas = 3000n. */
export type Milesimas = Branded<bigint, 'Milesimas'>;

/** Milésimas por unidad entera. */
export const ESCALA = 1000n;

/** `numeric(12,3)`: como mucho 9 cifras enteras. */
const MAXIMO = 999_999_999_999n;

export const CERO = 0n as Milesimas;

// ---------------------------------------------------------------- Unidades

export type Unidad = 'unidad' | 'kg' | 'g' | 'l' | 'ml' | 'paquete';

export const UNIDADES: readonly Unidad[] = ['unidad', 'kg', 'g', 'l', 'ml', 'paquete'];

/** Singular y plural de cada unidad tal como se lee en pantalla. */
const NOMBRE_DE_UNIDAD: Record<Unidad, { readonly uno: string; readonly varios: string }> = {
  unidad: { uno: 'unidad', varios: 'unidades' },
  kg: { uno: 'kg', varios: 'kg' },
  g: { uno: 'g', varios: 'g' },
  l: { uno: 'l', varios: 'l' },
  ml: { uno: 'ml', varios: 'ml' },
  paquete: { uno: 'paquete', varios: 'paquetes' },
};

// ---------------------------------------------------------------- Construir

/** Marca un `bigint` ya comprobado como milésimas. Uso interno del dominio. */
export function comoMilesimas(valor: bigint): Milesimas {
  return valor as Milesimas;
}

/** Piezas enteras a milésimas: 3 → 3000n. Falla si no es un entero no negativo. */
export function unidades(cantidad: number): Resultado<Milesimas> {
  if (!Number.isSafeInteger(cantidad) || cantidad < 0) {
    return fallo(`Se esperaba un número entero de piezas; se recibió ${cantidad}.`);
  }
  return exito((BigInt(cantidad) * ESCALA) as Milesimas);
}

/**
 * Lee lo que escribe una persona: «2,5», «2.5», «12», «0,333», « 3 ».
 *
 * Un solo separador decimal (coma o punto) y hasta 3 decimales. No se admiten
 * separadores de miles: «1.250» sería ambiguo (¿mil doscientos cincuenta o
 * uno coma veinticinco?) y se lee como 1,25. Más de 3 decimales es un error y
 * no se redondea en silencio: «0,3333 kg» casi siempre es un dedo de más.
 */
export function parsearCantidad(texto: string): Resultado<Milesimas> {
  const limpio = texto.trim();
  if (limpio.length === 0) return fallo('Escribe la cantidad.');
  if (limpio.startsWith('-')) return fallo('La cantidad no puede ser negativa.');

  const partes = /^(\d*)(?:[.,](\d*))?$/.exec(limpio);
  if (!partes) return fallo(`«${texto}» no es una cantidad. Escríbela con una coma decimal, por ejemplo 2,5.`);

  const enteros = partes[1] ?? '';
  const decimales = partes[2] ?? '';
  if (enteros.length === 0 && decimales.length === 0) {
    return fallo(`«${texto}» no es una cantidad. Escríbela con una coma decimal, por ejemplo 2,5.`);
  }
  if (decimales.length > 3) return fallo('La cantidad admite hasta 3 decimales.');

  const valor = BigInt(enteros.length > 0 ? enteros : '0') * ESCALA + BigInt(decimales.padEnd(3, '0'));
  if (valor > MAXIMO) return fallo('La cantidad es demasiado grande.');
  return exito(valor as Milesimas);
}

// ---------------------------------------------------------------- Consultar

/** Sin decimales: lo que exigen uniformes y utensilios. */
export function esEntera(cantidad: bigint): boolean {
  return cantidad % ESCALA === 0n;
}

export function menor(a: Milesimas, b: Milesimas): Milesimas {
  return a < b ? a : b;
}

export function sumar(...cantidades: readonly bigint[]): Milesimas {
  return cantidades.reduce((total, c) => total + c, 0n) as Milesimas;
}

// ---------------------------------------------------------------- Mostrar

/**
 * «12,5 kg», «20 kg», «0,333 kg», «1.250 unidades», «1 paquete». Coma
 * decimal, punto de miles (como `formatearMonto`), sin ceros decimales de
 * sobra. Admite valores negativos para las columnas «sale» del kárdex.
 */
export function formatearCantidad(cantidad: bigint, unidad?: Unidad): string {
  const negativo = cantidad < 0n;
  const absoluto = negativo ? -cantidad : cantidad;
  const enteros = (absoluto / ESCALA).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimales = (absoluto % ESCALA).toString().padStart(3, '0').replace(/0+$/, '');
  const numero = `${negativo ? '-' : ''}${enteros}${decimales.length > 0 ? `,${decimales}` : ''}`;
  if (!unidad) return numero;
  const nombre = NOMBRE_DE_UNIDAD[unidad];
  return `${numero} ${absoluto === ESCALA ? nombre.uno : nombre.varios}`;
}

// ---------------------------------------------------------------- Proporción exacta

/**
 * `round(v × t / c)` con la mitad hacia arriba, en enteros: `(2·v·t + c) / (2·c)`.
 * Es la misma cuenta que hace PostgreSQL con `round(v * t / c)` sobre
 * `numeric` (exacta). Exige `v ≥ 0`, `t ≥ 0` y `c > 0`.
 *
 * Ejemplo de la crítica 6: v = 3 c, t = 0,350, c = 2,100 → (2·3·350 + 2100) /
 * (2·2100) = 4200 / 4200 = 1 (con coma flotante daba 0).
 */
export function redondearProporcion(valor: bigint, tomado: bigint, total: bigint): bigint {
  if (total <= 0n) throw new RangeError('La proporción exige un total positivo.');
  if (valor < 0n || tomado < 0n) throw new RangeError('La proporción exige valores no negativos.');
  return (2n * valor * tomado + total) / (2n * total);
}

/** Centavos (enteros) a `bigint` para operar sin coma flotante. */
export function centavosABigInt(valor: Centavos): bigint {
  return BigInt(valor);
}

/** De vuelta a centavos; falla si el resultado no cabe en un entero seguro. */
export function bigIntACentavos(valor: bigint): Centavos {
  if (valor < 0n || valor > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(`Importe fuera de rango: ${valor.toString()} centavos.`);
  }
  return Number(valor) as Centavos;
}
