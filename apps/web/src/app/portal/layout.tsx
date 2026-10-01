/**
 * CAPA: Presentation / App — layout del portal de estudiantes.
 *
 * Más sobrio que el sitio público (operatividad antes que decoración): los
 * logotipos, un regreso claro al sitio y el contenido. La sesión no se lee
 * aquí: cada página decide si la exige.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { RUTAS } from '@/lib/rutas';
import { INSTITUTO } from '@contenido/instituto';
import { Icono } from '@/presentation/icons/Icono';
import { Logos } from '@ui/Logos';

export const metadata: Metadata = {
  title: { default: 'Portal de estudiantes', template: `%s · Portal · ${INSTITUTO.nombreCorto}` },
  robots: { index: false, follow: false },
};

export default function LayoutDelPortal({ children }: { readonly children: ReactNode }) {
  return (
    <>
      <header className="border-b border-linea bg-superficie">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accion focus:px-4 focus:py-3 focus:font-semibold focus:text-sobre-accion"
        >
          Saltar al contenido
        </a>
        <span className="franja-tricolor w-full rounded-none" aria-hidden="true" />
        <div className="shell flex min-h-18 items-center justify-between gap-4 py-3">
          <Link href={RUTAS.inicio} aria-label={`${INSTITUTO.nombreComercial}: ir al sitio`} className="flex-none">
            <Logos tamano="portal" />
          </Link>
          <Link href={RUTAS.inicio} className="hidden min-h-11 items-center gap-2 rounded-md px-3 font-semibold text-estructural hover:bg-superficie-alterna sm:inline-flex">
            <Icono nombre="flechaIzquierda" tamano={18} />
            Volver al sitio
          </Link>
        </div>
      </header>
      <main id="contenido" className="flex-1 bg-superficie-alterna">
        {children}
      </main>
      <footer className="border-t border-linea bg-superficie">
        <div className="shell flex flex-col items-center justify-between gap-2 py-5 text-sm text-tinta-suave sm:flex-row">
          <p>
            Portal de estudiantes · {INSTITUTO.nombreComercial} · {INSTITUTO.institucionMadre.sigla}
          </p>
          <Link href={RUTAS.privacidad} className="enlace">
            Aviso de privacidad
          </Link>
        </div>
      </footer>
    </>
  );
}
