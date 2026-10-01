/**
 * CAPA: Presentation / UI (átomo)
 *
 * Fotografía oficial optimizada, con `srcset` y dimensiones reales para que el
 * navegador reserve su espacio desde el primer pintado (CLS cero).
 *
 * No se usa `next/image`: añade siempre un atributo `style`, que la CSP
 * estricta ignora y anota como violación (ADR 0006). Las variantes WebP las
 * genera `npm run imagenes` una vez y se versionan.
 */

import { cn } from '@/lib/cn';
import { TEXTO_ALTERNATIVO } from '@contenido/imagenes';
import { DIMENSIONES, type NombreDeImagen } from '@contenido/imagenes.generadas';

interface FotoProps {
  readonly nombre: NombreDeImagen;
  /** Ancho con que se mostrará, para que el navegador elija la variante justa. */
  readonly sizes: string;
  readonly className?: string;
  /** La imagen principal de la página (LCP): se pide primero y sin diferir. */
  readonly prioritaria?: boolean;
  /** Texto alternativo distinto del general, o '' si es decorativa en ese contexto. */
  readonly alt?: string;
  /** Llena su contenedor (posicionado) en vez de mantener su proporción. */
  readonly relleno?: boolean;
}

export function rutaDeImagen(nombre: NombreDeImagen, ancho: number): string {
  return `/img/${nombre}-${ancho}.webp`;
}

export function Foto({ nombre, sizes, className, prioritaria = false, alt, relleno = false }: FotoProps) {
  const { ancho, alto, anchos } = DIMENSIONES[nombre];
  const srcSet = anchos.map((a) => `${rutaDeImagen(nombre, a)} ${a}w`).join(', ');
  const mediana = anchos[Math.min(1, anchos.length - 1)] ?? anchos[0] ?? 480;

  return (
    <img
      src={rutaDeImagen(nombre, mediana)}
      srcSet={srcSet}
      sizes={sizes}
      width={ancho}
      height={alto}
      alt={alt ?? TEXTO_ALTERNATIVO[nombre]}
      loading={prioritaria ? 'eager' : 'lazy'}
      fetchPriority={prioritaria ? 'high' : 'auto'}
      decoding={prioritaria ? 'sync' : 'async'}
      className={cn(relleno ? 'absolute inset-0 size-full object-cover' : 'h-auto w-full object-cover', className)}
    />
  );
}
