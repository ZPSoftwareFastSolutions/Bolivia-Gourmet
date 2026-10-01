/**
 * CAPA: Presentation / Patterns
 *
 * Redes sociales del instituto. Las que no tienen enlace confirmado
 * (Facebook y YouTube: aclaraciones §8) se muestran con su nombre para
 * buscarlas, nunca con un enlace adivinado que podría llevar a otra cuenta.
 */

import { INSTITUTO, type RedSocial } from '@contenido/instituto';
import { cn } from '@/lib/cn';
import { Icono } from '../icons/Icono';

export function RedesSociales({ tamano = 'md', conNombre = false, className }: { readonly tamano?: 'sm' | 'md'; readonly conNombre?: boolean; readonly className?: string }) {
  const redes: readonly RedSocial[] = INSTITUTO.redes;
  const icono = tamano === 'sm' ? 16 : 20;
  return (
    <ul className={cn('flex flex-wrap items-center', conNombre ? 'gap-x-6 gap-y-3' : 'gap-1', className)}>
      {redes.map((red) => {
        const contenido = (
          <>
            <Icono nombre={red.red} tamano={icono} />
            {conNombre ? (
              <span>
                <span className="sr-only">{red.etiqueta}: </span>
                {red.usuario}
              </span>
            ) : (
              <span className="sr-only">
                {red.etiqueta}: {red.usuario}
                {red.url ? '' : ' (búscanos con este nombre)'}
              </span>
            )}
          </>
        );
        const clases = cn('inline-flex items-center gap-2', conNombre ? 'min-h-11' : 'size-10 justify-center rounded-md');
        return (
          <li key={red.red}>
            {red.url ? (
              <a href={red.url} target="_blank" rel="noopener noreferrer" className={cn(clases, 'hover:text-accion')}>
                {contenido}
              </a>
            ) : (
              <span className={cn(clases, 'opacity-90')} title={`Búscanos en ${red.etiqueta} como «${red.usuario}»`}>
                {contenido}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
