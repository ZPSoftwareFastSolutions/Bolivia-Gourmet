'use client';

/**
 * CAPA: Presentation / Patterns (cliente)
 *
 * Navegación de escritorio. Es de cliente solo para marcar la sección activa
 * con `aria-current="page"` (WCAG: dónde estoy) sin leer la ruta en el
 * servidor, que obligaría a pasarla por todas las páginas.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAVEGACION } from '@/lib/rutas';
import { cn } from '@/lib/cn';

export function NavegacionPrincipal() {
  const ruta = usePathname();
  return (
    <nav aria-label="Principal" className="hidden xl:block">
      <ul className="flex items-center gap-1">
        {NAVEGACION.map((enlace) => {
          const activo = ruta === enlace.href || ruta.startsWith(`${enlace.href}/`);
          return (
            <li key={enlace.href}>
              <Link
                href={enlace.href}
                aria-current={activo ? 'page' : undefined}
                className={cn(
                  'relative inline-flex min-h-11 items-center rounded-md px-3 text-[0.92rem] font-semibold transition-colors duration-200',
                  activo ? 'text-estructural' : 'text-tinta hover:text-estructural hover:bg-superficie-alterna',
                )}
              >
                {enlace.etiqueta}
                {activo ? <span aria-hidden="true" className="absolute inset-x-3 bottom-1 h-1 rounded bg-accion" /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
