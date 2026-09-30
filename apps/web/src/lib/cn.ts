/**
 * Composición de clases sin dependencias externas.
 *
 * No se usa `tailwind-merge`: las variantes de los componentes se resuelven
 * con enums internos, no sobreescribiendo clases desde fuera. Regla derivada:
 * al pasar `className` a un componente no se envía una utilidad que compita
 * con las suyas (`hidden` sobre un `inline-flex` no lo oculta: gana la que
 * Tailwind emite más tarde en la hoja, no la última escrita).
 */
export type ClassValue = string | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}
