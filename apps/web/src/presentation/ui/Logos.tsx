/**
 * CAPA: Presentation / UI (átomo)
 *
 * Los dos logotipos oficiales, siempre juntos como en todo el material
 * impreso (docs/brand §14). Reglas de uso:
 *   - Solo sobre fondo CLARO: las letras son negras y no hay versión en blanco.
 *   - Nunca deformados: la altura la fija la clase y el ancho sale de la
 *     proporción real (`w-auto` + atributos width/height para reservar espacio).
 *   - Tamaño de lectura: ~120 px de ancho desde `sm`; en teléfonos estrechos
 *     bajan lo justo para que la cabecera no desborde (320–375 px).
 */

import { cn } from '@/lib/cn';
import { TEXTO_ALTERNATIVO } from '@contenido/imagenes';
import { DIMENSIONES, type NombreDeImagen } from '@contenido/imagenes.generadas';

type TamanoDeLogos = 'cabecera' | 'pie' | 'portal';

/** Alturas por tamaño: [Bolivia Gastronómica, Corporación Bolivia Gourmet]. */
const ALTURAS: Record<TamanoDeLogos, readonly [string, string]> = {
  cabecera: ['h-10 sm:h-[50px]', 'h-[34px] sm:h-[43px]'],
  pie: ['h-12 sm:h-14', 'h-10 sm:h-12'],
  portal: ['h-9 sm:h-11', 'h-8 sm:h-[38px]'],
};

function Logo({ nombre, clase }: { readonly nombre: NombreDeImagen; readonly clase: string }) {
  const { ancho, alto } = DIMENSIONES[nombre];
  return (
    <img
      src={`/img/${nombre}-320.webp`}
      srcSet={`/img/${nombre}-320.webp 320w, /img/${nombre}-640.webp 640w`}
      sizes="160px"
      width={ancho}
      height={alto}
      alt={TEXTO_ALTERNATIVO[nombre]}
      decoding="async"
      className={cn('w-auto max-w-none', clase)}
    />
  );
}

export function Logos({ tamano = 'cabecera', className }: { readonly tamano?: TamanoDeLogos; readonly className?: string }) {
  const [gastronomica, gourmet] = ALTURAS[tamano];
  return (
    <span className={cn('flex items-center gap-2.5 sm:gap-5', className)}>
      <Logo nombre="logo-bolivia-gastronomica" clase={gastronomica} />
      <span aria-hidden="true" className="h-8 w-px bg-linea" />
      <Logo nombre="logo-bolivia-gourmet" clase={gourmet} />
    </span>
  );
}
