/**
 * CAPA: Presentation / UI (átomo)
 *
 * Logotipo de un socio o una universidad como celda de panal: el hexágono ya
 * viene horneado con el fondo del propio logotipo (`npm run imagenes`), así
 * que aquí no hay color por socio ni atributo `style` (CSP, ADR 0006). Con
 * `srcset` y dimensiones reales para reservar su espacio (CLS cero).
 */

import { cn } from '@/lib/cn';
import { LOGOS_DE_SOCIOS, type NombreDeLogo } from '@contenido/imagenes.generadas';

export function rutaDeLogo(logo: NombreDeLogo, ancho: number): string {
  return `/img/socio-${logo}-${ancho}.webp`;
}

export function LogoHexagonal({
  logo,
  alt,
  sizes,
  className,
  diferida = true,
}: {
  readonly logo: NombreDeLogo;
  /** Nombre del socio, o '' si el nombre ya está escrito al lado. */
  readonly alt: string;
  /** Ancho con que se mostrará, para que el navegador elija la variante justa. */
  readonly sizes: string;
  readonly className?: string;
  /** `false` en el carrusel: sus celdas entran por el costado y no deben aparecer vacías. */
  readonly diferida?: boolean;
}) {
  const { ancho, alto, anchos } = LOGOS_DE_SOCIOS[logo];
  return (
    <img
      src={rutaDeLogo(logo, anchos[0])}
      srcSet={anchos.map((a) => `${rutaDeLogo(logo, a)} ${a}w`).join(', ')}
      sizes={sizes}
      width={ancho}
      height={alto}
      alt={alt}
      loading={diferida ? 'lazy' : 'eager'}
      fetchPriority="low"
      decoding="async"
      draggable={false}
      className={cn('hex-sombra block h-auto w-full select-none', className)}
    />
  );
}
