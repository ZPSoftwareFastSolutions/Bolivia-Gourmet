/**
 * Valores de marca que NO pueden ser variables CSS.
 *
 * `<meta name="theme-color">` (la barra del navegador en el móvil) exige un
 * color literal: no lee `var(--t-…)`. Es la única excepción a «ningún color
 * literal fuera de globals.css», y por eso vive aquí, sola y comentada. Debe
 * coincidir con `--marca-azul` de globals.css.
 */
export const COLOR_DE_TEMA = '#1f2447';
