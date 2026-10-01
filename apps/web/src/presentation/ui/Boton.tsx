/**
 * CAPA: Presentation / UI (átomo)
 *
 * Botón y enlace-botón. No conoce el dominio. Variantes como ENUM, nunca
 * booleanos combinables (2^n estados sin sentido).
 *
 * Reglas de la skill ui-ux-pro-max aplicadas: área táctil mínima de 44 px,
 * cursor de mano, transición de 150–300 ms, foco visible heredado de la base.
 * El amarillo SIEMPRE lleva azul marino encima (contraste 9.5:1).
 */

import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icono, type NombreDeIcono } from '../icons/Icono';

export type VarianteDeBoton = 'primario' | 'secundario' | 'contorno' | 'cursos' | 'claro' | 'fantasma' | 'peligro';
export type TamanoDeBoton = 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap select-none ' +
  'transition-[background-color,border-color,color,transform,box-shadow] duration-200 ease-out ' +
  'active:translate-y-px disabled:pointer-events-none disabled:opacity-50';

const VARIANTES: Record<VarianteDeBoton, string> = {
  primario: 'bg-accion text-sobre-accion hover:bg-accion-fuerte shadow-[0_6px_16px_-8px_var(--t-estructural)]',
  secundario: 'bg-estructural text-sobre-estructural hover:bg-estructural-profundo',
  contorno: 'border-2 border-estructural text-estructural hover:bg-estructural hover:text-sobre-estructural',
  cursos: 'bg-cursos text-sobre-cursos hover:bg-cursos-profundo',
  claro: 'bg-tarjeta text-estructural hover:bg-superficie-alterna',
  fantasma: 'text-estructural hover:bg-superficie-alterna',
  peligro: 'border-2 border-peligro text-peligro hover:bg-peligro hover:text-sobre-estructural',
};

const TAMANOS: Record<TamanoDeBoton, string> = {
  sm: 'min-h-10 px-4 text-sm',
  md: 'min-h-11 px-5 text-[0.95rem]',
  lg: 'min-h-13 px-7 text-base',
};

interface PropsComunes {
  readonly variante?: VarianteDeBoton;
  readonly tamano?: TamanoDeBoton;
  readonly icono?: NombreDeIcono;
  readonly iconoAlFinal?: boolean;
  readonly anchoCompleto?: boolean;
  readonly className?: string;
  readonly children: ReactNode;
}

function clases({ variante = 'primario', tamano = 'md', anchoCompleto, className }: PropsComunes): string {
  return cn(BASE, VARIANTES[variante], TAMANOS[tamano], anchoCompleto && 'w-full', className);
}

function Contenido({ icono, iconoAlFinal, children }: PropsComunes) {
  return (
    <>
      {icono && !iconoAlFinal ? <Icono nombre={icono} tamano={20} /> : null}
      <span>{children}</span>
      {icono && iconoAlFinal ? <Icono nombre={icono} tamano={20} /> : null}
    </>
  );
}

type BotonProps = PropsComunes & Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof PropsComunes | 'style'>;

export function Boton(props: BotonProps) {
  const { variante, tamano, icono, iconoAlFinal, anchoCompleto, className, children, type = 'button', ...resto } = props;
  return (
    <button type={type} className={clases(props)} {...resto}>
      <Contenido icono={icono} iconoAlFinal={iconoAlFinal}>
        {children}
      </Contenido>
    </button>
  );
}

type EnlaceBotonProps = PropsComunes & {
  readonly href: string;
  /** Abre en otra pestaña con `noopener noreferrer`. */
  readonly externo?: boolean;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof PropsComunes | 'href' | 'style'>;

export function EnlaceBoton(props: EnlaceBotonProps) {
  const { href, externo, variante, tamano, icono, iconoAlFinal, anchoCompleto, className, children, ...resto } = props;
  const contenido = (
    <Contenido icono={icono} iconoAlFinal={iconoAlFinal}>
      {children}
    </Contenido>
  );

  if (externo) {
    return (
      // `noopener` impide que el destino manipule `window.opener`; `noreferrer`
      // no filtra la URL de origen.
      <a href={href} target="_blank" rel="noopener noreferrer" className={clases(props)} {...resto}>
        {contenido}
      </a>
    );
  }
  return (
    <Link href={href} className={clases(props)} {...resto}>
      {contenido}
    </Link>
  );
}
