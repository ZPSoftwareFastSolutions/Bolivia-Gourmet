/**
 * CAPA: Presentation / Sections (lógica de maquetación, sin JSX)
 *
 * Cómo se reparten los logotipos en las filas del panal. Vive aparte del
 * componente para poder probarlo: si mañana llega un socio más, una prueba
 * avisa de que las filas ya no suman el total en vez de dejarlo fuera en
 * silencio.
 */

/**
 * Filas del folleto (`Portada1 (5).jpg`): 4, 4 desplazada, 5, 4 desplazada.
 * Las desplazadas empiezan medio hexágono a la derecha, como en el impreso.
 */
export const FILAS_DEL_FOLLETO: readonly { readonly celdas: number; readonly desplazada: boolean }[] = [
  { celdas: 4, desplazada: false },
  { celdas: 4, desplazada: true },
  { celdas: 5, desplazada: false },
  { celdas: 4, desplazada: true },
];

/**
 * En el móvil caben tres hexágonos por fila: filas de 2 y 3 alternadas y
 * centradas, que es el panal clásico (la de 2 queda entre las de 3).
 */
export const FILAS_MOVILES: readonly number[] = [2, 3, 2, 3, 2, 3, 2];

/** Parte la lista en filas del tamaño indicado; lo que sobre va a una fila más. */
export function repartirEnFilas<T>(elementos: readonly T[], tamanos: readonly number[]): T[][] {
  const filas: T[][] = [];
  let inicio = 0;
  for (const tamano of tamanos) {
    if (inicio >= elementos.length) break;
    filas.push(elementos.slice(inicio, inicio + tamano));
    inicio += tamano;
  }
  if (inicio < elementos.length) filas.push(elementos.slice(inicio));
  return filas;
}

/**
 * Celdas del carrusel. La cinta alterna celdas arriba y abajo y se desplaza
 * la mitad de su largo en bucle. El periodo son SIEMPRE dos copias del
 * listado: así tiene un número par de celdas (con una sola copia y un número
 * impar de logotipos, cada uno cambiaría de fila al reiniciar) y mide lo
 * bastante para cubrir una pantalla ancha aunque haya pocos socios.
 */
export function celdasDelCarrusel<T>(elementos: readonly T[]): { readonly elemento: T; readonly copia: number }[] {
  const copias = 4;
  return Array.from({ length: copias }, (_, copia) => elementos.map((elemento) => ({ elemento, copia }))).flat();
}
